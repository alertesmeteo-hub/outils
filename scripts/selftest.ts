import { toolRegistry } from '../src/lib/tools/registry';
import { defaultValues, run } from '../src/lib/tools/engine';

let fail = 0;
const eq = (name: string, cond: boolean, info = '') => { if (!cond) { fail++; console.error('✗', name, info); } else console.log('✓', name); };

// Chaque outil doit calculer avec ses valeurs par défaut.
for (const t of toolRegistry) {
  const o = run(t, { ...defaultValues(t), ...(t.slug === 'intemperies-btp' ? { commune: 'Lyon', date: '2026-01-15' } : {}) } as never);
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
process.exit(fail ? 1 : 0);
