'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { normalize, type SearchItem } from '@/lib/tools/registry';

export default function SearchBox({ items, autoFocus = false }: { items: SearchItem[]; autoFocus?: boolean }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const terms = normalize(q).split(/\s+/).filter(Boolean);
    return terms.length ? items.filter((i) => terms.every((t) => i.haystack.includes(t))) : [];
  }, [q, items]);

  return (
    <div role="search" className="relative">
      <label htmlFor="q" className="mb-2 block text-lg font-bold">Quel outil recherchez-vous ?</label>
      <input
        id="q" type="search" className="input !min-h-[52px] !text-lg" placeholder="pluie, vent, grêle, assurance, gel, température…"
        value={q} onChange={(e) => setQ(e.target.value)} autoFocus={autoFocus} autoComplete="off"
        aria-controls="search-results" aria-describedby="search-count"
      />
      <p id="search-count" role="status" className="sr-only">{q ? `${results.length} outil(s) trouvé(s)` : ''}</p>
      {q && (
        <ul id="search-results" className="card mt-2 divide-y divide-border overflow-hidden">
          {results.length === 0 && <li className="p-4 text-muted">Aucun outil ne correspond à « {q} ».</li>}
          {results.map((r) => (
            <li key={r.slug}>
              <Link href={r.href} className="flex gap-3 p-4 hover:bg-bg">
                <span aria-hidden className="text-2xl">{r.icon}</span>
                <span><strong className="block">{r.name}</strong><span className="text-sm text-muted">{r.description}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
