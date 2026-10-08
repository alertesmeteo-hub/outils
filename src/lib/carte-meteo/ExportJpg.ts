import { toJpeg } from 'html-to-image';

/** Pixel transparent, pour les tuiles absentes. */
const VIDE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const versDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result));
    lecteur.onerror = () => reject(lecteur.error);
    lecteur.readAsDataURL(blob);
  });

/**
 * Les tuiles du fond (éléments SVG <image> pointant vers l'IGN) ne sont pas recopiées par html-to-image : on les
 * remplace temporairement par des données locales (data:) le temps de l'export. Retourne la fonction de remise en état.
 */
async function integrerTuiles(noeud: HTMLElement): Promise<() => void> {
  const images = Array.from(noeud.querySelectorAll<SVGImageElement>('image')).filter((i) => (i.getAttribute('href') ?? '').startsWith('http'));
  const originaux = new Map<SVGImageElement, string>();
  await Promise.all(
    images.map(async (image) => {
      const url = image.getAttribute('href') as string;
      try {
        const reponse = await fetch(url, { mode: 'cors', signal: AbortSignal.timeout(15_000) });
        const data = reponse.ok ? await versDataUrl(await reponse.blob()) : VIDE;
        originaux.set(image, url);
        image.setAttribute('href', data);
      } catch {
        // Tuile indisponible (hors couverture, réseau) : on met une image vide pour ne pas faire échouer l'export.
        originaux.set(image, url);
        image.setAttribute('href', VIDE);
      }
    })
  );
  return () => originaux.forEach((url, image) => image.setAttribute('href', url));
}

/**
 * Exporte la carte en JPG (1,5 × la taille logique : 1280 × 720 → 1920 × 1080). La carte est affichée
 * réduite par une transformation CSS selon la largeur d'écran : on la neutralise sur le clone exporté.
 */
export async function exporterEnJpg(noeud: HTMLElement, nomFichier: string, largeur: number, hauteur: number): Promise<void> {
  const remettre = await integrerTuiles(noeud);
  let dataUrl: string;
  try {
    dataUrl = await Promise.race([
      toJpeg(noeud, {
        quality: 0.93,
        pixelRatio: 1.5,
        width: largeur,
        height: hauteur,
        backgroundColor: '#0b2a4a',
        // Boutons d'édition (suppression d'un picto ajouté…) : jamais sur l'image.
        filter: (n) => !(n instanceof Element && n.classList.contains('cmap-sans-export')),
        style: { transform: 'none', transformOrigin: 'top left' },
      }),
      new Promise<never>((_, rejeter) => setTimeout(() => rejeter(new Error("Délai dépassé pendant l'export")), 60_000)),
    ]);
  } finally {
    remettre();
  }
  const lien = document.createElement('a');
  lien.href = dataUrl;
  lien.download = nomFichier.endsWith('.jpg') ? nomFichier : `${nomFichier}.jpg`;
  lien.click();
}
