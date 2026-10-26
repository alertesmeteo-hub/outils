/** Géométrie de l'Occitanie pour les cartes saisonnières : lue sur le disque, donc côté serveur seulement. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DEPS_OCCITANIE, projeter } from './cfsv2';

type Anneau = number[][];

/** Tracés SVG des départements d'Occitanie (lu une fois dans public/geo). */
export async function tracesOccitanie(): Promise<{ code: string; d: string }[]> {
  const brut = JSON.parse(await readFile(path.join(process.cwd(), 'public/geo/departements.geojson'), 'utf8')) as {
    features: { properties: { code: string }; geometry: { type: string; coordinates: Anneau[] | Anneau[][] } }[];
  };
  return brut.features
    .filter((f) => DEPS_OCCITANIE.includes(f.properties.code))
    .map((f) => {
      const polygones = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as Anneau[][];
      const d = polygones
        .flatMap((anneaux) =>
          anneaux.map((anneau) => {
            let precedent = '';
            const pts: string[] = [];
            for (const [lon, lat] of anneau) {
              const p = projeter(lat, lon);
              const t = `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
              if (t !== precedent) pts.push(t);
              precedent = t;
            }
            return `M${pts.join('L')}Z`;
          })
        )
        .join('');
      return { code: f.properties.code, d };
    });
}
