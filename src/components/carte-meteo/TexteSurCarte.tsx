'use client';

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as PointerEventReact, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { CarteTexte, FormatTexte } from '@/lib/carte-meteo/texte-ia';
import { redigerTexte } from '@/lib/carte-meteo/texte-auto';
import { COULEURS_TEXTE, POLICES, styleTexte, type Annotation, type FondTexte, type PoliceTexte } from './Annotations';

/**
 * Texte libre « sur demande » pour toutes les cartes et planches exportées en JPG.
 * Le bouton déroule un petit panneau ; le texte est posé d'un clic sur la carte, déplaçable à la souris, et recopié dans l'export
 * (le calque est injecté dans le nœud exporté, via un portail). Rien n'apparaît tant que le bouton n'est pas utilisé.
 */

type Reglages = Pick<Annotation, 'couleur' | 'taille' | 'gras' | 'fond' | 'police'>;

/** Identifiant de l'encadré de rédaction posé sur la carte. */
const ID_REDACTION = 1;

const REGLAGES_DEFAUT: Reglages = { couleur: '#ffffff', taille: 36, gras: true, fond: 'contour', police: 'impact' };

const champ = 'mt-0.5 block w-full rounded-md border border-border bg-surface p-1 text-sm';

export default function TexteSurCarte({ cible, donnees, enLigne = false }: { cible: RefObject<HTMLElement | null>; donnees?: () => CarteTexte | null; /** Boutons dans une barre d'outils (à côté de « Texte IA ») : le panneau s'ouvre en dessous, par-dessus la page. */ enLigne?: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const [noeud, setNoeud] = useState<HTMLElement | null>(null);
  const [textes, setTextes] = useState<Annotation[]>([]);
  const [selection, setSelection] = useState<number | null>(null);
  const [pose, setPose] = useState(false);
  const [texteNouveau, setTexteNouveau] = useState('');
  const [reglages, setReglages] = useState<Reglages>(REGLAGES_DEFAUT);
  const [redaction, setRedaction] = useState('');
  const [surCarte, setSurCarte] = useState(true);
  const panneauRef = useRef<HTMLDivElement>(null);
  const [copie, setCopie] = useState(false);
  const [format, setFormat] = useState<FormatTexte>('court');
  const [erreur, setErreur] = useState<string | null>(null);

  /** Rédaction automatique (modèles de phrases, sans IA) à partir des valeurs de la carte ; le résultat reste modifiable. */
  function rediger(f: FormatTexte = format) {
    const carte = donnees?.();
    if (!carte) {
      setErreur('Pas de donnée sur cette carte.');
      return;
    }
    setErreur(null);
    const texte = redigerTexte(carte, f);
    setRedaction(texte);
    poserSurCarte(texte, surCarte);
  }

  /** Pose (ou met à jour) la rédaction dans un encadré de texte sur la carte, repris dans l'export ; `actif` faux : le retire. */
  function poserSurCarte(texte: string, actif: boolean) {
    const sansHashtags = texte.split('\n').filter((l) => !l.trim().startsWith('#')).join(' ').replace(/\s+/g, ' ').trim();
    if (!actif || !sansHashtags) {
      setTextes((liste) => liste.filter((t) => t.id !== ID_REDACTION));
      return;
    }
    const largeur = noeud?.offsetWidth || 1280;
    const hauteur = noeud?.offsetHeight || 720;
    const taille = 18;
    const parLigne = Math.max(20, Math.floor((largeur * 0.8) / (taille * 0.52)));
    const lignes: string[] = [];
    let courante = '';
    for (const mot of sansHashtags.split(' ')) {
      if (courante && (courante + ' ' + mot).length > parLigne) {
        lignes.push(courante);
        courante = mot;
      } else courante = courante ? courante + ' ' + mot : mot;
    }
    if (courante) lignes.push(courante);
    const contenu = lignes.join('\n');
    setTextes((liste) => {
      const existant = liste.find((t) => t.id === ID_REDACTION);
      const autres = liste.filter((t) => t.id !== ID_REDACTION);
      const bloc: Annotation = existant
        ? { ...existant, contenu }
        : { id: ID_REDACTION, zone: '', x: Math.round(largeur / 2), y: Math.round(hauteur - 50 - (lignes.length * taille * 1.1) / 2), type: 'texte', contenu, couleur: '#111111', taille, gras: false, fond: 'encadre', police: 'arial' };
      return [...autres, bloc];
    });
  }

  const glisser = useRef<{ id: number; sx: number; sy: number; x0: number; y0: number; echelle: number } | null>(null);

  // Le nœud exporté peut changer (autre vue, autre rendu) : on le relit à chaque rendu.
  useEffect(() => {
    const courant = cible.current;
    if (courant !== noeud) setNoeud(courant);
    if (courant && getComputedStyle(courant).position === 'static') courant.style.position = 'relative';
  });

  // Panneau en barre d'outils : recalé dans la fenêtre (jamais coupé à gauche ni à droite).
  useLayoutEffect(() => {
    const el = panneauRef.current;
    if (!el) return;
    el.style.transform = '';
    const r = el.getBoundingClientRect();
    const marge = 8;
    const dx = r.left < marge ? marge - r.left : r.right > window.innerWidth - marge ? window.innerWidth - marge - r.right : 0;
    if (dx) el.style.transform = `translateX(${Math.round(dx)}px)`;
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
                className={`cmap-annotation ${selection === t.id ? 'cmap-annotation-sel' : ''}`}
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
    <div className={enLigne ? 'relative flex gap-2' : 'mb-2 flex flex-wrap gap-2'}>
      <button
        type="button"
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
        className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${ouvert ? 'border-primary bg-primary text-white' : 'border-border'}`}
      >
        {textes.length > 0 ? `Texte sur la carte (${textes.length})` : 'Ajouter un texte sur la carte'}
      </button>
      {donnees && (
        <button
          type="button"
          onClick={() => {
            rediger();
            setOuvert(true);
          }}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium"
          title="Rédiger automatiquement un texte à partir des valeurs de la carte (sans IA)"
        >
          Régénérer le texte
        </button>
      )}
      {calque}
      {ouvert && (
        <div ref={panneauRef} className={`rounded-lg border border-border bg-surface p-3 text-sm ${enLigne ? 'absolute right-0 top-full z-30 mt-2 w-[22rem] max-w-[90vw] shadow-lg' : 'mt-2 w-full max-w-md'}`}>
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
          <label className="mt-3 block border-t border-border pt-2 text-xs font-medium">
            Texte de rédaction (hors image, à copier)
            <textarea value={redaction} onChange={(e) => { setRedaction(e.target.value); if (surCarte) poserSurCarte(e.target.value, true); }} rows={5} className={champ} placeholder={'Ex. : On note 10 à 12 °C dans le nord, 16 à 18 °C dans le sud…'} />
          </label>
          <label className="mt-1 flex items-center gap-2 text-xs font-medium">
            <input type="checkbox" checked={surCarte} onChange={(e) => { setSurCarte(e.target.checked); poserSurCarte(redaction, e.target.checked); }} disabled={!redaction} />
            Afficher ce texte sur la carte (déplaçable)
          </label>
          {donnees && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => rediger()} className="rounded-md border border-primary px-2 py-1 text-xs font-semibold text-primary">
                {redaction ? 'Régénérer le texte' : 'Rédiger le texte'}
              </button>
              <select value={format} onChange={(e) => { const f = e.target.value as FormatTexte; setFormat(f); if (redaction) rediger(f); }} aria-label="Format du texte" className="rounded-md border border-border bg-surface p-1 text-xs">
                <option value="court">Court (réseaux sociaux)</option>
                <option value="long">Long (article)</option>
              </select>
            </div>
          )}
          {erreur && (
            <p role="alert" className="mt-1 text-xs text-danger">
              {erreur}
            </p>
          )}
          <button
            type="button"
            disabled={!redaction}
            className="mt-1 rounded-md border border-border px-2 py-1 text-xs font-semibold disabled:opacity-50"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(redaction);
                setCopie(true);
                setTimeout(() => setCopie(false), 2000);
              } catch {
                /* copie refusée : le texte reste sélectionnable */
              }
            }}
          >
            {copie ? 'Copié ✓' : 'Copier le texte'}
          </button>
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
