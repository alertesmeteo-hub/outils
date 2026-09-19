export type Tone = 'ok' | 'info' | 'warn' | 'danger' | 'extreme' | 'neutral';
export type CategorySlug = 'meteo' | 'assurance' | 'risques' | 'climat' | 'btp';

export type FieldOption = { value: string; label: string };

export type Field = {
  id: string;
  label: string;
  type: 'number' | 'select' | 'checkbox' | 'text' | 'date' | 'time';
  unit?: string;
  help?: string;
  placeholder?: string;
  default?: string | boolean;
  required?: boolean;
  min?: number;
  max?: number;
  options?: FieldOption[];
  /** Regex (source) pour les champs texte. */
  pattern?: string;
  patternMessage?: string;
  maxLength?: number;
  /** Interdit une date future. */
  noFuture?: boolean;
  /** Titre de groupe : affiché quand la section change. */
  section?: string;
};

/** Valeurs brutes saisies (chaînes / booléens). */
export type Values = Record<string, string | boolean>;
/** Valeurs validées et typées. */
export type Parsed = Record<string, number | string | boolean | undefined>;

export type Metric = { label: string; value: string; unit?: string; hint?: string };

export type ToolResult = {
  level?: { label: string; tone: Tone };
  headline?: { label: string; value: string; unit?: string };
  metrics?: Metric[];
  gauge?: { value: number; min: number; max: number; segments: { to: number; tone: Tone }[]; caption?: string };
  checks?: { label: string; ok: boolean; detail?: string }[];
  lists?: { title: string; items: string[] }[];
  notes?: string[];
  /** Texte copiable / stocké dans l'historique local. */
  shareText: string;
};

export type Faq = { q: string; a: string };

export type ToolDefinition = {
  slug: string; // identifiant interne stable (API, embed, admin, liens associés)
  /** URL publique : /<thème>/<page>, ex. /pluie/mm-en-litres */
  path: string;
  name: string;
  category: CategorySlug;
  icon: string;
  shortDescription: string;
  /** SEO */
  h1: string;
  title: string;
  metaDescription: string;
  keywords: string[];
  /** Contenu éditorial */
  intro: string;
  method: string[];
  example: string;
  interpretation: string[];
  faq: Faq[];
  related: string[];
  sources: string[];
  disclaimer?: string;
  cta?: { title: string; text: string; label: string };
  /** Formulaire + calcul (pur, sans effet de bord, sans réseau) */
  fields: Field[];
  validate?: (p: Parsed) => Partial<Record<string, string>>;
  compute: (p: Parsed) => ToolResult;
  popular?: boolean;
  geo?: boolean;
  addedAt: string;
  updatedAt: string;
};
