'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { exporterEnJpg } from '@/lib/carte-meteo/ExportJpg';
import { LOGOS_PRESETS } from '@/lib/carte-meteo/logos';
import type { ReponseBilans } from '@/lib/carte-meteo/cartes-info';
import type { ReponseHistorique } from '@/app/api/carte-meteo/bilan-historique/route';
import { ajusterVue, unirBoites, versEcran, versMonde } from '@/lib/carte-meteo/projection-france';
import { FICHIERS_CONTOURS, normaliser, useContours } from './CarteMeteo';
import TexteSurCarte from './TexteSurCarte';

/** Formats de la planche (pixels de conception, l'export les agrandit) : paysage, 16:9 (YouTube), carré, 4:5 (Facebook), 9:16 (TikTok). */
const FORMATS = {
  paysage: { libelle: '🖼️ Paysage', l: 1600, h: 860, vertical: false, ligne: 170 },
  youtube: { libelle: '▶️ YouTube 16:9', l: 1600, h: 900, vertical: false, ligne: 170 },
  carre: { libelle: '⬜ Carré 1:1', l: 1080, h: 1080, vertical: true, ligne: 130 },
  facebook: { libelle: '👍 Facebook 4:5', l: 1080, h: 1350, vertical: true, ligne: 170 },
  tiktok: { libelle: '📱 TikTok 9:16', l: 1080, h: 1920, vertical: true, ligne: 170 },
} as const;
type FormatPlanche = keyof typeof FORMATS;
const ECART_LIGNES = 24;
/** Hauteur d'une ligne de la table des records des 12 mois. */
const HAUTEUR_TABLE = 36;
/** Table « Records du mois » : en-tête, hauteur d'une ligne et écart. */
const HAUTEUR_ENTETE_REC = 40;
const HAUTEUR_REC = 108;
const ECART_REC = 14;
const POLICE = "'Lato', 'Segoe UI', Arial, sans-serif";

/** Villes du bilan (département 66) : le nom cherché dans celui de la station. */
const VILLES = [
  { nom: 'Perpignan', cherche: 'PERPIGNAN' },
];
const DEPARTEMENT = '66';
/** Fond de carte : le département seul, pour qu'il remplisse le cadre. */
const CODES_CARTE = [DEPARTEMENT];

type Type = 'temp' | 'pluie' | 'soleil' | 'chaud' | 'froid';
type Affichage = Type | 'tous' | 'records' | 'annee';
interface Ligne {
  nom: string;
  mesure: number;
  normale: number | null;
  ecart: number;
  /** Bilan de la ligne (utile quand les trois sont affichés ensemble). */
  type: Type;
}

const FONDS_BASE: Record<'temp' | 'pluie' | 'soleil', { fond: string; carte: string; case: string; titre: string; unite: string; ecartTexte: string; libelles: [string, string]; tuile: string; surTuile: string }> = {
  temp: {
    fond: 'linear-gradient(135deg, #e0242b 0%, #b30f17 50%, #7a0a10 100%)',
    carte: '#fcdd09',
    case: 'rgba(70,4,8,0.8)',
    titre: 'BILAN DES TEMPÉRATURES',
    unite: '°C',
    ecartTexte: '#da121a',
    libelles: ['Moyenne', 'Normales'],
    tuile: '#fff',
    surTuile: '#da121a',
  },
  pluie: {
    fond: 'linear-gradient(135deg, #b30f17 0%, #8a0b13 50%, #560710 100%)',
    carte: '#fcdd09',
    case: 'rgba(50,3,8,0.8)',
    titre: 'BILAN DE LA PLUVIOMÉTRIE',
    unite: ' mm',
    ecartTexte: '#da121a',
    libelles: ['Relevés', 'Normales'],
    tuile: '#fff',
    surTuile: '#da121a',
  },
  soleil: {
    fond: 'linear-gradient(135deg, #f08a00 0%, #d9461a 50%, #a8101a 100%)',
    carte: '#fcdd09',
    case: 'rgba(80,10,6,0.8)',
    titre: 'BILAN DE L’ENSOLEILLEMENT',
    unite: ' h',
    ecartTexte: '#da121a',
    libelles: ['Relevés', 'Normales'],
    tuile: '#fff',
    surTuile: '#da121a',
  },
};

const FONDS = {
  ...FONDS_BASE,
  chaud: { ...FONDS_BASE.temp, titre: 'RECORDS DU MOIS', unite: '°C', libelles: ['Maxi du mois', 'Record du mois'] as [string, string] },
  froid: { ...FONDS_BASE.temp, titre: 'RECORDS DU MOIS', unite: '°C', libelles: ['Mini du mois', 'Record du mois'] as [string, string] },
};

const TITRES_LIGNE: Record<Type, string> = { temp: 'Températures', pluie: 'Pluviométrie', soleil: 'Ensoleillement', chaud: 'Chaleur', froid: 'Froid' };

const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
/** « octobre 2026 » pour « 2026-10 » (extremes-mois.ts est réservé au serveur). */
const libelleMois = (mois: string) => `${NOMS_MOIS[Number(mois.slice(5, 7)) - 1]} ${mois.slice(0, 4)}`;

const sansTiret = (nom: string) => normaliser(nom).toUpperCase().replace(/[^A-Z]/g, '');

const signe = (v: number, decimales: number, suffixe: string) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(decimales)}${suffixe}`;

export default function BilanMoisPlanche() {
  const [bilans, setBilans] = useState<ReponseBilans | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [mois, setMois] = useState<string | null>(null);
  // Mois d'avant l'archive des relevés du site : bilans mensuels de Perpignan de Météo-France (depuis 1950), chargés à part.
  const [histo, setHisto] = useState<ReponseHistorique | null>(null);
  const [moisHisto, setMoisHisto] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/carte-meteo/bilan-historique/')
      .then((r) => (r.ok ? (r.json() as Promise<ReponseHistorique>) : Promise.reject()))
      .then(setHisto)
      .catch(() => {});
  }, []);
  const [type, setType] = useState<Affichage>('tous');
  const [logoId, setLogoId] = useState('alertesmeteo');
  const [format, setFormat] = useState<FormatPlanche>('paysage');
  const { l: LARGEUR, h: HAUTEUR, vertical, ligne: HAUTEUR_LIGNE } = FORMATS[format];
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
  }, [LARGEUR]);

  const moisAffiche = moisHisto ?? bilans?.mois?.affiche ?? mois ?? '';
  const prete = !!bilans?.mois;

  /** Station de chaque ville et valeur d'une carte du mois. */
  const lire = useMemo(() => {
    if (!bilans) return null;
    const stations = VILLES.map((v) => {
      const i = bilans.stations.findIndex((s) => s[2] === DEPARTEMENT && sansTiret(s[1]).includes(v.cherche));
      return { ...v, i, station: i >= 0 ? bilans.stations[i] : null };
    });
    const valeurArchive = (carte: string, i: number) => bilans.cartes[carte]?.valeurs.find(([k]) => k === i)?.[1] ?? null;
    // Mois ancien : valeurs de la station de Perpignan lues dans la base mensuelle ; écarts calculés sur les normales 1991-2020.
    const h = moisHisto ? histo?.mois[moisHisto] : null;
    const n = moisHisto ? histo?.normales[String(Number(moisHisto.slice(5, 7)))] : null;
    const ecart = (v: number | null | undefined, norme: number | null | undefined) => (v == null || norme == null ? null : Math.round((v - norme) * 10) / 10);
    const pourcent = (v: number | null | undefined, norme: number | null | undefined) => (v == null || norme == null || norme <= 0 ? null : Math.round((v / norme - 1) * 100));
    const valeur = (carte: string, i: number): number | null => {
      if (!h || !n) return moisHisto ? null : valeurArchive(carte, i);
      switch (carte) {
        case 'txm-mois': return h.tx;
        case 'tnm-mois': return h.tn;
        case 'ntx-mois': return ecart(h.tx, n.tx);
        case 'ntn-mois': return ecart(h.tn, n.tn);
        case 'tx-mois': return h.txab;
        case 'tn-mois': return h.tnab;
        case 'rr-mois': return h.rr;
        case 'nrr-mois': return pourcent(h.rr, n.rr);
        case 'insol-mois': return h.insol;
        case 'ninsol-mois': return pourcent(h.insol, n.insol);
        case 'raf-mois': return h.raf;
        default: return null; // records du mois : lus dans les records de la station (recordsStations)
      }
    };
    return { stations, valeur };
  }, [bilans, histo, moisHisto]);

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
      if (t === 'chaud' || t === 'froid') {
        const [m, rec] = t === 'chaud' ? [v('tx-mois'), v('record-mois-tx')] : [v('tn-mois'), v('record-mois-tn')];
        if (m == null || rec == null) return null;
        return { nom, type: t, mesure: m, normale: rec, ecart: Math.round((m - rec) * 10) / 10 };
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
    if (type === 'records' || type === 'annee') return [];
    return lire.stations.flatMap((s) => (s.i < 0 ? [] : [ligneDe(s.nom, s.i, type as Type)])).filter((l): l is Ligne => l != null);
  }, [lire, type]);

  /** Records de chaque mois de l'année à la station de la planche (Perpignan), pour « Records des 12 mois ». */
  const annee = useMemo(() => {
    const s = lire?.stations.find((x) => x.i >= 0);
    const mensuels = s && bilans?.recordsStations?.[s.station![0]]?.monthly;
    if (!mensuels) return [];
    return NOMS_MOIS.map((nom, k) => ({ nom, ...mensuels[String(k + 1)] }));
  }, [lire, bilans]);
  const moisNumero = Number(moisAffiche.slice(5, 7));
  /** « Records du mois » : maxi, mini, rafales et précipitations de ce mois comparés au record du même mois (Perpignan). */
  const recordsMois = useMemo(() => {
    const s = lire?.stations.find((x) => x.i >= 0);
    if (!s || !lire) return [];
    const v = (c: string) => lire.valeur(c, s.i);
    const rec = bilans?.recordsStations?.[s.station![0]]?.monthly?.[String(moisNumero)];
    const dec = (x: number, u: string) => `${x.toFixed(1).replace('.', ',')}${u}`;
    const [tx, tn, raf, rr, nrr] = [v('tx-mois'), v('tn-mois'), v('raf-mois'), v('rr-mois'), v('nrr-mois')];
    const recTx = rec?.tx?.v ?? v('record-mois-tx');
    const recTn = rec?.tn?.v ?? v('record-mois-tn');
    const lignesRec: { titre: string; sous: string; obs: string; record: string; annee: string; verdict: string; battu: boolean }[] = [
      {
        titre: 'MAXIMALE',
        sous: 'la plus chaude du mois',
        obs: tx == null ? '—' : dec(tx, '°C'),
        record: recTx == null ? '—' : dec(recTx, '°C'),
        annee: rec?.tx ? rec.tx.d.slice(0, 4) : '',
        verdict: tx == null || recTx == null ? '—' : tx >= recTx ? 'RECORD BATTU !' : `${signe(Math.round((tx - recTx) * 10) / 10, 1, '°C')} du record`,
        battu: tx != null && recTx != null && tx >= recTx,
      },
      {
        titre: 'MINIMALE',
        sous: 'la plus froide du mois',
        obs: tn == null ? '—' : dec(tn, '°C'),
        record: recTn == null ? '—' : dec(recTn, '°C'),
        annee: rec?.tn ? rec.tn.d.slice(0, 4) : '',
        verdict: tn == null || recTn == null ? '—' : tn <= recTn ? 'RECORD BATTU !' : `${signe(Math.round((tn - recTn) * 10) / 10, 1, '°C')} du record`,
        battu: tn != null && recTn != null && tn <= recTn,
      },
      {
        titre: 'RAFALES',
        sous: 'la plus forte du mois',
        obs: raf == null ? '—' : `${Math.round(raf)} km/h`,
        record: '—',
        annee: '',
        verdict: '',
        battu: false,
      },
      {
        titre: 'PRÉCIPITATIONS',
        sous: 'cumul du mois · record sur 24 h',
        obs: rr == null ? '—' : `${Math.round(rr)} mm`,
        record: rec?.rr24 ? dec(rec.rr24.v, ' mm') : '—',
        annee: rec?.rr24 ? `${rec.rr24.d.slice(0, 4)} · en 24 h` : '',
        verdict: nrr == null ? '' : `${signe(Math.round(nrr), 0, ' %')} / normale`,
        battu: false,
      },
    ];
    return rec || tx != null ? lignesRec : [];
  }, [lire, bilans, moisNumero]);
  const avecDonnees = type === 'annee' ? annee.length > 0 : type === 'records' ? recordsMois.length > 0 : lignes.length > 0;

  // Disposition : en paysage, la carte à gauche et les lignes à droite ; en portrait ou carré, le titre, la carte, puis les lignes en bas.
  const blocLignes = type === 'records' ? HAUTEUR_ENTETE_REC + ECART_REC + 4 * HAUTEUR_REC + 3 * ECART_REC : type === 'annee' ? 13 * HAUTEUR_TABLE + 12 * 4 : Math.max(1, lignes.length) * HAUTEUR_LIGNE + Math.max(0, lignes.length - 1) * ECART_LIGNES;
  const bas = HAUTEUR - 130;
  const hautLignes = vertical ? bas - blocLignes : 190;
  const CARTE = vertical ? { gauche: 40, haut: 215, droite: LARGEUR - 40, bas: hautLignes - 16 } : { gauche: 30, haut: 40, droite: 570, bas: HAUTEUR - 110 };

  const vue = useMemo(() => {
    const boite = unirBoites(contours.filter((c) => CODES_CARTE.includes(c.code)).map((c) => c.boite));
    return boite ? ajusterVue(boite, CARTE, 0.02) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contours, CARTE.gauche, CARTE.haut, CARTE.droite, CARTE.bas]);

  const style = FONDS[type === 'tous' ? 'temp' : type === 'records' || type === 'annee' ? 'chaud' : type];
  const decimales = type === 'temp' ? 1 : 1;
  const logo = LOGOS_PRESETS.find((l) => l.id === logoId);
  const periode = moisHisto ? '' : (bilans?.cartes['rr-mois']?.fenetre.split(' · ')[0] ?? '');

  const exporter = async () => {
    if (!planche.current) return;
    setEnExport(true);
    try {
      await exporterEnJpg(planche.current, `bilan-${type === 'annee' ? 'records-12-mois' : type === 'records' ? 'records-du-mois' : type === 'tous' ? 'complet' : type === 'temp' ? 'temperatures' : type === 'pluie' ? 'pluviometrie' : 'ensoleillement'}-${moisAffiche}-pyrenees-orientales${format === 'paysage' ? '' : `-${format}`}`, LARGEUR, HAUTEUR);
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
            {([['tous', '📊 Les trois'], ['records', '🏆 Records du mois'], ['annee', '📅 Records des 12 mois'], ['temp', '🌡️ Températures'], ['pluie', '🌧️ Pluviométrie'], ['soleil', '☀️ Ensoleillement']] as [Affichage, string][]).map(([id, l]) => (
              <button key={id} type="button" aria-pressed={type === id} className={bouton(type === id)} onClick={() => setType(id)}>
                {l}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Format</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FORMATS) as FormatPlanche[]).map((id) => (
              <button key={id} type="button" aria-pressed={format === id} className={bouton(format === id)} onClick={() => setFormat(id)}>
                {FORMATS[id].libelle}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="text-sm font-medium">
          <span className="mb-1 block">Mois</span>
          <select
            value={moisAffiche}
            onChange={(e) => {
              const m = e.target.value;
              // Mois de l'archive du site : relevés de toutes les stations ; plus ancien : base mensuelle de Perpignan.
              if (bilans?.mois?.disponibles.includes(m)) {
                setMoisHisto(null);
                setMois(m);
              } else setMoisHisto(m);
            }}
            className={selectBarre}
          >
            <optgroup label="Archive du site">
              {(bilans?.mois?.disponibles ?? (moisAffiche ? [moisAffiche] : [])).map((m) => (
                <option key={m} value={m}>
                  {libelleMois(m)}
                </option>
              ))}
            </optgroup>
            {histo && (
              <optgroup label="Anciens mois (Perpignan, Météo-France)">
                {Object.keys(histo.mois)
                  .filter((m) => !bilans?.mois?.disponibles.includes(m) && histo.mois[m].tx != null)
                  .sort()
                  .reverse()
                  .map((m) => (
                    <option key={m} value={m}>
                      {libelleMois(m)}
                    </option>
                  ))}
              </optgroup>
            )}
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
        <button type="button" onClick={exporter} disabled={enExport || !bilans || !avecDonnees} className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {enExport ? 'Export en cours…' : 'Exporter en JPG'}
        </button>
      </div>
      <div className="mt-3">
        <TexteSurCarte cible={planche} />
      </div>
      {erreur && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {erreur}
        </p>
      )}
      {bilans && !avecDonnees && <p className="mt-3 text-sm text-muted">Aucune des trois stations n&apos;a de valeur pour ce bilan et ce mois.</p>}

      <div ref={colonne} className="mt-4 min-w-0">
        <div style={{ height: HAUTEUR * facteur }}>
          <div ref={planche} style={{ width: LARGEUR, height: HAUTEUR, transform: `scale(${facteur})`, transformOrigin: 'top left', background: style.fond, color: '#fff', fontFamily: POLICE, position: 'relative', overflow: 'hidden' }}>
            {/* Senyera : bandes jaunes et rouges en haut de la planche. */}
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 18, background: 'repeating-linear-gradient(to bottom, #fcdd09 0 2px, #da121a 2px 4px)' }} />
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
                        stroke={c.code === DEPARTEMENT ? 'rgba(120,10,16,0.8)' : 'rgba(255,255,255,0.4)'}
                        strokeWidth={1 / vue.echelle}
                        style={c.code === DEPARTEMENT ? { filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.4))' } : undefined}
                      />
                    ))}
                </g>
              )}
              {vue &&
                lire?.stations
                  .filter((s) => s.station && (type === 'tous' || type === 'records' || type === 'annee' ? avecDonnees : lignes.some((l) => l.nom === s.nom)))
                  .map((s) => {
                    const p = versEcran(versMonde(s.station![3], s.station![4]), vue);
                    return (
                      <g key={s.nom}>
                        <circle cx={p.x} cy={p.y} r={5} fill="#7a0a10" />
                        <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize={20} fontWeight={700} fill="#7a0a10" stroke="rgba(255,255,255,0.85)" strokeWidth={4} paintOrder="stroke">
                          {s.nom.toUpperCase()}
                        </text>
                      </g>
                    );
                  })}
            </svg>

            <div style={{ position: 'absolute', left: vertical ? 40 : 610, right: 40, top: vertical ? 40 : 28 }}>
              <div style={{ fontSize: vertical ? 40 : type === 'records' ? 42 : 50, whiteSpace: vertical ? 'normal' : 'nowrap', fontWeight: 800, textAlign: vertical ? 'center' : 'right', letterSpacing: 0.5, textShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>
                {type === 'tous' ? 'BILAN DU MOIS' : type === 'annee' ? 'RECORDS DES 12 MOIS' : style.titre}{prete && type !== 'annee' ? ` - ${libelleMois(moisAffiche).toUpperCase()}` : ''}
              </div>
              <div style={{ height: 3, background: '#fff', width: 270, marginLeft: vertical ? 'auto' : 'auto', marginRight: vertical ? 'auto' : undefined, marginTop: 14 }} />
              <div style={{ fontSize: 20, textAlign: vertical ? 'center' : 'right', opacity: 0.85, marginTop: 8 }}>{type === 'annee' ? 'Perpignan · records de chaque mois (Météo-France)' : type === 'records' ? 'Perpignan · comparé aux records du même mois (Météo-France)' : `Pyrénées-Orientales${periode ? ` · ${periode}` : ''}`}</div>
            </div>

            {type === 'records' && (
              <div style={{ position: 'absolute', left: vertical ? 40 : 610, right: 40, top: hautLignes, display: 'flex', flexDirection: 'column', gap: ECART_REC }}>
                <div style={{ display: 'flex', alignItems: 'center', height: HAUTEUR_ENTETE_REC, borderRadius: 12, background: 'rgba(0,0,0,0.35)', padding: '0 18px', fontSize: 20, fontWeight: 800, letterSpacing: 1 }}>
                  <div style={{ width: vertical ? 230 : 270 }} />
                  <div style={{ flex: 1, textAlign: 'center' }}>CE MOIS-CI</div>
                  <div style={{ flex: 1, textAlign: 'center' }}>RECORD DU MOIS</div>
                  <div style={{ width: vertical ? 230 : 260, textAlign: 'center' }}>RÉSULTAT</div>
                </div>
                {recordsMois.map((l) => (
                  <div key={l.titre} style={{ display: 'flex', alignItems: 'center', height: HAUTEUR_REC, borderRadius: 18, background: 'rgba(70,4,8,0.8)', padding: '0 18px' }}>
                    <div style={{ width: vertical ? 230 : 270 }}>
                      <div style={{ fontSize: vertical ? 26 : 30, fontWeight: 800 }}>{l.titre}</div>
                      <div style={{ fontSize: 17, fontStyle: 'italic', opacity: 0.85, marginTop: 4, lineHeight: 1.15 }}>{l.sous}</div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center', fontSize: 40, fontWeight: 800, whiteSpace: 'nowrap' }}>{l.obs}</div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 40, fontWeight: 700, whiteSpace: 'nowrap' }}>{l.record}</div>
                      {l.annee && <div style={{ fontSize: 19, fontStyle: 'italic', opacity: 0.85, whiteSpace: 'nowrap' }}>{l.annee}</div>}
                    </div>
                    <div style={{ width: vertical ? 230 : 260, height: 76, borderRadius: 16, background: l.battu ? '#fcdd09' : l.verdict ? '#fff' : 'transparent', color: '#da121a', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: l.battu ? 28 : 26, fontWeight: 800, lineHeight: 1.1, padding: '0 8px' }}>
                      {l.verdict}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {type === 'annee' && (
              <div style={{ position: 'absolute', left: vertical ? 40 : 610, right: 40, top: hautLignes, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 21 }}>
                {([{ nom: 'Mois', entete: true } as { nom: string; entete?: boolean; tx?: { v: number; d: string }; tn?: { v: number; d: string }; rr24?: { v: number; d: string } }] as { nom: string; entete?: boolean; tx?: { v: number; d: string }; tn?: { v: number; d: string }; rr24?: { v: number; d: string } }[]).concat(annee).map((m, k) => {
                  const entete = !!m.entete;
                  const rec = (r?: { v: number; d: string }, unite = '°C') => (r ? `${r.v.toFixed(1).replace('.', ',')}${unite} (${r.d.slice(0, 4)})` : '—');
                  const courant = !entete && k === moisNumero;
                  const col = (txt: string, w: number | null, gras = false) => (
                    <div style={{ width: w ?? undefined, flex: w == null ? 1 : undefined, textAlign: 'center', fontWeight: gras ? 700 : 500, whiteSpace: 'nowrap' }}>{txt}</div>
                  );
                  return (
                    <div key={m.nom} style={{ display: 'flex', alignItems: 'center', height: HAUTEUR_TABLE, borderRadius: 10, background: entete ? 'rgba(0,0,0,0.35)' : courant ? '#fcdd09' : 'rgba(70,4,8,0.8)', color: courant ? '#7a0a10' : '#fff', padding: '0 10px' }}>
                      {col(entete ? 'MOIS' : m.nom.toUpperCase(), 150, true)}
                      {col(entete ? 'CHALEUR' : rec(m.tx), null, entete)}
                      {col(entete ? 'FROID' : rec(m.tn), null, entete)}
                      {col(entete ? 'PLUIE EN 24 H' : rec(m.rr24, ' mm'), null, entete)}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ position: 'absolute', left: vertical ? 40 : 610, right: 40, top: hautLignes, display: 'flex', flexDirection: 'column', gap: ECART_LIGNES }}>
              {lignes.map((l) => {
                const sl = FONDS[l.type];
                return (
                <div key={l.nom} style={{ display: 'flex', gap: 22, height: HAUTEUR_LIGNE }}>
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
                      {l.type === 'chaud' ? (l.ecart >= 0 ? 'RECORD !' : signe(l.ecart, 1, '°C')) : l.type === 'froid' ? (l.ecart <= 0 ? 'RECORD !' : signe(l.ecart, 1, '°C')) : l.type === 'temp' ? signe(l.ecart, 1, '°C') : signe(Math.round(l.ecart), 0, ' %')}
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
