'use client';

import { useState, type ReactNode } from 'react';
import type { Rect } from '@/lib/carte-meteo/placement';
import { HAUTEUR_CARTE } from './CarteRendu';
import type { CarteTexte, FormatTexte } from '@/lib/carte-meteo/texte-ia';

/** Hauteur de ligne et largeur moyenne d'un caractère (px de la carte) du texte posé sur l'image. */
const LIGNE = 20;
const CARACTERE = 7.6;
const MAX_LIGNES = 6;

/**
 * Texte d'accompagnement rédigé par l'IA, à la demande : un bouton à côté de l'export, un panneau sous la carte (texte
 * modifiable, copier, court / long) et, en option, le texte posé sur l'image dans `zone` (pixels de la carte).
 */
export function useTexteIA(construire: () => CarteTexte | null, zone: { x: number; largeur: number }) {
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState('');
  const [format, setFormat] = useState<FormatTexte>('court');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [surImage, setSurImage] = useState(false);
  const [copie, setCopie] = useState(false);

  async function generer(f: FormatTexte = format) {
    const carte = construire();
    if (!carte) {
      setErreur('Pas de donnée sur cette carte.');
      return;
    }
    setEnCours(true);
    setErreur(null);
    try {
      const r = await fetch('/api/carte-meteo/texte/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: f, carte }),
      });
      const json = (await r.json().catch(() => null)) as { texte?: string; erreur?: string } | null;
      if (!r.ok || !json?.texte) throw new Error(json?.erreur ?? 'Service IA momentanément indisponible.');
      setTexte(json.texte);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Service IA momentanément indisponible.');
    } finally {
      setEnCours(false);
    }
  }

  // Texte sur l'image : en bas, au-dessus de l'adresse du site, sur autant de lignes que nécessaire (6 au plus).
  const lignes = Math.min(MAX_LIGNES, Math.max(1, Math.ceil(texte.length / (zone.largeur / CARACTERE))));
  const hauteur = lignes * LIGNE + 14;
  const rect: Rect | null = surImage && texte ? { x: zone.x, y: HAUTEUR_CARTE - 38 - hauteur, w: zone.largeur, h: hauteur } : null;

  const calque: ReactNode = rect && (
    <div className="cinfo-texte-ia" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, WebkitLineClamp: MAX_LIGNES }}>
      {texte}
    </div>
  );

  const bouton = (
    <button
      type="button"
      onClick={() => {
        setOuvert(true);
        if (!texte && !enCours) void generer();
      }}
      disabled={enCours}
      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-60"
      title="Rédiger un texte pour accompagner cette carte (IA)"
    >
      {enCours ? 'Rédaction…' : '✨ Texte IA'}
    </button>
  );

  const panneau = ouvert && (
    <div className="mt-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-semibold">Texte IA</span>
        <label>
          <select
            value={format}
            onChange={(e) => {
              const f = e.target.value as FormatTexte;
              setFormat(f);
              void generer(f);
            }}
            disabled={enCours}
            className="rounded-md border border-border bg-surface p-1 text-sm"
            aria-label="Format du texte"
          >
            <option value="court">Court (réseaux sociaux)</option>
            <option value="long">Long (article)</option>
          </select>
        </label>
        <button type="button" onClick={() => void generer()} disabled={enCours} className="btn-ghost rounded-md px-2 py-1 text-xs">
          {enCours ? 'Rédaction…' : 'Nouvelle version'}
        </button>
        <button
          type="button"
          disabled={!texte}
          onClick={() => {
            void navigator.clipboard?.writeText(texte).then(() => {
              setCopie(true);
              setTimeout(() => setCopie(false), 1500);
            });
          }}
          className="btn-ghost rounded-md px-2 py-1 text-xs"
        >
          {copie ? 'Copié ✓' : 'Copier'}
        </button>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={surImage} onChange={(e) => setSurImage(e.target.checked)} disabled={!texte} />
          Afficher sur l&apos;image
        </label>
        <button type="button" onClick={() => setOuvert(false)} className="ml-auto text-xs text-muted" aria-label="Fermer le texte IA">
          Fermer
        </button>
      </div>
      {erreur && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {erreur}
        </p>
      )}
      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        rows={format === 'long' ? 8 : 4}
        placeholder={enCours ? 'Rédaction en cours…' : 'Le texte apparaîtra ici ; il reste modifiable.'}
        className="mt-2 w-full rounded-lg border border-border bg-surface p-2 text-sm"
      />
      <p className="text-xs text-muted">Texte rédigé par une IA (Claude) à partir des valeurs de la carte : relisez-le avant de le publier.</p>
    </div>
  );

  return { bouton, panneau, calque, rect };
}
