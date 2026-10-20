'use client';

import { useEffect, useState } from 'react';
import type { ReponseBilans } from '@/lib/carte-meteo/cartes-info';

/** Bilans des stations (/api/carte-meteo/bilans/), lus une fois ; `reessayer` relance après une erreur. */
export function useBilans() {
  const [bilans, setBilans] = useState<ReponseBilans | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (bilans || erreur) return;
    const controleur = new AbortController();
    fetch('/api/carte-meteo/bilans/', { signal: controleur.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? 'Observations momentanément indisponibles.');
        return r.json() as Promise<ReponseBilans>;
      })
      .then(setBilans)
      .catch((e: Error) => e.name !== 'AbortError' && setErreur(e.message));
    return () => controleur.abort();
  }, [bilans, erreur]);

  return { bilans, erreur, reessayer: () => setErreur(null) };
}
