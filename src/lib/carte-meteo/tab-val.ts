/**
 * « Tab Val » : lecture d'une liste de valeurs collée à la main, une par ligne, pour en faire un tableau.
 * Formats compris : « 20.9°C à Perpignan - El Vernet », « 19.7°C au Boulou », « 18,6 °C à Vives », « 45 km/h à Leucate »,
 * « Perpignan : 20,9°C », « Perpignan 20.9 », avec ou sans numéro de rang devant (« 1. 20.9°C à Perpignan »).
 */

export interface LigneTab {
  nom: string;
  valeur: number;
  /** Unité écrite sur la ligne (« ° » pour °C), null si absente. */
  unite: string | null;
}

export interface LectureTab {
  lignes: LigneTab[];
  /** Lignes non comprises (sans nombre ou sans lieu), pour les signaler. */
  ignorees: string[];
  /** Unité la plus fréquente de la liste, null si aucune ligne n'en a. */
  unite: string | null;
}

const NOMBRE = '[-+\\u2212]?\\d+(?:[.,]\\d+)?';
const UNITE = '(?:°\\s*C|°|km\\s*\\/\\s*h|mm|cm|hPa|%)';
/** Valeur d'abord : « 20.9°C à Perpignan », avec un éventuel numéro de rang et une préposition (à, au, aux, à la, en) devant le lieu. */
const VALEUR_D_ABORD = new RegExp(`^\\s*(?:\\d{1,2}\\s*[.)]\\s+)?(${NOMBRE})\\s*(${UNITE})?\\s*(?:[:–—-]\\s*)?(?:(à\\s+la|aux|au|à|en|a)\\s+)?(.+?)\\s*$`, 'i');
/** Lieu d'abord : « Perpignan : 20,9°C », « Perpignan 20.9 ». */
const LIEU_D_ABORD = new RegExp(`^(.+?)\\s*(?:[:–—-]\\s*|\\s)(${NOMBRE})\\s*(${UNITE})?\\s*$`, 'i');

const nombre = (s: string) => Number(s.replace('−', '-').replace(',', '.'));

function uniteNormalisee(u: string | undefined): string | null {
  if (!u) return null;
  const x = u.replace(/\s+/g, '').toLowerCase();
  if (x === '°c' || x === '°') return '°';
  if (x.startsWith('km')) return 'km/h';
  return x === 'hpa' ? 'hPa' : x;
}

/** « au Boulou » → « Le Boulou », « aux Angles » → « Les Angles », « à la Llagonne » → « La Llagonne ». */
function lieuAvecArticle(preposition: string | undefined, lieu: string): string {
  const p = (preposition ?? '').replace(/\s+/g, ' ').toLowerCase();
  // Apostrophe typographique partout (« L’Hospitalet »), comme dans le reste du site.
  const nom = lieu.replace(/\s+/g, ' ').replace(/[,;.\s]+$/, '').replace(/'/g, '’');
  const avec = p === 'au' ? `Le ${nom}` : p === 'aux' ? `Les ${nom}` : p === 'à la' ? `La ${nom}` : nom;
  return avec.charAt(0).toUpperCase() + avec.slice(1);
}

export function lireListeValeurs(texte: string): LectureTab {
  const lignes: LigneTab[] = [];
  const ignorees: string[] = [];
  for (const brute of texte.split(/\r?\n/)) {
    const ligne = brute.trim();
    if (!ligne) continue;
    const avant = VALEUR_D_ABORD.exec(ligne);
    // Groupes : 1 nombre, 2 unité, 3 préposition, 4 lieu (qui doit contenir une lettre : « 20.9 » seul n'est pas une ligne).
    if (avant && /\p{L}/u.test(avant[4])) {
      lignes.push({ nom: lieuAvecArticle(avant[3], avant[4]), valeur: nombre(avant[1]), unite: uniteNormalisee(avant[2]) });
      continue;
    }
    const apres = LIEU_D_ABORD.exec(ligne);
    if (apres && /\p{L}/u.test(apres[1])) {
      lignes.push({ nom: lieuAvecArticle(undefined, apres[1]), valeur: nombre(apres[2]), unite: uniteNormalisee(apres[3]) });
      continue;
    }
    ignorees.push(ligne);
  }
  const comptes = new Map<string, number>();
  for (const l of lignes) if (l.unite) comptes.set(l.unite, (comptes.get(l.unite) ?? 0) + 1);
  const unite = [...comptes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { lignes, ignorees, unite };
}
