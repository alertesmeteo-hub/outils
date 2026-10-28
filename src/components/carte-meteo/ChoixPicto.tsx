'use client';

/* eslint-disable @next/next/no-img-element -- petites icônes locales (public/), inutile de passer par next/image */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as PointerEventReact, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  LIBELLES_EMOJIS,
  PICTOS_ALERTES,
  PICTOS_HALLOWEEN,
  PICTOS_DEFAUT_IMAGES,
  PICTOS_IMAGES,
  PICTOS_METEO,
  PICTOS_METEOCONS,
  cheminPictoImage,
  estPictoImage,
} from '@/lib/carte-meteo/pictos';

/**
 * Choix d'un picto : recherche, filtres par jeu, pictos récents, nom au survol, croix et touche Échap pour fermer.
 * Sert à la fois dans la bulle ouverte sur un picto de la carte et dans le panneau « Modifier plusieurs pictos ».
 */

type Jeu = 'tous' | 'recents' | 'alertes' | 'emoji' | 'images' | 'meteocons' | 'halloween';
type Entree = { id: string; label: string; recherche: string; groupe: string; jeu: Exclude<Jeu, 'tous' | 'recents'> };

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const CLE_RECENTS = 'carte-meteo:pictos-recents';
const MAX_RECENTS = 14;

const ENTREES: Entree[] = [
  ...PICTOS_ALERTES.map((p) => ({ id: p.id, label: p.label, groupe: `Alertes Météo · ${p.categorie}`, jeu: 'alertes' as const, recherche: sansAccents(`${p.label} ${p.categorie} ${p.motsCles} alertes`) })),
  ...PICTOS_HALLOWEEN.map((p) => ({ id: p.id, label: p.label, groupe: 'Halloween 🎃', jeu: 'halloween' as const, recherche: sansAccents(`${p.label} halloween`) })),
  ...PICTOS_METEO.map((e) => ({ id: e, label: LIBELLES_EMOJIS[e] ?? e, groupe: 'Emojis', jeu: 'emoji' as const, recherche: sansAccents(`${LIBELLES_EMOJIS[e] ?? ''} emoji`) })),
  ...PICTOS_IMAGES.map((p) => ({ id: p.id, label: p.label, groupe: 'Mes pictos', jeu: 'images' as const, recherche: sansAccents(`${p.label} mes pictos images`) })),
  ...[...PICTOS_DEFAUT_IMAGES, ...PICTOS_METEOCONS.filter((p) => !PICTOS_DEFAUT_IMAGES.includes(p))].map((p) => ({
    id: p.id,
    label: p.label,
    groupe: 'Meteocons (libres)',
    jeu: 'meteocons' as const,
    recherche: sansAccents(`${p.label} meteocons`),
  })),
];
const PAR_ID = new Map(ENTREES.map((e) => [e.id, e]));

const FILTRES: [Jeu, string][] = [
  ['tous', 'Tous'],
  ['recents', 'Récents'],
  ['alertes', 'Alertes Météo'],
  ['halloween', 'Halloween'],
  ['emoji', 'Emojis'],
  ['images', 'Mes pictos'],
  ['meteocons', 'Meteocons'],
];

/** Jeu d'un picto : la fenêtre s'ouvre sur le jeu du picto cliqué (Alertes Météo par défaut). */
function jeuDe(id: string | undefined): Jeu {
  if (!id || id.startsWith('am:')) return 'alertes';
  if (id.startsWith('mc:')) return 'meteocons';
  if (id.startsWith('ha:')) return 'halloween';
  if (id.startsWith('img:')) return 'images';
  return 'emoji';
}

function lireRecents(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLE_RECENTS) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && PAR_ID.has(x)) : [];
  } catch {
    return [];
  }
}
function noterRecent(id: string): void {
  try {
    localStorage.setItem(CLE_RECENTS, JSON.stringify([id, ...lireRecents().filter((x) => x !== id)].slice(0, MAX_RECENTS)));
  } catch {
    /* navigation privée : on s'en passe */
  }
}

export function ApercuPicto({ id, taille = 30 }: { id: string; taille?: number }) {
  if (estPictoImage(id)) return <img src={cheminPictoImage(id)} alt="" width={taille} height={taille} className="cmap-choix-img" />;
  return <span style={{ fontSize: taille * 0.72, lineHeight: 1 }}>{id}</span>;
}

export function ChoixPicto({
  actuel,
  onChoisir,
  onFermer,
  entete,
  titre = 'Choisir un picto',
  autoFocus = true,
  desactive = false,
}: {
  actuel?: string;
  onChoisir: (picto: string) => void;
  /** Avec une fonction de fermeture : croix en haut à droite et touche Échap. */
  onFermer?: () => void;
  /** Réglages affichés sous la recherche (même icône partout, altitude de la neige…). */
  entete?: ReactNode;
  titre?: string;
  autoFocus?: boolean;
  desactive?: boolean;
}) {
  const [q, setQ] = useState('');
  const [filtre, setFiltre] = useState<Jeu>(() => jeuDe(actuel));
  const [survol, setSurvol] = useState<string | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecents(lireRecents());
    if (autoFocus) champ.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  useEffect(() => {
    if (!onFermer) return;
    const surTouche = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [onFermer]);

  const groupes = useMemo(() => {
    const t = sansAccents(q.trim());
    const ok = (e: Entree) => !t || t.split(/\s+/).every((mot) => e.recherche.includes(mot));
    const res: { titre: string; entrees: Entree[] }[] = [];
    if ((filtre === 'tous' || filtre === 'recents') && !t) {
      const r = recents.map((id) => PAR_ID.get(id)).filter((e): e is Entree => !!e);
      if (r.length) res.push({ titre: 'Récents', entrees: r });
    }
    if (filtre === 'recents') return res;
    const vus = new Map<string, Entree[]>();
    for (const e of ENTREES) {
      if (filtre !== 'tous' && e.jeu !== filtre) continue;
      if (!ok(e)) continue;
      (vus.get(e.groupe) ?? vus.set(e.groupe, []).get(e.groupe)!).push(e);
    }
    for (const [titre, entrees] of vus) res.push({ titre, entrees });
    return res;
  }, [q, filtre, recents]);

  const nb = groupes.reduce((n, g) => n + (g.titre === 'Récents' ? 0 : g.entrees.length), 0);
  const choisir = (id: string) => {
    noterRecent(id);
    setRecents(lireRecents());
    onChoisir(id);
  };
  const libelleSurvol = survol ? PAR_ID.get(survol)?.label : actuel ? PAR_ID.get(actuel)?.label : undefined;

  return (
    <div className={`cmap-choix ${desactive ? 'cmap-choix-desactive' : ''}`} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <div className="cmap-choix-tete">
        <div className="cmap-choix-titre">
          <strong>{titre}</strong>
          {onFermer && (
            <button type="button" className="cmap-choix-fermer" onClick={onFermer} title="Fermer (Échap)" aria-label="Fermer">
              ×
            </button>
          )}
        </div>
        <div className="cmap-choix-recherche">
          <span aria-hidden>🔍</span>
          <input ref={champ} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher : orage, neige, grêle, nuit…" aria-label="Chercher un picto" />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Effacer la recherche" title="Effacer">
              ×
            </button>
          )}
        </div>
        <div className="cmap-choix-filtres" role="tablist">
          {FILTRES.map(([v, l]) => (
            <button key={v} type="button" role="tab" aria-selected={filtre === v} className={filtre === v ? 'actif' : ''} onClick={() => setFiltre(v)}>
              {l}
            </button>
          ))}
        </div>
        {entete}
      </div>

      <div className="cmap-choix-liste">
        {groupes.length === 0 && <p className="cmap-choix-vide">{filtre === 'recents' ? 'Aucun picto utilisé pour l’instant.' : `Aucun picto pour « ${q} ».`}</p>}
        {groupes.map((g) => (
          <section key={g.titre}>
            <div className="cmap-choix-groupe">{g.titre}</div>
            <div className="cmap-choix-grille">
              {g.entrees.map((e) => (
                <button
                  key={`${g.titre}${e.id}`}
                  type="button"
                  title={e.label}
                  aria-label={e.label}
                  className={e.id === actuel ? 'actuel' : ''}
                  onClick={() => choisir(e.id)}
                  onMouseEnter={() => setSurvol(e.id)}
                  onMouseLeave={() => setSurvol(null)}
                  onFocus={() => setSurvol(e.id)}
                >
                  <ApercuPicto id={e.id} />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="cmap-choix-pied">
        <span>{libelleSurvol ?? ' '}</span>
        <span>{q ? `${nb} résultat${nb > 1 ? 's' : ''}` : `${ENTREES.length} pictos`}</span>
      </div>
    </div>
  );
}

const CLE_TAILLE = 'carte-meteo:fenetre-picto';
const TAILLE_DEFAUT = { l: 340, h: 470 };
const TAILLE_MIN = { l: 280, h: 300 };
/** Position choisie à la souris pendant la visite : la fenêtre se rouvre au même endroit. */
let positionGardee: { x: number; y: number } | null = null;

function lireTaille(): { l: number; h: number } {
  try {
    const v = JSON.parse(localStorage.getItem(CLE_TAILLE) ?? 'null');
    if (v && Number.isFinite(v.l) && Number.isFinite(v.h)) return { l: Math.max(TAILLE_MIN.l, v.l), h: Math.max(TAILLE_MIN.h, v.h) };
  } catch {
    /* navigation privée */
  }
  return TAILLE_DEFAUT;
}

/**
 * Fenêtre flottante du choix de picto, posée au-dessus de la page (hors de la carte, donc jamais dans l'export) :
 * ouverte à côté du picto cliqué sans le cacher, déplaçable par sa barre de titre, agrandissable par son coin
 * (taille gardée dans le navigateur).
 */
export function FenetrePicto({ ancre, children }: { ancre: RefObject<HTMLElement | null>; children: ReactNode }) {
  const [taille] = useState(lireTaille);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const boite = useRef<HTMLDivElement>(null);
  const glisser = useRef<{ sx: number; sy: number; x0: number; y0: number } | null>(null);

  const dansLEcran = (x: number, y: number, l: number, h: number) => ({
    x: Math.min(Math.max(x, 8), Math.max(8, window.innerWidth - l - 8)),
    y: Math.min(Math.max(y, 8), Math.max(8, window.innerHeight - Math.min(h, 120) - 8)),
  });

  useLayoutEffect(() => {
    const { l, h } = taille;
    if (positionGardee) {
      setPos(dansLEcran(positionGardee.x, positionGardee.y, l, h));
      return;
    }
    const r = ancre.current?.getBoundingClientRect();
    if (!r) {
      setPos(dansLEcran((window.innerWidth - l) / 2, 80, l, h));
      return;
    }
    // À droite du picto s'il y a la place, sinon à gauche, sinon en dessous ; à hauteur du picto.
    const x = r.right + 14 + l <= window.innerWidth - 8 ? r.right + 14 : r.left - 14 - l >= 8 ? r.left - 14 - l : r.left + r.width / 2 - l / 2;
    const y = x === r.left + r.width / 2 - l / 2 ? r.bottom + 10 : r.top + r.height / 2 - 60;
    setPos(dansLEcran(x, Math.min(y, window.innerHeight - h - 8), l, h));
    // Ouverture seulement : ensuite, la fenêtre reste là où on la met.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const placee = pos != null;
  // Taille changée par le coin : gardée pour les prochaines ouvertures.
  useEffect(() => {
    const el = boite.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(() => {
      try {
        localStorage.setItem(CLE_TAILLE, JSON.stringify({ l: Math.round(el.offsetWidth), h: Math.round(el.offsetHeight) }));
      } catch {
        /* navigation privée */
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [placee]);

  // Barre de titre = poignée (pas sur la croix). En phase de capture : ChoixPicto arrête la propagation des clics.
  const debut = (e: PointerEventReact<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (e.button !== 0 || !pos || !t.closest('.cmap-choix-titre') || t.closest('button')) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    glisser.current = { sx: e.clientX, sy: e.clientY, x0: pos.x, y0: pos.y };
  };
  const pendant = (e: PointerEventReact<HTMLDivElement>) => {
    const g = glisser.current;
    if (!g || !boite.current) return;
    const p = dansLEcran(g.x0 + e.clientX - g.sx, g.y0 + e.clientY - g.sy, boite.current.offsetWidth, boite.current.offsetHeight);
    positionGardee = p;
    setPos(p);
  };
  const fin = (e: PointerEventReact<HTMLDivElement>) => {
    glisser.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={boite}
      className="cmap-fenetre-picto cmap-sans-export"
      style={{ left: pos?.x ?? -9999, top: pos?.y ?? -9999, width: taille.l, height: taille.h, visibility: pos ? 'visible' : 'hidden' }}
      onPointerDownCapture={debut}
      onPointerMove={pendant}
      onPointerUp={fin}
      onPointerCancel={fin}
    >
      {children}
    </div>,
    document.body
  );
}
