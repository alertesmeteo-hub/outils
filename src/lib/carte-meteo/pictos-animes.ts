/**
 * Pictos animés pour les vidéos (canvas) : les SVG du jeu « Alertes Météo » (public/pictos-alertes) sont découpés en calques
 * (nuage, soleil, pluie, neige, éclair, brouillard), chacun animé à l'instant `t` sans rien redessiner à la main.
 * Les images sont en data: URL (la CSP du site n'autorise pas blob:).
 */

type TypeCouche = 'nuage' | 'soleil' | 'foudre' | 'brume' | 'pluie' | 'chute' | 'autre';

interface Couche {
  img: HTMLImageElement;
  type: TypeCouche;
  /** Centre du soleil (unités du SVG, 64 × 64) : pivot de la rotation des rayons. */
  cx: number;
  cy: number;
  indice: number;
}

export interface PictoAnime {
  couches: Couche[];
  avecNuage: boolean;
}

const COTE = 64; // viewBox des SVG
const RESOLUTION = 512; // pixels de rastérisation de chaque calque
/** Zone où tombent les précipitations : sous le nuage. */
const Y_SOUS_NUAGE = 41;

const SOLEIL = '#f59e0b';
const cache = new Map<string, Promise<PictoAnime | null>>();

function chargerImage(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ko(new Error('Calque de picto illisible'));
    img.src = src;
  });
}

function typeDeCouche(el: Element, soleilCentre: boolean, avecNuage: boolean): TypeCouche {
  if (el.querySelector('path[d^="M10 30H38"]')) return 'nuage';
  if (el.querySelector('path[fill="#facc15"]')) return 'foudre';
  const traits = el.tagName === 'line' ? [el] : [...el.querySelectorAll('line')];
  const disque = el.tagName === 'circle' ? el : el.querySelector('circle[fill="' + SOLEIL + '"]');
  if (soleilCentre && (disque?.getAttribute('fill') === SOLEIL || (traits.length > 0 && traits.every((l) => (l.getAttribute('stroke') ?? l.parentElement?.getAttribute('stroke')) === SOLEIL)))) return 'soleil';
  if (traits.length > 0 && el.querySelectorAll('circle').length === 0 && traits.every((l) => l.getAttribute('stroke') === '#94a3b8')) return avecNuage ? 'brume' : 'autre';
  if (!avecNuage) return 'autre';
  if (traits.length > 0 && traits.every((l) => l.getAttribute('stroke') === '#3b82f6')) return 'pluie';
  return 'chute';
}

async function construire(url: string): Promise<PictoAnime | null> {
  const reponse = await fetch(url);
  if (!reponse.ok) return null;
  const doc = new DOMParser().parseFromString(await reponse.text(), 'image/svg+xml');
  const svg = doc.documentElement;
  if (svg.tagName !== 'svg') return null;
  const serialiseur = new XMLSerializer();
  const defs = [...svg.children].filter((e) => e.tagName === 'defs').map((e) => serialiseur.serializeToString(e)).join('');
  const elements = [...svg.children].filter((e) => e.tagName !== 'defs');
  const disque = svg.querySelector(`circle[fill="${SOLEIL}"]`);
  const cx = Number(disque?.getAttribute('cx') ?? COTE / 2);
  const cy = Number(disque?.getAttribute('cy') ?? COTE / 2);
  const avecNuage = !!svg.querySelector('path[d^="M10 30H38"]');
  const couches: Couche[] = [];
  let indice = 0;
  for (const el of elements) {
    const contenu = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COTE} ${COTE}" width="${RESOLUTION}" height="${RESOLUTION}">${defs}${serialiseur.serializeToString(el)}</svg>`;
    const img = await chargerImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(contenu)}`);
    couches.push({ img, type: typeDeCouche(el, !!disque, avecNuage), cx, cy, indice: indice++ });
  }
  return couches.length ? { couches, avecNuage } : null;
}

/** Charge et découpe un picto SVG ; `null` si ce n'est pas un SVG exploitable (le picto est alors dessiné fixe). */
export function chargerPictoAnime(url: string): Promise<PictoAnime | null> {
  if (!/\.svg(\?|$)/.test(url)) return Promise.resolve(null);
  let p = cache.get(url);
  if (!p) {
    p = construire(url).catch(() => null);
    cache.set(url, p);
  }
  return p;
}

const mod = (a: number, b: number) => ((a % b) + b) % b;

/** Éclairs : deux flashs rapprochés, puis une pause. */
function intensiteEclair(t: number): number {
  const p = mod(t, 2.6);
  if (p < 0.1) return 1;
  if (p < 0.2) return 0.3;
  if (p < 0.38) return 1;
  return 0.22;
}

/**
 * Dessine le picto animé dans le carré (x, y, taille) à l'instant `t` (secondes) ; `decalage` désynchronise deux pictos voisins.
 */
export function dessinerPictoAnime(ctx: CanvasRenderingContext2D, picto: PictoAnime, x: number, y: number, taille: number, t: number, decalage = 0) {
  const s = taille / COTE;
  const tt = t + decalage;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  for (const c of picto.couches) {
    ctx.save();
    switch (c.type) {
      case 'nuage': {
        ctx.translate(Math.sin(tt * 1.2) * 1.3, Math.sin(tt * 1.9 + 1) * 0.7);
        ctx.drawImage(c.img, 0, 0, COTE, COTE);
        break;
      }
      case 'soleil': {
        ctx.translate(c.cx, c.cy);
        ctx.rotate(tt * 0.55);
        const pulse = 1 + Math.sin(tt * 2.4) * 0.035;
        ctx.scale(pulse, pulse);
        ctx.translate(-c.cx, -c.cy);
        ctx.drawImage(c.img, 0, 0, COTE, COTE);
        break;
      }
      case 'foudre': {
        const i = intensiteEclair(tt);
        ctx.globalAlpha = i;
        if (i > 0.9) {
          ctx.shadowColor = '#fde047';
          ctx.shadowBlur = 40 * s;
        }
        ctx.drawImage(c.img, 0, 0, COTE, COTE);
        break;
      }
      case 'brume': {
        ctx.translate(Math.sin(tt * 0.9 + c.indice) * 3.5, 0);
        ctx.drawImage(c.img, 0, 0, COTE, COTE);
        break;
      }
      case 'pluie':
      case 'chute': {
        // Les gouttes (ou flocons) descendent sous le nuage et réapparaissent en haut : deux copies décalées d'une période.
        const pluie = c.type === 'pluie';
        const periode = pluie ? 20 : 16;
        const d = mod(tt * (pluie ? 24 : 11) + c.indice * 5, periode);
        const balancement = pluie ? 0 : Math.sin(tt * 2.2 + c.indice * 1.7) * 2.2;
        ctx.beginPath();
        ctx.rect(0, Y_SOUS_NUAGE, COTE, COTE - Y_SOUS_NUAGE);
        ctx.clip();
        for (const dy of [d, d - periode]) {
          ctx.save();
          ctx.translate(balancement - dy * (pluie ? 0.375 : 0), dy); // les gouttes sont penchées : elles suivent leur pente
          ctx.drawImage(c.img, 0, 0, COTE, COTE);
          ctx.restore();
        }
        break;
      }
      default: {
        ctx.translate(0, Math.sin(tt * 1.8 + c.indice) * 0.8);
        ctx.drawImage(c.img, 0, 0, COTE, COTE);
      }
    }
    ctx.restore();
  }
  ctx.restore();
}
