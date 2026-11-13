/**
 * Styles de fond de la carte (option « Style de fond ») : fond uni ou dégradé, territoire coloré, mer toujours dessinée.
 * Les couleurs sont des attributs SVG (pas de CSS) pour passer dans l'export JPG.
 */
export type StyleFond = 'bordeaux' | 'azur' | 'sauge' | 'ardoise' | 'sable' | 'lavande' | 'blanc' | 'gris' | 'bleu' | 'clair' | 'bleu-nuit' | 'creme' | 'rouge-or' | 'parchemin' | 'marine-creme' | 'marine-bleu';

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
  bordeaux: { libelle: 'Bordeaux et or uni (territoire crème)', terre: ['#98283a', '#8c2334'], mer: ['#5a1424', '#4c101d'], territoire: '#f8e7c6', contour: '#e8c872', voisins: 'rgba(232,200,114,0.35)', cote: '#e3b64f', senyera: false, texteMer: '#f1d9a0' },
  azur: { libelle: 'Bleu azur uni (territoire clair)', terre: ['#2d6199', '#295b92'], mer: ['#17406b', '#133860'], territoire: '#e8f1fa', contour: '#ffffff', voisins: 'rgba(255,255,255,0.30)', cote: '#8fb6dc', senyera: false, texteMer: '#dbe9f6' },
  sauge: { libelle: 'Vert sauge uni (territoire clair)', terre: ['#5f8f77', '#598a71'], mer: ['#2c5a47', '#254e3d'], territoire: '#f1f6ea', contour: '#ffffff', voisins: 'rgba(255,255,255,0.30)', cote: '#a9cdb9', senyera: false, texteMer: '#e0efe6' },
  ardoise: { libelle: 'Ardoise unie (territoire clair)', terre: ['#556070', '#4f5a69'], mer: ['#2f3946', '#29323e'], territoire: '#eceff3', contour: '#ffffff', voisins: 'rgba(255,255,255,0.25)', cote: '#97a3b3', senyera: false, texteMer: '#dde3ea' },
  sable: { libelle: 'Sable uni (mer bleu pâle, territoire brun)', terre: ['#ebdfc8', '#e6d8be'], mer: ['#c9dae4', '#b9cedb'], territoire: '#8a6a47', contour: '#ffffff', voisins: 'rgba(138,106,71,0.30)', cote: '#ffffff', senyera: false, texteMer: '#5b7686' },
  lavande: { libelle: 'Lavande unie (territoire clair)', terre: ['#bdb7df', '#b5aedb'], mer: ['#8e87c6', '#8279bb'], territoire: '#f5f3fc', contour: '#ffffff', voisins: 'rgba(255,255,255,0.35)', cote: '#d8d3f0', senyera: false, texteMer: '#ffffff' },
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
