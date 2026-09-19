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
process.exit(fail ? 1 : 0);
