'use client';

import { useState } from 'react';
import CarteMeteo from './CarteMeteo';
import CartesInfo from './CartesInfo';

type Vue = 'infos' | 'pictos';

const VUES: { id: Vue; libelle: string; aide: string }[] = [
  { id: 'infos', libelle: '🔎 Une carte par thème', aide: 'Valeurs sur la carte : températures, pluie, rafales, neige, orages, bilans…' },
  { id: 'pictos', libelle: '🌦️ Carte avec pictos', aide: 'Pictos, températures et rafales, avec tous les réglages de la page Pyrénées-Orientales' },
];

/** « Une carte au choix » : cartes de valeurs par thème (recherche) ou carte avec pictos et tous ses réglages. */
export default function CarteAuChoix({ aujourdhui }: { aujourdhui: string }) {
  const [vue, setVue] = useState<Vue>('infos');
  return (
    <div>
      <div role="group" aria-label="Type de carte" className="mb-4 flex flex-wrap gap-3">
        {VUES.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={vue === v.id}
            onClick={() => setVue(v.id)}
            className={`min-w-64 flex-1 rounded-2xl border-2 px-4 py-3 text-left transition-colors ${vue === v.id ? 'border-primary bg-primary text-white' : 'border-primary/30 bg-primary/5 hover:bg-primary/10'}`}
          >
            <strong className="block text-lg leading-snug">{v.libelle}</strong>
            <span className={`block text-sm ${vue === v.id ? 'text-white/85' : 'text-muted'}`}>{v.aide}</span>
          </button>
        ))}
      </div>
      {vue === 'infos' ? <CartesInfo aujourdhui={aujourdhui} uneCarte /> : <CarteMeteo aujourdhui={aujourdhui} initial={null} />}
    </div>
  );
}
