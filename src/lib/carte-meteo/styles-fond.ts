/**
 * Styles de fond de la carte (option « Style de fond ») : fond uni ou dégradé, territoire coloré, mer toujours dessinée.
 * Les couleurs sont des attributs SVG (pas de CSS) pour passer dans l'export JPG.
 */
export type StyleFond = 'clair' | 'bleu-nuit' | 'creme' | 'rouge-or' | 'parchemin' | 'marine-creme' | 'marine-bleu';

/** Une couleur, ou un dégradé en diagonale (haut gauche vers bas droit). */
export type Peinture = string | [string, string];

export interface DefStyleFond {
  libelle: string;
  /** Fond : tout ce qui n'est pas la mer (étranger, départements voisins). */
  terre: Peinture;
  mer: Peinture;
  /** Remplissage du territoire sélectionné. */
  territoire: string;
  /** Contour du territoire. */
  contour: string;
  /** Contours des départements voisins. */
  voisins: string;
  /** Trait de côte. */
  cote: string;
  /** Bandes de la senyera (jaune et rouge) en haut à gauche et en bas à droite. */
  senyera: boolean;
  /** Couleur du texte « Mer Méditerranée ». */
  texteMer: string;
}

export const STYLES_FOND: Record<StyleFond, DefStyleFond> = {
  clair: { libelle: 'Fond clair', terre: '#edf1f5', mer: '#c5dfeb', territoire: '#8499b8', contour: '#ffffff', voisins: '#d3dce6', cote: '#aecbd9', senyera: false, texteMer: '#3a6a88' },
  'bleu-nuit': { libelle: 'Fond bleu nuit', terre: '#0f2b47', mer: '#1b5273', territoire: '#6a89b0', contour: '#ffffff', voisins: '#2b4b6c', cote: '#2f6f93', senyera: false, texteMer: '#e6f2fa' },
  creme: { libelle: 'Crème et senyera (territoire bleu-gris)', terre: ['#f9e6cc', '#f3d0a4'], mer: ['#9ccbe3', '#5aa3d0'], territoire: '#7b8cab', contour: '#ffffff', voisins: '#dcc3a0', cote: '#ffffff', senyera: true, texteMer: '#ffffff' },
  'rouge-or': { libelle: 'Rouge et or (territoire crème)', terre: ['#f6b90f', '#9d1025'], mer: ['#2f6bc0', '#173f86'], territoire: '#f3d9a4', contour: '#ffffff', voisins: 'rgba(255,255,255,0.3)', cote: '#ffffff', senyera: true, texteMer: '#ffffff' },
  parchemin: { libelle: 'Parchemin (mer bleue)', terre: ['#f4e8d2', '#eadcbf'], mer: ['#3b9de8', '#1d6fc2'], territoire: '#fbe3ae', contour: '#1a1a1a', voisins: '#c9b79a', cote: '#1a1a1a', senyera: true, texteMer: '#ffffff' },
  'marine-creme': { libelle: 'Bleu marine (territoire crème)', terre: ['#0c2f7a', '#071b52'], mer: ['#2a93e0', '#1566b8'], territoire: '#fbe3ab', contour: '#ffffff', voisins: '#1d4aa0', cote: '#ffffff', senyera: true, texteMer: '#ffffff' },
  'marine-bleu': { libelle: 'Bleu marine (territoire bleu)', terre: ['#0a3f94', '#061f5c'], mer: ['#2a93e0', '#1566b8'], territoire: '#0c58b5', contour: '#ffffff', voisins: '#6a8fd6', cote: '#ffffff', senyera: true, texteMer: '#ffffff' },
};

export const ORDRE_STYLES_FOND = Object.keys(STYLES_FOND) as StyleFond[];

export const estStyleFond = (v: unknown): v is StyleFond => typeof v === 'string' && v in STYLES_FOND;

/** Départements du littoral méditerranéen : sur la carte du département, on garde une bande de mer à droite. */
export const DEPARTEMENTS_MER_A_L_EST = ['66', '11', '34', '30', '13', '83', '06', '2A', '2B'];
