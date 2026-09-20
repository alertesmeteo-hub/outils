import { toolRegistry } from '../src/lib/tools/registry';
import { defaultValues, run } from '../src/lib/tools/engine';

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
const RESERVED = ['admin', 'api', 'embed', 'outils', 'confidentialite', 'attestation-meteo', 'sitemap.xml', 'robots.txt'];
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
console.log('Paris 21/12/2026 :', s2.metrics.map((m: any) => m.value).join(' | '), '– durée', s2.headline.value);
eq('Paris 21 juin : lever 05 h 4x / coucher 21 h 5x', /^05 h 4/.test(s1.metrics[0].value) && /^21 h 5/.test(s1.metrics[2].value), s1.metrics.map((m: any) => m.value).join());
eq('Paris 21 juin : durée = 16 h 11', /^16 h 11/.test(s1.headline.value), s1.headline.value);
eq('Paris 21 déc. : lever 08 h 4x / coucher 16 h 5x', /^08 h 4/.test(s2.metrics[0].value) && /^16 h 5/.test(s2.metrics[2].value), s2.metrics.map((m: any) => m.value).join());
process.exit(fail ? 1 : 0);
