import type { CarteTexte, FormatTexte, RubriqueTexte } from './texte-ia';

/**
 * Rédaction automatique, sans IA : phrases-types remplies avec les valeurs de la carte (extrêmes, lieux, moyenne).
 * Les chiffres et les lieux viennent tous des données ; rien n'est inventé.
 */

const nombreFr = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');

function avecUnite(v: number, unite: string, ecart = false): string {
  // Unités longues (échelles de niveaux…) : on ne les répète pas derrière chaque valeur.
  const signe = ecart && v > 0 ? '+' : '';
  if (!unite || unite.length > 12) return signe + nombreFr(v);
  return `${signe}${nombreFr(v)}${unite === '%' ? '' : ' '}${unite}`;
}

const lieu = (l: RubriqueTexte['classement'][number]) => (l.departement ? `${l.lieu} (${l.departement})` : l.lieu);

function enumeration(elements: string[]): string {
  if (elements.length <= 1) return elements[0] ?? '';
  return `${elements.slice(0, -1).join(', ')} et ${elements[elements.length - 1]}`;
}

function phraseRubrique(r: RubriqueTexte, detail: boolean): string {
  const [premier, ...suite] = r.classement;
  const haut = r.sens === 'plus hautes';
  const prep = r.preposition ?? 'à';
  let t = `${r.nom} : ${haut ? 'la valeur la plus élevée' : 'la valeur la plus basse'} est de ${avecUnite(premier.valeur, r.unite, r.ecart)} ${prep} ${lieu(premier)}`;
  const suivants = suite.slice(0, detail ? 4 : 2).map((l) => `${avecUnite(l.valeur, r.unite, r.ecart)} ${prep} ${lieu(l)}`);
  t += suivants.length ? `, devant ${enumeration(suivants)}.` : '.';
  if (r.stats && r.stats.nombre > 1) {
    t += detail
      ? ` Sur l'ensemble des ${r.stats.nombre} points de la carte, les valeurs vont de ${avecUnite(r.stats.min, r.unite, r.ecart)} à ${avecUnite(r.stats.max, r.unite, r.ecart)}, pour une moyenne de ${avecUnite(r.stats.moyenne, r.unite, r.ecart)}.`
      : ` La moyenne sur la carte est de ${avecUnite(r.stats.moyenne, r.unite, r.ecart)}.`;
  }
  return t;
}

/** Texte d'accompagnement d'une carte : court (réseaux sociaux) ou long (deux paragraphes, article). */
export function redigerTexte(carte: CarteTexte, format: FormatTexte): string {
  const zone = carte.zone ? ` — ${carte.zone}` : '';
  const entete = `${carte.titre}${zone}${carte.periode ? ` (${carte.periode})` : ''}.`;
  const rubriques = carte.rubriques.filter((r) => r.classement.length > 0);
  if (rubriques.length === 0) return entete;
  if (format === 'court') {
    const mot = (carte.zone || 'France').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '');
    return `${entete} ${phraseRubrique(rubriques[0], false)}\n\n#météo${mot ? ` #${mot}` : ''}`;
  }
  const premier = `${entete} ${phraseRubrique(rubriques[0], true)}`;
  const autres = rubriques.slice(1).map((r) => phraseRubrique(r, true));
  const source = carte.source ? `Source : ${carte.source}.` : '';
  return [premier, [...autres, source].filter(Boolean).join(' ')].filter(Boolean).join('\n\n');
}
