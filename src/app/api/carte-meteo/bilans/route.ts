import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { THEMES_BILAN, type ReponseBilans } from '@/lib/carte-meteo/cartes-info';
import { buildRanking, getRanking, windows } from '@/lib/obs/rankings';
import { getRecords, getSix, getSnapshot, obsConfigured } from '@/lib/obs/store';
import { bilanDuMois, moisDisponibles } from '@/lib/carte-meteo/extremes-mois';
import { maximalesIlYAUnAn } from '@/lib/carte-meteo/il-y-a-un-an';

export const dynamic = 'force-dynamic';

/** Classements glissants (sans fenêtre fixe) : durée affichée devant la date de fin. */
const DUREES: Record<string, string> = { t: 'relevé', snow: 'relevé', rr24: '24 h', rr72: '72 h', raf24: '24 h', insol24: '24 h' };

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
    const cle = `${snap.updatedAt}|${now}`;
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
        if (theme.anPasse) continue; // calculées après la boucle, à partir de la maximale d'hier
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
          fenetre: r.window ? r.window(w).label : DUREES[theme.classement] === 'relevé' ? `relevé du ${hm(now)} (heure de Paris)` : `${DUREES[theme.classement] ?? ''} jusqu'au ${hm(now)} (heure de Paris)`.trim(),
          valeurs: lignes.map((l) => [indice.get(l.station.id)!, Math.round(l.value * 10) / 10] as [number, number]).filter(([i]) => i != null),
        };
      }
      // Il y a un an : maximale d'hier (TX finale, 8 h → 8 h) comparée à celle du même jour l'an dernier (dépôt climato).
      const hier = jourParis(w.txFin.start + 3600_000);
      const anPasse = maximalesIlYAUnAn(hier, stations.map((s) => s.id));
      const txHier = new Map((cartes['tx-hier']?.valeurs ?? []).map(([i, v]) => [i, v]));
      for (const theme of THEMES_BILAN.filter((t) => t.anPasse)) {
        const valeurs: [number, number][] = [];
        for (const [id, tx] of anPasse?.tx ?? []) {
          const i = indice.get(id);
          if (i == null) continue;
          if (theme.anPasse === 'tx') valeurs.push([i, tx]);
          else if (txHier.has(i)) valeurs.push([i, Math.round((txHier.get(i)! - tx) * 10) / 10]);
        }
        cartes[theme.id] = {
          fenetre: anPasse ? (theme.anPasse === 'tx' ? jourLong(anPasse.date) : `${jourLong(hier)} comparé au ${jourLong(anPasse.date)}`) : 'relevés de l’an dernier en cours de chargement',
          valeurs,
        };
      }
      cache = {
        // Relevés de l'an dernier pas encore lus : réponse non gardée, la suivante sera recalculée.
        cle: anPasse ? cle : `${cle}|un-an-en-attente`,
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
