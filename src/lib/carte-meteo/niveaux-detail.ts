/** Quatre niveaux d'information des cartes tendances : de tout ce qui tient sur la carte à l'essentiel. */
export const NIVEAUX_DETAIL = [
  { id: 1, libelle: '1 · Complet', part: 1 },
  { id: 2, libelle: '2 · Détaillé', part: 0.65 },
  { id: 3, libelle: '3 · Allégé', part: 0.4 },
  { id: 4, libelle: '4 · Essentiel', part: 0.22 },
] as const;
