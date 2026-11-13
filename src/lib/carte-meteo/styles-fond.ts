/**
 * Styles de fond de la carte (option « Style de fond ») : fond uni ou dégradé, territoire coloré, mer toujours dessinée.
 * Les couleurs sont des attributs SVG (pas de CSS) pour passer dans l'export JPG.
 */
export type StyleFond = 'bordeaux' | 'azur' | 'sauge' | 'ardoise' | 'sable' | 'lavande' | 'blanc' | 'gris' | 'bleu' | 'clair' | 'bleu-nuit' | 'creme' | 'rouge-or' | 'rouge-or-doux' | 'rouge-or-or' | 'rouge-or-rouge' | 'rouge-or-inverse' | 'rouge-or-territoire-rouge' | 'rouge-or-senyera' | 'parchemin' | 'marine-creme' | 'marine-bleu';

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
  bordeaux: { libelle: 'Bordeaux et or uni (mer bleue, territoire crème)', terre: ['#98283a', '#8c2334'], mer: ['#2f6bb0', '#1d4a85'], territoire: '#f8e7c6', contour: '#e8c872', voisins: 'rgba(232,200,114,0.35)', cote: '#e3b64f', senyera: false, texteMer: '#ffffff' },
  azur: { libelle: 'Bleu azur uni (territoire clair)', terre: ['#2d6199', '#295b92'], mer: ['#17406b', '#133860'], territoire: '#e8f1fa', contour: '#ffffff', voisins: 'rgba(255,255,255,0.30)', cote: '#8fb6dc', senyera: false, texteMer: '#dbe9f6' },
  sauge: { libelle: 'Vert sauge uni (mer bleue, territoire clair)', terre: ['#5f8f77', '#598a71'], mer: ['#3d80b8', '#245a8c'], territoire: '#f1f6ea', contour: '#ffffff', voisins: 'rgba(255,255,255,0.30)', cote: '#a9cdb9', senyera: false, texteMer: '#e8f3fb' },
  ardoise: { libelle: 'Ardoise unie (mer bleue, territoire clair)', terre: ['#556070', '#4f5a69'], mer: ['#3f6f9e', '#2c5278'], territoire: '#eceff3', contour: '#ffffff', voisins: 'rgba(255,255,255,0.25)', cote: '#97a3b3', senyera: false, texteMer: '#e3edf6' },
  sable: { libelle: 'Sable uni (mer bleue, territoire brun)', terre: ['#ebdfc8', '#e6d8be'], mer: ['#bcd9ef', '#9fc7e6'], territoire: '#8a6a47', contour: '#ffffff', voisins: 'rgba(138,106,71,0.30)', cote: '#ffffff', senyera: false, texteMer: '#2f5f7f' },
  lavande: { libelle: 'Lavande unie (mer bleue, territoire clair)', terre: ['#bdb7df', '#b5aedb'], mer: ['#5b8fd0', '#3d6fb0'], territoire: '#f5f3fc', contour: '#ffffff', voisins: 'rgba(255,255,255,0.35)', cote: '#d8d3f0', senyera: false, texteMer: '#ffffff' },
  blanc: { libelle: 'Fond blanc vierge (mer bleu pâle, territoire gris clair)', terre: '#ffffff', mer: ['#cfe4f6', '#b5d5ee'], territoire: '#e4e8ed', contour: '#8c97a4', voisins: '#d3d9e0', cote: '#8fbad3', senyera: false, texteMer: '#2f5f7f' },
  gris: { libelle: 'Fond gris (mer bleu pâle)', terre: ['#d6dadf', '#c0c6cd'], mer: ['#c5dcf0', '#a9c9e4'], territoire: '#f7f8fa', contour: '#6b7480', voisins: '#aab2bc', cote: '#8fb6d3', senyera: false, texteMer: '#2f5f7f' },
  bleu: { libelle: 'Fond bleu (mer bleue, territoire clair)', terre: ['#d3e5f6', '#b9d4ee'], mer: ['#3a86c8', '#1c5b97'], territoire: '#f4f9fe', contour: '#ffffff', voisins: '#9fc0e1', cote: '#ffffff', senyera: false, texteMer: '#ffffff' },
  clair: { libelle: 'Fond clair', terre: ['#f7f8fa', '#e9edf2'], mer: ['#d4e9f4', '#a9d0e6'], territoire: '#3d6cb0', contour: '#ffffff', voisins: '#c5cfdb', cote: '#8fbad3', senyera: false, texteMer: '#2f5f7f' },
  'bleu-nuit': { libelle: 'Fond bleu nuit', terre: ['#12304f', '#0a1f36'], mer: ['#1c5f8a', '#0f3d62'], territoire: '#5b9bd5', contour: '#ffffff', voisins: '#38597b', cote: '#3b84b0', senyera: false, texteMer: '#e6f2fa' },
  creme: { libelle: 'Crème et senyera (territoire bleu-gris)', terre: ['#fbefd9', '#f1d5a8'], mer: ['#a6d4ea', '#5aa7d6'], territoire: '#52689a', contour: '#ffffff', voisins: '#dcc3a0', cote: '#ffffff', senyera: true, texteMer: '#ffffff' },
  'rouge-or': { libelle: 'Rouge et or 1 : classique (mer bleue, territoire crème)', terre: ['#b98a2e', '#7a1c2a'], mer: ['#2f6bc0', '#173f86'], territoire: '#fbeccb', contour: '#f6e3b0', voisins: 'rgba(246,227,176,0.30)', cote: '#e3b64f', senyera: true, texteMer: '#ffffff' },
  'rouge-or-doux': { libelle: 'Rouge et or 2 : dégradé doux (mer bleue, territoire crème)', terre: ['#c49632', '#a8602c'], mer: ['#2f6bc0', '#173f86'], territoire: '#fbeccb', contour: '#fff3d6', voisins: 'rgba(255,243,214,0.35)', cote: '#fff3d6', senyera: false, texteMer: '#ffffff' },
  'rouge-or-or': { libelle: 'Rouge et or 3 : or uni (territoire rouge)', terre: ['#d8a93c', '#c8962f'], mer: ['#2f6bc0', '#173f86'], territoire: '#b3202f', contour: '#fff3d6', voisins: 'rgba(120,80,10,0.30)', cote: '#fff3d6', senyera: false, texteMer: '#ffffff' },
  'rouge-or-rouge': { libelle: 'Rouge et or 4 : rouge uni (territoire or pâle)', terre: ['#a82233', '#951d2d'], mer: ['#2f6bc0', '#173f86'], territoire: '#f6dd9a', contour: '#ffffff', voisins: 'rgba(255,255,255,0.30)', cote: '#ffffff', senyera: false, texteMer: '#ffffff' },
  'rouge-or-inverse': { libelle: 'Rouge et or 5 : dégradé inversé rouge → or (territoire crème)', terre: ['#8f1f2d', '#c9993a'], mer: ['#2f6bc0', '#173f86'], territoire: '#fbeccb', contour: '#fff3d6', voisins: 'rgba(255,243,214,0.35)', cote: '#fff3d6', senyera: false, texteMer: '#ffffff' },
  'rouge-or-territoire-rouge': { libelle: 'Rouge et or 6 : dégradé or → rouge (territoire rouge)', terre: ['#d6a53a', '#9c2432'], mer: ['#2f6bc0', '#173f86'], territoire: '#c4182c', contour: '#fff3d6', voisins: 'rgba(255,243,214,0.30)', cote: '#fff3d6', senyera: false, texteMer: '#ffffff' },
  'rouge-or-senyera': { libelle: 'Rouge et or 7 : senyera (dégradé doux, territoire crème)', terre: ['#c49632', '#a8602c'], mer: ['#2f6bc0', '#173f86'], territoire: '#fbeccb', contour: '#fff3d6', voisins: 'rgba(255,243,214,0.35)', cote: '#fff3d6', senyera: true, texteMer: '#ffffff' },
  parchemin: { libelle: 'Parchemin (mer bleue)', terre: ['#f4e8d2', '#eadcbf'], mer: ['#3b9de8', '#1d6fc2'], territoire: '#fbe3ae', contour: '#1a1a1a', voisins: '#c9b79a', cote: '#1a1a1a', senyera: true, texteMer: '#ffffff' },
  'marine-creme': { libelle: 'Bleu marine (territoire crème)', terre: ['#0e3485', '#071b52'], mer: ['#33a0ea', '#1566b8'], territoire: '#fdf0cc', contour: '#ffffff', voisins: '#2a58b0', cote: '#ffffff', senyera: true, texteMer: '#ffffff' },
  'marine-bleu': { libelle: 'Bleu marine (territoire bleu)', terre: ['#0a3f94', '#061f5c'], mer: ['#33a0ea', '#1566b8'], territoire: '#3f86e0', contour: '#ffffff', voisins: '#6a8fd6', cote: '#ffffff', senyera: true, texteMer: '#ffffff' },
};

export const ORDRE_STYLES_FOND = Object.keys(STYLES_FOND) as StyleFond[];

export const estStyleFond = (v: unknown): v is StyleFond => typeof v === 'string' && v in STYLES_FOND;

/** Départements du littoral méditerranéen : sur la carte du département, on garde une bande de mer à droite. */
export const DEPARTEMENTS_MER_A_L_EST = ['66', '11', '34', '30', '13', '83', '06', '2A', '2B'];
