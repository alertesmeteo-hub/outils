import type { JeuAccroche } from './commun';
import { ambiance } from './set-mer-ambiance';
import { phare } from './set-mer-phare';
import { vague } from './set-mer-vague';

export const jeu: JeuAccroche = {
  id: 'mer',
  libelle: '🌊 Méditerranée : vague déferlante et phare',
  haut: vague,
  bas: phare,
  ambiance,
};
