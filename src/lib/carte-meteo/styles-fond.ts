/**
 * Styles de fond de la carte (option « Style de fond ») : fond uni ou dégradé, territoire coloré, mer toujours dessinée.
 * Les couleurs sont des attributs SVG (pas de CSS) pour passer dans l'export JPG.
 */
export type StyleFond = 'blanc' | 'gris' | 'bleu' | 'clair' | 'bleu-nuit' | 'creme' | 'rouge-or' | 'parchemin' | 'marine-creme' | 'marine-bleu';

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
  blanc: { libelle: 'Fond blanc vierge (territoire gris clair)', terre: '#ffffff', mer: '#ffffff', territoire: '#e4e8ed', contour: '#8c97a4', voisins: '#d3d9e0', cote: '#c5cfdb', senyera: false, texteMer: '#ffffff' },
  gris: { libelle: 'Fond gris (mer gris clair)', terre: ['#d6dadf', '#c0c6cd'], mer: ['#eef0f3', '#dde1e6'], territoire: '#f7f8fa', contour: '#6b7480', voisins: '#aab2bc', cote: '#9aa3ad', senyera: false, texteMer: '#6b7480' },
  bleu: { libelle: 'Fond bleu (mer bleue, territoire clair)', terre: ['#d3e5f6', '#b9d4ee'], mer: ['#3a86c8', '#1c5b97'], territoire: '#f4f9fe', contour: '#ffffff', voisins: '#9fc0e1', cote: '#ffffff', senyera: false, texteMer: '#ffffff' },
  clair: { libelle: 'Fond clair', terre: ['#f7f8fa', '#e9edf2'], mer: ['#d4e9f4', '#a9d0e6'], territoire: '#3d6cb0', contour: '#ffffff', voisins: '#c5cfdb', cote: '#8fbad3', senyera: false, texteMer: '#2f5f7f' },
  'bleu-nuit': { libelle: 'Fond bleu nuit', terre: ['#12304f', '#0a1f36'], mer: ['#1c5f8a', '#0f3d62'], territoire: '#5b9bd5', contour: '#ffffff', voisins: '#38597b', cote: '#3b84b0', senyera: false, texteMer: '#e6f2fa' },
  creme: { libelle: 'Crème et senyera (territoire bleu-gris)', terre: ['#fbefd9', '#f1d5a8'], mer: ['#a6d4ea', '#5aa7d6'], territoire: '#52689a', contour: '#ffffff', voisins: '#dcc3a0', cote: '#ffffff', senyera: true, texteMer: '#ffffff' },
  'rouge-or': { libelle: 'Rouge et or (mer bordeaux, territoire crème)', terre: ['#b98a2e', '#7a1c2a'], mer: ['#5c1122', '#36080f'], territoire: '#fbeccb', contour: '#f6e3b0', voisins: 'rgba(246,227,176,0.30)', cote: '#e3b64f', senyera: true, texteMer: '#f6e3b0' },
  parchemin: { libelle: 'Parchemin (mer bleue)', terre: ['#f4e8d2', '#eadcbf'], mer: ['#3b9de8', '#1d6fc2'], territoire: '#fbe3ae', contour: '#1a1a1a', voisins: '#c9b79a', cote: '#1a1a1a', senyera: true, texteMer: '#ffffff' },
  'marine-creme': { libelle: 'Bleu marine (territoire crème)', terre: ['#0e3485', '#071b52'], mer: ['#33a0ea', '#1566b8'], territoire: '#fdf0cc', contour: '#ffffff', voisins: '#2a58b0', cote: '#ffffff', senyera: true, texteMer: '#ffffff' },
  'marine-bleu': { libelle: 'Bleu marine (territoire bleu)', terre: ['#0a3f94', '#061f5c'], mer: ['#33a0ea', '#1566b8'], territoire: '#3f86e0', contour: '#ffffff', voisins: '#6a8fd6', cote: '#ffffff', senyera: true, texteMer: '#ffffff' },
};

export const ORDRE_STYLES_FOND = Object.keys(STYLES_FOND) as StyleFond[];

export const estStyleFond = (v: unknown): v is StyleFond => typeof v === 'string' && v in STYLES_FOND;

/** Départements du littoral méditerranéen : sur la carte du département, on garde une bande de mer à droite. */
export const DEPARTEMENTS_MER_A_L_EST = ['66', '11', '34', '30', '13', '83', '06', '2A', '2B'];
