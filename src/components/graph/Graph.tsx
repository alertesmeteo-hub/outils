'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Cadre, { POLICE, type Chiffre } from '@/components/nuits-tropicales/Cadre';
import { exporterEnJpg } from '@/lib/carte-meteo/ExportJpg';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import type { DonneesGraph, JourGraph, ReponseGraph, ZoneGraph } from '@/lib/graph/types';

/**
 * Module Graph : graphiques de température et de pluie pour la France, une région ou un département, avec l'indicateur thermique
 * national (ITN) estimé. Les courbes sont dessinées en SVG (aucune bibliothèque) dans le cadre 1280 × 720 des autres images exportables.
 */

const JOUR_MS = 86_400_000;
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const ROUGE = '#dc2626';
const BLEU = '#2563eb';
const VERT_PLUIE = '#0d9488';

type Type = 'tm' | 'ecart' | 'maxmin' | 'mensuel' | 'pluie' | 'pluie-mois';
type Periode = '30' | '90' | 'annee' | '365';

const TYPES: { id: Type; libelle: string; aide: string }[] = [
  { id: 'tm', libelle: '🌡️ Température moyenne et normale', aide: 'Température moyenne quotidienne ((maxi + mini) / 2) et normale 1991-2020.' },
  { id: 'ecart', libelle: '📊 Écart quotidien à la normale', aide: 'Chaque jour, de combien de degrés la température moyenne s’écarte de la normale, avec la moyenne glissante sur 7 jours.' },
  { id: 'maxmin', libelle: '↕️ Maxi et mini quotidiens', aide: 'Maximales et minimales du jour, avec leurs normales (pointillés).' },
  { id: 'mensuel', libelle: '🗓️ Écart mensuel à la normale', aide: 'Écart de la température moyenne de chaque mois (mois avec au moins 25 jours de relevés).' },
  { id: 'pluie', libelle: '🌧️ Pluie quotidienne', aide: 'Cumul de pluie de chaque jour (moyenne des stations) et cumul de la période comparé à la normale.' },
  { id: 'pluie-mois', libelle: '☔ Pluie mensuelle / normale', aide: 'Cumul de chaque mois, en pourcentage de la normale 1991-2020 (mois avec au moins 25 jours de relevés).' },
];
const PERIODES: { id: Periode; libelle: string }[] = [
  { id: '30', libelle: '30 derniers jours' },
  { id: '90', libelle: '90 derniers jours' },
  { id: 'annee', libelle: 'Depuis le 1er janvier' },
  { id: '365', libelle: '12 derniers mois' },
];

const t0 = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const isoDe = (t: number) => new Date(t).toISOString().slice(0, 10);
const jourMois = (iso: string) => `${Number(iso.slice(8, 10))} ${MOIS_COURT[Number(iso.slice(5, 7)) - 1]}`;
const jourMoisAnnee = (iso: string) => `${jourMois(iso)} ${iso.slice(0, 4)}`;
const fr = (x: number, d = 1) => x.toFixed(d).replace('.', ',').replace('-', '−');
const signe = (x: number, d = 1) => `${x > 0 ? '+' : ''}${fr(x, d)}`;
const tmDe = (j: JourGraph) => (j.tx != null && j.tn != null ? (j.tx + j.tn) / 2 : null);
const joursDuMois = (annee: number, mois: number) => new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate();

/** Normale d'un jour : interpolation linéaire entre les normales mensuelles, placées au milieu de chaque mois. */
function normaleJour(normales: (number | null)[], iso: string): number | null {
  const annee = Number(iso.slice(0, 4));
  const mois = Number(iso.slice(5, 7)) - 1;
  const jour = Number(iso.slice(8, 10));
  const nb = joursDuMois(annee, mois);
  const position = jour - (nb + 1) / 2;
  const voisin = position >= 0 ? (mois + 1) % 12 : (mois + 11) % 12;
  const nbVoisin = joursDuMois(annee, position >= 0 ? mois + 1 : mois - 1);
  const part = Math.abs(position) / ((nb + nbVoisin) / 2);
  const a = normales[mois];
  const b = normales[voisin];
  if (a == null || b == null) return a ?? b;
  return a + (b - a) * part;
}
const normaleTm = (z: ZoneGraph, iso: string) => {
  const x = normaleJour(z.normales.tx, iso);
  const n = normaleJour(z.normales.tn, iso);
  return x != null && n != null ? (x + n) / 2 : null;
};

/** Graduations « rondes » entre mini et maxi. */
function graduations(mini: number, maxi: number, cible = 6): number[] {
  const etendue = Math.max(maxi - mini, 1e-6);
  const brut = etendue / cible;
  const p = 10 ** Math.floor(Math.log10(brut));
  const r = brut / p;
  const pas = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p;
  const liste: number[] = [];
  for (let v = Math.ceil(mini / pas) * pas; v <= maxi + 1e-9; v += pas) liste.push(Math.round(v / pas) * pas);
  return liste;
}

interface Serie {
  id: string;
  /** Points (jour, valeur) ; les trous (jours manquants) coupent la ligne. */
  points: { t: number; v: number | null }[];
  couleur: string;
  type: 'ligne' | 'barres' | 'pointille';
  /** Barres : couleur selon le signe. */
  signee?: boolean;
  epaisseur?: number;
}

interface Dessin {
  series: Serie[];
  unite: string;
  /** Zéro toujours visible (écarts, pluie). */
  zero: boolean;
  /** Axe horizontal : début, fin (ms). */
  debut: number;
  fin: number;
  /** Barres mensuelles : largeur d'une barre en jours. */
  largeurBarre: number;
  etiquettesMois: boolean;
  decimales: number;
  /** Texte de l'info-bulle d'un point. */
  info: (serie: string, t: number, v: number) => string;
  legende: { couleur: string; libelle: string; pointille?: boolean }[];
}

function Trace({ dessin, l, h }: { dessin: Dessin; l: number; h: number }) {
  const MG = 56;
  const MD = 16;
  const MH = 8;
  const MB = 34;
  const L = l - MG - MD;
  const H = h - MH - MB;
  const valeurs = dessin.series.flatMap((s) => s.points.map((p) => p.v).filter((v): v is number => v != null));
  if (!valeurs.length || L <= 0 || H <= 0) return <text x={l / 2} y={h / 2} textAnchor="middle" fontSize={18} fill="#475569">Pas de donnée sur cette période.</text>;
  let mini = Math.min(...valeurs);
  let maxi = Math.max(...valeurs);
  if (dessin.zero) {
    mini = Math.min(mini, 0);
    maxi = Math.max(maxi, 0);
  }
  const marge = (maxi - mini || 1) * 0.08;
  maxi += marge;
  if (!dessin.zero || mini < 0) mini -= marge;
  const duree = Math.max(dessin.fin - dessin.debut, JOUR_MS);
  const X = (t: number) => MG + ((t - dessin.debut) / duree) * L;
  const Y = (v: number) => MH + (1 - (v - mini) / (maxi - mini)) * H;
  const yZero = Y(0);
  const lb = Math.max(2, (dessin.largeurBarre * JOUR_MS * L) / duree - 1.5);

  // Repères horizontaux : un par mois (ou tous les 5 à 10 jours sur les périodes courtes).
  const reperes: { t: number; texte: string }[] = [];
  const jours = duree / JOUR_MS;
  if (dessin.etiquettesMois || jours > 100) {
    const d = new Date(dessin.debut);
    let a = d.getUTCFullYear();
    let m = d.getUTCMonth();
    const pas = jours > 450 ? 2 : 1;
    for (;;) {
      const t = Date.UTC(a, m, 1);
      if (t > dessin.fin) break;
      if (t >= dessin.debut) reperes.push({ t, texte: m === 0 || reperes.length === 0 ? `${MOIS_COURT[m]} ${a}` : MOIS_COURT[m] });
      m += pas;
      if (m > 11) { a += Math.floor(m / 12); m %= 12; }
    }
  } else {
    const pas = jours <= 35 ? 5 : 10;
    for (let t = dessin.debut; t <= dessin.fin; t += pas * JOUR_MS) reperes.push({ t, texte: jourMois(isoDe(t)) });
  }

  return (
    <g fontFamily={POLICE}>
      {graduations(mini, maxi).map((v) => (
        <g key={v}>
          <line x1={MG} x2={MG + L} y1={Y(v)} y2={Y(v)} stroke={v === 0 && dessin.zero ? '#64748b' : '#e2e8f0'} strokeWidth={v === 0 && dessin.zero ? 1.5 : 1} />
          <text x={MG - 8} y={Y(v) + 4} textAnchor="end" fontSize={13} fill="#475569">{fr(v, dessin.decimales === 0 ? 0 : v % 1 === 0 ? 0 : 1)}</text>
        </g>
      ))}
      <text x={14} y={MH + H / 2} fontSize={13} fill="#475569" textAnchor="middle" transform={`rotate(-90 14 ${MH + H / 2})`}>{dessin.unite}</text>
      {reperes.map((r) => (
        <g key={r.t}>
          <line x1={X(r.t)} x2={X(r.t)} y1={MH + H} y2={MH + H + 5} stroke="#94a3b8" />
          <text x={X(r.t)} y={MH + H + 20} textAnchor="middle" fontSize={12.5} fill="#475569">{r.texte}</text>
        </g>
      ))}
      {dessin.series.map((s) => {
        if (s.type === 'barres') {
          return (
            <g key={s.id}>
              {s.points.map((p) =>
                p.v == null ? null : (
                  <rect key={p.t} x={X(p.t) - lb / 2} y={Math.min(Y(p.v), yZero)} width={lb} height={Math.max(1, Math.abs(Y(p.v) - yZero))} fill={s.signee ? (p.v >= 0 ? ROUGE : BLEU) : s.couleur} opacity={0.9}>
                    <title>{dessin.info(s.id, p.t, p.v)}</title>
                  </rect>
                ),
              )}
            </g>
          );
        }
        // Ligne : coupée à chaque trou de plus d'un jour.
        const morceaux: string[] = [];
        let courant = '';
        let precedent: number | null = null;
        for (const p of s.points) {
          if (p.v == null) {
            if (courant) morceaux.push(courant);
            courant = '';
            precedent = null;
            continue;
          }
          if (precedent != null && p.t - precedent > 1.5 * JOUR_MS * Math.max(1, dessin.largeurBarre)) {
            if (courant) morceaux.push(courant);
            courant = '';
          }
          courant += `${courant ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`;
          precedent = p.t;
        }
        if (courant) morceaux.push(courant);
        return (
          <g key={s.id}>
            {morceaux.map((d, i) => (
              <path key={i} d={d} fill="none" stroke={s.couleur} strokeWidth={s.epaisseur ?? 2.4} strokeDasharray={s.type === 'pointille' ? '6 5' : undefined} strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </g>
        );
      })}
      <line x1={MG} x2={MG + L} y1={MH + H} y2={MH + H} stroke="#94a3b8" />
      {/* Légende */}
      <g transform={`translate(${MG + 8} ${MH + 6})`}>
        {dessin.legende.map((e, i) => (
          <g key={e.libelle} transform={`translate(${i * 190} 0)`}>
            <line x1={0} x2={26} y1={8} y2={8} stroke={e.couleur} strokeWidth={e.pointille ? 2.4 : 5} strokeDasharray={e.pointille ? '6 4' : undefined} />
            <text x={32} y={12.5} fontSize={13} fill="#334155">{e.libelle}</text>
          </g>
        ))}
      </g>
    </g>
  );
}

const moyenne = (l: (number | null)[]) => {
  const v = l.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export default function Graph() {
  const [reponse, setReponse] = useState<ReponseGraph | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [zone, setZone] = useState('FR');
  const [type, setType] = useState<Type>('tm');
  const [periode, setPeriode] = useState<Periode>('90');
  const [message, setMessage] = useState<string | null>(null);
  const noeud = useRef<HTMLDivElement>(null);

  // Lecture des données ; tant que le premier calcul n'est pas fini (202), on redemande toutes les 5 s.
  useEffect(() => {
    let annule = false;
    let minuteur: ReturnType<typeof setTimeout>;
    const lire = async () => {
      try {
        const r = await fetch('/api/graph/', { cache: 'no-store' });
        const j = (await r.json()) as ReponseGraph;
        if (annule) return;
        setReponse(j);
        setErreur(null);
        if (j.etat === 'calcul') minuteur = setTimeout(lire, 5000);
      } catch {
        if (!annule) {
          setErreur('Les données ne répondent pas pour le moment.');
          minuteur = setTimeout(lire, 15000);
        }
      }
    };
    void lire();
    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, []);

  const donnees: DonneesGraph | null = reponse?.etat === 'pret' ? reponse.donnees : null;
  const z = donnees?.zones[zone] ?? null;

  const choixZones = useMemo(() => {
    if (!donnees) return { regions: [] as { cle: string; nom: string }[], departements: [] as { cle: string; nom: string }[] };
    const regions = Object.keys(donnees.zones).filter((k) => k.startsWith('reg:')).map((k) => ({ cle: k, nom: k.slice(4) })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const departements = Object.keys(donnees.zones)
      .filter((k) => k.startsWith('dep:'))
      .map((k) => ({ cle: k, nom: `${k.slice(4)} · ${k === 'dep:20' ? 'Corse (2A et 2B)' : DEPARTEMENTS_FR[k.slice(4)] ?? k.slice(4)}` }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
    return { regions, departements };
  }, [donnees]);

  const nomZone = zone === 'FR' ? 'France' : zone.startsWith('reg:') ? zone.slice(4) : choixZones.departements.find((d) => d.cle === zone)?.nom.split(' · ')[1] ?? zone;

  const vue = useMemo(() => {
    if (!donnees || !z) return null;
    const fin = t0(donnees.derniereDate);
    const debutAnnee = Date.UTC(new Date(fin).getUTCFullYear(), 0, 1);
    const debut = type === 'mensuel' || type === 'pluie-mois' ? Date.UTC(new Date(fin - 540 * JOUR_MS).getUTCFullYear(), new Date(fin - 540 * JOUR_MS).getUTCMonth(), 1) : periode === '30' ? fin - 29 * JOUR_MS : periode === '90' ? fin - 89 * JOUR_MS : periode === 'annee' ? debutAnnee : fin - 364 * JOUR_MS;
    const jours = z.jours.filter((j) => t0(j.d) >= debut && t0(j.d) <= fin);
    return { debut, fin, jours };
  }, [donnees, z, type, periode]);

  // Mois complets (au moins 25 jours de relevés) : écart de température et pluie.
  const mois = useMemo(() => {
    if (!z) return [];
    const parMois = new Map<string, JourGraph[]>();
    for (const j of z.jours) {
      const k = j.d.slice(0, 7);
      parMois.set(k, [...(parMois.get(k) ?? []), j]);
    }
    return [...parMois.entries()]
      .map(([k, l]) => {
        const m = Number(k.slice(5, 7)) - 1;
        const tm = moyenne(l.map(tmDe));
        const nx = z.normales.tx[m];
        const nn = z.normales.tn[m];
        const pluie = l.reduce((s, j) => s + (j.rr ?? 0), 0);
        return { cle: k, annee: Number(k.slice(0, 4)), m, n: l.length, complet: l.length >= 25, ecart: tm != null && nx != null && nn != null ? tm - (nx + nn) / 2 : null, tm, pluie, normalePluie: z.normales.rr[m], pct: z.normales.rr[m] ? (pluie / (z.normales.rr[m] as number)) * 100 : null };
      })
      .filter((x) => x.complet);
  }, [z]);

  const analyse = useMemo(() => {
    if (!donnees || !z || !vue) return null;
    const { debut, fin, jours } = vue;
    const trou = (() => {
      // Plus long trou (jours sans relevé) entre deux jours affichés.
      let pire: { de: string; a: string; n: number } | null = null;
      for (let i = 1; i < jours.length; i++) {
        const n = Math.round((t0(jours[i].d) - t0(jours[i - 1].d)) / JOUR_MS) - 1;
        if (n >= 5 && (!pire || n > pire.n)) pire = { de: isoDe(t0(jours[i - 1].d) + JOUR_MS), a: isoDe(t0(jours[i].d) - JOUR_MS), n };
      }
      return pire;
    })();
    let dessin: Dessin;
    let chiffres: Chiffre[] = [];
    let titre = '';
    let sousTitre = '';
    let surtitre = zone === 'FR' ? 'INDICATEUR THERMIQUE NATIONAL (ESTIMÉ)' : `TEMPÉRATURES · ${nomZone.toUpperCase()}`;
    const periodeTexte = type === 'mensuel' || type === 'pluie-mois' ? '' : `du ${jourMoisAnnee(isoDe(debut))} au ${jourMoisAnnee(isoDe(fin))}`;
    const info = (nom: string, t: number, v: number) => `${jourMoisAnnee(isoDe(t))} : ${nom} ${fr(v)}`;
    const norm = (iso: string) => normaleTm(z, iso);

    if (type === 'tm' || type === 'ecart') {
      const tm = jours.map((j) => ({ t: t0(j.d), iso: j.d, v: tmDe(j), n: norm(j.d) }));
      const ecartMoy = moyenne(tm.map((p) => (p.v != null && p.n != null ? p.v - p.n : null)));
      const moyTm = moyenne(tm.map((p) => p.v));
      const moyN = moyenne(tm.map((p) => (p.v != null ? p.n : null)));
      const chaud = tm.reduce<(typeof tm)[number] | null>((m, p) => (p.v != null && (!m || (m.v ?? -99) < p.v) ? p : m), null);
      const froid = tm.reduce<(typeof tm)[number] | null>((m, p) => (p.v != null && (!m || (m.v ?? 99) > p.v) ? p : m), null);
      chiffres = [
        ...(moyTm != null ? [{ libelle: 'Moyenne', valeur: `${fr(moyTm)}°`, detail: moyN != null ? `normale ${fr(moyN)}°` : undefined, couleur: '#0b2e59' }] : []),
        ...(ecartMoy != null ? [{ libelle: 'Écart', valeur: `${signe(ecartMoy)}°`, detail: 'à la normale', couleur: ecartMoy >= 0 ? ROUGE : BLEU }] : []),
      ];
      if (type === 'tm') {
        titre = zone === 'FR' ? 'Température moyenne en France' : `Température moyenne · ${nomZone}`;
        dessin = {
          series: [
            { id: 'normale', points: tm.map((p) => ({ t: p.t, v: p.n })), couleur: '#64748b', type: 'pointille', epaisseur: 2.2 },
            { id: 'tm', points: tm.map((p) => ({ t: p.t, v: p.v })), couleur: '#c2410c', type: 'ligne', epaisseur: 2.8 },
          ],
          unite: '°C', zero: false, debut, fin, largeurBarre: 1, etiquettesMois: false, decimales: 1,
          info: (s, t, v) => info(s === 'tm' ? 'température moyenne' : 'normale', t, v),
          legende: [{ couleur: '#c2410c', libelle: 'Température moyenne' }, { couleur: '#64748b', libelle: 'Normale 1991-2020', pointille: true }],
        };
        sousTitre = `Moyenne quotidienne (maxi + mini) / 2 · ${periodeTexte}`;
        if (chaud?.v != null && froid?.v != null) chiffres.push({ libelle: 'Jour le plus chaud', valeur: `${fr(chaud.v)}°`, detail: jourMois(chaud.iso), couleur: '#c2410c' }, { libelle: 'Le plus froid', valeur: `${fr(froid.v)}°`, detail: jourMois(froid.iso), couleur: BLEU });
      } else {
        const ecarts = tm.map((p) => ({ t: p.t, v: p.v != null && p.n != null ? p.v - p.n : null }));
        const glissante = ecarts.map((p, i) => {
          const f = ecarts.slice(Math.max(0, i - 6), i + 1).filter((x) => x.v != null && p.t - x.t < 7 * JOUR_MS);
          return { t: p.t, v: f.length >= 4 ? moyenne(f.map((x) => x.v)) : null };
        });
        titre = zone === 'FR' ? 'Écart à la normale en France' : `Écart à la normale · ${nomZone}`;
        dessin = {
          series: [
            { id: 'ecart', points: ecarts, couleur: ROUGE, type: 'barres', signee: true },
            { id: 'glissante', points: glissante, couleur: '#0f172a', type: 'ligne', epaisseur: 2.6 },
          ],
          unite: '°C d’écart à la normale', zero: true, debut, fin, largeurBarre: 1, etiquettesMois: false, decimales: 1,
          info: (s, t, v) => `${jourMoisAnnee(isoDe(t))} : ${signe(v)} °C${s === 'glissante' ? ' (moyenne sur 7 jours)' : ''}`,
          legende: [{ couleur: ROUGE, libelle: 'Plus chaud que la normale' }, { couleur: BLEU, libelle: 'Plus froid' }, { couleur: '#0f172a', libelle: 'Moyenne sur 7 jours' }],
        };
        sousTitre = `Température moyenne moins la normale 1991-2020 · ${periodeTexte}`;
        const chauds = ecarts.filter((e) => (e.v ?? 0) > 0).length;
        const valides = ecarts.filter((e) => e.v != null).length;
        if (valides) chiffres.push({ libelle: 'Jours au-dessus', valeur: `${chauds} / ${valides}`, detail: 'de la normale', couleur: ROUGE });
      }
    } else if (type === 'maxmin') {
      const tx = jours.map((j) => ({ t: t0(j.d), v: j.tx }));
      const tn = jours.map((j) => ({ t: t0(j.d), v: j.tn }));
      const mx = moyenne(tx.map((p) => p.v));
      const mn = moyenne(tn.map((p) => p.v));
      const nx = moyenne(jours.map((j) => normaleJour(z.normales.tx, j.d)));
      const nn = moyenne(jours.map((j) => normaleJour(z.normales.tn, j.d)));
      titre = zone === 'FR' ? 'Maximales et minimales en France' : `Maximales et minimales · ${nomZone}`;
      dessin = {
        series: [
          { id: 'nx', points: jours.map((j) => ({ t: t0(j.d), v: normaleJour(z.normales.tx, j.d) })), couleur: '#fca5a5', type: 'pointille', epaisseur: 2 },
          { id: 'nn', points: jours.map((j) => ({ t: t0(j.d), v: normaleJour(z.normales.tn, j.d) })), couleur: '#93c5fd', type: 'pointille', epaisseur: 2 },
          { id: 'tx', points: tx, couleur: ROUGE, type: 'ligne' },
          { id: 'tn', points: tn, couleur: BLEU, type: 'ligne' },
        ],
        unite: '°C', zero: false, debut, fin, largeurBarre: 1, etiquettesMois: false, decimales: 1,
        info: (s, t, v) => info(s === 'tx' ? 'maximale' : s === 'tn' ? 'minimale' : s === 'nx' ? 'normale des maximales' : 'normale des minimales', t, v),
        legende: [{ couleur: ROUGE, libelle: 'Maximale' }, { couleur: BLEU, libelle: 'Minimale' }, { couleur: '#fca5a5', libelle: 'Normales', pointille: true }],
      };
      sousTitre = `Moyenne des stations · ${periodeTexte}`;
      chiffres = [
        ...(mx != null ? [{ libelle: 'Maxi moyenne', valeur: `${fr(mx)}°`, detail: nx != null ? `normale ${fr(nx)}°` : undefined, couleur: ROUGE }] : []),
        ...(mn != null ? [{ libelle: 'Mini moyenne', valeur: `${fr(mn)}°`, detail: nn != null ? `normale ${fr(nn)}°` : undefined, couleur: BLEU }] : []),
      ];
    } else if (type === 'mensuel') {
      surtitre = zone === 'FR' ? 'INDICATEUR THERMIQUE NATIONAL (ESTIMÉ)' : `TEMPÉRATURES · ${nomZone.toUpperCase()}`;
      const liste = mois.filter((x) => Date.UTC(x.annee, x.m, 1) >= debut);
      titre = zone === 'FR' ? 'Écart mensuel à la normale en France' : `Écart mensuel à la normale · ${nomZone}`;
      sousTitre = 'Température moyenne du mois moins la normale 1991-2020 · mois avec au moins 25 jours de relevés';
      dessin = {
        series: [{ id: 'mois', points: liste.map((x) => ({ t: Date.UTC(x.annee, x.m, 15), v: x.ecart })), couleur: ROUGE, type: 'barres', signee: true }],
        unite: '°C d’écart à la normale', zero: true, debut, fin: Date.UTC(new Date(fin).getUTCFullYear(), new Date(fin).getUTCMonth() + 1, 0), largeurBarre: 22, etiquettesMois: true, decimales: 1,
        info: (_s, t, v) => `${MOIS[new Date(t).getUTCMonth()]} ${new Date(t).getUTCFullYear()} : ${signe(v)} °C`,
        legende: [{ couleur: ROUGE, libelle: 'Plus chaud que la normale' }, { couleur: BLEU, libelle: 'Plus froid' }],
      };
      const dernier = liste[liste.length - 1];
      if (dernier?.ecart != null) chiffres.push({ libelle: `${MOIS[dernier.m]} ${dernier.annee}`, valeur: `${signe(dernier.ecart)}°`, detail: 'à la normale', couleur: dernier.ecart >= 0 ? ROUGE : BLEU });
      const chauds = liste.filter((x) => (x.ecart ?? 0) > 0).length;
      if (liste.length) chiffres.push({ libelle: 'Mois plus chauds', valeur: `${chauds} / ${liste.length}`, detail: 'que la normale', couleur: ROUGE });
    } else if (type === 'pluie') {
      surtitre = `PLUIE · ${nomZone.toUpperCase()}`;
      const rr = jours.map((j) => ({ t: t0(j.d), v: j.rr }));
      const total = rr.reduce((s, p) => s + (p.v ?? 0), 0);
      const normale = jours.reduce((s, j) => s + (normaleJour(z.normales.rr, j.d) ?? 0) / joursDuMois(Number(j.d.slice(0, 4)), Number(j.d.slice(5, 7)) - 1), 0);
      titre = zone === 'FR' ? 'Pluie quotidienne en France' : `Pluie quotidienne · ${nomZone}`;
      sousTitre = `Moyenne des stations · ${periodeTexte}`;
      dessin = {
        series: [{ id: 'rr', points: rr, couleur: VERT_PLUIE, type: 'barres' }],
        unite: 'mm', zero: true, debut, fin, largeurBarre: 1, etiquettesMois: false, decimales: 0,
        info: (_s, t, v) => `${jourMoisAnnee(isoDe(t))} : ${fr(v)} mm`,
        legende: [{ couleur: VERT_PLUIE, libelle: 'Pluie du jour (mm)' }],
      };
      chiffres = [{ libelle: 'Cumul', valeur: `${Math.round(total)} mm`, detail: `normale ${Math.round(normale)} mm`, couleur: VERT_PLUIE }];
      if (normale > 0) chiffres.push({ libelle: 'Rapport', valeur: `${Math.round((total / normale) * 100)} %`, detail: 'de la normale', couleur: total >= normale ? '#0f766e' : '#b45309' });
    } else {
      surtitre = `PLUIE · ${nomZone.toUpperCase()}`;
      const liste = mois.filter((x) => Date.UTC(x.annee, x.m, 1) >= debut && x.pct != null);
      titre = zone === 'FR' ? 'Pluie mensuelle en France' : `Pluie mensuelle · ${nomZone}`;
      sousTitre = 'Cumul du mois en % de la normale 1991-2020 · mois avec au moins 25 jours de relevés';
      dessin = {
        series: [{ id: 'pluie-mois', points: liste.map((x) => ({ t: Date.UTC(x.annee, x.m, 15), v: x.pct })), couleur: VERT_PLUIE, type: 'barres' }, { id: 'cent', points: [{ t: debut, v: 100 }, { t: Date.UTC(new Date(fin).getUTCFullYear(), new Date(fin).getUTCMonth() + 1, 0), v: 100 }], couleur: '#0f172a', type: 'pointille', epaisseur: 1.8 }],
        unite: '% de la normale', zero: true, debut, fin: Date.UTC(new Date(fin).getUTCFullYear(), new Date(fin).getUTCMonth() + 1, 0), largeurBarre: 22, etiquettesMois: true, decimales: 0,
        info: (s, t, v) => `${MOIS[new Date(t).getUTCMonth()]} ${new Date(t).getUTCFullYear()} : ${Math.round(v)} % de la normale${s === 'cent' ? '' : ''}`,
        legende: [{ couleur: VERT_PLUIE, libelle: 'Cumul du mois' }, { couleur: '#0f172a', libelle: 'Normale (100 %)', pointille: true }],
      };
      const dernier = liste[liste.length - 1];
      if (dernier?.pct != null) chiffres.push({ libelle: `${MOIS[dernier.m]} ${dernier.annee}`, valeur: `${Math.round(dernier.pct)} %`, detail: `${Math.round(dernier.pluie)} mm`, couleur: VERT_PLUIE });
    }
    return { dessin, chiffres, titre, sousTitre, surtitre, trou };
  }, [donnees, z, vue, type, zone, nomZone, mois]);

  const exporter = async () => {
    if (!noeud.current) return;
    setMessage('Export en cours…');
    try {
      await exporterEnJpg(noeud.current, `graph-${zone.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${type}`, noeud.current.offsetWidth, noeud.current.offsetHeight);
      setMessage(null);
    } catch {
      setMessage('L’export a échoué : réessayez dans un instant.');
    }
  };

  const select = 'rounded-lg border border-border bg-surface px-3 py-2 text-sm';
  const periodeUtile = type !== 'mensuel' && type !== 'pluie-mois';

  if (!reponse && !erreur) return <p className="mt-6 text-sm text-muted">Chargement des données…</p>;
  if (erreur && !donnees) return <p role="alert" className="mt-6 text-sm text-danger">{erreur}</p>;
  if (!donnees) {
    return (
      <div className="mt-6 max-w-xl rounded-lg border border-border bg-surface p-4 text-sm" aria-live="polite">
        <strong className="block">Calcul des séries en cours…</strong>
        <span className="text-muted">
          Première utilisation : le serveur lit les fichiers de Météo-France (environ 100 départements). Cela prend quelques minutes, la page se met à jour toute seule. {reponse?.etat === 'calcul' ? `(${reponse.avancement})` : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">
          <span className="mb-1 block">Zone</span>
          <select value={zone} onChange={(e) => setZone(e.target.value)} className={select} aria-label="Zone">
            <option value="FR">🇫🇷 France (ITN estimé)</option>
            <optgroup label="Régions">
              {choixZones.regions.map((r) => (
                <option key={r.cle} value={r.cle}>{r.nom}</option>
              ))}
            </optgroup>
            <optgroup label="Départements">
              {choixZones.departements.map((d) => (
                <option key={d.cle} value={d.cle}>{d.nom}</option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className="text-sm font-medium">
          <span className="mb-1 block">Graphique</span>
          <select value={type} onChange={(e) => setType(e.target.value as Type)} className={select} aria-label="Graphique">
            {TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.libelle}</option>
            ))}
          </select>
        </label>
        {periodeUtile && (
          <label className="text-sm font-medium">
            <span className="mb-1 block">Période</span>
            <select value={periode} onChange={(e) => setPeriode(e.target.value as Periode)} className={select} aria-label="Période">
              {PERIODES.map((p) => (
                <option key={p.id} value={p.id}>{p.libelle}</option>
              ))}
            </select>
          </label>
        )}
        <button type="button" onClick={exporter} className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold">⬇ Exporter en JPG</button>
      </div>
      <p className="mt-2 text-xs text-muted">{TYPES.find((t) => t.id === type)?.aide}</p>
      {message && <p className="mt-2 text-sm" role="status">{message}</p>}

      {z && analyse ? (
        <div className="mt-4">
          <Cadre
            ref={noeud}
            surtitre={analyse.surtitre}
            titre={analyse.titre}
            sousTitre={analyse.sousTitre}
            chiffres={analyse.chiffres}
            pied={`Source : Météo-France (relevés quotidiens), ${z.stations} stations de basse altitude · normales 1991-2020`}
            description={`${analyse.titre} : ${analyse.sousTitre}`}
          >
            {(d) => (
              <svg width={d.largeur} height={d.hauteur} viewBox={`0 0 ${d.largeur} ${d.hauteur}`} style={{ position: 'absolute', left: 0, top: 0 }}>
                <rect width={d.largeur} height={d.hauteur} fill="#ffffff" />
                <g transform={`translate(12 ${d.compact ? 124 : 112})`}>
                  <Trace dessin={analyse.dessin} l={d.largeur - 24} h={d.hauteur - (d.compact ? 124 : 112) - 30} />
                </g>
              </svg>
            )}
          </Cadre>
          {analyse.trou && (
            <p className="mt-2 text-xs text-muted">
              Pas de relevé contrôlé du {jourMoisAnnee(analyse.trou.de)} au {jourMoisAnnee(analyse.trou.a)} ({analyse.trou.n} jours) : les fichiers quotidiens de Météo-France s’arrêtent en juin, et l’archive du site ne commence qu’à la mi-septembre. La courbe est interrompue sur cette période.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">Pas de donnée pour cette zone.</p>
      )}
      <p className="mt-4 max-w-3xl text-xs text-muted">
        <strong>ITN estimé :</strong> moyenne des températures moyennes quotidiennes ((maxi + mini) / 2) de {donnees.zones.FR?.stations ?? '—'} stations Météo-France de basse altitude (800 m au plus) réparties sur tous les départements, chaque département pesant autant. Ce n’est pas l’indicateur officiel de Météo-France (qui utilise 30 stations) : il en donne l’allure et l’écart à la normale 1991-2020, calculée mois par mois sur les mêmes stations. Les régions et les départements se calculent de la même façon. Dernier jour : {jourMoisAnnee(donnees.derniereDate)}.
      </p>
    </div>
  );
}
