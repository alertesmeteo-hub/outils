import { NextResponse } from 'next/server';

/**
 * GET /api/carte-meteo/complements/ : valeurs complémentaires pour les cartes d'observations en direct, lues sur Météo-Ciel
 * (source citée sur la carte) quand une station n'a pas de valeur dans les relevés Météo-France :
 *   - rafales maximales sur 24 h glissantes et pluie sur 24 h glissantes : classements de toutes les stations (nom, département) ;
 *   - températures de deux stations qui n'ont pas de point sur la carte (Perpignan - El Vernet, Cabestany) : dernier relevé horaire.
 * Les pages sont relues au plus toutes les 10 minutes (une requête par page, pas davantage).
 */
export const dynamic = 'force-dynamic';

const BASE = 'https://www.meteociel.fr';
const DUREE_CACHE_MS = 10 * 60_000;
const AGENT = 'Mozilla/5.0 (compatible; AlertesMeteo-Outils/1.0; +https://outils.alertes-meteo.com)';

/** Stations sans point sur la carte : code Météo-Ciel, nom affiché et position approximative. */
const STATIONS_T = [
  { code: '53', nom: 'Perpignan - El Vernet', dep: '66', lat: 42.714, lon: 2.91, alt: 30 },
  { code: '146', nom: 'Cabestany', dep: '66', lat: 42.688, lon: 2.936, alt: 30 },
];

export interface ReponseComplements {
  /** Clé « NOM|dép. » (nom normalisé) → valeur. */
  rafales24: Record<string, number>;
  pluies24: Record<string, number>;
  temperatures: { nom: string; dep: string; lat: number; lon: number; alt: number; valeur: number; heure: string }[];
  majA: string;
}

const normaliser = (nom: string) =>
  nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[-'’]/g, ' ')
    .replace(/\bSAINTE?\b/g, (m) => (m === 'SAINTE' ? 'STE' : 'ST'))
    .replace(/\s+/g, ' ')
    .trim();

async function lirePage(chemin: string): Promise<string> {
  const r = await fetch(`${BASE}${chemin}`, { headers: { 'User-Agent': AGENT }, cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`Météo-Ciel ${chemin} : ${r.status}`);
  return new TextDecoder('windows-1252').decode(await r.arrayBuffer());
}

/** Lignes « Nom (dép.) | valeur unité » d'un classement. */
function lireClassement(html: string): Record<string, number> {
  const valeurs: Record<string, number> = {};
  for (const m of html.matchAll(/<a href='\/temps-reel\/obs_villes\.php\?code2=\d+'>([^<]+?)\s*\((\w{2,3})\)<\/a><\/td><td[^>]*>\s*(-?\d+(?:[.,]\d+)?)\s*(?:km\/h|mm)/g)) {
    const dep = m[2] === '20' ? m[2] : m[2].padStart(2, '0');
    valeurs[`${normaliser(m[1])}|${dep}`] = Number(m[3].replace(',', '.'));
  }
  return valeurs;
}

/** Dernière température horaire d'une page station : première ligne « n h … 14.9 °C ». */
function lireTemperature(html: string): { valeur: number; heure: string } | null {
  const ligne = html.match(/(\d{1,2})\s*h\s*<\/td>[\s\S]{0,400}?(-?\d+(?:\.\d+)?)\s*(?:&nbsp;|\s)*(?:°|°|&deg;|�)\s*C/);
  if (!ligne) return null;
  return { heure: `${ligne[1]} h`, valeur: Number(ligne[2]) };
}

let cache: { lu: number; reponse: ReponseComplements } | null = null;

export async function GET() {
  try {
    if (cache && Date.now() - cache.lu < DUREE_CACHE_MS) return NextResponse.json(cache.reponse);
    const [rafales, pluies, ...pagesT] = await Promise.all([
      lirePage('/obs/classement.php?mode=21&all=1&u2=1&ua=1&ud=1'),
      lirePage('/obs/classement.php?mode=32&all=1&u2=1&ud=1&ua=1'),
      ...STATIONS_T.map((s) => lirePage(`/temps-reel/obs_villes.php?code2=${s.code}`).catch(() => '')),
    ]);
    const temperatures = STATIONS_T.flatMap((s, i) => {
      const t = lireTemperature(pagesT[i]);
      return t ? [{ nom: s.nom, dep: s.dep, lat: s.lat, lon: s.lon, alt: s.alt, valeur: t.valeur, heure: t.heure }] : [];
    });
    const reponse: ReponseComplements = { rafales24: lireClassement(rafales), pluies24: lireClassement(pluies), temperatures, majA: new Date().toISOString() };
    cache = { lu: Date.now(), reponse };
    return NextResponse.json(reponse);
  } catch (erreur) {
    console.error('Compléments Météo-Ciel', erreur);
    return NextResponse.json({ erreur: 'Import momentanément indisponible.' }, { status: 503 });
  }
}
