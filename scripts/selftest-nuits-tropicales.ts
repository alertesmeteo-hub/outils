/** Tests de /outils/nuits-tropicales : conversion des fichiers du pipeline, tranches, comptage par année, classement, zones, recherche, formats. */
import { donneesDepuis, indicateurDepuis } from '../src/lib/nuits-tropicales/conversion';
import {
  chercherStations, classement, dansZone, ecartFr, jourMois, moyennePeriode, nombreFr, nomStation, nuitsAnnee, recordStation, serieStation, synthese, tranche, TRANCHES,
} from '../src/lib/nuits-tropicales/logique';
import type { DonneesNuits, StationNuits } from '../src/lib/nuits-tropicales/types';
import { pasRond } from '../src/components/nuits-tropicales/Barres';

let fail = 0;
const eq = (name: string, cond: boolean, info = '') => { if (!cond) { fail++; console.error('✗', name, info); } else console.log('✓', name); };

// --- Formats ---
eq('nombre à virgule française', nombreFr(8.46) === '8,5' && nombreFr(12, 1) === '12' && nombreFr(0.04) === '0');
eq('écart signé', ecartFr(19.38) === '+19,4' && ecartFr(-3) === '−3' && ecartFr(0) === '0');
eq('jour et mois', jourMois('2026-09-22') === '22 septembre' && jourMois('2026-10-01') === '1 octobre' && jourMois('n’importe quoi') === 'n’importe quoi');
eq('nom de station lisible', nomStation('CAP CORSE') === 'Cap Corse' && nomStation("L'ILE ROUSSE") === "L'Ile Rousse" && nomStation('MONT-DE-MARSAN') === 'Mont-De-Marsan' && nomStation('TOULOUSE-BLAGNAC SA') === 'Toulouse-Blagnac SA');
eq('pas rond du graphique', pasRond(18) === 5 && pasRond(120) === 20 && pasRond(9) === 2 && pasRond(0) === 1);

// --- Tranches ---
eq('tranches de la carte', tranche(0).libelle === 'Aucune' && tranche(1).libelle === '1 à 4' && tranche(4).libelle === '1 à 4' && tranche(5).libelle === '5 à 9' && tranche(19).libelle === '10 à 19' && tranche(39).libelle === '20 à 39' && tranche(119).libelle === '60 et plus');
eq('tranches croissantes', TRANCHES.every((t, i) => i === 0 || t.min > TRANCHES[i - 1].min));

// --- Stations d'essai ---
const station = (p: Partial<StationNuits> & Pick<StationNuits, 'id'>): StationNuits => ({
  nom: 'PERPIGNAN', dep: '66', lat: 42.74, lon: 2.87, alt: 42, y0: 2020, n: [10, null, 20, 30, 40], panel: false, courante: null, derniere: null, ...p,
});
const perpi = station({ id: '66136001', courante: { nuits: 84, jours: 265, fin: '2026-09-22' }, derniere: { nuits: 88, jours: 285, fin: '2026-10-12' } });
const nice = station({ id: '06088001', nom: 'NICE', dep: '06', y0: 2023, n: [50, 60, 70], courante: { nuits: 109, jours: 265, fin: '2026-09-22' } });
const montagne = station({ id: '73040005', nom: 'BESSANS', dep: '73', alt: 1731, y0: 2021, n: [0, 0, 0, 0], courante: { nuits: 0, jours: 265, fin: '2026-09-22' } });
const serie = station({ id: '20004002', nom: 'AJACCIO', dep: '20', y0: 2025, n: [5], courante: null });
const stations = [perpi, nice, montagne, serie];
const donnees = { anneeCourante: 2026 } as Pick<DonneesNuits, 'anneeCourante'>;

// --- Comptage par année ---
eq('année passée : lue dans la série', nuitsAnnee(perpi, 2022, 2026) === 20 && nuitsAnnee(perpi, 2020, 2026) === 10);
eq('année manquante ou hors série : non comptée', nuitsAnnee(perpi, 2021, 2026) === null && nuitsAnnee(perpi, 2010, 2026) === null && nuitsAnnee(perpi, 2030, 2026) === null);
eq('année en cours : à la date commune', nuitsAnnee(perpi, 2026, 2026) === 84 && nuitsAnnee(serie, 2026, 2026) === null);
eq('année en cours : au dernier relevé (stations principales seulement)', nuitsAnnee(perpi, 2026, 2026, true) === 88 && nuitsAnnee(nice, 2026, 2026, true) === null);

// --- Classement et synthèse ---
const cl = classement(stations, 2026, 2026);
eq('classement de l’année en cours', cl.map((l) => l.station.id).join() === '06088001,66136001,73040005', cl.map((l) => l.station.id).join());
eq('classement au dernier relevé', classement(stations, 2026, 2026, true).map((l) => l.station.id).join() === '66136001');
eq('classement d’une année passée, à égalité par ordre alphabétique', classement([station({ id: 'b', nom: 'B', y0: 2025, n: [3] }), station({ id: 'a', nom: 'A', y0: 2025, n: [3] })], 2025, 2026).map((l) => l.station.id).join() === 'a,b');
const syn = synthese(cl);
eq('synthèse', syn.stations === 3 && syn.avecNuit === 2 && syn.total === 193 && Math.abs((syn.moyenne ?? 0) - 193 / 3) < 1e-9 && syn.maximum?.station.id === '06088001');
eq('synthèse vide', synthese([]).moyenne === null && synthese([]).maximum === null);

// --- Zones ---
eq('zone : département', dansZone(perpi, { region: '', dep: '66' }) && !dansZone(nice, { region: '', dep: '66' }));
eq('zone : région', dansZone(perpi, { region: 'Occitanie', dep: '' }) && !dansZone(nice, { region: 'Occitanie', dep: '' }) && dansZone(nice, { region: 'Provence-Alpes-Côte d’Azur', dep: '' }));
eq('zone : Corse (code 20)', dansZone(serie, { region: 'Corse', dep: '' }) && dansZone(serie, { region: '', dep: '20' }));
eq('zone : France entière', dansZone(montagne, { region: '', dep: '' }));

// --- Records, moyennes et séries ---
eq('meilleure année d’une station (à égalité : la plus récente)', JSON.stringify(recordStation(station({ id: 'x', y0: 2000, n: [5, 9, 3, 9] }), 2026)) === JSON.stringify({ annee: 2003, nuits: 9 }));
eq('l’année en cours peut être la meilleure (au dernier relevé, ou à la date commune)', recordStation(perpi, 2026)?.annee === 2026 && recordStation(perpi, 2026)?.nuits === 88 && recordStation(perpi, 2026, false)?.nuits === 84);
eq('station sans nuit tropicale : pas de record', recordStation(montagne, 2026) === null);
eq('moyenne sur une période (années comptées seulement)', moyennePeriode(perpi, 2020, 2024) === 25 && moyennePeriode(perpi, 1990, 1999) === null);
eq('série d’une station : années non comptées en null, année en cours ajoutée', JSON.stringify(serieStation(perpi, donnees).map((p) => [p.annee, p.valeur])) === JSON.stringify([[2020, 10], [2021, null], [2022, 20], [2023, 30], [2024, 40], [2026, 88]]));

// --- Recherche ---
eq('recherche : nom sans accent ni casse', chercherStations(stations, 'perpi').map((s) => s.id).join() === '66136001');
eq('recherche : département', chercherStations(stations, '06').map((s) => s.id).join() === '06088001');
eq('recherche : trop courte', chercherStations(stations, 'p').length === 0);
eq('recherche : plusieurs mots', chercherStations(stations, 'nice 06').length === 1 && chercherStations(stations, 'nice 66').length === 0);

// --- Conversion des fichiers du pipeline ---
const ligne = (p: Record<string, unknown> = {}) => ({ id: '66136001', nom: 'Perpignan', dep: '66', lat: 42.7, lon: 2.9, alt: 42, y0: 2020, n: [10, null, 20, -1, 4.5, 3], panel: true, courante: { nuits: 84, jours: 265, fin: '2026-09-22' }, derniere: { nuits: 88, jours: 285, fin: '2026-10-12' }, ...p });
const fichierStations = (p: Record<string, unknown> = {}) => ({ generated_at: '2026-10-13T15:00:00Z', annee_courante: 2026, derniere_annee_complete: 2025, jusqu_au: '2026-09-22', dernier_releve: '2026-10-12', stations: [ligne()], ...p });
const fichierIndicateur = (p: Record<string, unknown> = {}) => ({
  seuil_c: 20, reference: { debut: 1991, fin: 2020, moyenne: 8.5 }, panel: { stations: 86, criteres: { altitude_max_m: 500, depuis: 1950 } },
  annees: [{ annee: 2024, moyenne: 12.2, ecart: 3.7, stations: 86 }, { annee: 2023, moyenne: 14.9, ecart: 6.4, stations: 85 }, { annee: 'x', moyenne: 1 }],
  decennies: [{ debut: 1950, fin: 1959, annees: 10, moyenne: 3.7 }, { debut: 'x' }], plus_fortes_annees: [{ annee: 2003, moyenne: 18.2 }, { annee: 2003 }],
  courante: { annee: 2026, jusqu_au: '2026-09-22', dernier_releve: '2026-10-12', moyenne: 27.9, stations: 86, reference_a_ce_jour: 8.5, ecart: 19.4 }, ...p,
});
const d = donneesDepuis(fichierStations(), fichierIndicateur());
eq('conversion : données complètes', d !== null && d.anneeCourante === 2026 && d.jusquAu === '2026-09-22' && d.dernierReleve === '2026-10-12' && d.stations.length === 1 && d.genere === '2026-10-13T15:00:00Z');
eq('conversion : valeurs invalides écartées dans une série', JSON.stringify(d?.stations[0].n) === JSON.stringify([10, null, 20, null, null, 3]), JSON.stringify(d?.stations[0].n));
eq('conversion : comptages de l’année en cours', d?.stations[0].courante?.nuits === 84 && d?.stations[0].derniere?.fin === '2026-10-12' && d?.stations[0].panel === true);
eq('conversion : indicateur trié, lignes invalides écartées', JSON.stringify(d?.indicateur.annees.map((a) => a.annee)) === JSON.stringify([2023, 2024]) && d?.indicateur.decennies.length === 1 && d?.indicateur.plusFortes.length === 1);
eq('conversion : indicateur courant', d?.indicateur.courante.dernierReleve === '2026-10-12' && d?.indicateur.courante.referenceACeJour === 8.5 && d?.indicateur.reference.moyenne === 8.5 && d?.indicateur.panel.stations === 86);
eq('conversion : station sans comptage récent', donneesDepuis(fichierStations({ stations: [ligne({ courante: null, derniere: undefined })] }), fichierIndicateur())?.stations[0].courante === null);
eq('conversion : station incomplète écartée', donneesDepuis(fichierStations({ stations: [ligne({ nom: null }), ligne({ y0: 'x' }), ligne({ n: 'x' }), ligne()] }), fichierIndicateur())?.stations.length === 1);
eq('conversion : fichier sans station', donneesDepuis(fichierStations({ stations: [] }), fichierIndicateur()) === null);
eq('conversion : indicateur absent ou vide', donneesDepuis(fichierStations(), null) === null && donneesDepuis(fichierStations(), fichierIndicateur({ annees: [] })) === null && indicateurDepuis(null) === null);
eq('conversion : fichier des stations absent ou sans date', donneesDepuis(null, fichierIndicateur()) === null && donneesDepuis(fichierStations({ jusqu_au: undefined }), fichierIndicateur()) === null);
eq('conversion : dernier relevé repris sur la date commune si absent', donneesDepuis(fichierStations({ dernier_releve: undefined }), fichierIndicateur())?.dernierReleve === '2026-09-22');

if (fail) { console.error(`\n${fail} test(s) en échec`); process.exit(1); }
console.log('\nnuits-tropicales : tous les tests passent');
