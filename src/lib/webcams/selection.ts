import type { Webcam } from './types';

/**
 * SÉLECTION ÉDITORIALE : vos webcams, affichées en tête de /webcams/.
 *
 * N'ajoutez que des webcams dont vous avez l'autorisation de diffusion (image publique
 * prévue pour être reprise, ou accord du propriétaire). `imageUrl` doit pointer vers une
 * image JPEG/PNG en https ; son domaine doit figurer dans WEBCAM_IMG_HOSTS (.env) pour la CSP.
 *
 * Exemple :
 * { id: 'mont-aiguille', title: 'Mont Aiguille (Isère)', imageUrl: 'https://exemple.fr/webcam.jpg',
 *   place: 'Chichilianne, Isère', lat: 44.842, lon: 5.553, link: 'https://exemple.fr/', source: 'Exemple' },
 */
export const webcamSelection: Webcam[] = [];
