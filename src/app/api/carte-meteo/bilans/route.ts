import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { THEMES_BILAN, type ReponseBilans } from '@/lib/carte-meteo/cartes-info';
import { buildRanking, getRanking, windows } from '@/lib/obs/rankings';
import { dernierReleveSix, getRecords, getSix, getSnapshot, obsConfigured } from '@/lib/obs/store';
import { bilanDuMois, moisDisponibles } from '@/lib/carte-meteo/extremes-mois';
import { ilYAUnAn } from '@/lib/carte-meteo/il-y-a-un-an';

export const dynamic = 'force-dynamic';

/** Classements glissants (sans fenêtre fixe) : durée affichée devant la date de fin. */
const DUREES: Record<string, string> = {
  t: 'relevé', snow: 'relevé', humidex: 'relevé', windchill: 'relevé', pmer: 'relevé', u: 'relevé',
  rr24: '24 h', rr72: '72 h', raf24: '24 h', insol24: '24 h', raf1: '1 h', dp3: '3 h', dt24: '24 h', tx12: '12 h', tn12: '12 h', tx24: '24 h', tn24: '24 h',
};

/** Classements lus dans les relevés 6 min quand ils sont frais : leur carte est datée de ce relevé, pas du relevé horaire. */
const RELEVES_SIX = new Set(['t', 'humidex', 'windchill', 'u', 'pmer', 'raf1']);

/** Calcul partagé entre visiteurs tant que les observations n'ont pas changé (une entrée par mois demandé). */
const caches = new Map<string, { cle: string; reponse: ReponseBilans }>();

/** Altitude minimale (m) des stations de la carte « Neige au sol en montagne ». */
const ALTITUDE_MONTAGNE = 1000;
/** Une hauteur de neige plus ancienne que ça n'est plus « actuelle ». */
const FRAICHEUR_NEIGE_MS = 6 * 3600_000;

const jourParis = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const jourLong = (dateISO: string) =>
  new Date(`${dateISO}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const hm = (ms: number) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

/**
 * GET /api/carte-meteo/bilans/ : bilans des stations Météo-France (principales et secondaires) pour les cartes infos,
 * avec les mêmes fenêtres que les classements (TX finales 8 h → 8 h, pluie de la journée climatologique…).
 */
export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (!rateLimit(`carte-meteo-bilans:${ip}`, 20, 60_000)) {
    return NextResponse.json({ erreur: 'Trop de requêtes. Réessayez dans une minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  if (!obsConfigured()) return NextResponse.json({ erreur: 'Observations non disponibles.' }, { status: 503 });

  try {
    const [snap, records] = await Promise.all([getSnapshot(), getRecords()]);
    let now = 0;
    for (const liste of Object.values(snap.obs)) {
      const t = Date.parse(liste[liste.length - 1]?.time ?? '');
      if (t > now) now = t;
    }
    if (!now) return NextResponse.json({ erreur: 'Observations momentanément indisponibles.' }, { status: 503 });

    // Cartes du mois : ?mois=AAAA-MM parmi les mois de l'archive (défaut : le mois en cours) ; le reste des bilans est identique.
    const disponibles = moisDisponibles(now);
    const courant = disponibles[disponibles.length - 1];
    const demande = new URL(req.url).searchParams.get('mois');
    const moisAffiche = demande && disponibles.includes(demande) ? demande : courant;
    // Relevés 6 min (≈ 10 min de délai) : la carte est recalculée à chaque nouveau relevé, pas seulement à la collecte horaire.
    const six = dernierReleveSix();
    const sixFrais = six > 0 && Date.now() - six <= 30 * 60_000;
    const cle = `${snap.updatedAt}|${now}|${sixFrais ? six : 0}`;
    let cache = caches.get(moisAffiche);
    if (cache?.cle !== cle) {
      const w = windows(now);
      const extra = { six: getSix(), rafH: snap.rafH };
      const stations = snap.stations.filter((s) => s.lat != null && s.lon != null && s.kind !== 'amateur');
      const indice = new Map(stations.map((s, i) => [s.id, i]));
      const cartes: ReponseBilans['cartes'] = {};
      // Bilan du mois : archive des stations sur le VPS (indisponible = cartes vides, le reste des bilans s'affiche).
      // Département = 2 premiers chiffres du numéro de station (nom des fichiers horaires de l'archive, « 20 » pour la Corse).
      const mois = THEMES_BILAN.some((t) => t.mois)
        ? await bilanDuMois(moisAffiche, now, stations.map((s) => ({ id: s.id, lat: s.lat!, lon: s.lon!, alt: s.alt ?? null, dep: s.id.slice(0, 2) })), records)
        : null;
      for (const theme of THEMES_BILAN) {
        if (theme.anPasse) continue; // calculées après la boucle, à partir de la maximale d'hier et de la minimale de la nuit
        if (theme.direct && theme.direct.vue !== 'releve') continue; // records et écarts : après la boucle (maxi et mini du jour)
        if (theme.pluie && theme.pluie.vue !== 'releve') continue; // normales, records et écarts : après la boucle (pluie du jour)
        if (theme.neigeMontagne) {
          const valeurs: [number, number][] = [];
          for (const s of stations) {
            if ((s.alt ?? 0) < ALTITUDE_MONTAGNE) continue;
            const liste = snap.obs[s.id] ?? [];
            for (let i = liste.length - 1; i >= 0; i--) {
              const t = Date.parse(liste[i].time);
              if (now - t > FRAICHEUR_NEIGE_MS) break;
              if (liste[i].snow != null) {
                valeurs.push([indice.get(s.id)!, Math.round(liste[i].snow!)]);
                break;
              }
            }
          }
          cartes[theme.id] = { fenetre: `relevé du ${hm(now)} (heure de Paris), stations à ${ALTITUDE_MONTAGNE.toLocaleString('fr-FR')} m et plus`, valeurs };
          continue;
        }
        if (theme.mois) {
          const valeurs = mois?.valeurs[theme.mois];
          // Carte « de plaine » : stations d'altitude connue jusqu'à theme.altMax.
          const garder = (id: string) => theme.altMax == null || ((alt) => alt != null && alt <= theme.altMax!)(stations[indice.get(id) ?? -1]?.alt);
          cartes[theme.id] = {
            // Écarts : la référence est donnée avec la période (« octobre 2026 · normales 1991-2020 »).
            fenetre: mois ? `${mois.periode}${theme.mois.startsWith('n') ? ' · normales 1991-2020' : ''}` : '',
            valeurs: valeurs ? [...valeurs].filter(([id]) => garder(id)).map(([id, v]) => [indice.get(id)!, Math.round(v * 10) / 10] as [number, number]).filter(([i]) => i != null) : [],
          };
          continue;
        }
        const r = getRanking(theme.classement);
        const lignes = buildRanking(r, stations, snap.obs, now, { secondaires: true, amateurs: false, byDept: false }, records, extra);
        cartes[theme.id] = {
          fenetre: r.window
            ? r.window(w).label
            : ((instant) => (DUREES[theme.classement] === 'relevé' ? `relevé du ${hm(instant)} (heure de Paris)` : `${DUREES[theme.classement] ?? ''} jusqu'au ${hm(instant)} (heure de Paris)`.trim()))(
                sixFrais && RELEVES_SIX.has(theme.classement) ? six : now
              ),
          valeurs: lignes.map((l) => [indice.get(l.station.id)!, Math.round(l.value * 10) / 10] as [number, number]).filter(([i]) => i != null),
        };
      }
      // Il y a un an : maximale d'hier (TX finale, 8 h → 8 h) et minimale de la nuit (20 h → 8 h) comparées aux relevés du même
      // jour l'an dernier (dépôt climato, où la minimale d'un jour est celle de la nuit qui précède son matin).
      const ids = stations.map((s) => s.id);
      const reference = {
        tx: { jour: jourParis(w.txFin.start + 3600_000), recentes: 'tx-hier' },
        tn: { jour: jourParis(w.tnFin.end - 3600_000), recentes: 'tn-hier' },
      } as const;
      let enAttente = false;
      for (const theme of THEMES_BILAN.filter((t) => t.anPasse)) {
        const { champ, ecart } = theme.anPasse!;
        const ref = reference[champ];
        const anPasse = ilYAUnAn(ref.jour, ids, champ);
        if (!anPasse) enAttente = true;
        const recentes = new Map((cartes[ref.recentes]?.valeurs ?? []).map(([i, v]) => [i, v]));
        const valeurs: [number, number][] = [];
        for (const [id, v] of anPasse?.valeurs ?? []) {
          const i = indice.get(id);
          if (i == null) continue;
          if (!ecart) valeurs.push([i, v]);
          else if (recentes.has(i)) valeurs.push([i, Math.round((recentes.get(i)! - v) * 10) / 10]);
        }
        cartes[theme.id] = {
          fenetre: anPasse ? (ecart ? `${jourLong(ref.jour)} comparé au ${jourLong(anPasse.date)}` : jourLong(anPasse.date)) : 'relevés de l’an dernier en cours de chargement',
          valeurs,
        };
      }
      // Températures en direct : record du mois ou absolu de chaque station (dépôt climato), et écart de la maximale du jour
      // (8 h → 8 h, provisoire) ou de la minimale de la nuit (20 h → 8 h, provisoire) à ce record. Écart positif = record battu
      // (de chaleur : maxi au-dessus du record ; de froid : mini au-dessous).
      const numeroMois = Number(jourParis(now).slice(5, 7));
      const nomMois = new Date(Date.UTC(2026, numeroMois - 1, 15)).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' });
      const recentes = {
        tx: new Map((cartes['tx-prov']?.valeurs ?? []).map(([i, v]) => [i, v])),
        tn: new Map((cartes['tn-prov']?.valeurs ?? []).map(([i, v]) => [i, v])),
      };
      for (const theme of THEMES_BILAN.filter((t) => t.direct && t.direct.vue !== 'releve')) {
        const { vue, champ = 'tx' } = theme.direct!;
        const duMois = vue === 'record-mois' || vue === 'ecart-mois';
        const valeurs: [number, number][] = [];
        stations.forEach((s, i) => {
          const rec = records[s.id];
          const record = duMois ? rec?.monthly?.[String(numeroMois)]?.[champ]?.v : rec?.absolute?.[champ]?.v;
          if (record == null) return;
          if (vue === 'record-mois' || vue === 'record-abs') {
            valeurs.push([i, record]);
            return;
          }
          const v = recentes[champ].get(i);
          if (v == null) return;
          valeurs.push([i, Math.round((champ === 'tx' ? v - record : record - v) * 10) / 10]);
        });
        const quoi = duMois ? `record ${champ === 'tx' ? 'de chaleur' : 'de froid'} ${/^[aeiou]/.test(nomMois) ? 'd’' : 'de '}${nomMois}` : `record absolu ${champ === 'tx' ? 'de chaleur' : 'de froid'}`;
        cartes[theme.id] = {
          fenetre:
            vue === 'record-mois' || vue === 'record-abs'
              ? `${quoi} de chaque station (Météo-France)`
              : `${champ === 'tx' ? 'maximale du jour' : 'minimale de la nuit'} (provisoire) comparée au ${quoi}`,
          valeurs,
        };
      }
      // Pluie en direct : cumul moyen du mois ou de l'année (normales 1991-2020), record de pluie en 24 h du mois ou absolu de
      // chaque station (dépôt climato), et pluie de la journée en cours (depuis 6 h UTC) en % de ce record.
      const pluieDuJour = new Map((cartes['pluie-releve']?.valeurs ?? []).map(([i, v]) => [i, v]));
      for (const theme of THEMES_BILAN.filter((t) => t.pluie && t.pluie.vue !== 'releve')) {
        const vue = theme.pluie!.vue;
        const duMois = vue === 'record-mois' || vue === 'ecart-mois';
        const valeurs: [number, number][] = [];
        stations.forEach((s, i) => {
          const rec = records[s.id];
          if (vue === 'normale-mois' || vue === 'normale-annee') {
            const mensuelles = vue === 'normale-mois' ? [rec?.normals?.[String(numeroMois)]?.rr] : Array.from({ length: 12 }, (_, m) => rec?.normals?.[String(m + 1)]?.rr);
            if (mensuelles.every((v) => v != null)) valeurs.push([i, Math.round(mensuelles.reduce((a, b) => a! + b!, 0)!)]);
            return;
          }
          const record = duMois ? rec?.monthly?.[String(numeroMois)]?.rr24?.v : rec?.absolute?.rr24?.v;
          if (record == null || record <= 0) return;
          if (vue === 'record-mois' || vue === 'record-abs') {
            valeurs.push([i, record]);
            return;
          }
          const v = pluieDuJour.get(i);
          if (v != null) valeurs.push([i, Math.round((v / record) * 100)]);
        });
        const quoi = duMois ? `record de pluie en 24 h ${/^[aeiou]/.test(nomMois) ? 'd’' : 'de '}${nomMois}` : 'record absolu de pluie en 24 h';
        cartes[theme.id] = {
          fenetre:
            vue === 'normale-mois'
              ? `${nomMois} · normales 1991-2020`
              : vue === 'normale-annee'
                ? 'année · normales 1991-2020'
                : vue === 'record-mois' || vue === 'record-abs'
                  ? `${quoi} de chaque station (Météo-France)`
                  : `pluie de la journée (depuis 6 h UTC) en % du ${quoi}`,
          valeurs,
        };
      }
      cache = {
        // Relevés de l'an dernier pas encore lus : réponse non gardée, la suivante sera recalculée.
        cle: enAttente ? `${cle}|un-an-en-attente` : cle,
        reponse: {
          majA: snap.updatedAt,
          stations: stations.map((s) => [s.id, s.name, s.dept, s.lat!, s.lon!, s.alt ?? null]),
          cartes,
          mois: { affiche: moisAffiche, courant, disponibles },
        },
      };
      caches.set(moisAffiche, cache);
    }
    return NextResponse.json(cache.reponse, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch (erreur) {
    console.error('Bilans carte météo', erreur);
    return NextResponse.json({ erreur: 'Observations momentanément indisponibles.' }, { status: 503 });
  }
}
