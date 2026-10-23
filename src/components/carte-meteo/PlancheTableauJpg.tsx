'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { REGIONS_FR, REGION_PAR_DEPARTEMENT } from '@/lib/carte-meteo/regions-fr';
import { palierDe, texteInfo, type ReponseBilans } from '@/lib/carte-meteo/cartes-info';
import { COLONNES, uniteEntete, type Ligne } from '@/lib/carte-meteo/colonnes-releves';
import { exporterEnJpg } from '@/lib/carte-meteo/ExportJpg';
import { LOGOS_PRESETS } from '@/lib/carte-meteo/logos';
import { STYLES_TABLEAU, type StyleTableau } from '@/lib/carte-meteo/styles-tableau';
import { pointsDuBilan, sansValeursAberrantes } from '@/lib/carte-meteo/stations-bilan';
import { normaliser } from './CarteMeteo';
import CarteInfo from './CarteInfo';

/** Largeur logique de l'image (exportée à 1,5 ×) ; la hauteur dépend du nombre de lignes. */
const LARGEUR = 1280;
const HAUTEUR_ENTETE = 128;
const HAUTEUR_TITRES_COLONNES = 64;
const HAUTEUR_LIGNE = 50;
const HAUTEUR_PIED = 48;
const MAX_MESURES = 6;
const NOMBRES_LIGNES = [10, 15, 20, 25, 30, 40, 50] as const;
const ALTITUDES = [300, 500, 1000, 1500] as const;

/** Modèles de tableaux : mesures affichées (la première classe les stations) et sens du classement. */
const MODELES = [
  { id: 'pluie', libelle: '🌧️ Pluie', mesures: ['obs-rr24', 'obs-rr48', 'obs-rr72', 'obs-rr6'], sens: 'desc' },
  { id: 'rafales', libelle: '💨 Rafales', mesures: ['obs-raf24', 'obs-raf48', 'obs-raf72', 'obs-raf1'], sens: 'desc' },
  { id: 'pluie-vent', libelle: '🌧️💨 Pluie et vent', mesures: ['obs-rr24', 'obs-raf24', 'obs-rr6', 'obs-raf1'], sens: 'desc' },
  { id: 'maxi', libelle: '🔥 Maxi', mesures: ['obs-tx24', 'obs-tx12', 'obs-t'], sens: 'desc' },
  { id: 'mini', libelle: '🥶 Mini', mesures: ['obs-tn24', 'obs-tn12', 'obs-t'], sens: 'asc' },
  { id: 'temperature', libelle: '🌡️ Températures', mesures: ['obs-t', 'obs-dt24', 'obs-humidex', 'obs-windchill'], sens: 'desc' },
  { id: 'synthese', libelle: '📋 Synthèse du jour', mesures: ['obs-tx24', 'obs-tn24', 'obs-rr24', 'obs-raf24', 'obs-insol24'], sens: 'desc' },
  { id: 'pression', libelle: '📉 Pression', mesures: ['obs-pmer', 'obs-dp3', 'obs-u'], sens: 'asc' },
  { id: 'variation-pression', libelle: '📉 Variation de pression', mesures: ['obs-dp6', 'obs-dp3', 'obs-dp9', 'obs-dp12', 'obs-dp24'], sens: 'asc' },
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
 * dans l'un des onze styles (voir styles-tableau.ts), et exporté en image. Limité à une zone et à une altitude.
 */
export default function PlancheTableauJpg({ lignes, departements, bilans }: Props) {
  const [modeleId, setModeleId] = useState<(typeof MODELES)[number]['id']>('pluie');
  const [mesures, setMesures] = useState<string[]>([...MODELES[0].mesures]);
  const [sens, setSens] = useState<'asc' | 'desc'>('desc');
  const [nombre, setNombre] = useState<(typeof NOMBRES_LIGNES)[number]>(15);
  const [departement, setDepartement] = useState('');
  const [region, setRegion] = useState('');
  const [altitudeMax, setAltitudeMax] = useState<number>(0);
  const [logoId, setLogoId] = useState('aucun');
  const [styleId, setStyleId] = useState(STYLES_TABLEAU[0].id);
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

  const st: StyleTableau = STYLES_TABLEAU.find((x) => x.id === styleId) ?? STYLES_TABLEAU[0];
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
      .filter((l) => l.valeurs[classement.id] != null && (!departement || l.dep === departement) && (!region || REGION_PAR_DEPARTEMENT[l.dep] === region) && (!altitudeMax || l.alt == null || l.alt <= altitudeMax))
      .sort((a, b) => d * (a.valeurs[classement.id] - b.valeurs[classement.id]) || a.nom.localeCompare(b.nom, 'fr'))
      .slice(0, nombre);
  }, [lignes, classement, sens, nombre, departement, region, altitudeMax]);

  /** Étendue des valeurs affichées de chaque mesure, pour la longueur des barres. */
  const etendues = useMemo(() => {
    const r: Record<string, { min: number; max: number }> = {};
    for (const { theme } of colonnesChoisies) {
      const v = lignesTriees.map((l) => l.valeurs[theme.id]).filter((x): x is number => x != null);
      r[theme.id] = { min: v.length ? Math.min(...v) : 0, max: v.length ? Math.max(...v) : 0 };
    }
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignesTriees, mesures]);

  /** Carte de la même zone et de la même mesure (France, région ou département). */
  const zoneCarte = departement ? `dep:${departement}` : region ? `reg:${region}` : 'france';
  const pointsCarte = useMemo(() => {
    if (!classement) return [];
    const brut = pointsDuBilan(bilans, classement.id, altitudeMax || Infinity);
    return classement.obs?.controle ? sansValeursAberrantes(brut) : brut;
  }, [bilans, classement, altitudeMax]);

  const nomZone = departement ? `${DEPARTEMENTS_FR[departement] ?? departement} (${departement})` : region || 'France';
  const suffixeTitre = classement ? (sens === classement.ordre && classement.titreTop ? classement.titreTop.toUpperCase() : sens === 'asc' ? 'LES PLUS BAS' : 'LES PLUS ÉLEVÉS') : '';
  const titre = titreSaisi ?? (classement ? `${classement.titre} : ${suffixeTitre}` : '');
  const sousTitre = [classement ? fenetreDe(bilans, classement.id) : '', nomZone.toUpperCase(), altitudeMax ? `STATIONS JUSQU'À ${altitudeMax} M` : ''].filter(Boolean).join(' · ');
  const logo = LOGOS_PRESETS.find((l) => l.id === logoId);
  const pasLigne = HAUTEUR_LIGNE + st.ecart;
  const hauteur = HAUTEUR_ENTETE + HAUTEUR_TITRES_COLONNES + Math.max(lignesTriees.length, 1) * pasLigne + HAUTEUR_PIED;
  // Plus il y a de mesures, plus la colonne « station » se resserre.
  const largeurMesure = colonnesChoisies.length > 4 ? 150 : 180;
  const marge = st.ecart ? 28 : 36;
  // Titre sur une seule ligne : police réduite quand il est long (Impact est étroite, les autres polices plus larges).
  const largeurTitre = LARGEUR - 2 * marge - 52 - (logo?.fichier ? 230 : 0);
  const tailleTitre = Math.max(22, Math.min(38, Math.floor(largeurTitre / (Math.max(titre.length, 1) * (st.policeTitre.startsWith('Impact') ? 0.5 : 0.62)))));

  async function exporter() {
    if (!planchRef.current) return;
    setErreurExport(null);
    setEnExport(true);
    try {
      await exporterEnJpg(planchRef.current, `tableau-${modeleId}-${st.id}-${normaliser(nomZone).replace(/ /g, '-')}-${new Date().toISOString().slice(0, 10)}`, LARGEUR, hauteur);
    } catch (e) {
      console.error('Export du tableau en JPG', e);
      setErreurExport("L'export a échoué. Réessayez dans un instant.");
    } finally {
      setEnExport(false);
    }
  }

  /** Une valeur dans le style choisi : pastille, pastille plate, texte avec puce de couleur, ou barre. */
  function valeurDe(l: Ligne, theme: (typeof colonnesChoisies)[number]['theme'], premiere: boolean) {
    const v = l.valeurs[theme.id];
    if (v == null) return <span style={{ color: st.secondaire }}>–</span>;
    const palier = palierDe(theme.paliers, v);
    const colore = !palier.neutre;
    const fond = colore ? palier.fond : st.neutreFond;
    const texte = colore ? palier.texte : st.neutreTexte;
    const nombre = texteInfo(theme, v);
    if (st.valeur === 'texte') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: st.policeValeur, fontSize: premiere ? 30 : 26, lineHeight: 1, color: st.texte, fontWeight: premiere ? 700 : 500 }}>
          <span style={{ width: 14, height: 14, borderRadius: st.puceRonde ? 14 : 3, background: fond, border: `1px solid ${st.puceBordure}`, display: 'inline-block' }} />
          {nombre}
        </span>
      );
    }
    if (st.valeur === 'barre') {
      const { min, max } = etendues[theme.id] ?? { min: 0, max: 0 };
      const part = max === min ? 1 : 0.5 + (0.5 * (v - min)) / (max - min);
      return (
        <span style={{ display: 'block', width: largeurMesure - 24, height: 34, background: st.barreFond, borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
          <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(part * 100)}%`, background: fond, borderRadius: 6 }} />
          <span style={{ position: 'absolute', left: 10, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontFamily: st.policeValeur, fontSize: 22, lineHeight: 1, color: texte }}>{nombre}</span>
        </span>
      );
    }
    const pastille: CSSProperties =
      st.valeur === 'pastille'
        ? { border: `2px solid ${st.pastilleBordure}`, boxShadow: st.pastilleOmbre, borderRadius: 10 }
        : { border: 'none', boxShadow: st.valeur === 'neon' ? `0 0 14px ${fond}, 0 0 4px ${fond}` : 'none', borderRadius: st.valeur === 'neon' ? 8 : 20 };
    return (
      <span style={{ ...pastille, background: fond, color: texte, fontFamily: st.policeValeur, fontSize: 26, lineHeight: 1, padding: '5px 16px 4px', minWidth: 96, textAlign: 'center' }}>{nombre}</span>
    );
  }

  return (
    <section id="tableau-jpg" className="scroll-mt-4">
      <h2 className="text-2xl font-extrabold">Tableaux en JPG</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Le classement des stations sur une mesure (pluie, rafales, maxi, mini, pression…), avec les mesures voisines en colonnes, dans l&apos;un des onze styles
        proposés, exporté en image. Choisissez un modèle, un style, la zone et le nombre de lignes ; changez les mesures à volonté (six au plus, la première classe les stations).
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

      <fieldset className="mt-4">
        <legend className="mb-1 text-sm font-medium">Style du tableau</legend>
        <div className="flex flex-wrap gap-2">
          {STYLES_TABLEAU.map((x, i) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={x.id === styleId}
              onClick={() => setStyleId(x.id)}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${x.id === styleId ? 'border-primary ring-2 ring-primary' : 'border-border'} bg-surface`}
            >
              <span aria-hidden className="inline-block h-5 w-8 rounded border border-black/20" style={{ background: x.apercu }} />
              {i + 1}. {x.libelle}
            </button>
          ))}
        </div>
      </fieldset>

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
          <span className="mb-1 block">Région</span>
          <select value={region} onChange={(e) => { setRegion(e.target.value); setDepartement(''); }} className={selectBarre}>
            <option value="">Toute la France</option>
            {REGIONS_FR.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          <span className="mb-1 block">Département</span>
          <select value={departement} onChange={(e) => setDepartement(e.target.value)} className={selectBarre}>
            <option value="">Toute la France</option>
            {departements.filter((d) => !region || REGION_PAR_DEPARTEMENT[d] === region).map((d) => (
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
              background: st.fond,
              color: st.texte,
              fontFamily: st.police,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Bandeau du titre */}
            <div style={{ height: HAUTEUR_ENTETE, display: 'flex', alignItems: 'center', gap: 24, padding: `0 ${marge}px` }}>
              {logo?.fichier ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo.fichier} alt="" style={{ height: 84, background: logo.fondBlanc === false ? 'transparent' : '#fff', borderRadius: 8 }} />
              ) : null}
              <div style={{ ...st.bandeau, flex: 1, minWidth: 0, padding: '10px 26px' }}>
                <div style={{ fontFamily: st.policeTitre, fontSize: tailleTitre, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', color: st.titre, letterSpacing: 0.5, fontWeight: st.titreGras ? 700 : 400 }}>{titre}</div>
                <div style={{ fontFamily: st.policeTitre, fontSize: 20, lineHeight: 1.2, color: st.sousTitre, letterSpacing: 0.5, marginTop: 2, fontWeight: st.titreGras ? 700 : 400 }}>{sousTitre}</div>
              </div>
            </div>

            {/* Titres des colonnes */}
            <div style={{ height: HAUTEUR_TITRES_COLONNES, display: 'flex', alignItems: 'center', padding: `0 ${marge + (st.ecart ? 20 : 0)}px`, fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: st.entete, borderBottom: st.traitEntete }}>
              <div style={{ width: 64 }}>#</div>
              <div style={{ flex: 1 }}>Station</div>
              <div style={{ width: 70, textAlign: 'center' }}>Dép.</div>
              {colonnesChoisies.map(({ theme }, i) => (
                <div key={theme.id} style={{ width: largeurMesure, textAlign: 'center', lineHeight: 1.15, color: i === 0 ? st.accent : undefined }}>
                  {theme.court}
                  {uniteEntete(theme) ? <span style={{ fontWeight: 400 }}> ({uniteEntete(theme)})</span> : null}
                </div>
              ))}
            </div>

            {/* Lignes */}
            <div style={{ padding: st.ecart ? `${st.ecart}px ${marge}px 0` : 0 }}>
              {lignesTriees.map((l, i) => (
                <div
                  key={l.code}
                  style={{
                    height: HAUTEUR_LIGNE,
                    marginBottom: st.ecart ? st.ecart : 0,
                    display: 'flex',
                    alignItems: 'center',
                    padding: st.ecart ? '0 20px' : `0 ${marge}px`,
                    background: i % 2 === 0 ? st.lignePaire : st.ligneImpaire,
                    borderTop: st.ecart ? 'none' : st.traitLigne,
                    borderRadius: st.ecart ? 14 : 0,
                    boxShadow: st.ecart ? st.ombreLigne : 'none',
                    borderLeft: st.ecart ? `6px solid ${st.accent}` : undefined,
                  }}
                >
                  <div style={{ width: 64, fontFamily: st.policeTitre, fontSize: 24, color: st.accent, fontStyle: st.rangItalique ? 'italic' : 'normal', fontWeight: st.titreGras ? 700 : 400 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 22, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {l.nom}
                    {l.alt != null ? <span style={{ marginLeft: 10, fontSize: 15, fontWeight: 400, color: st.secondaire }}>{l.alt} m</span> : null}
                  </div>
                  <div style={{ width: 70, textAlign: 'center', fontSize: 18, color: st.secondaire }}>{l.dep}</div>
                  {colonnesChoisies.map(({ theme }, j) => (
                    <div key={theme.id} style={{ width: largeurMesure, display: 'flex', justifyContent: 'center' }}>
                      {valeurDe(l, theme, j === 0)}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Pied */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: HAUTEUR_PIED, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${marge}px`, fontSize: 16, color: st.pied }}>
              <span>Relevés Météo-France{bilans.majA ? ` · ${new Date(bilans.majA).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })}` : ''}</span>
              <span style={{ fontFamily: st.policeTitre, fontSize: 22, color: st.piedMarque, letterSpacing: 0.5, fontWeight: st.titreGras ? 700 : 400 }}>www.alertes-meteo.com</span>
            </div>
          </div>
        </div>
      </div>

      {classement && (
        <div className="mt-10">
          <h3 className="mb-2 text-xl font-extrabold">Carte : {nomZone}</h3>
          <CarteInfo
            key={`${classement.id}-${zoneCarte}`}
            theme={classement}
            zone={zoneCarte}
            points={pointsCarte}
            sousTitre={fenetreDe(bilans, classement.id)}
            logoId={logoId}
            prefixeFichier={`carte-${classement.id}-${normaliser(nomZone).replace(/ /g, '-')}`}
            contexte="Observations des stations Météo-France"
            echelleValeurs={1.5}
          />
        </div>
      )}
    </section>
  );
}
