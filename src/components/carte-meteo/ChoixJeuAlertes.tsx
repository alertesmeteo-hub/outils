'use client';

import type { JeuAlertes } from '@/lib/carte-meteo/jeu-alertes';

const OPTIONS: { id: JeuAlertes; libelle: string; apercu: string }[] = [
  { id: 'alertes', libelle: 'Alertes Météo', apercu: '/pictos-alertes/eclaircies.svg?v=6' },
  { id: 'alertes-pro', libelle: 'Alertes-meteo-Pro', apercu: '/pictos-alertes-pro/eclaircies.svg?v=1' },
];

/** Choix bien visible du jeu de pictos (aperçu de chaque jeu), pour les planches, le tableau et les vidéos. */
export default function ChoixJeuAlertes({ jeu, onChange }: { jeu: JeuAlertes; onChange: (jeu: JeuAlertes) => void }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">Jeu de pictos</legend>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <label
            key={o.id}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-1 text-sm font-semibold ${jeu === o.id ? 'border-primary bg-primary/10' : 'border-border bg-surface'}`}
          >
            <input type="radio" name="jeu-pictos-alertes" checked={jeu === o.id} onChange={() => onChange(o.id)} className="sr-only" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={o.apercu} alt="" width={36} height={36} />
            {o.libelle}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
