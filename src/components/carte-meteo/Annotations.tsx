'use client';

import { useRef, type CSSProperties, type PointerEvent as PointerEventReact } from 'react';

/**
 * Textes et icônes posés à la main sur la carte météo (clic sur la carte), déplaçables à la souris, inclus dans l'export JPG.
 * Icônes : météo (emojis), alertes (triangle jaune / orange / rouge) et vigilances (pastille de couleur et phénomène).
 */

export type FondTexte = 'aucun' | 'contour' | 'encadre' | 'bandeau';
export type PoliceTexte = 'impact' | 'arial' | 'georgia';

export interface Annotation {
  id: number;
  zone: string;
  x: number;
  y: number;
  type: 'texte' | 'icone';
  /** Texte (plusieurs lignes possibles) ou identifiant de l'icône (voir ICONES_*). */
  contenu: string;
  couleur: string;
  /** Taille en pixels de la carte (hauteur des lettres ou de l'icône). */
  taille: number;
  gras: boolean;
  fond: FondTexte;
  police: PoliceTexte;
}

export type ReglagesAnnotation = Pick<Annotation, 'couleur' | 'taille' | 'gras' | 'fond' | 'police'>;

export const COULEURS_TEXTE = [
  { valeur: '#ffffff', nom: 'Blanc' },
  { valeur: '#111111', nom: 'Noir' },
  { valeur: '#1e3a8a', nom: 'Bleu nuit' },
  { valeur: '#2563eb', nom: 'Bleu' },
  { valeur: '#16a34a', nom: 'Vert' },
  { valeur: '#facc15', nom: 'Jaune' },
  { valeur: '#f97316', nom: 'Orange' },
  { valeur: '#dc2626', nom: 'Rouge' },
  { valeur: '#7c3aed', nom: 'Violet' },
];

export const POLICES: { valeur: PoliceTexte; nom: string; css: string }[] = [
  { valeur: 'impact', nom: 'Impact (titres)', css: "Impact, 'Arial Narrow Bold', sans-serif" },
  { valeur: 'arial', nom: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { valeur: 'georgia', nom: 'Georgia', css: 'Georgia, serif' },
];

/** Icônes météo (emojis). */
export const ICONES_METEO = ['☀️', '🌤️', '⛅', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '⚡', '🌨️', '❄️', '🧊', '🌫️', '💨', '🌪️', '🌀', '🌊', '💧', '☔', '🌡️', '🔥', '🥵', '🥶', '🌈', '🏔️', '🌙'];

export const NIVEAUX_ALERTE = [
  { id: 'jaune', nom: 'Jaune', fond: '#ffe600', texte: '#111111' },
  { id: 'orange', nom: 'Orange', fond: '#ff8c00', texte: '#111111' },
  { id: 'rouge', nom: 'Rouge', fond: '#e30613', texte: '#ffffff' },
  { id: 'vert', nom: 'Vert', fond: '#28a745', texte: '#ffffff' },
] as const;
type NiveauAlerte = (typeof NIVEAUX_ALERTE)[number]['id'];

/** Phénomènes des vigilances (pastille de la couleur du niveau, symbole au centre). */
export const PHENOMENES = [
  { id: 'vent', nom: 'Vent violent', symbole: '💨' },
  { id: 'pluie', nom: 'Pluie-inondation', symbole: '🌧️' },
  { id: 'orages', nom: 'Orages', symbole: '⚡' },
  { id: 'crues', nom: 'Crues', symbole: '🌊' },
  { id: 'neige', nom: 'Neige-verglas', symbole: '❄️' },
  { id: 'canicule', nom: 'Canicule', symbole: '🌡️' },
  { id: 'froid', nom: 'Grand froid', symbole: '🥶' },
  { id: 'avalanches', nom: 'Avalanches', symbole: '🏔️' },
  { id: 'vagues', nom: 'Vagues-submersion', symbole: '🌀' },
  { id: 'feux', nom: 'Feux de forêt', symbole: '🔥' },
] as const;

/** Identifiants des icônes : emoji tel quel, « alerte:<niveau> » (triangle) ou « vigi:<niveau>:<phénomène> » (pastille). */
export const iconeAlerte = (niveau: NiveauAlerte) => `alerte:${niveau}`;
export const iconeVigilance = (niveau: NiveauAlerte, phenomene: string) => `vigi:${niveau}:${phenomene}`;

export function nomIcone(id: string): string {
  const [genre, niveau, phenomene] = id.split(':');
  const n = NIVEAUX_ALERTE.find((x) => x.id === niveau)?.nom.toLowerCase();
  if (genre === 'alerte') return `Alerte ${n}`;
  if (genre === 'vigi') return `Vigilance ${n} ${PHENOMENES.find((p) => p.id === phenomene)?.nom.toLowerCase() ?? ''}`.trim();
  return id;
}

/** Dessin d'une icône à la taille donnée (px). Couleurs en attributs SVG : html-to-image ne recopie pas les styles CSS du SVG. */
export function DessinIcone({ id, taille }: { id: string; taille: number }) {
  const [genre, niveau, phenomene] = id.split(':');
  const couleurs = NIVEAUX_ALERTE.find((x) => x.id === niveau) ?? NIVEAUX_ALERTE[1];
  if (genre === 'alerte') {
    return (
      <svg viewBox="0 0 100 90" width={taille * 1.1} height={taille} aria-hidden style={{ display: 'block' }}>
        <path d="M50 4 L96 84 Q98 88 93 88 L7 88 Q2 88 4 84 Z" fill={couleurs.fond} stroke="#111111" strokeWidth="6" strokeLinejoin="round" />
        <rect x="44" y="28" width="12" height="34" rx="5" fill="#111111" />
        <circle cx="50" cy="74" r="7" fill="#111111" />
      </svg>
    );
  }
  if (genre === 'vigi') {
    const symbole = PHENOMENES.find((p) => p.id === phenomene)?.symbole ?? '⚠️';
    return (
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: taille,
          height: taille,
          borderRadius: '50%',
          background: couleurs.fond,
          border: `${Math.max(2, taille * 0.07)}px solid #ffffff`,
          boxShadow: '0 1px 4px rgba(0,0,0,.55)',
          fontSize: taille * 0.55,
          lineHeight: 1,
        }}
      >
        {symbole}
      </span>
    );
  }
  // Ombre portée : certains emojis (tornade, brouillard) sont gris et se perdent sur le fond de carte.
  return <span style={{ display: 'block', fontSize: taille, lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.6))' }}>{id}</span>;
}

/** Couleur claire (jaune, blanc…) : contour noir et texte noir sur bandeau ; sinon contour blanc et texte blanc. */
function estClaire(hex: string): boolean {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return false;
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}

/** Style d'un texte posé : couleur, taille, police, et contour, encadré ou bandeau pour rester lisible sur le fond. */
function styleTexte(a: Annotation): CSSProperties {
  const police = POLICES.find((p) => p.valeur === a.police)?.css ?? POLICES[0].css;
  const clair = estClaire(a.couleur);
  const base: CSSProperties = {
    color: a.couleur,
    fontSize: a.taille,
    fontFamily: police,
    fontWeight: a.gras ? 700 : 400,
    lineHeight: 1.1,
    whiteSpace: 'pre',
    textAlign: 'center',
  };
  if (a.fond === 'contour') {
    const c = clair ? '#000000' : '#ffffff';
    const e = Math.max(1, Math.round(a.taille / 18));
    return { ...base, textShadow: `${e}px ${e}px 0 ${c}, -${e}px ${e}px 0 ${c}, ${e}px -${e}px 0 ${c}, -${e}px -${e}px 0 ${c}, 0 ${e}px 0 ${c}, 0 -${e}px 0 ${c}, ${e}px 0 0 ${c}, -${e}px 0 0 ${c}` };
  }
  if (a.fond === 'encadre') return { ...base, background: 'rgba(255,255,255,.92)', border: `2px solid ${a.couleur}`, borderRadius: 8, padding: '0.15em 0.4em', boxShadow: '0 2px 6px rgba(0,0,0,.35)' };
  if (a.fond === 'bandeau') return { ...base, color: clair ? '#111111' : '#ffffff', background: a.couleur, borderRadius: 6, padding: '0.15em 0.45em', boxShadow: '0 2px 6px rgba(0,0,0,.35)' };
  return base;
}

interface PropsCalque {
  annotations: Annotation[];
  /** Mise à l'échelle de la carte à l'écran (déplacements en pixels de la carte). */
  facteur: number;
  selection: number | null;
  /** Export en cours : ni cadre de sélection ni croix. */
  enExport: boolean;
  onSelectionner: (id: number | null) => void;
  onDeplacer: (id: number, x: number, y: number) => void;
  onSupprimer: (id: number) => void;
}

/** Calque des textes et icônes, posé par-dessus la carte (enfant de CarteRendu, donc inclus dans l'export). */
export function CalqueAnnotations({ annotations, facteur, selection, enExport, onSelectionner, onDeplacer, onSupprimer }: PropsCalque) {
  const glisser = useRef<{ id: number; sx: number; sy: number; x0: number; y0: number } | null>(null);

  const debut = (e: PointerEventReact<HTMLDivElement>, a: Annotation) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    glisser.current = { id: a.id, sx: e.clientX, sy: e.clientY, x0: a.x, y0: a.y };
    onSelectionner(a.id);
  };
  const pendant = (e: PointerEventReact<HTMLDivElement>) => {
    const g = glisser.current;
    if (!g) return;
    onDeplacer(g.id, Math.round(g.x0 + (e.clientX - g.sx) / facteur), Math.round(g.y0 + (e.clientY - g.sy) / facteur));
  };
  const fin = () => {
    glisser.current = null;
  };

  return (
    <>
      {annotations.map((a) => (
        <div
          key={a.id}
          className="cmap-annotation"
          style={{
            left: a.x,
            top: a.y,
            outline: !enExport && selection === a.id ? '2px dashed #f59e0b' : undefined,
            outlineOffset: 3,
          }}
          title="Glisser pour déplacer · clic pour modifier"
          onPointerDown={(e) => debut(e, a)}
          onPointerMove={pendant}
          onPointerUp={fin}
          onPointerCancel={fin}
          onClick={(e) => e.stopPropagation()}
        >
          {a.type === 'texte' ? <div style={styleTexte(a)}>{a.contenu || ' '}</div> : <DessinIcone id={a.contenu} taille={a.taille} />}
          {!enExport && (
            <button type="button" className="cmap-supprimer cmap-sans-export" style={{ fontSize: 22 }} title="Retirer" aria-label="Retirer" onClick={() => onSupprimer(a.id)}>
              ×
            </button>
          )}
        </div>
      ))}
    </>
  );
}

interface PropsPanneau {
  mode: 'texte' | 'icone' | null;
  onMode: (mode: 'texte' | 'icone' | null) => void;
  /** Texte et icône des prochains ajouts. */
  texte: string;
  onTexte: (texte: string) => void;
  icone: string;
  onIcone: (icone: string) => void;
  reglages: ReglagesAnnotation;
  onReglages: (r: Partial<ReglagesAnnotation>) => void;
  /** Annotation sélectionnée : les réglages s'y appliquent aussi. */
  selection: Annotation | null;
  onDeselectionner: () => void;
  nombre: number;
  onToutRetirer: () => void;
}

const nomChamp = 'mt-0.5 block w-full rounded-md border border-border bg-surface p-1 text-sm';

/** Panneau « Textes et icônes » de la barre latérale de la carte météo. */
export function PanneauAnnotations({ mode, onMode, texte, onTexte, icone, onIcone, reglages, onReglages, selection, onDeselectionner, nombre, onToutRetirer }: PropsPanneau) {
  const typeEdite = selection?.type ?? mode;
  const niveauVigi = (icone.startsWith('vigi:') || icone.startsWith('alerte:') ? icone.split(':')[1] : 'orange') as NiveauAlerte;
  return (
    <div className="mt-3 rounded-lg border border-border p-2">
      <p className="text-sm font-semibold">Textes et icônes</p>
      <div className="mt-1 flex gap-1">
        {(
          [
            ['texte', 'Ajouter du texte'],
            ['icone', 'Ajouter une icône'],
          ] as const
        ).map(([m, libelle]) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => onMode(mode === m ? null : m)}
            className={`flex-1 rounded-md border px-1.5 py-1 text-xs font-semibold ${mode === m ? 'border-primary bg-primary text-white' : 'border-border'}`}
          >
            {libelle}
          </button>
        ))}
      </div>
      {mode && !selection && <p className="mt-1 text-xs text-muted">Clique sur la carte à l&apos;endroit voulu. Ensuite, glisse pour déplacer ; clic dessus pour modifier ; la croix rouge le retire.</p>}
      {selection && (
        <p className="mt-1 text-xs font-medium text-primary">
          {selection.type === 'texte' ? 'Texte sélectionné' : 'Icône sélectionnée'} : les réglages ci-dessous s&apos;y appliquent.{' '}
          <button type="button" onClick={onDeselectionner} className="underline">
            Terminer
          </button>
        </p>
      )}

      {typeEdite === 'texte' && (
        <label className="mt-2 block text-xs font-medium">
          Texte
          <textarea value={selection ? selection.contenu : texte} onChange={(e) => onTexte(e.target.value)} rows={2} className={nomChamp} placeholder="Ex. : Vigilance orange orages" />
        </label>
      )}

      {typeEdite === 'icone' && (
        <div className="mt-2">
          <p className="text-xs font-medium">Météo</p>
          <div className="mt-0.5 grid grid-cols-7 gap-0.5">
            {ICONES_METEO.map((e) => (
              <button key={e} type="button" aria-pressed={(selection?.contenu ?? icone) === e} onClick={() => onIcone(e)} className={`rounded p-0.5 text-lg leading-none ${(selection?.contenu ?? icone) === e ? 'bg-primary/20 ring-1 ring-primary' : 'hover:bg-bg'}`}>
                {e}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs font-medium">Alertes et vigilances</p>
          <div className="mt-0.5 flex gap-1">
            {NIVEAUX_ALERTE.map((n) => (
              <button key={n.id} type="button" title={`Alerte ${n.nom.toLowerCase()}`} aria-pressed={(selection?.contenu ?? icone) === iconeAlerte(n.id)} onClick={() => onIcone(iconeAlerte(n.id))} className={`rounded p-0.5 ${(selection?.contenu ?? icone) === iconeAlerte(n.id) ? 'ring-1 ring-primary' : ''}`}>
                <DessinIcone id={iconeAlerte(n.id)} taille={22} />
              </button>
            ))}
          </div>
          <label className="mt-1 block text-xs font-medium">
            Couleur de vigilance
            <select
              value={niveauVigi}
              onChange={(e) => {
                const actuelle = selection?.contenu ?? icone;
                const phen = actuelle.startsWith('vigi:') ? actuelle.split(':')[2] : PHENOMENES[2].id;
                onIcone(actuelle.startsWith('alerte:') ? iconeAlerte(e.target.value as NiveauAlerte) : iconeVigilance(e.target.value as NiveauAlerte, phen));
              }}
              className={nomChamp}
            >
              {NIVEAUX_ALERTE.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nom}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-1 grid grid-cols-5 gap-0.5">
            {PHENOMENES.map((p) => {
              const id = iconeVigilance(niveauVigi, p.id);
              return (
                <button key={p.id} type="button" title={`Vigilance ${p.nom.toLowerCase()}`} aria-pressed={(selection?.contenu ?? icone) === id} onClick={() => onIcone(id)} className={`flex justify-center rounded p-0.5 ${(selection?.contenu ?? icone) === id ? 'ring-1 ring-primary' : ''}`}>
                  <DessinIcone id={id} taille={26} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {typeEdite && (
        <>
          <label className="mt-2 block text-xs font-medium">
            Taille : {reglages.taille} px
            <input type="range" min={typeEdite === 'texte' ? 12 : 20} max={typeEdite === 'texte' ? 90 : 140} value={reglages.taille} onChange={(e) => onReglages({ taille: Number(e.target.value) })} className="block w-full" />
          </label>
          {typeEdite === 'texte' && (
            <>
              <p className="mt-2 text-xs font-medium">Couleur</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                {COULEURS_TEXTE.map((c) => (
                  <button
                    key={c.valeur}
                    type="button"
                    title={c.nom}
                    aria-label={c.nom}
                    aria-pressed={reglages.couleur === c.valeur}
                    onClick={() => onReglages({ couleur: c.valeur })}
                    className={`h-5 w-5 rounded-full border ${reglages.couleur === c.valeur ? 'ring-2 ring-primary ring-offset-1' : 'border-border'}`}
                    style={{ background: c.valeur }}
                  />
                ))}
                <input type="color" value={reglages.couleur} onChange={(e) => onReglages({ couleur: e.target.value })} title="Autre couleur" className="h-6 w-7 cursor-pointer rounded border border-border bg-surface p-0" />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1">
                <label className="text-xs font-medium">
                  Police
                  <select value={reglages.police} onChange={(e) => onReglages({ police: e.target.value as PoliceTexte })} className={nomChamp}>
                    {POLICES.map((p) => (
                      <option key={p.valeur} value={p.valeur}>
                        {p.nom}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium">
                  Fond
                  <select value={reglages.fond} onChange={(e) => onReglages({ fond: e.target.value as FondTexte })} className={nomChamp}>
                    <option value="contour">Contour</option>
                    <option value="aucun">Aucun</option>
                    <option value="encadre">Encadré blanc</option>
                    <option value="bandeau">Bandeau couleur</option>
                  </select>
                </label>
              </div>
              <label className="mt-1 flex items-center gap-2 text-xs font-medium">
                <input type="checkbox" checked={reglages.gras} onChange={(e) => onReglages({ gras: e.target.checked })} />
                Gras
              </label>
            </>
          )}
        </>
      )}

      {nombre > 0 && (
        <button type="button" className="btn-ghost mt-2 rounded-md px-2 py-1 text-xs" onClick={onToutRetirer}>
          Retirer les textes et icônes ({nombre})
        </button>
      )}
    </div>
  );
}
