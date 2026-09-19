import type { CategorySlug } from './types';

export type Category = { slug: CategorySlug; name: string; icon: string; description: string; topics: string[]; planned: string[] };

export const categories: Category[] = [
  { slug: 'meteo', name: 'Météo', icon: '🌦️', description: 'Convertisseurs et calculateurs : pluie, vent, température, humidité, orages.', topics: ['Pluie', 'Vent', 'Température', 'Humidité', 'Neige', 'Gel', 'Orages'],
    planned: ['Convertisseur pression atmosphérique', 'Humidex', 'Humidité absolue', 'Température humide', 'Intensité de pluie', 'Neige / eau', 'Risque de gel', 'Risque de verglas', 'Indice UV'] },
  { slug: 'assurance', name: 'Assurance', icon: '🛡️', description: 'Estimer les dégâts météo et comprendre le calcul d’une indemnisation.', topics: ['Grêle', 'Tempête', 'Inondation', 'Franchise', 'Justificatifs météo'],
    planned: ['Checklist sinistre assurance', 'Générateur de kit d’urgence'] },
  { slug: 'risques', name: 'Risques naturels', icon: '⚠️', description: 'Évaluer l’exposition aux phénomènes naturels : tempête, grêle, chaleur, inondation.', topics: ['Inondation', 'Feu de forêt', 'Sécheresse', 'Chaleur', 'Tempête', 'Submersion', 'Grêle'],
    planned: ['Risque feu de forêt', 'Sécheresse', 'Checklist tempête', 'Checklist inondation'] },
  { slug: 'climat', name: 'Climat', icon: '🌍', description: 'Empreinte carbone, réchauffement, évolution des températures, niveau de la mer.', topics: ['CO₂', 'Empreinte carbone', 'Réchauffement', 'Températures', 'Niveau de la mer'],
    planned: ['Degrés-jours et chauffage', 'Montée du niveau marin', 'Récupération d’eau de pluie', 'Volume d’une citerne'] },
  { slug: 'btp', name: 'BTP', icon: '🏗️', description: 'Conditions de chantier : pluie, gel, vent, intempéries, rapport météo.', topics: ['Pluie chantier', 'Gel', 'Vent', 'Intempéries', 'Jours perdus'],
    planned: ['Calculateur de charge de neige', 'Jours d’intempéries cumulés'] },
];

export const getCategory = (slug: string) => categories.find((c) => c.slug === slug);
