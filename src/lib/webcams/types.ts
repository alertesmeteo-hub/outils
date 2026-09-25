/** Une webcam affichable, quelle qu'en soit la source (sélection éditoriale ou API Windy). */
export type Webcam = {
  id: string;
  title: string;
  /** URL d'une image fixe rafraîchie par la source (JPEG). */
  imageUrl: string;
  place?: string;
  lat?: number;
  lon?: number;
  /** Page de la webcam chez sa source (lien « voir en direct »). */
  link?: string;
  source: string;
  updatedAt?: string;
  distanceKm?: number;
};
