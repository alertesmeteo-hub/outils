/** Contours simplifiés des départements métropolitains (public/geo/departements-simplifies.json), projetés pour la carte de France : côté serveur seulement. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { projeterFrance, type EcheanceFrance, type SaisonnierFrance } from './france';

export async function tracesFrance(): Promise<{ code: string; d: string }[]> {
  const brut = JSON.parse(await readFile(path.join(process.cwd(), 'public/geo/departements-simplifies.json'), 'utf8')) as Record<string, number[][][]>;
  return Object.entries(brut).map(([code, anneaux]) => ({
    code,
    d: anneaux
      .map((anneau) => {
        const pts = anneau.map(([lon, lat]) => {
          const p = projeterFrance(lat, lon);
          return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        });
        return `M${pts.join('L')}Z`;
      })
      .join(''),
  }));
}

type Anneau = number[][];

async function contours(): Promise<Anneau[]> {
  const brut = JSON.parse(await readFile(path.join(process.cwd(), 'public/geo/departements-simplifies.json'), 'utf8')) as Record<string, Anneau[]>;
  return Object.values(brut).flat();
}

function dansAnneau(lat: number, lon: number, anneau: Anneau) {
  let dedans = false;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    const [xi, yi] = anneau[i];
    const [xj, yj] = anneau[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

/** Mailles dont le centre est sur la France : seules celles-là portent une valeur écrite sur la carte (pas les mailles en mer ou à l'étranger). */
export async function etiquettesFrance(donnees: SaisonnierFrance): Promise<SaisonnierFrance> {
  const anneaux = await contours();
  const avecEtiquettes = (e: EcheanceFrance): EcheanceFrance => ({ ...e, etiquettes: e.cellules.filter((c) => anneaux.some((a) => dansAnneau(c[0], c[1], a))).map((c) => `${c[0]}-${c[1]}`) });
  return {
    ...donnees,
    hebdo: donnees.hebdo.map(avecEtiquettes),
    mensuel: donnees.mensuel.map(avecEtiquettes),
  };
}
