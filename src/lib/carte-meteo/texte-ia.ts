/**
 * Texte IA des cartes infos : données d'une carte envoyées à /api/carte-meteo/texte/ pour que Claude rédige le texte qui
 * l'accompagne. Seuls ces champs (bornés) sont transmis au modèle : pas de texte libre de l'utilisateur.
 */

export type FormatTexte = 'court' | 'long';

export interface RubriqueTexte {
  /** Phénomène (« Températures maximales », « Rafales »…). */
  nom: string;
  unite: string;
  /** Sens du classement : les valeurs les plus hautes ou les plus basses en tête. */
  sens: 'plus hautes' | 'plus basses';
  classement: { lieu: string; departement?: string; valeur: number }[];
  stats?: { nombre: number; min: number; max: number; moyenne: number };
}

export interface CarteTexte {
  /** Nature de la carte : prévision (modèle), bilan des stations, projection climatique, synthèse. */
  type: string;
  titre: string;
  periode: string;
  zone: string;
  source: string;
  rubriques: RubriqueTexte[];
}

export interface DemandeTexte {
  format: FormatTexte;
  carte: CarteTexte;
}

const texte = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '');
const nombre = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : null);

/** Valide et borne une demande reçue (côté serveur) ; null si elle est inutilisable. */
export function lireDemandeTexte(brut: unknown): DemandeTexte | null {
  if (!brut || typeof brut !== 'object') return null;
  const d = brut as Record<string, unknown>;
  const c = (d.carte ?? {}) as Record<string, unknown>;
  const rubriques = (Array.isArray(c.rubriques) ? c.rubriques : []).slice(0, 6).flatMap((r): RubriqueTexte[] => {
    if (!r || typeof r !== 'object') return [];
    const x = r as Record<string, unknown>;
    const classement = (Array.isArray(x.classement) ? x.classement : []).slice(0, 8).flatMap((l) => {
      const ligne = (l ?? {}) as Record<string, unknown>;
      const valeur = nombre(ligne.valeur);
      const lieu = texte(ligne.lieu, 60);
      return valeur == null || !lieu ? [] : [{ lieu, departement: texte(ligne.departement, 4) || undefined, valeur }];
    });
    const s = (x.stats ?? null) as Record<string, unknown> | null;
    const stats =
      s && [s.nombre, s.min, s.max, s.moyenne].every((v) => nombre(v) != null)
        ? { nombre: nombre(s.nombre)!, min: nombre(s.min)!, max: nombre(s.max)!, moyenne: nombre(s.moyenne)! }
        : undefined;
    const nom = texte(x.nom, 60);
    return nom && classement.length ? [{ nom, unite: texte(x.unite, 70), sens: x.sens === 'plus basses' ? 'plus basses' : 'plus hautes', classement, stats }] : [];
  });
  if (rubriques.length === 0) return null;
  return {
    format: d.format === 'long' ? 'long' : 'court',
    carte: {
      type: texte(c.type, 200),
      titre: texte(c.titre, 120),
      periode: texte(c.periode, 160),
      zone: texte(c.zone, 80),
      source: texte(c.source, 200),
      rubriques,
    },
  };
}

/** Statistiques d'une série de valeurs (nombre de points, extrêmes, moyenne). */
export function statsDe(valeurs: number[]): RubriqueTexte['stats'] {
  if (valeurs.length === 0) return undefined;
  return {
    nombre: valeurs.length,
    min: Math.min(...valeurs),
    max: Math.max(...valeurs),
    moyenne: Math.round((valeurs.reduce((a, b) => a + b, 0) / valeurs.length) * 10) / 10,
  };
}
