export interface LogoPreset {
  id: string;
  nom: string;
  fichier: string;
  /** Fond blanc derrière le logo ; faux pour un logo détouré (ex. rond) dont les coins sont transparents. */
  fondBlanc?: boolean;
}

export const LOGOS_PRESETS: LogoPreset[] = [
  { id: 'aucun', nom: 'Aucun logo', fichier: '' },
  { id: 'alertesmeteo', nom: 'AlertesMétéo.com', fichier: '/logos/alertesmeteo.png' },
  { id: 'alertesmeteo-transparent', nom: 'AlertesMétéo.com (fond transparent)', fichier: '/logos/alertesmeteo-transparent.png' },
  { id: 'pays-catalan-hd', nom: 'Météo Pays Catalan (haute qualité)', fichier: '/logos/meteo-pays-catalan-hd.png', fondBlanc: false },
  { id: 'pays-catalan', nom: 'Météo Pays Catalan', fichier: '/logos/meteo-pays-catalan.jpg' },
];

/** Logo suggéré selon les départements sélectionnés (ex. Pyrénées-Orientales seul → Météo Pays Catalan). */
export function logoParDefaut(codesDepartements: string[]): LogoPreset {
  if (codesDepartements.length === 1 && codesDepartements[0] === '66') {
    return LOGOS_PRESETS.find((l) => l.id === 'pays-catalan-hd')!;
  }
  return LOGOS_PRESETS.find((l) => l.id === 'aucun')!;
}
