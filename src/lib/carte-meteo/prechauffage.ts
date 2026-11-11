import { MODELES_MOYENNE_FRANCE, type ModeleSource } from './previsions-modeles';
import { passageCourant, prechaufferModele } from './sources';

/**
 * Préchauffage du cache de la carte de France (moyenne des modèles) : tant que le serveur tourne, on surveille le passage de
 * chaque modèle de la moyenne France ; dès qu'un nouveau passage est publié (ou au démarrage), on télécharge ses 96 départements
 * en tâche de fond. Sans cela, le premier visiteur après chaque passage attendait environ 40 s (plus de 500 fichiers à lire).
 * Un modèle à la fois et peu de lectures simultanées : le VPS est petit et partagé avec d'autres applications.
 */

/** Pause entre deux vérifications (passageCourant ne relit de toute façon l'index qu'au bout de 5 min). */
const INTERVALLE_MS = 3 * 60_000;
/** Attente après le démarrage : laisse passer la vérification de mise en ligne avant de charger quoi que ce soit. */
const DELAI_DEMARRAGE_MS = 20_000;

const marque = globalThis as { __prechauffageCarteMeteo?: boolean };

export function demarrerPrechauffage(): void {
  if (marque.__prechauffageCarteMeteo) return;
  marque.__prechauffageCarteMeteo = true;

  /** Dernier passage préchauffé de chaque modèle. */
  const prechauffes = new Map<ModeleSource, string>();
  let enCours = false;

  const tour = async () => {
    if (enCours) return;
    enCours = true;
    try {
      for (const modele of MODELES_MOYENNE_FRANCE) {
        const passage = await passageCourant(modele);
        if (!passage || prechauffes.get(modele) === passage) continue;
        const debut = Date.now();
        const charges = await prechaufferModele(modele);
        prechauffes.set(modele, passage);
        console.log(`Carte météo : cache préchauffé, ${modele} ${charges} départements en ${Math.round((Date.now() - debut) / 1000)} s (passage ${passage.split('|')[0]})`);
      }
    } catch (e) {
      console.error('Carte météo : préchauffage interrompu', e);
    } finally {
      enCours = false;
    }
  };

  setTimeout(() => {
    void tour();
    setInterval(() => void tour(), INTERVALLE_MS).unref();
  }, DELAI_DEMARRAGE_MS).unref();
}
