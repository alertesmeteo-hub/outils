'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { palierDe, texteInfo, THEMES_BILAN, type ThemeBilan } from '@/lib/carte-meteo/cartes-info';
import { COLONNES, uniteEntete } from '@/lib/carte-meteo/colonnes-releves';
import { exporterEnJpg } from '@/lib/carte-meteo/ExportJpg';
import { LOGOS_PRESETS } from '@/lib/carte-meteo/logos';
import { ajouterJours } from '@/lib/carte-meteo/previsions-modeles';
import { STYLES_TABLEAU, type StyleTableau } from '@/lib/carte-meteo/styles-tableau';
import { lireListeValeurs } from '@/lib/carte-meteo/tab-val';
import { normaliser } from './CarteMeteo';

/**
 * « Tab Val » : on colle une liste de valeurs (« 20.9°C à Perpignan - El Vernet », une par ligne), on choisit la mesure (T° maxi d'hier,
 * rafales maxi, pluie…) et l'un des quatorze styles de tableau : l'outil classe la liste, colore les valeurs selon les paliers de la mesure
 * et exporte le tableau en JPG.
 */

/** Largeur logique de l'image (exportée à 1,5 ×) ; la hauteur dépend du nombre de lignes. */
const LARGEUR = 1280;
const HAUTEUR_ENTETE = 128;
const HAUTEUR_LIGNE = 50;
const HAUTEUR_PIED = 48;
const MAX_LIGNES = 50;
const NOMBRES_LIGNES = [0, 10, 15, 20, 25, 30, 40] as const;
const CLE_MEMOIRE = 'tab-val-v1';

const jourLong = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
const jourCourt = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', timeZone: 'UTC' }).toUpperCase();

interface ModeleTab {
  id: string;
  libelle: string;
  /** Mesure du tableau (thème des relevés : paliers de couleur, unité, titre) ; vide : celle choisie dans « Autre mesure ». */
  themeId: string;
  /** Titre à la place de celui de la mesure. */
  titre?: string;
  /** Sens du classement ; absent : celui de la mesure. */
  sens?: 'asc' | 'desc';
  /** Période écrite dans le sous-titre. */
  periode: (aujourdhui: string) => string;
}
const hier = (a: string) => ajouterJours(a, -1);
const MODELES_TAB: ModeleTab[] = [
  { id: 'tx-hier', libelle: '🔥 T° maxi d’hier', themeId: 'tx-veille-direct', sens: 'desc', periode: (a) => `HIER · ${jourLong(hier(a))}` },
  { id: 'tn-nuit', libelle: '🥶 T° mini de la nuit dernière', themeId: 'tn-veille-direct', sens: 'asc', periode: (a) => `NUIT DU ${jourCourt(hier(a))} AU ${jourLong(a)}` },
  { id: 'tx-jour', libelle: '☀️ T° maxi du jour', themeId: 'tx-jour-direct', sens: 'desc', periode: (a) => `AUJOURD’HUI · ${jourLong(a)} (PROVISOIRE)` },
  { id: 'tn-jour', libelle: '❄️ T° mini de cette nuit', themeId: 'tn-jour-direct', sens: 'asc', periode: (a) => `NUIT DU ${jourCourt(hier(a))} AU ${jourLong(a)} (PROVISOIRE)` },
  { id: 't-moment', libelle: '🌡️ T° du moment', themeId: 'obs-t', sens: 'desc', titre: 'TEMPÉRATURES DU MOMENT', periode: () => 'RELEVÉS DU MOMENT' },
  { id: 'raf-hier', libelle: '💨 Rafales maxi d’hier', themeId: 'obs-raf24', sens: 'desc', titre: 'RAFALES MAXIMALES D’HIER', periode: (a) => `HIER · ${jourLong(hier(a))}` },
  { id: 'raf-24h', libelle: '💨 Rafales maxi (24 h)', themeId: 'obs-raf24', sens: 'desc', periode: () => 'LES 24 DERNIÈRES HEURES' },
  { id: 'pluie-hier', libelle: '🌧️ Pluie d’hier', themeId: 'obs-rr24', sens: 'desc', titre: 'PLUIE D’HIER', periode: (a) => `HIER · ${jourLong(hier(a))}` },
  { id: 'pluie-24h', libelle: '🌧️ Pluie (24 h)', themeId: 'obs-rr24', sens: 'desc', periode: () => 'LES 24 DERNIÈRES HEURES' },
  { id: 'pluie-jour', libelle: '🌦️ Pluie du jour', themeId: 'pluie-releve', sens: 'desc', periode: (a) => `AUJOURD’HUI · ${jourLong(a)}` },
  { id: 'autre', libelle: '➕ Autre mesure…', themeId: '', periode: () => '' },
];

const selectBarre = 'rounded-lg border border-border bg-surface p-1.5 text-sm';
const EXEMPLE = `20.9°C à Perpignan - El Vernet
20.7°C à Cabestany
20.2°C à Céret
19.7°C au Boulou
18°C à Eus
11.9°C à Targassonne`;

export default function TabVal({ aujourdhui }: { aujourdhui: string }) {
  const [texte, setTexte] = useState('');
  const [modeleId, setModeleId] = useState('tx-hier');
  const [autreId, setAutreId] = useState('obs-tx24');
  const [classement, setClassement] = useState<'auto' | 'desc' | 'asc' | 'liste'>('auto');
  const [nombre, setNombre] = useState<(typeof NOMBRES_LIGNES)[number]>(0);
  const [lieu, setLieu] = useState('Pyrénées-Orientales');
  const [styleId, setStyleId] = useState(STYLES_TABLEAU[0].id);
  const [logoId, setLogoId] = useState('pays-catalan-hd');
  const [avecRang, setAvecRang] = useState(true);
  const [source, setSource] = useState('');
  const [titreSaisi, setTitreSaisi] = useState<string | null>(null);
  const [sousTitreSaisi, setSousTitreSaisi] = useState<string | null>(null);
  const [enExport, setEnExport] = useState(false);
  const [erreurExport, setErreurExport] = useState<string | null>(null);
  const [facteur, setFacteur] = useState(1);
  const colonneRef = useRef<HTMLDivElement>(null);
  const planchRef = useRef<HTMLDivElement>(null);

  // La dernière liste collée est gardée dans le navigateur : on la retrouve à la réouverture.
  useEffect(() => {
    try {
      const memo = localStorage.getItem(CLE_MEMOIRE);
      if (memo) setTexte(memo);
    } catch {
      // stockage indisponible : liste vide
    }
  }, []);
  function changerTexte(valeur: string) {
    setTexte(valeur);
    try {
      localStorage.setItem(CLE_MEMOIRE, valeur);
    } catch {
      // stockage indisponible ou plein : la liste reste à l'écran
    }
  }

  useEffect(() => {
    const colonne = colonneRef.current;
    if (!colonne) return;
    const observateur = new ResizeObserver(() => setFacteur(Math.min(1, colonne.clientWidth / LARGEUR)));
    observateur.observe(colonne);
    return () => observateur.disconnect();
  }, []);

  const st: StyleTableau = STYLES_TABLEAU.find((x) => x.id === styleId) ?? STYLES_TABLEAU[0];
  const modele = MODELES_TAB.find((m) => m.id === modeleId) ?? MODELES_TAB[0];
  const theme: ThemeBilan | undefined = THEMES_BILAN.find((t) => t.id === (modele.themeId || autreId));
  const lecture = useMemo(() => lireListeValeurs(texte), [texte]);
  const sens: 'asc' | 'desc' = classement === 'asc' || classement === 'desc' ? classement : modele.sens ?? theme?.ordre ?? 'desc';
  const lignes = useMemo(() => {
    const l = [...lecture.lignes];
    if (classement !== 'liste') {
      const d = sens === 'asc' ? 1 : -1;
      l.sort((a, b) => d * (a.valeur - b.valeur) || a.nom.localeCompare(b.nom, 'fr'));
    }
    return l.slice(0, nombre || MAX_LIGNES);
  }, [lecture, classement, sens, nombre]);

  const suffixe = classement === 'liste' || !theme ? '' : sens === theme.ordre && theme.titreTop ? theme.titreTop.toUpperCase() : sens === 'asc' ? 'LES PLUS BAS' : 'LES PLUS ÉLEVÉS';
  const titreAuto = theme ? `${modele.titre ?? theme.titre}${suffixe ? ` : ${suffixe}` : ''}` : '';
  const sousTitreAuto = [modele.periode(aujourdhui), lieu.toUpperCase()].filter(Boolean).join(' · ');
  const titre = titreSaisi ?? titreAuto;
  const sousTitre = sousTitreSaisi ?? sousTitreAuto;
  const logo = LOGOS_PRESETS.find((l) => l.id === logoId);
  const pasLigne = HAUTEUR_LIGNE + st.ecart;
  const hauteur = HAUTEUR_ENTETE + 14 + Math.max(lignes.length, 1) * pasLigne + HAUTEUR_PIED;
  const largeurMesure = st.valeur === 'barre' ? 300 : 200;
  const marge = st.ecart ? 28 : 36;
  // Titre sur une seule ligne : police réduite quand il est long.
  const largeurTitre = LARGEUR - 2 * marge - 52 - (logo?.fichier ? 230 : 0);
  const tailleTitre = Math.max(22, Math.min(38, Math.floor(largeurTitre / (Math.max(titre.length, 1) * (st.policeTitre.startsWith('Impact') ? 0.5 : 0.62)))));
  const etendue = useMemo(() => {
    const v = lignes.map((l) => l.valeur);
    return { min: v.length ? Math.min(...v) : 0, max: v.length ? Math.max(...v) : 0 };
  }, [lignes]);
  const uniteTheme = theme ? uniteEntete(theme) : null;
  const uniteListe = lecture.unite === '°' ? '°C' : lecture.unite;
  const uniteIncoherente = !!uniteTheme && !!uniteListe && uniteTheme !== uniteListe;

  async function exporter() {
    if (!planchRef.current) return;
    setErreurExport(null);
    setEnExport(true);
    try {
      await exporterEnJpg(planchRef.current, `tab-val-${modele.id === 'autre' ? autreId : modele.id}-${st.id}-${normaliser(lieu).replace(/ /g, '-')}-${aujourdhui}`, LARGEUR, hauteur);
    } catch (e) {
      console.error('Export du tableau Tab Val en JPG', e);
      setErreurExport("L'export a échoué. Réessayez dans un instant.");
    } finally {
      setEnExport(false);
    }
  }

  /** Une valeur dans le style choisi : pastille, pastille plate, texte avec puce de couleur, ou barre ; la couleur suit les paliers de la mesure. */
  function valeurDe(v: number) {
    if (!theme) return <span>{String(v)}</span>;
    const palier = palierDe(theme.paliers, v);
    const colore = !palier.neutre;
    const fond = colore ? palier.fond : st.neutreFond;
    const texteCouleur = colore ? palier.texte : st.neutreTexte;
    const nombreTexte = texteInfo(theme, v);
    if (st.valeur === 'texte') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: 150, fontVariantNumeric: 'tabular-nums', fontFamily: st.policeValeur, fontSize: 30, lineHeight: 1, color: st.texte, fontWeight: 700 }}>
          <span style={{ width: 14, height: 14, borderRadius: st.puceRonde ? 14 : 3, background: fond, border: `1px solid ${st.puceBordure}`, display: 'inline-block' }} />
          {nombreTexte}
        </span>
      );
    }
    if (st.valeur === 'barre') {
      const part = etendue.max === etendue.min ? 1 : 0.5 + (0.5 * (v - etendue.min)) / (etendue.max - etendue.min);
      return (
        <span style={{ display: 'block', width: largeurMesure - 12, height: 44, background: st.barreFond, borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
          <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(part * 100)}%`, background: fond, borderRadius: 6 }} />
          <span style={{ position: 'absolute', left: 12, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontFamily: st.policeValeur, fontSize: 29, lineHeight: 1, color: texteCouleur }}>{nombreTexte}</span>
        </span>
      );
    }
    const pastille: CSSProperties =
      st.valeur === 'pastille'
        ? { border: `2px solid ${st.pastilleBordure}`, boxShadow: st.pastilleOmbre, borderRadius: 10 }
        : { border: 'none', boxShadow: st.valeur === 'neon' ? `0 0 14px ${fond}, 0 0 4px ${fond}` : 'none', borderRadius: st.valeur === 'neon' ? 8 : 20 };
    return <span style={{ ...pastille, background: fond, color: texteCouleur, fontFamily: st.policeValeur, fontSize: 28, lineHeight: 1, padding: '5px 16px 4px', minWidth: 110, textAlign: 'center' }}>{nombreTexte}</span>;
  }

  return (
    <section>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 rounded-2xl border-2 border-primary/30 bg-primary/5 p-5">
          <label className="text-sm font-medium">
            <span className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-primary">
              Ma liste de valeurs
              <button type="button" onClick={() => changerTexte(EXEMPLE)} className="rounded border border-border bg-surface px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-text">
                Insérer un exemple
              </button>
            </span>
            <textarea
              value={texte}
              onChange={(e) => changerTexte(e.target.value)}
              rows={12}
              spellCheck={false}
              placeholder={`Une valeur par ligne, par exemple :\n${EXEMPLE}`}
              className={`${selectBarre} w-full font-mono`}
            />
          </label>
          <p className="text-xs text-muted">
            {lecture.lignes.length} ligne{lecture.lignes.length > 1 ? 's' : ''} comprise{lecture.lignes.length > 1 ? 's' : ''}
            {lecture.ignorees.length > 0 ? `, ${lecture.ignorees.length} ignorée${lecture.ignorees.length > 1 ? 's' : ''}` : ''}. Formats : « 20.9°C à Perpignan », « 45 km/h au Perthus », « Céret : 20,2°C ».
          </p>
          {lecture.ignorees.length > 0 && (
            <p role="alert" className="rounded-lg border border-amber-400 bg-amber-50 p-2 text-xs text-amber-900">
              Lignes non comprises : {lecture.ignorees.slice(0, 4).join(' | ')}
              {lecture.ignorees.length > 4 ? '…' : ''}
            </p>
          )}

          <label className="text-sm font-medium">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-primary">Mesure du tableau</span>
            <select value={modeleId} onChange={(e) => { setModeleId(e.target.value); setTitreSaisi(null); setSousTitreSaisi(null); }} className={`${selectBarre} w-full`}>
              {MODELES_TAB.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.libelle}
                </option>
              ))}
            </select>
          </label>
          {modele.id === 'autre' && (
            <label className="text-sm font-medium">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-primary">Autre mesure</span>
              <select value={autreId} onChange={(e) => { setAutreId(e.target.value); setTitreSaisi(null); }} className={`${selectBarre} w-full`}>
                {COLONNES.map(({ theme: t }) => (
                  <option key={t.id} value={t.id}>
                    {t.court} ({uniteEntete(t) || 'sans unité'})
                  </option>
                ))}
              </select>
            </label>
          )}
          {uniteIncoherente && (
            <p role="alert" className="rounded-lg border border-amber-400 bg-amber-50 p-2 text-xs text-amber-900">
              Ta liste est en {uniteListe} mais cette mesure est en {uniteTheme} : choisis une mesure dans la même unité (les couleurs en dépendent).
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-primary">Classement</span>
              <select value={classement} onChange={(e) => { setClassement(e.target.value as typeof classement); setTitreSaisi(null); }} className={`${selectBarre} w-full`}>
                <option value="auto">Selon la mesure</option>
                <option value="desc">Du plus élevé au plus bas</option>
                <option value="asc">Du plus bas au plus élevé</option>
                <option value="liste">Ordre de ma liste</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-primary">Lignes</span>
              <select value={nombre} onChange={(e) => setNombre(Number(e.target.value) as (typeof NOMBRES_LIGNES)[number])} className={`${selectBarre} w-full`}>
                {NOMBRES_LIGNES.map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? 'Toutes' : n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="text-sm font-medium">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-primary">Lieu (sous-titre)</span>
            <input value={lieu} onChange={(e) => { setLieu(e.target.value); setSousTitreSaisi(null); }} className={`${selectBarre} w-full`} />
          </label>
          <label className="text-sm font-medium">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-primary">Titre</span>
            <input value={titre} onChange={(e) => setTitreSaisi(e.target.value.toUpperCase())} className={`${selectBarre} w-full`} />
          </label>
          <label className="text-sm font-medium">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-primary">Sous-titre</span>
            <input value={sousTitre} onChange={(e) => setSousTitreSaisi(e.target.value.toUpperCase())} className={`${selectBarre} w-full`} />
          </label>
          {(titreSaisi !== null || sousTitreSaisi !== null) && (
            <button type="button" onClick={() => { setTitreSaisi(null); setSousTitreSaisi(null); }} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium">
              ↺ Titres automatiques
            </button>
          )}
          <label className="text-sm font-medium">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-primary">Source (en bas à gauche, facultative)</span>
            <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="ex. Relevés Météo-France" className={`${selectBarre} w-full`} />
          </label>
          <label className="text-sm font-medium">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-primary">Logo</span>
            <select value={logoId} onChange={(e) => setLogoId(e.target.value)} className={`${selectBarre} w-full`}>
              {LOGOS_PRESETS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nom}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={avecRang} onChange={(e) => setAvecRang(e.target.checked)} />
            Numéros de rang
          </label>
          <button type="button" onClick={exporter} disabled={enExport || lignes.length === 0 || !theme} className="btn-primary rounded-lg px-4 py-3 font-semibold disabled:opacity-60">
            {enExport ? 'Export en cours…' : '🖼️ Exporter en JPG'}
          </button>
          {erreurExport && (
            <p role="alert" className="text-sm text-danger">
              {erreurExport}
            </p>
          )}
        </div>

        <div className="min-w-0">
          <fieldset className="mb-4">
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

          <div ref={colonneRef} className="min-w-0">
            {lignes.length === 0 && (
              <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">Colle ta liste de valeurs à gauche (une par ligne) : le tableau apparaît ici.</p>
            )}
            <div style={{ height: hauteur * facteur, display: lignes.length ? undefined : 'none' }}>
              <div
                ref={planchRef}
                style={{ width: LARGEUR, height: hauteur, transform: `scale(${facteur})`, transformOrigin: 'top left', background: st.fond, color: st.texte, fontFamily: st.police, position: 'relative', overflow: 'hidden' }}
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
                <div style={{ height: 14 }} />

                {/* Lignes */}
                <div style={{ padding: st.ecart ? `${st.ecart}px ${marge}px 0` : 0 }}>
                  {lignes.map((l, i) => (
                    <div
                      key={`${l.nom}-${i}`}
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
                      {avecRang && (
                        <div style={{ width: 52, flexShrink: 0, fontFamily: st.policeValeur, fontSize: 24, color: st.accent, fontStyle: st.rangItalique ? 'italic' : undefined, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0, fontSize: 24, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nom}</div>
                      <div style={{ width: largeurMesure, display: 'flex', justifyContent: 'center' }}>{valeurDe(l.valeur)}</div>
                    </div>
                  ))}
                </div>

                {/* Pied */}
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: HAUTEUR_PIED, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${marge}px`, fontSize: 16, color: st.pied }}>
                  <span>{source}</span>
                  <span style={{ fontFamily: st.policeTitre, fontSize: 22, color: st.piedMarque, letterSpacing: 0.5, fontWeight: st.titreGras ? 700 : 400 }}>www.alertes-meteo.com</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
