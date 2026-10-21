'use client';

import { useEffect, useId, useState } from 'react';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { REGIONS_FR } from '@/lib/carte-meteo/regions-fr';
import { CODES_DEPARTEMENTS } from '@/lib/carte-meteo/previsions-modeles';

type Niveau = 'france' | 'region' | 'departement';
const selectBarre = 'rounded-lg border border-border bg-surface p-1.5 text-sm';

/**
 * Zone des cartes de stations (« france », « reg:<région> » ou « dep:<code> ») : en région ou en département, toutes les
 * stations trouvent leur place (sur la carte de France, un petit département comme les Pyrénées-Orientales n'en garde
 * que deux ou trois). Le choix est mémorisé dans le navigateur (`cle`).
 */
export function useZone(cle: string) {
  const [niveau, setNiveau] = useState<Niveau>('france');
  const [region, setRegion] = useState(REGIONS_FR[0]);
  const [departement, setDepartement] = useState('66');

  useEffect(() => {
    try {
      const memo = JSON.parse(localStorage.getItem(cle) ?? 'null') as { niveau?: Niveau; region?: string; departement?: string } | null;
      if (memo?.niveau) setNiveau(memo.niveau);
      if (memo?.region && REGIONS_FR.includes(memo.region)) setRegion(memo.region);
      if (memo?.departement && CODES_DEPARTEMENTS.includes(memo.departement)) setDepartement(memo.departement);
    } catch {
      // Stockage indisponible (navigation privée…) : France par défaut.
    }
  }, [cle]);
  useEffect(() => {
    try {
      localStorage.setItem(cle, JSON.stringify({ niveau, region, departement }));
    } catch {
      // Sans stockage, le choix vaut pour la visite.
    }
  }, [cle, niveau, region, departement]);

  const zone = niveau === 'france' ? 'france' : niveau === 'region' ? `reg:${region}` : `dep:${departement}`;
  /** Morceau du nom des fichiers exportés : « france », « pyrenees-orientales »… */
  const nomFichier = (niveau === 'france' ? 'france' : niveau === 'region' ? region : DEPARTEMENTS_FR[departement] ?? departement)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return { zone, nomFichier, niveau, setNiveau, region, setRegion, departement, setDepartement };
}

/** Choix de la zone : France, une région ou un département. */
export default function ChoixZone({ etat }: { etat: ReturnType<typeof useZone> }) {
  const nom = useId();
  const { niveau, setNiveau, region, setRegion, departement, setDepartement } = etat;
  return (
    <fieldset className="text-sm font-medium">
      <legend className="mb-1 block">Zone</legend>
      <div className="flex flex-wrap items-center gap-3">
        {(
          [
            ['france', 'France'],
            ['region', 'Région'],
            ['departement', 'Département'],
          ] as const
        ).map(([valeur, libelle]) => (
          <label key={valeur} className="font-normal">
            <input type="radio" name={nom} checked={niveau === valeur} onChange={() => setNiveau(valeur)} className="mr-1.5" />
            {libelle}
          </label>
        ))}
        {niveau === 'region' && (
          <select value={region} onChange={(e) => setRegion(e.target.value)} className={selectBarre} aria-label="Région">
            {REGIONS_FR.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
        {niveau === 'departement' && (
          <select value={departement} onChange={(e) => setDepartement(e.target.value)} className={selectBarre} aria-label="Département">
            {CODES_DEPARTEMENTS.map((code) => (
              <option key={code} value={code}>
                {code} — {DEPARTEMENTS_FR[code]}
              </option>
            ))}
          </select>
        )}
      </div>
    </fieldset>
  );
}
