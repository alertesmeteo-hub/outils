import type { CategorySlug } from './types';

export type Category = { slug: CategorySlug; name: string; icon: string; description: string; topics: string[]; planned: string[] };

export const categories: Category[] = [
  { slug: 'meteo', name: 'Météo', icon: '🌦️', description: 'Convertisseurs et calculateurs : pluie, vent, température, humidité, orages.', topics: ['Pluie', 'Vent', 'Température', 'Humidité', 'Neige', 'Gel', 'Orages'],
    planned: [] },
  { slug: 'assurance', name: 'Assurance', icon: '🛡️', description: 'Estimer les dégâts météo et comprendre le calcul d’une indemnisation.', topics: ['Grêle', 'Tempête', 'Inondation', 'Franchise', 'Justificatifs météo'],
    planned: [] },
  { slug: 'risques', name: 'Risques naturels', icon: '⚠️', description: 'Évaluer l’exposition aux phénomènes naturels : tempête, grêle, chaleur, inondation.', topics: ['Inondation', 'Feu de forêt', 'Sécheresse', 'Chaleur', 'Tempête', 'Submersion', 'Grêle'],
    planned: ['Risque feu de forêt (indice officiel requis)', 'Sécheresse (données officielles requises)'] },
  { slug: 'climat', name: 'Climat', icon: '🌍', description: 'Empreinte carbone, réchauffement, évolution des températures, niveau de la mer.', topics: ['CO₂', 'Empreinte carbone', 'Réchauffement', 'Températures', 'Niveau de la mer'],
    planned: ['Montée du niveau marin (scénarios officiels requis)'] },
  { slug: 'btp', name: 'BTP', icon: '🏗️', description: 'Conditions de chantier : pluie, gel, vent, intempéries, rapport météo.', topics: ['Pluie chantier', 'Gel', 'Vent', 'Intempéries', 'Jours perdus'],
    planned: ['Jours d’intempéries cumulés'] },
];

export const getCategory = (slug: string) => categories.find((c) => c.slug === slug);
