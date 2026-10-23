'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { palierDe, texteInfo, type ReponseBilans } from '@/lib/carte-meteo/cartes-info';
import { COLONNES, uniteEntete, type Ligne } from '@/lib/carte-meteo/colonnes-releves';
import { exporterEnJpg } from '@/lib/carte-meteo/ExportJpg';
import { LOGOS_PRESETS } from '@/lib/carte-meteo/logos';
import { normaliser } from './CarteMeteo';

/** Largeur logique de l'image (exportée à 1,5 ×) ; la hauteur dépend du nombre de lignes. */
const LARGEUR = 1280;
const HAUTEUR_ENTETE = 128;
const HAUTEUR_TITRES_COLONNES = 64;
const HAUTEUR_LIGNE = 50;
const HAUTEUR_PIED = 48;
const MAX_MESURES = 6;
const NOMBRES_LIGNES = [10, 15, 20, 25, 30, 40, 50] as const;
const ALTITUDES = [300, 500, 1000, 1500] as const;
const POLICE_TITRE = "Impact, 'Arial Narrow Bold', 'Arial Black', sans-serif";

/** Modèles de tableaux : mesures affichées (la première classe les stations) et sens du classement. */
const MODELES = [
  { id: 'pluie', libelle: '🌧️ Pluie', mesures: ['obs-rr24', 'obs-rr6'], sens: 'desc' },
  { id: 'rafales', libelle: '💨 Rafales', mesures: ['obs-raf24', 'obs-raf1'], sens: 'desc' },
  { id: 'maxi', libelle: '🔥 Maxi', mesures: ['obs-tx24', 'obs-tx12', 'obs-t'], sens: 'desc' },
  { id: 'mini', libelle: '🥶 Mini', mesures: ['obs-tn24', 'obs-tn12', 'obs-t'], sens: 'asc' },
  { id: 'temperature', libelle: '🌡️ Températures', mesures: ['obs-t', 'obs-dt24', 'obs-humidex', 'obs-windchill'], sens: 'desc' },
  { id: 'pression', libelle: '📉 Pression', mesures: ['obs-pmer', 'obs-dp3', 'obs-u'], sens: 'asc' },
  { id: 'soleil', libelle: '☀️ Soleil', mesures: ['obs-insol24', 'obs-u'], sens: 'desc' },
  { id: 'records', libelle: '🏆 Records de pluie', mesures: ['pluie-ecart-mois', 'obs-rr6', 'pluie-record-mois'], sens: 'desc' },
] as const;

const selectBarre = 'rounded-lg border border-border bg-surface p-1.5 text-sm';

/** « du 23/10 07 h au 24/10 07 h » : fenêtre de la mesure, sans l'heure de Paris, en majuscules pour le sous-titre. */
const fenetreDe = (bilans: ReponseBilans, id: string) => (bilans.cartes[id]?.fenetre ?? '').replace(/\s*\(heure de Paris\)/, '').toUpperCase();

interface Props {
  lignes: Ligne[];
  departements: string[];
  bilans: ReponseBilans;
}

/**
 * Tableau en JPG : le classement des stations sur une mesure (pluie, rafales, maxi, mini, pression…), avec les mesures voisines en colonnes,
 * mis en page comme les cartes (titre, logo, pastilles de couleur) et exporté en image. Limité à une zone et à une altitude.
 */
export default function PlancheTableauJpg({ lignes, departements, bilans }: Props) {
  const [modeleId, setModeleId] = useState<(typeof MODELES)[number]['id']>('pluie');
  const [mesures, setMesures] = useState<string[]>([...MODELES[0].mesures]);
  const [sens, setSens] = useState<'asc' | 'desc'>('desc');
  const [nombre, setNombre] = useState<(typeof NOMBRES_LIGNES)[number]>(15);
  const [departement, setDepartement] = useState('');
  const [altitudeMax, setAltitudeMax] = useState<number>(0);
  const [logoId, setLogoId] = useState('aucun');
  const [titreSaisi, setTitreSaisi] = useState<string | null>(null);
  const [enExport, setEnExport] = useState(false);
  const [erreurExport, setErreurExport] = useState<string | null>(null);
  const [facteur, setFacteur] = useState(1);
  const colonneRef = useRef<HTMLDivElement>(null);
  const planchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const colonne = colonneRef.current;
    if (!colonne) return;
    const observateur = new ResizeObserver(() => setFacteur(Math.min(1, colonne.clientWidth / LARGEUR)));
    observateur.observe(colonne);
    return () => observateur.disconnect();
  }, []);

  const colonnesChoisies = mesures.map((id) => COLONNES.find((c) => c.theme.id === id)).filter((c): c is NonNullable<typeof c> => !!c);
  const classement = colonnesChoisies[0]?.theme;

  function choisirModele(id: (typeof MODELES)[number]['id']) {
    const m = MODELES.find((x) => x.id === id)!;
    setModeleId(id);
    setMesures([...m.mesures]);
    setSens(m.sens);
    setTitreSaisi(null);
  }

  /** Une mesure de plus (jusqu'à six) ou de moins ; la première de la liste classe les stations. */
  function basculerMesure(id: string) {
    setMesures((courantes) => {
      if (courantes.includes(id)) return courantes.length > 1 ? courantes.filter((m) => m !== id) : courantes;
      return courantes.length >= MAX_MESURES ? courantes : [...courantes, id];
    });
    setTitreSaisi(null);
  }

  const lignesTriees = useMemo(() => {
    if (!classement) return [];
    const d = sens === 'asc' ? 1 : -1;
    return lignes
      .filter((l) => l.valeurs[classement.id] != null && (!departement || l.dep === departement) && (!altitudeMax || l.alt == null || l.alt <= altitudeMax))
      .sort((a, b) => d * (a.valeurs[classement.id] - b.valeurs[classement.id]) || a.nom.localeCompare(b.nom, 'fr'))
      .slice(0, nombre);
  }, [lignes, classement, sens, nombre, departement, altitudeMax]);

  const nomZone = departement ? `${DEPARTEMENTS_FR[departement] ?? departement} (${departement})` : 'France';
  const titre = titreSaisi ?? (classement ? `${classement.titre}${sens === 'asc' ? ' : LES PLUS BAS' : ' : LES PLUS ÉLEVÉS'}` : '');
  const sousTitre = [classement ? fenetreDe(bilans, classement.id) : '', nomZone.toUpperCase(), altitudeMax ? `STATIONS JUSQU'À ${altitudeMax} M` : ''].filter(Boolean).join(' · ');
  const logo = LOGOS_PRESETS.find((l) => l.id === logoId);
  const hauteur = HAUTEUR_ENTETE + HAUTEUR_TITRES_COLONNES + Math.max(lignesTriees.length, 1) * HAUTEUR_LIGNE + HAUTEUR_PIED;
  // Plus il y a de mesures, plus la colonne « station » se resserre.
  const largeurMesure = colonnesChoisies.length > 4 ? 150 : 180;

  async function exporter() {
    if (!planchRef.current) return;
    setErreurExport(null);
    setEnExport(true);
    try {
      await exporterEnJpg(planchRef.current, `tableau-${modeleId}-${normaliser(nomZone).replace(/ /g, '-')}-${new Date().toISOString().slice(0, 10)}`, LARGEUR, hauteur);
    } catch (e) {
      console.error('Export du tableau en JPG', e);
      setErreurExport("L'export a échoué. Réessayez dans un instant.");
    } finally {
      setEnExport(false);
    }
  }

  return (
    <section id="tableau-jpg" className="mt-12 scroll-mt-4">
      <h2 className="text-2xl font-extrabold">Tableaux en JPG</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Le classement des stations sur une mesure (pluie, rafales, maxi, mini, pression…), avec les mesures voisines en colonnes, mis en page comme les cartes et
        exporté en image. Choisissez un modèle, la zone et le nombre de lignes ; changez les mesures à volonté (six au plus, la première classe les stations).
      </p>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Modèle de tableau">
        {MODELES.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={m.id === modeleId}
            onClick={() => choisirModele(m.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${m.id === modeleId ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}
          >
            {m.libelle}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl border border-border bg-surface p-4">
        <label className="text-sm font-medium">
          <span className="mb-1 block">Lignes</span>
          <select value={nombre} onChange={(e) => setNombre(Number(e.target.value) as (typeof NOMBRES_LIGNES)[number])} className={selectBarre}>
            {NOMBRES_LIGNES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          <span className="mb-1 block">Classement</span>
          <select value={sens} onChange={(e) => setSens(e.target.value as 'asc' | 'desc')} className={selectBarre}>
            <option value="desc">Du plus élevé au plus bas</option>
            <option value="asc">Du plus bas au plus élevé</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          <span className="mb-1 block">Département</span>
          <select value={departement} onChange={(e) => setDepartement(e.target.value)} className={selectBarre}>
            <option value="">Toute la France</option>
            {departements.map((d) => (
              <option key={d} value={d}>
                {d} — {DEPARTEMENTS_FR[d] ?? d}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          <span className="mb-1 block">Altitude</span>
          <select value={altitudeMax} onChange={(e) => setAltitudeMax(Number(e.target.value))} className={selectBarre}>
            <option value={0}>Toutes les stations</option>
            {ALTITUDES.map((a) => (
              <option key={a} value={a}>
                Jusqu&apos;à {a} m
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
        <label className="min-w-64 flex-1 text-sm font-medium">
          <span className="mb-1 block">Titre</span>
          <input value={titre} onChange={(e) => setTitreSaisi(e.target.value.toUpperCase())} className={`${selectBarre} w-full`} />
        </label>
        <button type="button" onClick={exporter} disabled={enExport || lignesTriees.length === 0} className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {enExport ? 'Export en cours…' : 'Exporter en JPG'}
        </button>
      </div>

      <fieldset className="mt-3">
        <legend className="mb-1 text-sm font-medium">
          Mesures ({colonnesChoisies.length} sur {MAX_MESURES} au plus ; la première classe les stations)
        </legend>
        <div className="flex flex-wrap gap-2">
          {COLONNES.map(({ theme }) => {
            const choisie = mesures.includes(theme.id);
            const rang = mesures.indexOf(theme.id) + 1;
            return (
              <button
                key={theme.id}
                type="button"
                aria-pressed={choisie}
                disabled={!choisie && mesures.length >= MAX_MESURES}
                onClick={() => basculerMesure(theme.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-40 ${choisie ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}
              >
                {choisie ? `${rang}. ` : ''}
                {theme.court}
              </button>
            );
          })}
        </div>
      </fieldset>

      {erreurExport && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {erreurExport}
        </p>
      )}

      <div ref={colonneRef} className="mt-4 min-w-0">
        {lignesTriees.length === 0 && <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">Aucune station avec cette mesure dans cette zone.</p>}
        <div style={{ height: hauteur * facteur, display: lignesTriees.length ? undefined : 'none' }}>
          <div
            ref={planchRef}
            style={{
              width: LARGEUR,
              height: hauteur,
              transform: `scale(${facteur})`,
              transformOrigin: 'top left',
              background: 'linear-gradient(160deg, #0b2a4a 0%, #123c6b 100%)',
              color: '#fff',
              fontFamily: 'Arial, Helvetica, sans-serif',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Bandeau du titre */}
            <div style={{ height: HAUTEUR_ENTETE, display: 'flex', alignItems: 'center', gap: 24, padding: '0 36px' }}>
              {logo?.fichier ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo.fichier} alt="" style={{ height: 84, background: logo.fondBlanc === false ? 'transparent' : '#fff', borderRadius: 8 }} />
              ) : null}
              <div style={{ background: 'rgba(255,255,255,0.94)', borderRadius: 12, padding: '10px 26px', flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: POLICE_TITRE, fontSize: 38, lineHeight: 1.05, color: '#0b2a4a', letterSpacing: 0.5 }}>{titre}</div>
                <div style={{ fontFamily: POLICE_TITRE, fontSize: 20, lineHeight: 1.2, color: '#2563a8', letterSpacing: 0.5, marginTop: 2 }}>{sousTitre}</div>
              </div>
            </div>

            {/* Titres des colonnes */}
            <div style={{ height: HAUTEUR_TITRES_COLONNES, display: 'flex', alignItems: 'center', padding: '0 36px', fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#cfe3fa' }}>
              <div style={{ width: 64 }}>#</div>
              <div style={{ flex: 1 }}>Station</div>
              <div style={{ width: 70, textAlign: 'center' }}>Dép.</div>
              {colonnesChoisies.map(({ theme }, i) => (
                <div key={theme.id} style={{ width: largeurMesure, textAlign: 'center', lineHeight: 1.15, color: i === 0 ? '#ffd21a' : undefined }}>
                  {theme.court}
                  {uniteEntete(theme) ? <span style={{ fontWeight: 400 }}> ({uniteEntete(theme)})</span> : null}
                </div>
              ))}
            </div>

            {/* Lignes */}
            {lignesTriees.map((l, i) => (
              <div
                key={l.code}
                style={{
                  height: HAUTEUR_LIGNE,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 36px',
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.03)',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div style={{ width: 64, fontFamily: POLICE_TITRE, fontSize: 24, color: '#ffd21a' }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 22, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {l.nom}
                  {l.alt != null ? <span style={{ marginLeft: 10, fontSize: 15, fontWeight: 400, color: '#9db8d6' }}>{l.alt} m</span> : null}
                </div>
                <div style={{ width: 70, textAlign: 'center', fontSize: 18, color: '#cfe3fa' }}>{l.dep}</div>
                {colonnesChoisies.map(({ theme }) => {
                  const v = l.valeurs[theme.id];
                  const palier = v == null ? null : palierDe(theme.paliers, v);
                  const teinte = palier && !palier.neutre ? { background: palier.fond, color: palier.texte } : { background: 'rgba(255,255,255,0.12)', color: '#fff' };
                  return (
                    <div key={theme.id} style={{ width: largeurMesure, display: 'flex', justifyContent: 'center' }}>
                      {v == null ? (
                        <span style={{ color: '#7f9bbb' }}>–</span>
                      ) : (
                        <span
                          style={{
                            ...teinte,
                            fontFamily: POLICE_TITRE,
                            fontSize: 26,
                            lineHeight: 1,
                            padding: '5px 16px 4px',
                            borderRadius: 10,
                            border: '2px solid #fff',
                            minWidth: 96,
                            textAlign: 'center',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.45)',
                          }}
                        >
                          {texteInfo(theme, v)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Pied */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: HAUTEUR_PIED, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 36px', fontSize: 16, color: '#cfe3fa' }}>
              <span>Relevés Météo-France{bilans.majA ? ` · ${new Date(bilans.majA).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })}` : ''}</span>
              <span style={{ fontFamily: POLICE_TITRE, fontSize: 22, color: '#fff', letterSpacing: 0.5 }}>www.alertes-meteo.com</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
