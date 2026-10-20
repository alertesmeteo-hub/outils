'use client';

import { useState } from 'react';
import type { ThemeBilan, VueDirect } from '@/lib/carte-meteo/cartes-info';
import CarteInfo, { type PointInfo } from './CarteInfo';

/** Boutons de la carte, dans l'ordre de la carte de référence (relevés, records du mois, battus ?, absolus, battus ?). */
const VUES: { vue: VueDirect; libelle: string; record: boolean }[] = [
  { vue: 'releve', libelle: 'Relevés', record: false },
  { vue: 'record-mois', libelle: 'Records mois', record: true },
  { vue: 'ecart-mois', libelle: 'Records mois battus ?', record: true },
  { vue: 'record-abs', libelle: 'Records absolus', record: true },
  { vue: 'ecart-abs', libelle: 'Records abs. battus ?', record: true },
];

interface Props {
  themes: ThemeBilan[];
  points: Record<string, PointInfo[]>;
  sousTitre: (themeId: string) => string;
  zone: string;
  logoId: string;
  prefixeFichier: string;
  contexte: string;
  echelleValeurs?: number;
}

/**
 * Températures en direct : une seule carte de toutes les stations, avec ses boutons — relevé du moment, record du mois ou
 * record absolu de chaque station, et écart de la maxi du jour (ou de la mini de la nuit) à ce record. Chaleur / froid pour
 * les vues de records.
 */
export default function CarteDirect({ themes, points, sousTitre, zone, logoId, prefixeFichier, contexte, echelleValeurs = 1 }: Props) {
  const [vue, setVue] = useState<VueDirect>('releve');
  const [champ, setChamp] = useState<'tx' | 'tn'>('tx');
  const theme = themes.find((t) => t.direct?.vue === vue && (vue === 'releve' || t.direct?.champ === champ)) ?? themes[0];
  const avecRecord = VUES.find((v) => v.vue === vue)?.record;

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        {VUES.map((v) => (
          <button
            key={v.vue}
            type="button"
            aria-pressed={vue === v.vue}
            onClick={() => setVue(v.vue)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide shadow-sm ${
              vue === v.vue ? 'bg-primary text-white' : v.record ? 'bg-[#e74c3c] text-white hover:opacity-90' : 'bg-[#6ee0d0] text-[#0b3b36] hover:opacity-90'
            }`}
          >
            {v.libelle}
          </button>
        ))}
        {avecRecord && (
          <span className="ml-2 inline-flex overflow-hidden rounded-full border border-border text-xs font-semibold">
            {(
              [
                ['tx', 'Chaleur (maxi)'],
                ['tn', 'Froid (mini)'],
              ] as const
            ).map(([c, libelle]) => (
              <button key={c} type="button" aria-pressed={champ === c} onClick={() => setChamp(c)} className={`px-3 py-1.5 ${champ === c ? 'bg-primary text-white' : 'bg-surface'}`}>
                {libelle}
              </button>
            ))}
          </span>
        )}
      </div>
      <CarteInfo
        key={theme.id}
        theme={theme}
        zone={zone}
        points={points[theme.id] ?? []}
        sousTitre={sousTitre(theme.id)}
        logoId={logoId}
        prefixeFichier={prefixeFichier}
        contexte={contexte}
        echelleValeurs={echelleValeurs}
      />
    </div>
  );
}
