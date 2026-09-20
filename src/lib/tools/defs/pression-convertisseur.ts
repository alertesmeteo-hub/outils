import type { ToolDefinition, Tone } from '../types';
import { fmt } from '../engine';

// Facteurs vers le pascal (valeurs conventionnelles).
const TO_PA: Record<string, number> = { hpa: 100, kpa: 1000, pa: 1, bar: 100000, mmhg: 133.322387415, inhg: 3386.38815789, atm: 101325, psi: 6894.757293168 };
const LABEL: Record<string, string> = { hpa: 'hPa (= mbar)', kpa: 'kPa', pa: 'Pa', bar: 'bar', mmhg: 'mmHg', inhg: 'inHg', atm: 'atm', psi: 'psi' };

export const pressionConvertisseur: ToolDefinition = {
  slug: 'pression-convertisseur',
  path: '/pression/convertisseur',
  name: 'Convertisseur de pression atmosphérique (hPa, mmHg, inHg…)',
  category: 'meteo',
  icon: '🌡️',
  shortDescription: 'Convertissez hPa, kPa, mmHg, inHg, bar, atm et psi, avec un repère anticyclone ou dépression.',
  h1: 'Convertisseur de pression atmosphérique : hPa, mmHg, inHg, bar',
  title: 'Convertisseur pression atmosphérique : hPa, mmHg, inHg, bar',
  metaDescription: 'Convertissez une pression atmosphérique entre hPa, kPa, mmHg, inHg, bar, atm et psi et situez-la par rapport à la pression standard de 1 013,25 hPa.',
  keywords: ['convertisseur pression atmosphérique', 'hPa en mmHg', 'hPa en inHg', 'mbar en hPa', 'pression standard', 'anticyclone dépression', 'baromètre'],
  intro:
    'Les stations météo, les baromètres, les cartes et les sites aéronautiques n’affichent pas tous la pression dans la même unité : hectopascals en Europe, pouces de mercure aux États-Unis, millimètres de mercure pour certains baromètres. Saisissez une valeur dans l’unité de votre choix pour obtenir toutes les équivalences, avec un repère par rapport à la pression atmosphérique standard au niveau de la mer.',
  method: [
    'Conversion via le pascal : 1 hPa = 100 Pa ; 1 kPa = 1 000 Pa ; 1 bar = 100 000 Pa ; 1 atm = 101 325 Pa ; 1 mmHg = 133,322 387 Pa ; 1 inHg = 3 386,388 Pa ; 1 psi = 6 894,757 Pa.',
    'Le millibar (mbar) est égal à l’hectopascal (hPa) : 1 mbar = 1 hPa.',
    'Repères usuels sur une pression réduite au niveau de la mer : en dessous de 1 000 hPa, on parle de basses pressions (dépression) ; au-delà de 1 020 hPa, de hautes pressions (anticyclone). La pression standard est de 1 013,25 hPa.',
  ],
  example: '1 013,25 hPa = 101,325 kPa = 760 mmHg = 29,92 inHg = 1 atm.',
  interpretation: [
    'La pression diminue avec l’altitude : une valeur mesurée en montagne est plus basse qu’au niveau de la mer sans que la météo change. Les cartes utilisent une pression « réduite au niveau de la mer ».',
    'Ce sont surtout les variations qui renseignent : une baisse rapide annonce souvent une dégradation, une hausse régulière une amélioration, mais ce n’est pas une prévision.',
    'Les repères anticyclone et dépression n’ont de sens que pour une pression réduite au niveau de la mer.',
  ],
  faq: [
    { q: 'Combien de mmHg font 1 013 hPa ?', a: '1 013 hPa correspondent à environ 760 mmHg (1 013,25 hPa = 760 mmHg par définition de l’atmosphère normale).' },
    { q: 'Le mbar est-il identique à l’hPa ?', a: 'Oui : 1 millibar = 1 hectopascal. Seul le nom de l’unité a changé.' },
    { q: 'Comment convertir des hPa en inHg ?', a: 'Divisez par 33,8639. Par exemple, 1 013,25 hPa ≈ 29,92 inHg.' },
    { q: 'Pourquoi ma pression change-t-elle avec l’altitude ?', a: 'Il y a moins d’air au-dessus de vous quand vous montez : la pression baisse d’environ 1 hPa tous les 8 mètres près du sol.' },
  ],
  related: ['convertisseur-vent', 'humidite-absolue', 'temperature-humide'],
  sources: ['Valeurs conventionnelles des unités de pression (Système international ; atmosphère normale = 101 325 Pa).', 'Repères anticyclone / dépression : usage courant en météorologie (pression réduite au niveau de la mer, référence 1 013,25 hPa).'],
  fields: [
    { id: 'valeur', label: 'Pression', type: 'number', min: 0, required: true, default: '1013.25', placeholder: 'ex. 1013,25' },
    { id: 'unite', label: 'Unité', type: 'select', default: 'hpa', options: Object.entries(LABEL).map(([value, label]) => ({ value, label })) },
  ],
  validate: (p) => {
    const hpa = ((p.valeur as number) * TO_PA[p.unite as string]) / 100;
    return hpa < 300 || hpa > 1100 ? { valeur: 'Valeur hors de la plage atmosphérique usuelle (300 à 1 100 hPa).' } : {};
  },
  compute: (p) => {
    const pa = (p.valeur as number) * TO_PA[p.unite as string];
    const hpa = pa / 100;
    let label: string, tone: Tone;
    if (hpa < 1000) { label = 'Basses pressions (dépression)'; tone = 'warn'; }
    else if (hpa <= 1020) { label = 'Pression proche de la moyenne'; tone = 'ok'; }
    else { label = 'Hautes pressions (anticyclone)'; tone = 'info'; }
    return {
      level: { label, tone },
      headline: { label: 'Pression', value: fmt(hpa, 2), unit: 'hPa' },
      metrics: Object.keys(TO_PA).filter((u) => u !== 'hpa').map((u) => ({ label: LABEL[u], value: fmt(pa / TO_PA[u], u === 'pa' ? 0 : 4) })),
      gauge: { value: Math.max(960, Math.min(1060, hpa)), min: 960, max: 1060, caption: 'Pression (hPa)', segments: [{ to: 1000, tone: 'warn' }, { to: 1020, tone: 'ok' }, { to: 1060, tone: 'info' }] },
      notes: ['Repères valables pour une pression réduite au niveau de la mer ; une mesure en altitude est naturellement plus basse.'],
      shareText: `${fmt(p.valeur as number, 2)} ${LABEL[p.unite as string]} = ${fmt(hpa, 2)} hPa = ${fmt(pa / TO_PA.mmhg, 1)} mmHg = ${fmt(pa / TO_PA.inhg, 2)} inHg.`,
    };
  },
  addedAt: '2026-09-20',
  updatedAt: '2026-09-20',
};
