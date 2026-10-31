'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { exporterEnJpg } from '@/lib/carte-meteo/ExportJpg';
import { LOGOS_PRESETS } from '@/lib/carte-meteo/logos';
import type { ReponseBilans } from '@/lib/carte-meteo/cartes-info';
import { ajusterVue, unirBoites, versEcran, versMonde } from '@/lib/carte-meteo/projection-france';
import { FICHIERS_CONTOURS, normaliser, useContours } from './CarteMeteo';

const LARGEUR = 1600;
const HAUTEUR = 860;
const CARTE = { gauche: 30, haut: 40, droite: 570, bas: HAUTEUR - 110 };
const POLICE = "'Lato', 'Segoe UI', Arial, sans-serif";

/** Villes du bilan (département 66) : le nom cherché dans celui de la station. */
const VILLES = [
  { nom: 'Perpignan', cherche: 'PERPIGNAN' },
];
const DEPARTEMENT = '66';
/** Fond de carte : le département seul, pour qu'il remplisse le cadre. */
const CODES_CARTE = [DEPARTEMENT];

type Type = 'temp' | 'pluie' | 'soleil';
type Affichage = Type | 'tous';
interface Ligne {
  nom: string;
  mesure: number;
  normale: number | null;
  ecart: number;
  /** Bilan de la ligne (utile quand les trois sont affichés ensemble). */
  type: Type;
}

const FONDS: Record<Type, { fond: string; carte: string; case: string; titre: string; unite: string; ecartTexte: string; libelles: [string, string]; tuile: string; surTuile: string }> = {
  temp: {
    fond: 'linear-gradient(135deg, #b9a98d 0%, #6b4a2e 45%, #3a2415 100%)',
    carte: '#fff1d6',
    case: 'rgba(48,27,14,0.78)',
    titre: 'BILAN DES TEMPÉRATURES',
    unite: '°C',
    ecartTexte: '#e8883a',
    libelles: ['Moyenne', 'Normales'],
    tuile: '#fff',
    surTuile: '#e8883a',
  },
  pluie: {
    fond: 'linear-gradient(135deg, #3d5a3a 0%, #17301c 50%, #0b1a0f 100%)',
    carte: '#e2ecd9',
    case: 'rgba(8,20,10,0.78)',
    titre: 'BILAN DE LA PLUVIOMÉTRIE',
    unite: ' mm',
    ecartTexte: '#e8883a',
    libelles: ['Relevés', 'Normales'],
    tuile: '#fff',
    surTuile: '#e8883a',
  },
  soleil: {
    fond: 'linear-gradient(135deg, #1f3f94 0%, #2c5d9a 55%, #2a5183 100%)',
    carte: '#fff1d6',
    case: 'rgba(8,38,100,0.78)',
    titre: 'BILAN DE L’ENSOLEILLEMENT',
    unite: ' h',
    ecartTexte: '#1a3a8f',
    libelles: ['Relevés', 'Normales'],
    tuile: '#fff',
    surTuile: '#1a3a8f',
  },
};

const TITRES_LIGNE: Record<Type, string> = { temp: 'Températures', pluie: 'Pluviométrie', soleil: 'Ensoleillement' };

const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
/** « octobre 2026 » pour « 2026-10 » (extremes-mois.ts est réservé au serveur). */
const libelleMois = (mois: string) => `${NOMS_MOIS[Number(mois.slice(5, 7)) - 1]} ${mois.slice(0, 4)}`;

const sansTiret = (nom: string) => normaliser(nom).toUpperCase().replace(/[^A-Z]/g, '');

const signe = (v: number, decimales: number, suffixe: string) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(decimales)}${suffixe}`;

export default function BilanMoisPlanche() {
  const [bilans, setBilans] = useState<ReponseBilans | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [mois, setMois] = useState<string | null>(null);
  const [type, setType] = useState<Affichage>('tous');
  const [logoId, setLogoId] = useState('alertesmeteo');
  const [facteur, setFacteur] = useState(1);
  const [enExport, setEnExport] = useState(false);
  const colonne = useRef<HTMLDivElement>(null);
  const planche = useRef<HTMLDivElement>(null);
  const contours = useContours(FICHIERS_CONTOURS.departements);

  useEffect(() => {
    let actif = true;
    setBilans(null);
    setErreur(null);
    fetch(`/api/carte-meteo/bilans/${mois ? `?mois=${mois}` : ''}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? 'Observations momentanément indisponibles.');
        return r.json() as Promise<ReponseBilans>;
      })
      .then((b) => actif && setBilans(b))
      .catch((e: Error) => actif && setErreur(e.message));
    return () => {
      actif = false;
    };
  }, [mois]);

  useEffect(() => {
    const c = colonne.current;
    if (!c) return;
    const o = new ResizeObserver(() => setFacteur(Math.min(1, c.clientWidth / LARGEUR)));
    o.observe(c);
    return () => o.disconnect();
  }, []);

  const moisAffiche = bilans?.mois?.affiche ?? mois ?? '';
  const prete = !!bilans?.mois;

  /** Station de chaque ville et valeur d'une carte du mois. */
  const lire = useMemo(() => {
    if (!bilans) return null;
    const stations = VILLES.map((v) => {
      const i = bilans.stations.findIndex((s) => s[2] === DEPARTEMENT && sansTiret(s[1]).includes(v.cherche));
      return { ...v, i, station: i >= 0 ? bilans.stations[i] : null };
    });
    const valeur = (carte: string, i: number) => bilans.cartes[carte]?.valeurs.find(([k]) => k === i)?.[1] ?? null;
    return { stations, valeur };
  }, [bilans]);

  const lignes: Ligne[] = useMemo(() => {
    if (!lire) return [];
    const ligneDe = (nom: string, i: number, t: Type): Ligne | null => {
      const v = (c: string) => lire.valeur(c, i);
      if (t === 'temp') {
        const [tx, tn, ntx, ntn] = [v('txm-mois'), v('tnm-mois'), v('ntx-mois'), v('ntn-mois')];
        if (tx == null || tn == null) return null;
        const mesure = (tx + tn) / 2;
        const ecart = ntx != null && ntn != null ? (ntx + ntn) / 2 : null;
        return ecart == null ? null : { nom, type: t, mesure, ecart, normale: mesure - ecart };
      }
      const [m, e] = t === 'pluie' ? [v('rr-mois'), v('nrr-mois')] : [v('insol-mois'), v('ninsol-mois')];
      if (m == null || e == null) return null;
      return { nom, type: t, mesure: m, ecart: e, normale: 1 + e / 100 > 0.01 ? m / (1 + e / 100) : null };
    };
    if (type === 'tous') {
      const s = lire.stations.find((x) => x.i >= 0);
      if (!s) return [];
      return (['temp', 'pluie', 'soleil'] as Type[]).map((t) => ligneDe(TITRES_LIGNE[t], s.i, t)).filter((l): l is Ligne => l != null);
    }
    return lire.stations.flatMap((s) => (s.i < 0 ? [] : [ligneDe(s.nom, s.i, type)])).filter((l): l is Ligne => l != null);
  }, [lire, type]);

  const vue = useMemo(() => {
    const boite = unirBoites(contours.filter((c) => CODES_CARTE.includes(c.code)).map((c) => c.boite));
    return boite ? ajusterVue(boite, CARTE, 0.02) : null;
  }, [contours]);

  const style = FONDS[type === 'tous' ? 'temp' : type];
  const decimales = type === 'temp' ? 1 : 1;
  const logo = LOGOS_PRESETS.find((l) => l.id === logoId);
  const periode = bilans?.cartes['rr-mois']?.fenetre.split(' · ')[0] ?? '';

  const exporter = async () => {
    if (!planche.current) return;
    setEnExport(true);
    try {
      await exporterEnJpg(planche.current, `bilan-${type === 'tous' ? 'complet' : type === 'temp' ? 'temperatures' : type === 'pluie' ? 'pluviometrie' : 'ensoleillement'}-${moisAffiche}-pyrenees-orientales`, LARGEUR, HAUTEUR);
    } catch (e) {
      console.error('Export du bilan en JPG', e);
      setErreur("L'export a échoué. Réessayez dans un instant.");
    } finally {
      setEnExport(false);
    }
  };

  const bouton = (actif: boolean) => `rounded-full border px-4 py-1.5 text-sm font-semibold ${actif ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`;
  const selectBarre = 'rounded-lg border border-border bg-surface p-1.5 text-sm';

  return (
    <>
      <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl border border-border bg-surface p-4">
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Bilan</legend>
          <div className="flex flex-wrap gap-2">
            {([['tous', '📊 Les trois'], ['temp', '🌡️ Températures'], ['pluie', '🌧️ Pluviométrie'], ['soleil', '☀️ Ensoleillement']] as [Affichage, string][]).map(([id, l]) => (
              <button key={id} type="button" aria-pressed={type === id} className={bouton(type === id)} onClick={() => setType(id)}>
                {l}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="text-sm font-medium">
          <span className="mb-1 block">Mois</span>
          <select value={moisAffiche} onChange={(e) => setMois(e.target.value)} className={selectBarre}>
            {(bilans?.mois?.disponibles ?? (moisAffiche ? [moisAffiche] : [])).map((m) => (
              <option key={m} value={m}>
                {libelleMois(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          <span className="mb-1 block">Logo</span>
          <select value={logoId} onChange={(e) => setLogoId(e.target.value)} className={selectBarre}>
            {LOGOS_PRESETS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nom}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={exporter} disabled={enExport || !bilans || lignes.length === 0} className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {enExport ? 'Export en cours…' : 'Exporter en JPG'}
        </button>
      </div>
      {erreur && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {erreur}
        </p>
      )}
      {bilans && lignes.length === 0 && <p className="mt-3 text-sm text-muted">Aucune des trois stations n&apos;a de valeur pour ce bilan et ce mois.</p>}

      <div ref={colonne} className="mt-4 min-w-0">
        <div style={{ height: HAUTEUR * facteur }}>
          <div ref={planche} style={{ width: LARGEUR, height: HAUTEUR, transform: `scale(${facteur})`, transformOrigin: 'top left', background: style.fond, color: '#fff', fontFamily: POLICE, position: 'relative', overflow: 'hidden' }}>
            <svg width={LARGEUR} height={HAUTEUR} style={{ position: 'absolute', left: 0, top: 0 }}>
              {vue && (
                <g transform={`translate(${vue.tx} ${vue.ty}) scale(${vue.echelle})`}>
                  {contours
                    .filter((c) => CODES_CARTE.includes(c.code))
                    .sort((a, b) => Number(a.code === DEPARTEMENT) - Number(b.code === DEPARTEMENT))
                    .map((c) => (
                      <path
                        key={c.code}
                        d={c.d}
                        fill={c.code === DEPARTEMENT ? style.carte : 'rgba(255,255,255,0.2)'}
                        stroke={c.code === DEPARTEMENT ? 'rgba(80,60,40,0.5)' : 'rgba(255,255,255,0.4)'}
                        strokeWidth={1 / vue.echelle}
                        style={c.code === DEPARTEMENT ? { filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.4))' } : undefined}
                      />
                    ))}
                </g>
              )}
              {vue &&
                lire?.stations
                  .filter((s) => s.station && (type === 'tous' ? lignes.length > 0 : lignes.some((l) => l.nom === s.nom)))
                  .map((s) => {
                    const p = versEcran(versMonde(s.station![3], s.station![4]), vue);
                    return (
                      <g key={s.nom}>
                        <circle cx={p.x} cy={p.y} r={5} fill="#3a1f0f" />
                        <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize={20} fontWeight={700} fill="#3a1f0f" stroke="rgba(255,255,255,0.85)" strokeWidth={4} paintOrder="stroke">
                          {s.nom.toUpperCase()}
                        </text>
                      </g>
                    );
                  })}
            </svg>

            <div style={{ position: 'absolute', left: 610, right: 40, top: 28 }}>
              <div style={{ fontSize: 50, fontWeight: 800, textAlign: 'right', letterSpacing: 0.5, textShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>
                {type === 'tous' ? 'BILAN DU MOIS' : style.titre}{prete ? ` - ${libelleMois(moisAffiche).toUpperCase()}` : ''}
              </div>
              <div style={{ height: 3, background: '#fff', width: 270, marginLeft: 'auto', marginTop: 14 }} />
              <div style={{ fontSize: 20, textAlign: 'right', opacity: 0.85, marginTop: 8 }}>Pyrénées-Orientales{periode ? ` · ${periode}` : ''}</div>
            </div>

            <div style={{ position: 'absolute', left: 610, right: 40, top: 190, display: 'flex', flexDirection: 'column', gap: 24 }}>
              {lignes.map((l) => {
                const sl = FONDS[l.type];
                return (
                <div key={l.nom} style={{ display: 'flex', gap: 22, height: 170 }}>
                  <div style={{ width: 270, background: sl.case, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 31, fontWeight: 700, textAlign: 'center', padding: 10 }}>{l.nom.toUpperCase()}</div>
                  <div style={{ flex: 1, background: sl.case, borderRadius: 22, display: 'flex', alignItems: 'center', position: 'relative', paddingRight: 0, overflow: 'hidden' }}>
                    {[
                      [l.mesure, sl.libelles[0]],
                      [l.normale, sl.libelles[1]],
                    ].map(([v, lib], k) => (
                      <div key={k} style={{ width: 215, textAlign: 'center', borderLeft: k ? '2px solid rgba(255,255,255,0.3)' : undefined, margin: 0 }}>
                        <div style={{ fontSize: 42, fontWeight: 700 }}>{v == null ? '—' : `${(v as number).toFixed(decimales)}${sl.unite}`}</div>
                        <div style={{ fontSize: 22, fontStyle: 'italic', marginTop: 6 }}>{lib as string}</div>
                      </div>
                    ))}
                    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 205, background: sl.tuile, color: sl.surTuile, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 46, fontWeight: 800 }}>
                      {l.type === 'temp' ? signe(l.ecart, 1, '°C') : signe(Math.round(l.ecart), 0, ' %')}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            <div style={{ position: 'absolute', left: 40, right: 40, bottom: 22, borderTop: '2px solid rgba(255,255,255,0.8)', paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 20 }}>
              {logo?.fichier ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo.fichier} alt="" style={{ height: 52, background: logo.fondBlanc === false ? 'transparent' : '#fff', borderRadius: 8 }} />
              ) : (
                <span />
              )}
              <span>Relevés Météo-France · normales 1991-2020 · www.alertes-meteo.com</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
