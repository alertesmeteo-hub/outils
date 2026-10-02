import 'server-only';
import villes from './villes-departements.json';
import { appelerOpenMeteo, pointDepuisReponse, urlPrevisions, type ModeleMeteo, type PointCarte } from './previsions-modeles';

type Ville = { code: string; nom: string; lat: number; lon: number; pop: number };
const VILLES = villes as Record<string, Ville[]>;

/**
 * Prévisions des plus grandes villes d'un département (vue « département » de la carte météo).
 * Triées par population décroissante ; une seule requête Open-Meteo, mise en cache 30 min.
 */
export async function chargerPrevisionsVilles(modele: ModeleMeteo, dateISO: string, departement: string): Promise<PointCarte[]> {
  const liste = VILLES[departement];
  if (!liste?.length) return [];
  const lieux = await appelerOpenMeteo(urlPrevisions(liste, modele, dateISO));
  if (lieux.length !== liste.length) throw new Error('Réponse Open-Meteo incomplète');
  return liste.map((v, i) => ({ ...pointDepuisReponse(v.code, v.nom, lieux[i]), lat: v.lat, lon: v.lon }));
}
