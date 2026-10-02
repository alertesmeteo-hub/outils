import { toJpeg } from 'html-to-image';

/**
 * Exporte la carte en JPG (1,5 × la taille logique : 1280 × 720 → 1920 × 1080). La carte est affichée
 * réduite par une transformation CSS selon la largeur d'écran : on la neutralise sur le clone exporté.
 */
export async function exporterEnJpg(noeud: HTMLElement, nomFichier: string, largeur: number, hauteur: number): Promise<void> {
  const dataUrl = await toJpeg(noeud, {
    quality: 0.93,
    pixelRatio: 1.5,
    width: largeur,
    height: hauteur,
    backgroundColor: '#0b2a4a',
    style: { transform: 'none', transformOrigin: 'top left' },
  });
  const lien = document.createElement('a');
  lien.href = dataUrl;
  lien.download = nomFichier.endsWith('.jpg') ? nomFichier : `${nomFichier}.jpg`;
  lien.click();
}
