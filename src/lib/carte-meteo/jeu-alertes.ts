import { useEffect, useState } from 'react';

/** Jeu d'icônes Alertes Météo des planches, du tableau et des vidéos : classique ou Alertes-meteo-Pro (contours épais). */
export type JeuAlertes = 'alertes' | 'alertes-pro';

const CLE = 'carte-meteo:jeu-pictos-alertes';

/** Picto `am:…` ou `ap:…` dans le jeu choisi (les autres pictos ne changent pas). */
export const selonJeu = (picto: string, jeu: JeuAlertes): string => (jeu === 'alertes-pro' ? picto.replace(/^am:/, 'ap:') : picto.replace(/^ap:/, 'am:'));

/** Chemin d'un SVG du jeu Alertes Météo → son équivalent dans le jeu choisi. */
export const cheminSelonJeu = (chemin: string, jeu: JeuAlertes): string =>
  jeu === 'alertes-pro' ? chemin.replace('/pictos-alertes/', '/pictos-alertes-pro/') : chemin.replace('/pictos-alertes-pro/', '/pictos-alertes/');

/** Jeu choisi, mémorisé dans le navigateur (le même pour la planche, le tableau et la vidéo). */
export function useJeuAlertes(): [JeuAlertes, (jeu: JeuAlertes) => void] {
  const [jeu, setJeu] = useState<JeuAlertes>('alertes');
  useEffect(() => {
    try {
      if (localStorage.getItem(CLE) === 'alertes-pro') setJeu('alertes-pro');
    } catch {
      // Stockage indisponible : le choix vaut pour cette visite.
    }
  }, []);
  return [
    jeu,
    (nouveau) => {
      setJeu(nouveau);
      try {
        localStorage.setItem(CLE, nouveau);
      } catch {
        // Idem.
      }
    },
  ];
}
