// Génère public/geo/cours-eau.json : les principaux cours d'eau de France métropolitaine, par nom, depuis la BD TOPO de
// l'IGN (Géoplateforme, WFS sans clé, Licence ouverte), simplifiés. L'attribut « importance » de la BD TOPO ne
// reflète pas la taille des rivières : on retient donc une liste de noms, répartie en trois niveaux
// (1 = grands fleuves, 2 = grandes rivières, 3 = rivières locales affichées seulement sur les vues zoomées).
//   node scripts/cours-eau.mjs
import { writeFileSync } from 'node:fs';

const NIVEAUX = {
  1: ['Loire', 'Seine', 'Rhône', 'Garonne', 'Gironde', 'Dordogne', 'Marne', 'Saône', 'Meuse', 'Moselle', 'Rhin'],
  2: [
    'Oise', 'Yonne', 'Allier', 'Cher', 'Lot', 'Tarn', 'Durance', 'Charente', 'Vienne', 'Somme', 'Aisne', 'Aube', 'Orne', 'Eure',
    'Sarthe', 'Mayenne', 'Maine', 'Loir', 'Indre', 'Creuse', 'Aveyron', 'Adour', 'Isère', 'Doubs', 'Ill', 'Aude', 'Hérault', 'Vilaine',
    'Aulne', 'Vézère', 'Isle', 'Escaut', 'Sambre', 'Meurthe', 'Ognon', 'Drôme', 'Ardèche', 'Gardon', 'Var', 'Verdon', 'Têt',
    'Gave de Pau', "Gave d'Oloron", 'Arve', 'Ain', 'Loing', 'Vire', 'Dives', 'Rance', 'Blavet', 'Golo', 'Tavignano',
  ],
  3: [
    'Tech', 'Agly', 'Orb', 'Salz', 'Lez', 'Vidourle', 'Cèze', 'Ouvèze', 'Eygues', 'Roya', 'Argens', 'Gapeau', 'Touloubre', 'Arc',
    'Vesle', 'Serre', 'Ourcq', 'Grand Morin', 'Petit Morin', 'Epte', 'Risle', 'Touques', 'Dronne', 'Vézère', 'Célé', 'Viaur', 'Agout',
    'Ariège', 'Salat', 'Save', 'Gers', 'Baïse', 'Neste', 'Louge', 'Nive', 'Bidassoa', 'Leyre', 'Midouze', 'Douze', 'Midou',
    'Clain', 'Thouet', 'Sèvre Niortaise', 'Sèvre Nantaise', 'Layon', 'Authion', 'Erdre', 'Oust', 'Scorff', 'Odet', 'Elorn',
    'Liamone', 'Taravo', 'Gravona', 'Prunelli', 'Rizzanese', 'Fango', 'Ostriconi', 'Golo',
  ],
};

const TAILLE_PAGE = 100;
const TOLERANCE = 0.0006; // degrés (~65 m) : invisible à l'échelle d'un département
const metropole = ([lon, lat]) => lon > -5.5 && lon < 10 && lat > 41 && lat < 51.6;

/** Douglas-Peucker. */
function simplifier(points, tol) {
  if (points.length < 3) return points;
  const garder = new Array(points.length).fill(false);
  garder[0] = garder[points.length - 1] = true;
  const pile = [[0, points.length - 1]];
  while (pile.length) {
    const [a, b] = pile.pop();
    let max = 0;
    let idx = -1;
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const norme = Math.hypot(dx, dy) || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * (points[i][0] - ax) - dx * (points[i][1] - ay)) / norme;
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (max > tol && idx > 0) {
      garder[idx] = true;
      pile.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => garder[i]);
}

/** Variantes de toponyme dans la BD TOPO : « la Loire », « le Rhône », « l'Allier », « Gave de Pau »… */
const variantes = (nom) => [nom, `le ${nom}`, `la ${nom}`, `l'${nom}`, `les ${nom}`];

const lignes = { 1: [], 2: [], 3: [] };
const vus = new Set();
for (const [niveau, noms] of Object.entries(NIVEAUX)) {
  const liste = [...new Set(noms.flatMap(variantes))].map((n) => `'${n.replace(/'/g, "''")}'`).join(',');
  const filtre = encodeURIComponent(`toponyme IN (${liste})`);
  for (let debut = 0; ; debut += TAILLE_PAGE) {
    const url = `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BDTOPO_V3:cours_d_eau&OUTPUTFORMAT=application/json&SRSNAME=CRS:84&COUNT=${TAILLE_PAGE}&STARTINDEX=${debut}&SORTBY=cleabs&CQL_FILTER=${filtre}`;
    let page;
    for (let essai = 1; essai <= 4 && !page; essai++) {
      try {
        const r = await fetch(url);
        page = await r.json();
      } catch {
        await new Promise((res) => setTimeout(res, essai * 1000));
      }
    }
    if (!page?.features) throw new Error(`Échec niveau ${niveau} à partir de ${debut}`);
    for (const f of page.features) {
      const id = f.properties.cleabs ?? f.id;
      if (vus.has(id)) continue; // un cours d'eau cité à deux niveaux garde le plus important
      vus.add(id);
      const parts = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const l of parts) {
        const s = simplifier(l, TOLERANCE).filter(metropole);
        if (s.length > 1) lignes[niveau].push(s.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]));
      }
    }
    console.log(`niveau ${niveau}`, debut, page.features.length);
    if (page.features.length < TAILLE_PAGE) break;
  }
}
const sortie = JSON.stringify(lignes);
writeFileSync(new URL('../public/geo/cours-eau.json', import.meta.url), sortie);
console.log('lignes', Object.fromEntries(Object.entries(lignes).map(([k, v]) => [k, v.length])), 'octets', sortie.length);
