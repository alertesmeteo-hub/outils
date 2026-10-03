import 'server-only';
import villes from './villes-departements.json';
import { appelerOpenMeteo, pointDepuisReponse, urlPrevisions, type ModeleMeteo, type PointCarte } from './previsions-modeles';

type Ville = { code: string; nom: string; lat: number; lon: number; pop: number };
const VILLES = villes as Record<string, Ville[]>;

/** Nombre de villes dont on demande les prévisions (les appels Open-Meteo sont comptés par lieu). */
const VILLES_PAR_DEPARTEMENT = 30;

/**
 * Sélectionne `n` villes bien réparties sur le département : la plus grande d'abord, puis à chaque fois celle qui comble
 * le mieux les zones vides (distance aux villes déjà retenues, légèrement pondérée par la taille de la ville).
 */
function repartir(liste: Ville[], n: number): Ville[] {
  if (liste.length <= n) return liste;
  const km = (a: Ville, b: Ville) => Math.hypot((a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180), a.lat - b.lat);
  const choisies = [liste[0]];
  while (choisies.length < n) {
    let meilleure: Ville | null = null;
    let score = -1;
    liste.forEach((v, rang) => {
      if (choisies.includes(v)) return;
      const s = Math.min(...choisies.map((c) => km(c, v))) / (1 + rang) ** 0.1;
      if (s > score) {
        score = s;
        meilleure = v;
      }
    });
    if (!meilleure) break;
    choisies.push(meilleure);
  }
  // On garde l'ordre de population (le client s'en sert comme priorité).
  return liste.filter((v) => choisies.includes(v));
}

/**
 * Prévisions des plus grandes villes d'un département (vue « département » de la carte météo).
 * Triées par population décroissante ; une seule requête Open-Meteo, mise en cache 30 min.
 */
export async function chargerPrevisionsVilles(modele: ModeleMeteo, dateISO: string, departement: string): Promise<PointCarte[]> {
  const liste = repartir(VILLES[departement] ?? [], VILLES_PAR_DEPARTEMENT);
  if (!liste.length) return [];
  const lieux = await appelerOpenMeteo(urlPrevisions(liste, modele, dateISO));
  if (lieux.length !== liste.length) throw new Error('Réponse Open-Meteo incomplète');
  return liste.map((v, i) => ({ ...pointDepuisReponse(v.code, v.nom, lieux[i]), lat: v.lat, lon: v.lon }));
}
