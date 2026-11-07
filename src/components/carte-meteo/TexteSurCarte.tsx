'use client';

import { useEffect, useRef, useState, type PointerEvent as PointerEventReact, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { COULEURS_TEXTE, POLICES, styleTexte, type Annotation, type FondTexte, type PoliceTexte } from './Annotations';

/**
 * Texte libre « sur demande » pour toutes les cartes et planches exportées en JPG.
 * Le bouton déroule un petit panneau ; le texte est posé d'un clic sur la carte, déplaçable à la souris, et recopié dans l'export
 * (le calque est injecté dans le nœud exporté, via un portail). Rien n'apparaît tant que le bouton n'est pas utilisé.
 */

type Reglages = Pick<Annotation, 'couleur' | 'taille' | 'gras' | 'fond' | 'police'>;

const REGLAGES_DEFAUT: Reglages = { couleur: '#ffffff', taille: 36, gras: true, fond: 'contour', police: 'impact' };

const champ = 'mt-0.5 block w-full rounded-md border border-border bg-surface p-1 text-sm';

export default function TexteSurCarte({ cible }: { cible: RefObject<HTMLElement | null> }) {
  const [ouvert, setOuvert] = useState(false);
  const [noeud, setNoeud] = useState<HTMLElement | null>(null);
  const [textes, setTextes] = useState<Annotation[]>([]);
  const [selection, setSelection] = useState<number | null>(null);
  const [pose, setPose] = useState(false);
  const [texteNouveau, setTexteNouveau] = useState('');
  const [reglages, setReglages] = useState<Reglages>(REGLAGES_DEFAUT);
  const glisser = useRef<{ id: number; sx: number; sy: number; x0: number; y0: number; echelle: number } | null>(null);

  // Le nœud exporté peut changer (autre vue, autre rendu) : on le relit à chaque rendu.
  useEffect(() => {
    const courant = cible.current;
    if (courant !== noeud) setNoeud(courant);
    if (courant && getComputedStyle(courant).position === 'static') courant.style.position = 'relative';
  });

  const choisi = textes.find((t) => t.id === selection) ?? null;

  function modifier(champs: Partial<Annotation>) {
    if (!choisi) return;
    setTextes((liste) => liste.map((t) => (t.id === choisi.id ? { ...t, ...champs } : t)));
  }

  function majReglages(r: Partial<Reglages>) {
    setReglages((x) => ({ ...x, ...r }));
    modifier(r);
  }

  function poserAuClic(e: React.MouseEvent<HTMLDivElement>) {
    const cadre = e.currentTarget.getBoundingClientRect();
    const echelle = cadre.width / (e.currentTarget.offsetWidth || cadre.width) || 1;
    const id = Date.now();
    setTextes((liste) => [
      ...liste,
      {
        id,
        zone: '',
        x: Math.round((e.clientX - cadre.left) / echelle),
        y: Math.round((e.clientY - cadre.top) / echelle),
        type: 'texte',
        contenu: texteNouveau || 'Texte',
        ...reglages,
      },
    ]);
    setSelection(id);
    setPose(false);
  }

  function debut(e: PointerEventReact<HTMLDivElement>, t: Annotation) {
    if ((e.target as HTMLElement).closest('button')) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const parent = e.currentTarget.parentElement as HTMLElement;
    const echelle = parent.getBoundingClientRect().width / (parent.offsetWidth || 1) || 1;
    glisser.current = { id: t.id, sx: e.clientX, sy: e.clientY, x0: t.x, y0: t.y, echelle };
    setSelection(t.id);
    setTexteNouveau(t.contenu);
    setReglages({ couleur: t.couleur, taille: t.taille, gras: t.gras, fond: t.fond, police: t.police });
  }

  function pendant(e: PointerEventReact<HTMLDivElement>) {
    const g = glisser.current;
    if (!g) return;
    const x = Math.round(g.x0 + (e.clientX - g.sx) / g.echelle);
    const y = Math.round(g.y0 + (e.clientY - g.sy) / g.echelle);
    setTextes((liste) => liste.map((t) => (t.id === g.id ? { ...t, x, y } : t)));
  }

  const calque =
    noeud && textes.length + (pose ? 1 : 0) > 0
      ? createPortal(
          <div
            className="cmap-texte-libre"
            style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: pose ? 'auto' : 'none', cursor: pose ? 'crosshair' : undefined }}
            onClick={pose ? poserAuClic : undefined}
          >
            {textes.map((t) => (
              <div
                key={t.id}
                className="cmap-annotation"
                style={{ left: t.x, top: t.y, pointerEvents: 'auto', zIndex: 21 }}
                title="Glisser pour déplacer · clic pour modifier"
                onPointerDown={(e) => debut(e, t)}
                onPointerMove={pendant}
                onPointerUp={() => (glisser.current = null)}
                onPointerCancel={() => (glisser.current = null)}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={styleTexte(t)}>{t.contenu || ' '}</div>
                {/* Cadre de sélection et croix : classe reconnue par exporterEnJpg, donc absents de l'image. */}
                {selection === t.id && <span className="cmap-sans-export" style={{ position: 'absolute', inset: -4, border: '2px dashed #f59e0b', pointerEvents: 'none' }} />}
                <button
                  type="button"
                  className="cmap-supprimer cmap-sans-export"
                  style={{ fontSize: 22 }}
                  title="Retirer"
                  aria-label="Retirer"
                  onClick={() => {
                    setTextes((liste) => liste.filter((x) => x.id !== t.id));
                    if (selection === t.id) setSelection(null);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>,
          noeud
        )
      : null;

  return (
    <div className="mb-2">
      <button
        type="button"
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
        className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${ouvert ? 'border-primary bg-primary text-white' : 'border-border'}`}
      >
        {textes.length > 0 ? `Texte sur la carte (${textes.length})` : 'Ajouter un texte sur la carte'}
      </button>
      {calque}
      {ouvert && (
        <div className="mt-2 max-w-md rounded-lg border border-border bg-surface p-3 text-sm">
          <label className="block text-xs font-medium">
            Texte
            <textarea
              value={texteNouveau}
              onChange={(e) => {
                setTexteNouveau(e.target.value);
                modifier({ contenu: e.target.value });
              }}
              rows={2}
              className={champ}
              placeholder="Ex. : Vigilance orange orages"
            />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={pose}
              onClick={() => {
                setSelection(null);
                setPose((p) => !p);
              }}
              className={`rounded-md border px-2 py-1 text-xs font-semibold ${pose ? 'border-primary bg-primary text-white' : 'border-border'}`}
            >
              {pose ? 'Clique sur la carte…' : 'Poser sur la carte'}
            </button>
            {choisi && (
              <button type="button" onClick={() => setSelection(null)} className="text-xs underline">
                Terminer
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-muted">
            {choisi ? 'Texte sélectionné : les réglages s’y appliquent.' : 'Saisis le texte, clique « Poser sur la carte » puis sur l’endroit voulu. Ensuite : glisse pour déplacer, clic dessus pour modifier, croix rouge pour retirer.'}
          </p>
          <label className="mt-2 block text-xs font-medium">
            Taille : {reglages.taille} px
            <input type="range" min={12} max={120} value={reglages.taille} onChange={(e) => majReglages({ taille: Number(e.target.value) })} className="block w-full" />
          </label>
          <p className="mt-2 text-xs font-medium">Couleur</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {COULEURS_TEXTE.map((c) => (
              <button
                key={c.valeur}
                type="button"
                title={c.nom}
                aria-label={c.nom}
                aria-pressed={reglages.couleur === c.valeur}
                onClick={() => majReglages({ couleur: c.valeur })}
                className={`h-5 w-5 rounded-full border ${reglages.couleur === c.valeur ? 'ring-2 ring-primary ring-offset-1' : 'border-border'}`}
                style={{ background: c.valeur }}
              />
            ))}
            <input type="color" value={reglages.couleur} onChange={(e) => majReglages({ couleur: e.target.value })} title="Autre couleur" className="h-6 w-7 cursor-pointer rounded border border-border bg-surface p-0" />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1">
            <label className="text-xs font-medium">
              Police
              <select value={reglages.police} onChange={(e) => majReglages({ police: e.target.value as PoliceTexte })} className={champ}>
                {POLICES.map((p) => (
                  <option key={p.valeur} value={p.valeur}>
                    {p.nom}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium">
              Fond
              <select value={reglages.fond} onChange={(e) => majReglages({ fond: e.target.value as FondTexte })} className={champ}>
                <option value="contour">Contour</option>
                <option value="aucun">Aucun</option>
                <option value="encadre">Encadré blanc</option>
                <option value="bandeau">Bandeau couleur</option>
              </select>
            </label>
          </div>
          <label className="mt-1 flex items-center gap-2 text-xs font-medium">
            <input type="checkbox" checked={reglages.gras} onChange={(e) => majReglages({ gras: e.target.checked })} />
            Gras
          </label>
          {textes.length > 0 && (
            <button
              type="button"
              className="btn-ghost mt-2 rounded-md px-2 py-1 text-xs"
              onClick={() => {
                setTextes([]);
                setSelection(null);
              }}
            >
              Retirer tous les textes ({textes.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
