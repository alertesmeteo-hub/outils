# Ajouter un outil

1. Créer `src/lib/tools/defs/mon-outil.ts` exportant un `ToolDefinition` (copier un outil existant, ex. `mm-pluie-litres.ts`) :
   - `slug` (identifiant interne) et `path` (URL publique `/<thème>/<page>`, ex. `/pluie/mm-en-litres`), `category`, SEO (`h1`, `title`, `metaDescription`, `keywords`), contenu (`intro` de 50 à 100 mots, `method`, `example`, `interpretation`, `faq`, `sources`), `related`.
   - `fields` : types `number | select | checkbox | text | date | time`, avec `min`, `max`, `required`, `unit`, `help`, `section`.
   - `validate(p)` (optionnel) : règles croisées entre champs.
   - `compute(p)` : fonction pure retournant un `ToolResult` (`level`, `headline`, `metrics`, `gauge`, `checks`, `lists`, `notes`, `shareText`).
2. L'ajouter au tableau de `src/lib/tools/registry.ts`.
3. `npm test` : vérifie valeurs par défaut, longueur de l'intro et existence des liens associés.

Page, sitemap, recherche, embed, API, liens internes, JSON-LD et entrée dans l'admin sont automatiques.

Règles : ne pas inventer de données scientifiques (citer la formule et sa source), présenter tout barème maison comme indicatif, ne jamais afficher un montant de dommage comme certain.
