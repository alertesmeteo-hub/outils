/** Tests de /outils/records-temperature : catégories, libellés, filtres, tris, conversion des fichiers du pipeline, zones. */
import { estDate, evenementDepuis, jourDepuis } from '../src/lib/records-temperature/conversion';
import {
  ajouterJours, anneesEntre, ancienneteRecord, categorie, categories, compter, dateCourte, dateLongue, degres, degresCourt, estEgale, filtrer,
  FILTRES_PAR_DEFAUT, heureParis, libelle, majuscule, normaliser, porteePrincipale, synthese, trier,
} from '../src/lib/records-temperature/logique';
import type { Categorie, Evenement } from '../src/lib/records-temperature/types';
import { contoursDeDep, depDeContour, DEPARTEMENTS, nomDepartement, regionDeDep, REGIONS } from '../src/lib/records-temperature/zones';

let fail = 0;
const eq = (name: string, cond: boolean, info = '') => { if (!cond) { fail++; console.error('✗', name, info); } else console.log('✓', name); };

const evt = (p: Partial<Evenement> & Pick<Evenement, 'famille'>): Evenement => ({
  id: '66136001', nom: 'Perpignan', lat: 42.74, lon: 2.87, alt: 44, ouverture: 1924, principal: true, dep: '66', region: 'Occitanie',
  valeur: 34.5, battus: [], proches: [], ecarts: {}, records: {}, provisoire: false, ...p,
});

// --- Catégories ---
eq('absolu l’emporte sur mensuel et jour', categorie(evt({ famille: 'heat', battus: ['daily', 'monthly', 'absolute'] })) === 'absolu');
eq('mensuel avant quinzaine', categorie(evt({ famille: 'heat', battus: ['fortnight', 'monthly'] })) === 'mensuel');
eq('quinzaine avant jour', categorie(evt({ famille: 'cold', battus: ['daily', 'fortnight'] })) === 'quinzaine');
eq('proche de l’absolu avant proche du jour', categorie(evt({ famille: 'heat', proches: ['daily', 'absolute'] })) === 'proche_absolu');
eq('proche du jour seul', categorie(evt({ famille: 'cold', proches: ['daily'] })) === 'proche_jour');
eq('toutes les catégories d’une station', JSON.stringify(categories(evt({ famille: 'heat', battus: ['daily', 'fortnight'], proches: ['monthly'] }))) === JSON.stringify(['quinzaine', 'jour', 'proche_mensuel']));
eq('période principale', porteePrincipale(evt({ famille: 'heat', battus: ['daily', 'monthly'] })) === 'monthly');
eq('pas de période principale pour une proximité', porteePrincipale(evt({ famille: 'heat', proches: ['daily'] })) === null);

// --- Libellés ---
eq('record de chaleur du mois battu', libelle(evt({ famille: 'heat', battus: ['monthly', 'daily'], ecarts: { monthly: -0.6 } })) === 'Record de chaleur du mois battu', libelle(evt({ famille: 'heat', battus: ['monthly'] })));
eq('record absolu de froid égalé', libelle(evt({ famille: 'cold', battus: ['absolute'], ecarts: { absolute: 0 } })) === 'Record absolu de froid égalé');
eq('nuit chaude du jour battue', libelle(evt({ famille: 'tropical', battus: ['daily'], ecarts: { daily: -0.5 } })) === 'Record de nuit chaude du jour battu');
eq('record de la quinzaine', libelle(evt({ famille: 'cold', battus: ['fortnight'], ecarts: { fortnight: -1 } })) === 'Record de froid de la quinzaine battu');
eq('à 1 °C du record du jour', libelle(evt({ famille: 'heat', proches: ['daily'] })) === 'À 1 °C du record du jour');
eq('égalité reconnue (écart nul)', estEgale(evt({ famille: 'heat', battus: ['daily'], ecarts: { daily: 0 } })) && !estEgale(evt({ famille: 'heat', battus: ['daily'], ecarts: { daily: -0.2 } })));

// --- Dates et nombres ---
eq('années entre deux dates', anneesEntre('2019-06-28', '2026-06-27') === 6 && anneesEntre('2019-06-28', '2026-06-28') === 7 && anneesEntre('2026-10-13', '2026-10-13') === 0);
eq('années : date future refusée', anneesEntre('2027-01-01', '2026-10-13') === null && anneesEntre('abc', '2026-10-13') === null);
eq('ancienneté du record battu', ancienneteRecord(evt({ famille: 'heat', battus: ['daily'], records: { daily: { value: 30, date: '2003-10-13' } } }), '2026-10-13') === 23);
eq('pas d’ancienneté pour une proximité', ancienneteRecord(evt({ famille: 'heat', proches: ['daily'], records: { daily: { value: 30, date: '2003-10-13' } } }), '2026-10-13') === null);
eq('degrés : virgule et pas d’espace', degres(34.5) === '34,5°C' && degres(-3) === '−3,0°C' && degresCourt(20.04) === '20,0°');
eq('date longue', dateLongue('2026-10-13') === 'mardi 13 octobre 2026' && dateLongue('2026-11-01') === 'dimanche 1er novembre 2026', dateLongue('2026-11-01'));
eq('date courte', dateCourte('2026-10-13') === '13/10/2026');
eq('majuscule initiale seulement', majuscule('mardi 13 octobre 2026') === 'Mardi 13 octobre 2026' && majuscule('') === '');
eq('ajouter des jours (changement de mois et d’année)', ajouterJours('2026-10-31', 1) === '2026-11-01' && ajouterJours('2026-01-01', -1) === '2025-12-31');
eq('heure de Paris (heure d’été)', heureParis('2026-10-13T02:07:34Z') === '04 h 07' && heureParis(null) === null && heureParis('pas une date') === null, String(heureParis('2026-10-13T02:07:34Z')));
eq('date valide', estDate('2026-02-28') && !estDate('2026-02-30') && !estDate('13/10/2026') && !estDate('1800-01-01'));
eq('normalisation des noms', normaliser('Saint-Étienne (42)') === 'saint etienne 42');

// --- Compteurs, filtres, tris ---
const jeu: Evenement[] = [
  evt({ famille: 'heat', id: 'A', nom: 'Aigues-Mortes', dep: '30', region: 'Occitanie', valeur: 36, battus: ['monthly'], ecarts: { monthly: -0.5 }, records: { monthly: { value: 35.5, date: '2011-10-02' } } }),
  evt({ famille: 'heat', id: 'B', nom: 'Brest', dep: '29', region: 'Bretagne', principal: false, ouverture: 2005, valeur: 24, proches: ['daily'] }),
  evt({ famille: 'cold', id: 'C', nom: 'Chamonix', dep: '74', region: 'Auvergne-Rhône-Alpes', alt: 1042, valeur: -6.1, battus: ['absolute', 'daily'], ecarts: { absolute: -0.4, daily: -3 }, records: { absolute: { value: -5.7, date: '1974-10-28' }, daily: { value: -1, date: '1990-10-13' } } }),
  evt({ famille: 'cold', id: 'D', nom: 'Dijon', dep: '21', region: 'Bourgogne-Franche-Comté', ouverture: null, valeur: 1.2, battus: ['daily'], ecarts: { daily: -0.2 }, records: { daily: { value: 1.4, date: '2016-10-13' } } }),
  evt({ famille: 'tropical', id: 'F', nom: 'Fitou', dep: '11', region: 'Occitanie', valeur: 20.5, battus: ['daily'], ecarts: { daily: -0.5 }, records: { daily: { value: 20, date: '2003-10-13' } } }),
];
const c = compter(jeu);
eq('compteurs par famille', c.heat.records === 1 && c.heat.proches === 1 && c.cold.records === 2 && c.cold.proches === 0 && c.tropical.records === 1, JSON.stringify(c));
eq('filtre : famille', filtrer(jeu, { ...FILTRES_PAR_DEFAUT, famille: 'cold' }).length === 2);
eq('filtre : région', filtrer(jeu, { ...FILTRES_PAR_DEFAUT, region: 'Occitanie' }).map((e) => e.id).join() === 'A,F');
eq('filtre : département', filtrer(jeu, { ...FILTRES_PAR_DEFAUT, dep: '74' }).map((e) => e.id).join() === 'C');
eq('filtre : réseau principal', filtrer(jeu, { ...FILTRES_PAR_DEFAUT, principal: true }).length === 4);
eq('filtre : année d’ouverture (les inconnues sont écartées)', filtrer(jeu, { ...FILTRES_PAR_DEFAUT, ouvertureMax: 1950 }).map((e) => e.id).join() === 'A,C,F');
eq('filtre : année minimale', filtrer(jeu, { ...FILTRES_PAR_DEFAUT, ouvertureMin: 2000 }).map((e) => e.id).join() === 'B');
eq('filtre : recherche sans accent ni casse', filtrer(jeu, { ...FILTRES_PAR_DEFAUT, recherche: 'AIGUES' }).map((e) => e.id).join() === 'A');
eq('filtre : recherche par nom de département', filtrer(jeu, { ...FILTRES_PAR_DEFAUT, recherche: 'finistere' }, nomDepartement).map((e) => e.id).join() === 'B');
const sansProches: Categorie[] = ['absolu', 'mensuel', 'quinzaine', 'jour'];
eq('filtre : sans les « à 1 °C »', filtrer(jeu, { ...FILTRES_PAR_DEFAUT, categories: new Set(sansProches) }).length === 4);
eq('filtre : un record du jour reste visible quand seul « du jour » est coché', filtrer(jeu, { ...FILTRES_PAR_DEFAUT, categories: new Set<Categorie>(['jour']) }).map((e) => e.id).join() === 'C,D,F');
eq('tri par importance : absolu, mensuel puis jour', trier(jeu, 'importance', '2026-10-13').map((e) => e.id).slice(0, 3).join() === 'C,A,F', trier(jeu, 'importance', '2026-10-13').map((e) => e.id).join());
eq('tri par ancienneté du record battu', trier(jeu, 'anciennete', '2026-10-13').map((e) => e.id)[0] === 'C');
eq('tri par valeur extrême (froid : le plus bas d’abord)', trier(jeu.filter((e) => e.famille === 'cold'), 'valeur', '2026-10-13').map((e) => e.id).join() === 'C,D');
eq('tri par nom', trier(jeu, 'nom', '2026-10-13').map((e) => e.id).join() === 'A,B,C,D,F');

// --- Synthèse ---
const jour = { date: '2026-10-13', provisoire: true, source: 't', genere: null, derniereObservation: null, quinzaine: '1re quinzaine', evenements: jeu, stations: 1700 };
eq('synthèse du jour', synthese(jour) === 'Le mardi 13 octobre 2026 : 1 station bat un record de chaleur, 2 stations battent un record de froid, 1 nuit tropicale bat un record ; 1 autre station à moins de 1 °C d’un record.', synthese(jour));
eq('synthèse sans record', synthese({ ...jour, evenements: [] }) === 'Le mardi 13 octobre 2026, aucun record de température n’est battu.');

// --- Conversion des fichiers du pipeline ---
const brut = {
  id: '25254001', name: 'LES FOURGS', lat: 46.834, lon: 6.4365, altitude: 1140, opening_year: 1956, opened: '1956-07-01', type_station: 2, principal: true,
  department_code: '25', region: 'Bourgogne-Franche-Comté', value: -0.5, kind: 'cold', flags: ['daily', 'bidon'], near: ['daily'],
  records: { absolute: { value: -23.5, date: '2026-01-07' }, monthly: null, daily: { value: 1.8, date: '2021-10-13' } }, deltas: { absolute: 23, daily: -2.3 }, provisional: true,
};
const e = evenementDepuis(brut, 'cold');
eq('conversion : champs principaux', !!e && e.id === '25254001' && e.nom === 'Les Fourgs' && e.alt === 1140 && e.ouverture === 1956 && e.principal && e.dep === '25' && e.valeur === -0.5 && e.provisoire, JSON.stringify(e));
eq('conversion : portées inconnues écartées', !!e && JSON.stringify(e.battus) === '["daily"]' && JSON.stringify(e.proches) === '["daily"]');
eq('conversion : records et écarts', !!e && e.records.absolute?.value === -23.5 && e.records.monthly === undefined && e.ecarts.daily === -2.3 && e.ecarts.absolute === 23);
eq('conversion : événement sans position ou sans drapeau refusé', evenementDepuis({ ...brut, lat: null }, 'cold') === null && evenementDepuis({ ...brut, flags: [], near: [] }, 'cold') === null && evenementDepuis('x', 'cold') === null);
eq('conversion : la Corse prend la région Corse', evenementDepuis({ ...brut, id: '20004002', department_code: '20', region: 'France' }, 'heat')?.region === 'Corse');
eq('conversion : l’année d’ouverture inconnue reste nulle', evenementDepuis({ ...brut, opening_year: null }, 'cold')?.ouverture === null);
const j = jourDepuis({ date: '2026-10-13', provisional: true, source: 'Météo-France DPPaquetObs V2', fortnight_label: '1re quinzaine', stations_with_values: 1690, events: { heat: [], cold: [brut, { id: 'x' }], tropical: [] } }, { generated_at: '2026-10-13T02:07:34Z', latest_observation_at: '2026-10-13T02:00:00Z' });
eq('jour : conversion complète', !!j && j.date === '2026-10-13' && j.provisoire && j.evenements.length === 1 && j.stations === 1690 && j.genere === '2026-10-13T02:07:34Z' && j.derniereObservation === '2026-10-13T02:00:00Z');
eq('jour : date absente ou invalide refusée', jourDepuis({ events: {} }) === null && jourDepuis({ date: '13/10/2026' }) === null && jourDepuis(null) === null);

// --- Zones ---
eq('Corse : un seul département dans les fichiers, deux contours sur la carte', contoursDeDep('20').join() === '2A,2B' && contoursDeDep('66').join() === '66' && depDeContour('2B') === '20' && depDeContour('66') === '66');
eq('régions : 13 régions métropolitaines dont la Corse', REGIONS.length === 13 && REGIONS.includes('Corse') && REGIONS.includes('Occitanie'), String(REGIONS.length));
eq('départements : 95 codes, Corse = 20', DEPARTEMENTS.length === 95 && DEPARTEMENTS.some((d) => d.code === '20') && !DEPARTEMENTS.some((d) => d.code === '2A') && !DEPARTEMENTS.some((d) => d.code === '99'), String(DEPARTEMENTS.length));
eq('région d’un département', regionDeDep('66') === 'Occitanie' && regionDeDep('20') === 'Corse' && regionDeDep('75') === 'Île-de-France');
eq('nom d’un département', nomDepartement('66') === 'Pyrénées-Orientales' && nomDepartement('20') === 'Corse');

if (fail) { console.error(`\n${fail} test(s) en échec`); process.exit(1); }
console.log('\nrecords-temperature : tous les tests passent');
