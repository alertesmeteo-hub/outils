// Génère src/lib/carte-meteo/villes-departements.json : les communes les plus peuplées de chaque
// département métropolitain (nom, code INSEE, centre, population), pour la vue « département » de la
// carte météo. Source : API Géo de l'État (geo.api.gouv.fr), Licence ouverte Etalab. À relancer si besoin :
//   node scripts/villes-departements.mjs
import { writeFileSync } from 'node:fs';

const PAR_DEPARTEMENT = 15;
const codes = [
  ...Array.from({ length: 19 }, (_, i) => String(i + 1).padStart(2, '0')),
  '2A',
  '2B',
  ...Array.from({ length: 75 }, (_, i) => String(i + 21)),
];

const resultat = {};
for (const code of codes) {
  const url = `https://geo.api.gouv.fr/departements/${code}/communes?fields=nom,code,population,centre&format=json&geometry=centre`;
  let communes;
  for (let essai = 1; essai <= 3; essai++) {
    const r = await fetch(url);
    if (r.ok) {
      communes = await r.json();
      break;
    }
    await new Promise((res) => setTimeout(res, essai * 800));
  }
  if (!communes) throw new Error(`Échec pour ${code}`);
  resultat[code] = communes
    .filter((c) => c.centre?.coordinates && c.population > 0)
    .sort((a, b) => b.population - a.population)
    .slice(0, PAR_DEPARTEMENT)
    .map((c) => ({ code: c.code, nom: c.nom, lon: +c.centre.coordinates[0].toFixed(4), lat: +c.centre.coordinates[1].toFixed(4), pop: c.population }));
  console.log(code, resultat[code].length, resultat[code][0]?.nom);
}
writeFileSync(new URL('../src/lib/carte-meteo/villes-departements.json', import.meta.url), JSON.stringify(resultat));
