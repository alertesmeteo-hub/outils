/**
 * Jeu de pictos « Alertes-meteo-Pro » : mêmes icônes (mêmes noms) que public/pictos-alertes/, redessinées « bien prononcées »
 * comme sur la planche Alertes Météo : contour sombre épais autour de chaque forme, traits cernés, couleurs plus franches.
 *
 * Usage : node scripts/pictos-pro.mjs   (écrit public/pictos-alertes-pro/*.svg)
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = 'public/pictos-alertes';
const SORTIE = 'public/pictos-alertes-pro';
const MARINE = '#14264d';
const ENCRE = '#0f1c3a';

/** Couleurs plus franches (le contour est calculé à part). */
const FRANCHES = {
  '#f59e0b': '#ffb000', '#facc15': '#ffd21a', '#fde68a': '#ffe36e', '#fde047': '#ffe033', '#eab308': '#f5c400',
  '#f97316': '#ff7a00', '#fb923c': '#ff8a1f', '#dc2626': '#e3101c', '#ef4444': '#f0222d',
  '#3b82f6': '#1c78ff', '#2563eb': '#1565f0', '#7dd3fc': '#38b6ff', '#38bdf8': '#19a3ff', '#0ea5e9': '#0a8ef0', '#0284c7': '#0a6dc4',
  '#22c55e': '#17b94f', '#16a34a': '#10993f', '#86efac': '#5fdc8c',
  '#ffffff': '#ffffff', '#f0f9ff': '#eef6ff', '#f8fafc': '#f4f8ff', '#e2e8f0': '#e4ecfa', '#cbd5e1': '#c4d0e6',
  '#94a3b8': '#8a9bb8', '#64748b': '#667794', '#475569': '#4b5a7a', '#334155': '#34456a', '#9ca3af': '#98a4bb', '#6b7280': '#677489',
};

const hex = (c) => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c ?? '');
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((x) => x + x).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const versHex = (rgb) => `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const luminance = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const neutre = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b) < 42;
const sombre = (c) => {
  const rgb = hex(c);
  return rgb != null && luminance(rgb) < 0.26;
};
const franche = (c) => FRANCHES[c?.toLowerCase()] ?? c;
/** Contour d'une couleur : marine pour les gris et blancs (nuages), version assombrie pour les couleurs vives. */
function contour(c) {
  const rgb = hex(c);
  if (!rgb) return MARINE;
  if (neutre(rgb)) return MARINE;
  return versHex(rgb.map((v) => v * 0.45));
}

function attributs(texte) {
  const a = {};
  for (const m of texte.matchAll(/([\w:-]+)="([^"]*)"/g)) a[m[1]] = m[2];
  return a;
}
const ecrire = (nom, a, fermeture) =>
  `<${nom} ${Object.entries(a)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ')}${fermeture}>`;
const arrondi = (v) => Math.round(v * 100) / 100;

function convertir(svg) {
  const pile = [1];
  return svg.replace(/<(\/?)(g|line|path|circle|rect|ellipse|polygon|polyline)\b([^>]*?)(\/?)>/g, (tout, ferme, nom, reste, auto) => {
    if (nom === 'g') {
      if (ferme) {
        if (pile.length > 1) pile.pop();
        return tout;
      }
      const echelleG = /scale\(([\d.]+)\)/.exec(reste)?.[1];
      pile.push(pile[pile.length - 1] * (echelleG ? Number(echelleG) : 1));
      return auto ? (pile.pop(), tout) : tout;
    }
    if (ferme) return tout;
    const a = attributs(reste);
    const echelle = pile[pile.length - 1] * (a.transform ? Number(/scale\(([\d.]+)\)/.exec(a.transform)?.[1] ?? 1) : 1);
    const local = (largeurVb) => arrondi(largeurVb / echelle);
    delete a['vector-effect'];
    const remplie = a.fill != null && a.fill !== 'none';
    const traitOrigine = a.stroke != null && a.stroke !== 'none' && a['stroke-width'] !== '0';
    const largeurOrigine = (a['stroke-width'] != null ? Number(a['stroke-width']) : 1) * (a['vector-effect'] === 'non-scaling-stroke' ? 1 : echelle);

    if (remplie) {
      const fond = franche(a.fill.toLowerCase());
      a.fill = fond;
      // Reflets (petits cercles sans trait) : pas de contour, il les noierait.
      const reflet = nom === 'circle' && a.stroke == null && Number(a.r) < 2;
      if (!reflet && (traitOrigine || a.stroke == null)) {
        const sombreOrigine = a.stroke != null && sombre(a.stroke);
        a.stroke = sombreOrigine ? ENCRE : contour(fond);
        a['stroke-width'] = local(sombreOrigine ? Math.max(3, largeurOrigine * 1.15) : 2.6);
        a['stroke-linejoin'] = 'round';
      }
      return ecrire(nom, a, auto);
    }

    if (traitOrigine) {
      let couleur = franche(a.stroke.toLowerCase());
      const rgbOrigine = hex(couleur);
      // Traits gris (vent, brouillard) : bleu-acier clair cerné de marine, comme sur la planche.
      if (rgbOrigine && Math.max(...rgbOrigine) - Math.min(...rgbOrigine) < 60 && luminance(rgbOrigine) >= 0.26 && couleur !== '#ffffff') couleur = '#a9bfe3';
      // Traits fins (flocons, détails) : à peine épaissis, pour ne pas former de blocs.
      const fin = largeurOrigine < 2.6;
      const principal = fin ? Math.max(1.8, largeurOrigine * 1.3) : largeurOrigine * 1.1;
      a.stroke = couleur;
      a['stroke-width'] = local(principal);
      a['stroke-linecap'] = 'round';
      a['stroke-linejoin'] = 'round';
      const rgb = hex(couleur);
      // Traits clairs ou colorés : un trait plus large, sombre, dessiné dessous, fait le contour. Traits déjà sombres ou blancs : tels quels.
      if (fin || !rgb || luminance(rgb) < 0.26 || couleur === '#ffffff') {
        if (rgb && luminance(rgb) < 0.26) a.stroke = ENCRE;
        return ecrire(nom, a, auto);
      }
      const dessous = { ...a, stroke: contour(couleur), 'stroke-width': local(principal + 2.6) };
      return `${ecrire(nom, dessous, '/')}${ecrire(nom, a, auto)}`;
    }
    return ecrire(nom, a, auto);
  });
}

mkdirSync(SORTIE, { recursive: true });
let n = 0;
for (const f of readdirSync(SOURCE).filter((x) => x.endsWith('.svg'))) {
  writeFileSync(join(SORTIE, f), convertir(readFileSync(join(SOURCE, f), 'utf8')));
  n++;
}
console.log(`${n} pictos écrits dans ${SORTIE}`);
