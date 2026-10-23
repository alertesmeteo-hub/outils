import type { CSSProperties } from 'react';

/** Façon d'écrire une valeur : pastille bordée, pastille plate, pastille lumineuse, texte avec une puce de couleur, ou barre proportionnelle. */
export type ValeurTableau = 'pastille' | 'plate' | 'neon' | 'texte' | 'barre';

/** Un style de tableau en JPG (couleurs, polices, forme des lignes et des valeurs). */
export interface StyleTableau {
  id: string;
  libelle: string;
  /** Fond (CSS) du petit aperçu du bouton de choix. */
  apercu: string;
  fond: string;
  texte: string;
  police: string;
  policeTitre: string;
  policeValeur: string;
  titreGras?: boolean;
  /** Bandeau du titre (fond, bordures, arrondi) et couleurs de ses deux lignes. */
  bandeau: CSSProperties;
  titre: string;
  sousTitre: string;
  /** Titres des colonnes et trait dessous. */
  entete: string;
  traitEntete: string;
  /** Couleur des rangs, de la première colonne (celle qui classe) et du liseré des lignes en cartouches. */
  accent: string;
  rangItalique?: boolean;
  lignePaire: string;
  ligneImpaire: string;
  /** Trait entre deux lignes (lignes pleine largeur). */
  traitLigne: string;
  /** Lignes en cartouches séparés (px entre deux lignes) ; 0 = lignes pleine largeur. */
  ecart: number;
  ombreLigne: string;
  /** Département, altitude, valeurs absentes. */
  secondaire: string;
  pied: string;
  piedMarque: string;
  valeur: ValeurTableau;
  pastilleBordure: string;
  pastilleOmbre: string;
  /** Valeur « neutre » (pas de couleur de palier). */
  neutreFond: string;
  neutreTexte: string;
  puceRonde?: boolean;
  puceBordure: string;
  barreFond: string;
}

const IMPACT = "Impact, 'Arial Narrow Bold', 'Arial Black', sans-serif";
const ARIAL = 'Arial, Helvetica, sans-serif';
const SEGOE = "'Segoe UI', Arial, sans-serif";
const TREBUCHET = "'Trebuchet MS', Arial, sans-serif";
const GEORGIA = "Georgia, 'Times New Roman', serif";

const base: Omit<StyleTableau, 'id' | 'libelle' | 'apercu' | 'fond' | 'texte' | 'bandeau' | 'titre' | 'sousTitre' | 'entete' | 'accent' | 'lignePaire' | 'ligneImpaire' | 'secondaire' | 'pied' | 'piedMarque'> = {
  police: ARIAL,
  policeTitre: IMPACT,
  policeValeur: IMPACT,
  traitEntete: 'none',
  traitLigne: '1px solid rgba(255,255,255,0.08)',
  ecart: 0,
  ombreLigne: 'none',
  valeur: 'pastille',
  pastilleBordure: '#fff',
  pastilleOmbre: '0 2px 6px rgba(0,0,0,0.45)',
  neutreFond: 'rgba(255,255,255,0.12)',
  neutreTexte: '#fff',
  puceBordure: '#fff',
  barreFond: 'rgba(255,255,255,0.1)',
};

/** Les onze styles proposés (le premier est celui des cartes). */
export const STYLES_TABLEAU: StyleTableau[] = [
  {
    ...base,
    id: 'alertes',
    libelle: 'Alertes Météo',
    apercu: 'linear-gradient(135deg,#0b2a4a,#123c6b)',
    fond: 'linear-gradient(160deg, #0b2a4a 0%, #123c6b 100%)',
    texte: '#fff',
    bandeau: { background: 'rgba(255,255,255,0.94)', borderRadius: 12 },
    titre: '#0b2a4a',
    sousTitre: '#2563a8',
    entete: '#cfe3fa',
    accent: '#ffd21a',
    lignePaire: 'rgba(255,255,255,0.09)',
    ligneImpaire: 'rgba(255,255,255,0.03)',
    secondaire: '#9db8d6',
    pied: '#cfe3fa',
    piedMarque: '#fff',
  },
  {
    ...base,
    id: 'clair',
    libelle: 'Clair',
    apercu: 'linear-gradient(135deg,#f1f5f9,#1e3a8a)',
    fond: '#f1f5f9',
    texte: '#0f172a',
    police: SEGOE,
    policeTitre: SEGOE,
    policeValeur: "'Arial Black', Arial, sans-serif",
    titreGras: true,
    bandeau: { background: '#1e3a8a', borderRadius: 10 },
    titre: '#ffffff',
    sousTitre: '#bfdbfe',
    entete: '#475569',
    traitEntete: '2px solid #cbd5e1',
    accent: '#1d4ed8',
    lignePaire: '#ffffff',
    ligneImpaire: '#eef2f7',
    traitLigne: '1px solid #e2e8f0',
    secondaire: '#64748b',
    pied: '#64748b',
    piedMarque: '#1e3a8a',
    valeur: 'plate',
    neutreFond: '#e2e8f0',
    neutreTexte: '#0f172a',
  },
  {
    ...base,
    id: 'tele',
    libelle: 'Plateau télé',
    apercu: 'linear-gradient(135deg,#0a0a0a 55%,#ffd21a 55%)',
    fond: '#0a0a0a',
    texte: '#ffffff',
    bandeau: { background: '#ffd21a', borderRadius: 0 },
    titre: '#111111',
    sousTitre: '#3b3b3b',
    entete: '#ffd21a',
    traitEntete: '3px solid #ffd21a',
    accent: '#ffd21a',
    lignePaire: '#161616',
    ligneImpaire: '#0f0f0f',
    traitLigne: '1px solid #262626',
    secondaire: '#9a9a9a',
    pied: '#9a9a9a',
    piedMarque: '#ffd21a',
    valeur: 'texte',
    puceRonde: true,
  },
  {
    ...base,
    id: 'minimal',
    libelle: 'Minimal',
    apercu: 'linear-gradient(135deg,#ffffff 60%,#111111 60%)',
    fond: '#ffffff',
    texte: '#111111',
    police: 'Helvetica, Arial, sans-serif',
    policeTitre: 'Helvetica, Arial, sans-serif',
    policeValeur: 'Helvetica, Arial, sans-serif',
    titreGras: true,
    bandeau: { background: 'transparent', borderBottom: '4px solid #111111', borderRadius: 0 },
    titre: '#111111',
    sousTitre: '#6b7280',
    entete: '#6b7280',
    traitEntete: '1px solid #111111',
    accent: '#111111',
    lignePaire: '#ffffff',
    ligneImpaire: '#ffffff',
    traitLigne: '1px solid #e5e7eb',
    secondaire: '#6b7280',
    pied: '#6b7280',
    piedMarque: '#111111',
    valeur: 'texte',
    puceBordure: 'rgba(0,0,0,0.25)',
  },
  {
    ...base,
    id: 'barres',
    libelle: 'Barres',
    apercu: 'linear-gradient(90deg,#111827 30%,#38bdf8 30%,#38bdf8 70%,#111827 70%)',
    fond: 'linear-gradient(160deg, #111827 0%, #1f2937 100%)',
    texte: '#f9fafb',
    bandeau: { background: '#f9fafb', borderRadius: 10 },
    titre: '#111827',
    sousTitre: '#4b5563',
    entete: '#9ca3af',
    accent: '#38bdf8',
    lignePaire: 'rgba(255,255,255,0.06)',
    ligneImpaire: 'transparent',
    traitLigne: '1px solid rgba(255,255,255,0.06)',
    secondaire: '#9ca3af',
    pied: '#9ca3af',
    piedMarque: '#f9fafb',
    valeur: 'barre',
    neutreFond: '#6b7280',
  },
  {
    ...base,
    id: 'neon',
    libelle: 'Néon',
    apercu: 'linear-gradient(135deg,#0d0221,#22d3ee 60%,#f472b6)',
    fond: 'linear-gradient(160deg, #0d0221 0%, #1a0b3d 100%)',
    texte: '#f5f3ff',
    police: TREBUCHET,
    bandeau: { background: 'transparent', border: '2px solid #22d3ee', borderRadius: 14, boxShadow: '0 0 18px #22d3ee, inset 0 0 12px rgba(34,211,238,0.35)' },
    titre: '#e0fbff',
    sousTitre: '#f472b6',
    entete: '#22d3ee',
    traitEntete: '1px solid rgba(34,211,238,0.5)',
    accent: '#f472b6',
    lignePaire: 'rgba(34,211,238,0.08)',
    ligneImpaire: 'rgba(244,114,182,0.05)',
    traitLigne: '1px solid rgba(34,211,238,0.15)',
    secondaire: '#a5b4fc',
    pied: '#a5b4fc',
    piedMarque: '#22d3ee',
    valeur: 'neon',
    neutreFond: '#4c1d95',
  },
  {
    ...base,
    id: 'orage',
    libelle: 'Orage',
    apercu: 'linear-gradient(135deg,#1b1f2a 55%,#ff7a18 55%)',
    fond: 'linear-gradient(160deg, #1b1f2a 0%, #3a3f52 100%)',
    texte: '#ffffff',
    police: SEGOE,
    bandeau: { background: '#ff7a18', borderRadius: 6 },
    titre: '#1b1f2a',
    sousTitre: '#ffffff',
    entete: '#ffb27a',
    traitEntete: '2px solid #ff7a18',
    accent: '#ff7a18',
    lignePaire: 'rgba(255,255,255,0.07)',
    ligneImpaire: 'rgba(255,255,255,0.02)',
    traitLigne: '1px solid rgba(255,255,255,0.07)',
    secondaire: '#aab1c5',
    pied: '#aab1c5',
    piedMarque: '#ff7a18',
    valeur: 'plate',
    neutreFond: '#4b5163',
  },
  {
    ...base,
    id: 'pastel',
    libelle: 'Pastel',
    apercu: 'linear-gradient(135deg,#fde7f3,#dbeafe)',
    fond: 'linear-gradient(160deg, #fde7f3 0%, #dbeafe 100%)',
    texte: '#334155',
    police: TREBUCHET,
    policeTitre: TREBUCHET,
    policeValeur: TREBUCHET,
    titreGras: true,
    bandeau: { background: 'rgba(255,255,255,0.85)', borderRadius: 24 },
    titre: '#7c3aed',
    sousTitre: '#db2777',
    entete: '#64748b',
    accent: '#db2777',
    lignePaire: '#ffffff',
    ligneImpaire: '#ffffff',
    ecart: 8,
    ombreLigne: '0 2px 8px rgba(100,116,139,0.25)',
    secondaire: '#64748b',
    pied: '#64748b',
    piedMarque: '#7c3aed',
    valeur: 'plate',
    neutreFond: '#e2e8f0',
    neutreTexte: '#334155',
  },
  {
    ...base,
    id: 'cartouches',
    libelle: 'Cartouches',
    apercu: 'linear-gradient(135deg,#0b2a4a,#0f4c5c 60%,#2dd4bf)',
    fond: 'linear-gradient(160deg, #0b2a4a 0%, #0f4c5c 100%)',
    texte: '#ffffff',
    bandeau: { background: 'rgba(255,255,255,0.94)', borderRadius: 12 },
    titre: '#0b2a4a',
    sousTitre: '#0f766e',
    entete: '#a7f3d0',
    accent: '#2dd4bf',
    lignePaire: 'rgba(255,255,255,0.14)',
    ligneImpaire: 'rgba(255,255,255,0.14)',
    ecart: 8,
    ombreLigne: '0 3px 10px rgba(0,0,0,0.35)',
    secondaire: '#a7c7d9',
    pied: '#a7c7d9',
    piedMarque: '#2dd4bf',
    pastilleOmbre: '0 2px 5px rgba(0,0,0,0.4)',
  },
  {
    ...base,
    id: 'journal',
    libelle: 'Journal',
    apercu: 'linear-gradient(135deg,#f3ead3,#2b2118)',
    fond: '#f3ead3',
    texte: '#2b2118',
    police: GEORGIA,
    policeTitre: GEORGIA,
    policeValeur: GEORGIA,
    titreGras: true,
    bandeau: { background: 'transparent', borderTop: '4px double #2b2118', borderBottom: '4px double #2b2118', borderRadius: 0, textAlign: 'center' },
    titre: '#2b2118',
    sousTitre: '#7a5c3a',
    entete: '#7a5c3a',
    traitEntete: '2px solid #2b2118',
    accent: '#8b1e1e',
    rangItalique: true,
    lignePaire: 'rgba(43,33,24,0.06)',
    ligneImpaire: 'transparent',
    traitLigne: '1px dotted rgba(43,33,24,0.45)',
    secondaire: '#7a5c3a',
    pied: '#7a5c3a',
    piedMarque: '#2b2118',
    valeur: 'texte',
    puceBordure: '#2b2118',
  },
  {
    ...base,
    id: 'ocean',
    libelle: 'Océan',
    apercu: 'linear-gradient(135deg,#022c3a,#0e7490 60%,#fde68a)',
    fond: 'linear-gradient(160deg, #022c3a 0%, #0e7490 100%)',
    texte: '#ecfeff',
    police: SEGOE,
    bandeau: { background: 'linear-gradient(90deg,#fde68a,#fef3c7)', borderRadius: 40 },
    titre: '#022c3a',
    sousTitre: '#0e7490',
    entete: '#fde68a',
    traitEntete: '2px solid #fde68a',
    accent: '#fde68a',
    lignePaire: 'rgba(236,254,255,0.12)',
    ligneImpaire: 'rgba(236,254,255,0.04)',
    traitLigne: '1px solid rgba(236,254,255,0.1)',
    secondaire: '#a5f3fc',
    pied: '#a5f3fc',
    piedMarque: '#fde68a',
    valeur: 'plate',
    neutreFond: '#155e75',
  },
];
