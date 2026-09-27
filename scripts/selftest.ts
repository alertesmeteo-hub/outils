import { toolRegistry } from '../src/lib/tools/registry';
import { defaultValues, run } from '../src/lib/tools/engine';
import * as R from '../src/lib/obs/rankings';
import * as MF from '../src/lib/obs/meteofrance';
import { fromClimato } from '../src/lib/obs/climato';
import { matchStations, parseSynop } from '../src/lib/obs/synop';
import marignane from './fixtures/normales-13054001.json';

let fail = 0;
const eq = (name: string, cond: boolean, info = '') => { if (!cond) { fail++; console.error('✗', name, info); } else console.log('✓', name); };

// Chaque outil doit calculer avec ses valeurs par défaut.
for (const t of toolRegistry) {
  const o = run(t, { ...defaultValues(t), ...(t.slug === 'intemperies-btp' ? { commune: 'Lyon', date: '2026-01-15' } : {}), ...(t.slug === 'lever-coucher-soleil' ? { date: '2026-01-15' } : {}) } as never);
  eq(`${t.slug}: valeurs par défaut valides`, o.ok, JSON.stringify(o));
  eq(`${t.slug}: intro 50-100 mots`, (() => { const n = t.intro.split(/\s+/).length; return n >= 50 && n <= 100; })(), String(t.intro.split(/\s+/).length));
  for (const r of t.related) eq(`${t.slug}: lien ${r} existe`, toolRegistry.some((x) => x.slug === r));
}
const get = (s: string, v: Record<string, string | boolean>) => {
  const t = toolRegistry.find((x) => x.slug === s)!;
  const o = run(t, { ...defaultValues(t), ...v });
  return o.ok ? o.result : o;
};
const r1: any = get('mm-pluie-litres', { mm: '20', surface: '100' });
eq('20 mm x 100 m² = 2 000 L', r1.metrics[1].value.replace(/\s/g, '') === '2000', JSON.stringify(r1.metrics));
const r3: any = get('distance-orage', { secondes: '9' });
eq('9 s ≈ 3,1 km', r3.headline.value === '3,1', r3.headline.value);
const r4: any = get('temperature-ressentie', { temperature: '-5', vent: '30' });
eq('windchill -5/30 ≈ -13', r4.headline.value.startsWith('-13') || r4.headline.value.startsWith('−13'), r4.headline.value);
const r4b: any = get('temperature-ressentie', { temperature: '15', vent: '30' });
eq('windchill 15 °C non applicable', r4b.headline.value === 'Non applicable');
const r5: any = get('indice-chaleur', { temperature: '35', humidite: '60' });
eq('indice chaleur 35/60 ≈ 45', /^4[45]/.test(r5.headline.value), r5.headline.value);
const r6: any = get('point-de-rosee', { temperature: '25', humidite: '60' });
eq('point de rosée 25/60 ≈ 16,7', r6.headline.value === '16,7', r6.headline.value);
const r9: any = get('calcul-indemnisation-assurance', { dommages: '5000', franchise: '380', vetuste: '20', plafond: '' });
eq('indemnisation 3 620 €', r9.headline.value.replace(/\s/g, '') === '3620,00' || r9.headline.value.replace(/\s/g, '') === '3620', r9.headline.value);
const bad: any = get('degats-tempete', { rafale: '50', moyen: '80' });
eq('rafale < vent moyen rejetée', !!bad.errors?.rafale);
const bad2: any = get('mm-pluie-litres', { mm: '-1' });
eq('valeur négative rejetée', !!bad2.errors?.mm);

const paths = toolRegistry.map((t) => t.path);
eq('paths uniques', new Set(paths).size === paths.length);
eq('paths de la forme /thème/page', paths.every((p) => /^\/[a-z0-9-]+\/[a-z0-9-]+$/.test(p)), paths.join(','));
const RESERVED = ['admin', 'api', 'embed', 'outils', 'classements', 'confidentialite', 'attestation-meteo', 'sitemap.xml', 'robots.txt'];
eq('thèmes non réservés', paths.every((p) => !RESERVED.includes(p.split('/')[1])));

const cc: any = get('empreinte-carbone', { mode: 'car_moyenne', distance: '100', occupants: '1' });
eq('voiture moyenne 100 km = 25,6 kg', cc.headline.value === '25,6', cc.headline.value);
const cc2: any = get('empreinte-carbone', { mode: 'car_moyenne', distance: '100', occupants: '2' });
eq('voiture à 2 = 12,8 kg par personne', cc2.headline.value === '12,8', cc2.headline.value);
const cc3: any = get('empreinte-carbone', { mode: 'tgv', distance: '100', occupants: '1' });
eq('TGV 100 km ≈ 0,293 kg', cc3.headline.value === '0,293', cc3.headline.value);
const cc4: any = get('empreinte-carbone', { mode: 'tgv', distance: '100', occupants: '1', retour: true });
eq('aller-retour double', cc4.headline.value === '0,586', cc4.headline.value);
const cc5: any = get('empreinte-carbone', { mode: 'avion', distance: '600', occupants: '1', trainees: true });
eq('avion 600 km avec traînées = 135 kg (0,225)', cc5.headline.value === '135', cc5.headline.value);
const cc6: any = get('empreinte-carbone', { mode: 'avion', distance: '600', occupants: '1', trainees: false });
eq('avion 600 km sans traînées = 74,4 kg (0,124)', cc6.headline.value === '74,4', cc6.headline.value);
const cc7: any = get('empreinte-carbone', { mode: 'marche', distance: '5', occupants: '1' });
eq('marche = 0', cc7.headline.value === '0', cc7.headline.value);
const cc8: any = get('empreinte-carbone', { mode: 'car_moyenne', distance: '10', occupants: '1,5' });
eq('occupants non entier rejeté', !!cc8.errors?.occupants);

// --- Lot 2 : nouveaux outils ---
const A = (s: string, v: Record<string, string | boolean> = {}): any => get(s, v);
eq('pression 1013,25 hPa = 760 mmHg', A('pression-convertisseur', { valeur: '1013.25', unite: 'hpa' }).shareText.includes('760 mmHg'), A('pression-convertisseur', {}).shareText);
eq('pression 29,92 inHg ≈ 1013 hPa', /^1\s01[23]/g.test(A('pression-convertisseur', { valeur: '29.92', unite: 'inhg' }).headline.value), A('pression-convertisseur', { valeur: '29.92', unite: 'inhg' }).headline.value);
console.log('humidex 30/70 :', A('humidex', { temperature: '30', humidite: '70' }).headline.value, '(point de rosée', A('humidex', { temperature: '30', humidite: '70' }).metrics[0].value + ')');
eq('humidité absolue 20/50 ≈ 8,6', A('humidite-absolue', { temperature: '20', humidite: '50' }).headline.value.startsWith('8,6'), A('humidite-absolue', {}).headline.value);
eq('humidité absolue 20/100 ≈ 17,3', A('humidite-absolue', { temperature: '20', humidite: '100' }).headline.value.startsWith('17,'), A('humidite-absolue', { temperature: '20', humidite: '100' }).headline.value);
console.log('température humide 30/50 :', A('temperature-humide', { temperature: '30', humidite: '50' }).headline.value);
eq('intensité 15 mm / 30 min = 30 mm/h', A('intensite-pluie', { mm: '15', minutes: '30' }).headline.value === '30', A('intensite-pluie', {}).headline.value);
eq('neige 20 cm à 100 kg/m³ = 20 mm', A('neige-en-eau', { hauteur: '20', densite: '100' }).headline.value === '20', A('neige-en-eau', {}).headline.value);
eq('charge neige 30 cm à 200 = 60 kg/m²', A('charge-neige-toiture', { hauteur: '30', densite: '200', surface: '100' }).headline.value === '60', A('charge-neige-toiture', {}).headline.value);
eq('DJU 2/10 base 18 = 12', A('degres-jours', { tn: '2', tx: '10' }).headline.value === '12', A('degres-jours', {}).headline.value);
eq('DJU tn>=base = 0', A('degres-jours', { tn: '19', tx: '25' }).headline.value === '0', A('degres-jours', { tn: '19', tx: '25' }).headline.value);
eq('DJU tx<tn rejeté', !!A('degres-jours', { tn: '10', tx: '5' }).errors?.tx);
eq('récupération eau 57 600 L', A('recuperation-eau-pluie', {}).headline.value.replace(/\s/g, '') === '57600', A('recuperation-eau-pluie', {}).headline.value);
eq('citerne 150 L × 20 j = 3 000 L', A('volume-citerne', {}).headline.value.replace(/\s/g, '') === '3000', A('volume-citerne', {}).headline.value);
eq('kit 4 pers × 3 j = 24 L d’eau', A('kit-urgence', {}).headline.value === '24', A('kit-urgence', {}).headline.value);
eq('UV 7 = élevé', A('indice-uv', { uv: '7' }).level.label.includes('élevé'));
eq('gel: min 2 °C ciel dégagé calme → sol −1', A('risque-gel', { tmin: '2', ciel: 'degage', vent: 'calme' }).headline.value === '-1' || A('risque-gel', { tmin: '2', ciel: 'degage', vent: 'calme' }).headline.value === '−1', A('risque-gel', { tmin: '2' }).headline.value);
eq('verglas −1 °C chaussée humide = élevé', A('risque-verglas', { air: '-1', eau: 'humide' }).level.label.includes('élevé'));
// Soleil : Paris, solstice d'été 2026 (heure d'été) et de décembre (heure d'hiver)
const s1 = A('lever-coucher-soleil', { ville: 'paris', date: '2026-06-21' });
console.log('Paris 21/06/2026 :', s1.metrics.map((m: any) => m.value).join(' | '), '– durée', s1.headline.value);
const s2 = A('lever-coucher-soleil', { ville: 'paris', date: '2026-12-21' });
// ---------- Classements de stations ----------
{
  const iso = (s: string) => new Date(s).toISOString();
  // Été (UTC+2) : 8 h locales = 06 UTC ; hiver (UTC+1) : 07 UTC.
  eq('8 h Paris en été = 06 UTC', new Date(R.parisToUtc(2026, 7, 15, 8)).toISOString() === '2026-07-15T06:00:00.000Z');
  eq('8 h Paris en hiver = 07 UTC', new Date(R.parisToUtc(2026, 1, 15, 8)).toISOString() === '2026-01-15T07:00:00.000Z');
  const now = Date.parse('2026-07-15T13:00:00Z'); // 15 h locales
  const w = R.windows(now);
  eq('TX prov. : 15/07 06 UTC → 16/07 06 UTC', new Date(w.txProv.start).toISOString() === '2026-07-15T06:00:00.000Z' && new Date(w.txProv.end).toISOString() === '2026-07-16T06:00:00.000Z' && !w.txProv.final);
  eq('TX finale : veille, close', new Date(w.txFin.start).toISOString() === '2026-07-14T06:00:00.000Z' && w.txFin.final);
  eq('TN prov. à 15 h : nuit 14/07 20 h → 15/07 8 h (close)', new Date(w.tnProv.start).toISOString() === '2026-07-14T18:00:00.000Z' && new Date(w.tnProv.end).toISOString() === '2026-07-15T06:00:00.000Z' && w.tnProv.final);
  const w2 = R.windows(Date.parse('2026-07-15T21:00:00Z')); // 23 h locales
  eq('TN prov. à 23 h : nuit en cours', new Date(w2.tnProv.start).toISOString() === '2026-07-15T18:00:00.000Z' && !w2.tnProv.final);
  eq('TN finale à 23 h : nuit précédente', new Date(w2.tnFin.start).toISOString() === '2026-07-14T18:00:00.000Z');
  const w3 = R.windows(Date.parse('2026-10-25T12:00:00Z')); // jour du passage à l'heure d'hiver
  eq('TX finale sur 25 h le jour du changement d’heure', w3.txFin.end - w3.txFin.start === 25 * 3600_000 && w3.txProv.end - w3.txProv.start === 24 * 3600_000);

  const obs = Array.from({ length: 30 }, (_, i) => {
    const t = Date.parse('2026-07-14T08:00:00Z') + i * 3600_000;
    return { time: iso(new Date(t).toISOString()), t: 20 + i / 2, tx: 20.5 + i / 2, tn: 19.5 + i / 2, rr1: 1, td: 18, ff: 10 };
  });
  const mx = R.aggMax(obs, w.txProv, now)!;
  eq('TX = max des tx horaires de la fenêtre (13 UTC → 20,5 + 29/2 = 35)', mx.value === 35 && mx.n === 7 && mx.expected === 7, JSON.stringify(mx));
  const rr = R.aggSum(obs, { start: now - 24 * 3600_000, end: now }, 'rr1', now)!;
  eq('pluie 24 h = 24 mm', rr.value === 24 && rr.n === 24);
  const rr72 = R.aggSum(obs, { start: now - 72 * 3600_000, end: now }, 'rr1', now)!;
  eq('pluie 72 h incomplète signalée (30/72 h)', rr72.value === 30 && rr72.n === 30 && rr72.expected === 72);
  eq('humidex classes', R.humidexBand(25).label === 'Sensation de bien-être' && R.humidexBand(46).label === 'Danger' && R.humidexBand(54).label === 'Coup de chaleur imminent');
  eq('windchill classes', R.windchillBand(-30).label.includes('modéré') && R.windchillBand(-56).label.includes('extrême') && R.windchillBand(-5).label === 'Faible risque de gelures');
  eq('windchill : −5 °C / 30 km/h ≈ −13 ; vent faible = température ; plafonné à la température', Math.round(R.windchillOf(-5, 30)!) === -13 && R.windchillOf(15, 3) === 15 && R.windchillOf(25, 20)! <= 25);
  eq('couleurs : humidex 42 orange, windchill −45 bleu', R.humidexBand(42).bg === '#ff8c00' && R.windchillBand(-45).bg === '#0000ff');

  const st = (id: string, dept: string, alt: number, kind: 'principale' | 'secondaire' = 'principale') => ({ id, name: id, dept, alt, kind });
  const stations = [st('A', '13', 5), st('B', '84', 900), st('C', '13', 50, 'secondaire')];
  const o = (v: number) => [{ time: '2026-07-15T12:00:00.000Z', tx: v, t: v }, { time: '2026-07-15T13:00:00.000Z', tx: v, t: v }];
  const data = { A: o(38), B: o(40), C: o(41) };
  const rec = { A: { monthly: { '7': { tx: { v: 37.9, d: '2019-07-12' } } }, absolute: { tx: { v: 44, d: '2019-06-28' } } } };
  const tx = R.getRanking('tx-prov');
  const rows = R.buildRanking(tx, stations, data, now, { secondaires: false, amateurs: false, byDept: false }, rec);
  eq('classement TX : secondaires exclues, tri décroissant', rows.map((r) => r.station.id).join() === 'B,A');
  eq('record mensuel battu détecté', rows[1].beaten === 'month');
  eq('altitude max. filtre', R.buildRanking(tx, stations, data, now, { maxAlt: 500, secondaires: true, amateurs: false, byDept: false }).map((r) => r.station.id).join() === 'C,A');
  eq('tri par département, rang par département', R.buildRanking(tx, stations, data, now, { secondaires: true, amateurs: false, byDept: true }).map((r) => `${r.station.dept}:${r.rank}`).join() === '13:1,13:2,84:1');
  eq('TN : tri croissant', R.buildRanking(R.getRanking('tn-0618'), stations, data, now, { secondaires: true, amateurs: false, byDept: false })[0].station.id === 'A');

  // Vent, pression, évolution, régions, normales
  const ob2 = Array.from({ length: 25 }, (_, i) => ({ time: new Date(now - (24 - i) * 3600_000).toISOString(), t: 10 + i, fxi: i === 5 ? 90 : 20, ff: 15, pmer: 1000 + i, u: 80, vv: 3000, snow: 0 }));
  const d2 = { A: ob2 };
  const one = (id: string, f = {}) => R.buildRanking(R.getRanking(id), [st('A', '13', 5)], d2, now, { secondaires: false, amateurs: false, byDept: false, ...f }, { A: { normals: { '7': { tx: 30, tn: 18 } }, monthly: { '7': { tx: { v: 40, d: '2019-07-12' } } } } })[0];
  eq('vent max 24 h = 90 km/h', one('fxi24')?.value === 90);
  eq('vent max repli sur fxy', R.buildRanking(R.getRanking('fxi'), [st('A', '13', 5)], { A: [{ time: new Date(now).toISOString(), fxy: 55 }] }, now, { secondaires: false, amateurs: false, byDept: false })[0]?.value === 55);
  eq('variation de pression 3 h = +3 hPa, pression actuelle 1024', one('dp3')?.value === 3 && one('dp24')?.value === 24 && one('dp3')?.pmer === 1024);
  eq('visibilité en km', one('vv')?.value === 3);
  eq('neige nulle non classée', one('snow') === undefined);
  const ev = one('tx-prov', { evo: true });
  eq('évolution T 1 h = +1, 24 h = +24', ev?.evo1 === 1 && ev?.evo24 === 24, JSON.stringify(ev));
  eq('filtre département', one('ff', { dept: '13' })?.station.id === 'A' && one('ff', { dept: '29' }) === undefined);
  eq('région PACA pour les Bouches-du-Rhône', one('ff')?.region === 'Provence-Alpes-Côte d’Azur' && one('ff', { region: 'bre' }) === undefined);
  eq('écart à la normale TX 24 h glissantes = 34 − 30', one('n-tx24')?.value === 4);
  eq('écart au record mensuel TX (TX finale 27 − 40)', one('e-recm-tx')?.value === -13, String(one('e-recm-tx')?.value));

  // Normales et records du dépôt climato (fiche Météo-France de Marignane)
  const cl = fromClimato(marignane as never)!;
  eq('climato : normale TX janvier Marignane = 11,8 °C', cl.normals?.['1']?.tx === 11.8);
  eq('climato : record TX janvier 19,9 °C le 2024-01-24', cl.monthly?.['1']?.tx?.v === 19.9 && cl.monthly?.['1']?.tx?.d === '2024-01-24');
  eq('climato : record absolu TX = 40,5 °C, TN = −16,8 °C (1956)', cl.absolute?.tx?.v === 40.5 && cl.absolute?.tn?.v === -16.8 && cl.absolute?.tn?.d.startsWith('1956'), JSON.stringify(cl.absolute));

  // Rafales SYNOP (extrait réel des colonnes de l'archive OMM)
  const csvS = 'lat;lon;geo_id_wmo;validity_time;ff;raf10;rafper;per\n48.444;-4.412;7110;2026-09-26T18:00:00Z;8;15.2;21.0;-360\n48.444;-4.412;7110;2026-09-26T21:00:00Z;6;9.0;;-10\n48.444;-4.412;7110;2026-09-20T21:00:00Z;6;30;30;-10';
  const gs = parseSynop(csvS, Date.parse('2026-09-24T00:00:00Z'));
  eq('SYNOP : rafper 21 m/s = 76 km/h, raf10 seul pris en compte, vieux message ignoré', gs.length === 2 && gs[0].gust === 76 && gs[1].gust === 32 && gs[0].wmo === '07110', JSON.stringify(gs));
  const mt = matchStations(gs, [{ id: '29075001', name: 'BREST-GUIPAVAS', dept: '29', lat: 48.4445, lon: -4.4118, kind: 'principale' }, { id: '29000000', name: 'LOIN', dept: '29', lat: 48.6, lon: -4.4, kind: 'principale' }]);
  eq('SYNOP : rattachement à la station Météo-France la plus proche (≤ 3 km)', mt.get('07110') === '29075001' && mt.size === 1);
  const sEndT = Date.parse('2026-09-26T21:00:00Z');
  const rafRow = R.buildRanking(R.getRanking('raf24'), [st('B', '29', 94)], { B: [{ time: '2026-09-26T18:00:00.000Z', gust: 76 }, { time: '2026-09-26T21:00:00.000Z', gust: 32 }] }, sEndT + 86400_000, { secondaires: false, amateurs: false, byDept: false })[0];
  eq('rafales 24 h comptées depuis le dernier message SYNOP', rafRow?.value === 76);

  const p = MF.parsePaquetRow({ geo_id_insee: '13054001', validity_time: '2026-07-15T13:00:00Z', t_10: 295.15, t_100: 291.65, t: 308.15, td: 290.15, tx: 309.05, tn: 307.15, ff: 5, pmer: 101520, rr1: 0.4, insolh: 60 })!;
  eq('paquet MF : K → °C, m/s → km/h, Pa → hPa', p.obs.t === 35 && p.obs.tx === 35.9 && p.obs.ff === 18 && p.obs.pmer === 1015.2 && p.obs.insol === 60 && p.obs.t10 === 22 && p.obs.t100 === 18.5, JSON.stringify(p));
  eq('id-departement sans zéro initial, Corse = 20', MF.deptParam('01') === '1' && MF.deptParam('20') === '20' && MF.DEPARTEMENTS.length === 95 && MF.DEPARTEMENTS.includes('20'));
  const csv = 'Id_station;Id_omm;Nom_usuel;Latitude;Longitude;Altitude;Date_ouverture;Pack\n13054001;07650;MARIGNANE;43.44;5.22;9;1920-01-01;RADOME\n13001009;;AIX;43.5;5.4;173;1990-05-01;ETENDU\n99999999;;HORS;0;0;0;;RADOME';
  const sl = MF.parseStationsCsv(csv, (id) => (id.startsWith('13') ? '13' : undefined));
  eq('liste stations : Pack ETENDU = secondaire, date d’ouverture', sl.length === 2 && sl[1].kind === 'secondaire' && sl[0].opened === '1920-01-01' && sl[0].alt === 9);
}

console.log('Paris 21/12/2026 :', s2.metrics.map((m: any) => m.value).join(' | '), '– durée', s2.headline.value);
eq('Paris 21 juin : lever 05 h 4x / coucher 21 h 5x', /^05 h 4/.test(s1.metrics[0].value) && /^21 h 5/.test(s1.metrics[2].value), s1.metrics.map((m: any) => m.value).join());
eq('Paris 21 juin : durée = 16 h 11', /^16 h 11/.test(s1.headline.value), s1.headline.value);
eq('Paris 21 déc. : lever 08 h 4x / coucher 16 h 5x', /^08 h 4/.test(s2.metrics[0].value) && /^16 h 5/.test(s2.metrics[2].value), s2.metrics.map((m: any) => m.value).join());
process.exit(fail ? 1 : 0);
