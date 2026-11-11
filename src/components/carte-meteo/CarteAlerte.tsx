'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { CODES_DEPARTEMENTS } from '@/lib/carte-meteo/previsions-modeles';

/**
 * Cartes d'alerte pour les réseaux sociaux (TikTok, Facebook, Instagram) : fond dégradé, nom du département, gros texte, drapeau catalan,
 * nom de la page. Quatre modèles : record battu, alerte avec relevés, annonce libre (« Orage sur Perpignan entre 18h et 22h »), vigilance
 * Météo-France jaune, orange ou rouge.
 */

/** Nom en bas des cartes par défaut (modifiable dans le formulaire). */
const NOM_PAGE = 'www.alertes-meteo.com';

const POLICE = "Roboto, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

const FORMATS = [
  { id: 'facebook', libelle: 'Facebook (paysage, comme les modèles)', l: 1305, h: 1096 },
  { id: 'facebook45', libelle: 'Facebook, Instagram (4:5)', l: 1080, h: 1350 },
  { id: 'tiktok', libelle: 'TikTok, Reels, Shorts (9:16)', l: 1080, h: 1920 },
  { id: 'carre', libelle: 'Carré (1:1)', l: 1080, h: 1080 },
] as const;
type FormatId = (typeof FORMATS)[number]['id'];

type Fond = 'orange' | 'jaune' | 'rouge';
interface Theme {
  libelle: string;
  degrade: [string, string, string];
  /** Titre en haut, filets et nom de la page en bas. */
  accent: string;
  texte: string;
  ville: string;
  valeur: string;
  /** Triangle d'alerte : couleur du triangle et du point d'exclamation. */
  triangle: [string, string];
}
const THEMES: Record<Fond, Theme> = {
  orange: { libelle: 'Orange', degrade: ['#ffd43b', '#fb9b16', '#f4640a'], accent: '#d4141b', texte: '#000', ville: '#a50022', valeur: '#ff0000', triangle: ['#d4141b', '#fff'] },
  jaune: { libelle: 'Jaune', degrade: ['#fff6a8', '#ffe135', '#f2b800'], accent: '#c8102e', texte: '#000', ville: '#a50022', valeur: '#e00000', triangle: ['#d4141b', '#fff'] },
  rouge: { libelle: 'Rouge', degrade: ['#ff6e5f', '#e3261c', '#9a0a0a'], accent: '#ffffff', texte: '#ffffff', ville: '#ffe9a0', valeur: '#fff3a0', triangle: ['#ffd800', '#1a1a1a'] },
};

type Modele = 'record' | 'alerte' | 'annonce' | 'vigilance';
const MODELES: { id: Modele; libelle: string }[] = [
  { id: 'record', libelle: '🏆 Record battu' },
  { id: 'alerte', libelle: '⚠️ Alerte avec relevés' },
  { id: 'annonce', libelle: '⛈️ Annonce libre' },
  { id: 'vigilance', libelle: '🚨 Vigilance' },
];

type Niveau = 'jaune' | 'orange' | 'rouge';
const NIVEAUX: Record<Niveau, { libelle: string; fond: string; texte: string }> = {
  jaune: { libelle: 'JAUNE', fond: '#ffd800', texte: '#000' },
  orange: { libelle: 'ORANGE', fond: '#ff8c00', texte: '#000' },
  rouge: { libelle: 'ROUGE', fond: '#e30613', texte: '#fff' },
};
const PHENOMENES = ['Orages', 'Pluie-inondation', 'Vent violent', 'Crues', 'Canicule', 'Neige-verglas', 'Grand froid', 'Avalanches', 'Vagues-submersion', 'Incendie'];

interface Carte {
  modele: Modele;
  fond: Fond;
  departement: string;
  nomPage: string;
  drapeau: boolean;
  // Record
  recordVille: string;
  recordLigne: string;
  recordValeur: string;
  // Alerte avec relevés
  alerteTitre: string;
  alerteVille: string;
  alerteLignes: string;
  // Annonce libre
  annonce: string;
  // Vigilance
  niveau: Niveau;
  phenomene: string;
  periode: string;
  precision: string;
}

interface Bloc {
  texte: string;
  couleur: string;
  taille: number;
  poids?: number;
  /** Espace sous le bloc, en fraction de la taille du texte (0,1 par défaut). */
  ecart?: number;
  /** Triangles d'alerte de part et d'autre du texte. */
  triangles?: boolean;
  /** Texte dans une pastille de couleur (niveau de vigilance). */
  pastille?: { fond: string; texte: string };
}

/** Coupe un texte en lignes qui tiennent dans `largeurMax` (police déjà réglée sur le contexte). */
function decouper(ctx: CanvasRenderingContext2D, texte: string, largeurMax: number): string[] {
  const lignes: string[] = [];
  for (const paragraphe of texte.split('\n')) {
    let courante = '';
    for (const mot of paragraphe.split(/\s+/).filter(Boolean)) {
      const essai = courante ? `${courante} ${mot}` : mot;
      if (courante && ctx.measureText(essai).width > largeurMax) {
        lignes.push(courante);
        courante = mot;
      } else courante = essai;
    }
    if (courante) lignes.push(courante);
  }
  return lignes;
}

function rectArrondi(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Triangle d'alerte à pointe en haut, centré en (cx, cy), de côté `t`, avec son point d'exclamation. */
function triangleAlerte(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number, couleurs: [string, string]) {
  const h = t * 0.88;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx + t / 2, cy + h / 2);
  ctx.lineTo(cx - t / 2, cy + h / 2);
  ctx.closePath();
  ctx.lineWidth = t * 0.16;
  ctx.strokeStyle = couleurs[0];
  ctx.fillStyle = couleurs[0];
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = couleurs[1];
  rectArrondi(ctx, cx - t * 0.05, cy - h * 0.2, t * 0.1, h * 0.36, t * 0.04);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy + h * 0.28, t * 0.055, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Drapeau catalan qui ondule (neuf bandes), avec son ombre au sol. */
function drapeauCatalan(ctx: CanvasRenderingContext2D, cx: number, haut: number, w: number) {
  const h = w * 0.62;
  const ombre = ctx.createRadialGradient(cx, haut + h * 1.3, 0, cx, haut + h * 1.3, w * 0.6);
  ombre.addColorStop(0, 'rgba(60,25,0,0.55)');
  ombre.addColorStop(1, 'rgba(60,25,0,0)');
  ctx.save();
  ctx.fillStyle = ombre;
  ctx.translate(0, 0);
  ctx.beginPath();
  ctx.ellipse(cx, haut + h * 1.3, w * 0.6, h * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const pas = 2;
  const n = Math.ceil(w / pas);
  for (let i = 0; i < n; i++) {
    const p = i / n;
    const phase = p * Math.PI * 2.3 + 0.4;
    const dy = Math.sin(phase) * h * 0.055 + (p - 0.5) * h * 0.07;
    const x = cx - w / 2 + i * pas;
    for (let k = 0; k < 9; k++) {
      ctx.fillStyle = k % 2 === 0 ? '#fcdd09' : '#da121a';
      ctx.fillRect(x, haut + dy + (k * h) / 9, pas + 0.6, h / 9 + 0.6);
    }
    const reflet = Math.cos(phase);
    ctx.fillStyle = reflet < 0 ? `rgba(0,0,0,${-reflet * 0.2})` : `rgba(255,255,255,${reflet * 0.14})`;
    ctx.fillRect(x, haut + dy, pas + 0.6, h);
  }
}

function dessiner(ctx: CanvasRenderingContext2D, W: number, H: number, c: Carte) {
  const th = THEMES[c.fond];
  const u = Math.min(W / 1305, H / 1096);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, th.degrade[0]);
  g.addColorStop(0.5, th.degrade[1]);
  g.addColorStop(1, th.degrade[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  // En-tête : département, souligné d'un filet.
  ctx.fillStyle = th.accent;
  let t = 56 * u;
  ctx.font = `800 ${t}px ${POLICE}`;
  while (ctx.measureText(c.departement.toUpperCase()).width > W * 0.9 && t > 20) {
    t -= 2;
    ctx.font = `800 ${t}px ${POLICE}`;
  }
  ctx.fillText(c.departement.toUpperCase(), W / 2, H * 0.055);
  ctx.fillRect(W * 0.22, H * 0.1, W * 0.56, 3 * u);

  // Pied : nom de la page, entre deux filets.
  ctx.fillStyle = th.accent;
  t = 50 * u;
  ctx.font = `800 ${t}px ${POLICE}`;
  while (ctx.measureText(c.nomPage).width > W * 0.8 && t > 20) {
    t -= 2;
    ctx.font = `800 ${t}px ${POLICE}`;
  }
  ctx.fillText(c.nomPage, W / 2, H * 0.935);
  ctx.fillRect(W * 0.24, H * 0.974, W * 0.52, 3 * u);

  // Drapeau.
  const avecDrapeau = c.drapeau;
  if (avecDrapeau) drapeauCatalan(ctx, W / 2, H * 0.7, Math.min(W * 0.21, H * 0.3));

  // Contenu : blocs de texte centrés, réduits ensemble jusqu'à tenir dans la zone.
  const blocs = blocsDe(c, th);
  const haut = H * 0.135;
  const bas = avecDrapeau ? H * 0.685 : H * 0.89;
  const maxW = W * 0.94;
  const maxH = bas - haut;
  const essai = (s: number) => {
    let ok = true;
    let total = 0;
    const res = blocs.map((b, i) => {
      const taille = b.taille * u * s;
      ctx.font = `${b.poids ?? 800} ${taille}px ${POLICE}`;
      const largeur = b.triangles ? maxW - taille * 2.6 : b.pastille ? maxW - taille * 1.4 : maxW;
      const lignes = b.pastille ? [b.texte] : decouper(ctx, b.texte, largeur);
      if (lignes.some((l) => ctx.measureText(l).width > largeur)) ok = false;
      const lh = taille * (b.pastille ? 1.5 : 1.08);
      total += lignes.length * lh + (i < blocs.length - 1 ? taille * (b.ecart ?? 0.1) : 0);
      return { b, taille, lignes, lh };
    });
    return { ok: ok && total <= maxH, res, total };
  };
  let mise = essai(1);
  for (let s = 0.98; !mise.ok && s >= 0.2; s -= 0.02) mise = essai(s);
  let y = haut + Math.max(0, (maxH - mise.total) / 2);
  for (const { b, taille, lignes, lh } of mise.res) {
    ctx.font = `${b.poids ?? 800} ${taille}px ${POLICE}`;
    for (const ligne of lignes) {
      const cy = y + lh / 2;
      const larg = ctx.measureText(ligne).width;
      if (b.pastille) {
        const pw = larg + taille * 1.1;
        const ph = taille * 1.3;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 18 * u;
        ctx.shadowOffsetY = 6 * u;
        rectArrondi(ctx, W / 2 - pw / 2, cy - ph / 2, pw, ph, ph / 2);
        ctx.fillStyle = b.pastille.fond;
        ctx.fill();
        ctx.restore();
        ctx.lineWidth = 7 * u;
        ctx.strokeStyle = '#fff';
        rectArrondi(ctx, W / 2 - pw / 2, cy - ph / 2, pw, ph, ph / 2);
        ctx.stroke();
        ctx.fillStyle = b.pastille.texte;
      } else ctx.fillStyle = b.couleur;
      ctx.fillText(ligne, W / 2, cy + taille * 0.04);
      if (b.triangles) {
        const dx = larg / 2 + taille * 0.85;
        triangleAlerte(ctx, W / 2 - dx, cy, taille * 1.1, th.triangle);
        triangleAlerte(ctx, W / 2 + dx, cy, taille * 1.1, th.triangle);
      }
      y += lh;
    }
    y += taille * (b.ecart ?? 0.1);
  }
}

/** Blocs de texte de la carte selon le modèle. */
function blocsDe(c: Carte, th: Theme): Bloc[] {
  const net = (s: string) => s.trim();
  if (c.modele === 'record') {
    return [
      { texte: net(c.recordVille).toUpperCase(), couleur: th.ville, taille: 175, ecart: 0.04 },
      { texte: net(c.recordLigne), couleur: th.texte, taille: 138, ecart: 0.05 },
      { texte: net(c.recordValeur), couleur: th.valeur, taille: 195 },
    ].filter((b) => b.texte);
  }
  if (c.modele === 'alerte') {
    const lignes = c.alerteLignes.split('\n').map(net).filter(Boolean);
    return [
      { texte: net(c.alerteTitre), couleur: th.accent === '#ffffff' ? '#fff' : th.accent, taille: 122, triangles: true, ecart: 0.08 },
      { texte: net(c.alerteVille).toUpperCase(), couleur: th.texte, taille: 118, ecart: 0.05 },
      ...lignes.map((texte) => ({ texte, couleur: th.texte, taille: 114, ecart: 0.04 })),
    ].filter((b) => b.texte);
  }
  if (c.modele === 'annonce') {
    return c.annonce
      .split('\n')
      .map(net)
      .filter(Boolean)
      .map((texte) => ({ texte, couleur: th.texte, taille: 128, ecart: 0.03 }));
  }
  const n = NIVEAUX[c.niveau];
  return [
    { texte: 'VIGILANCE', couleur: th.texte, taille: 120, ecart: 0.05 },
    { texte: n.libelle, couleur: th.texte, taille: 150, pastille: { fond: n.fond, texte: n.texte }, ecart: 0.1 },
    { texte: net(c.phenomene).toUpperCase(), couleur: th.texte, taille: 130, ecart: 0.06 },
    { texte: net(c.periode), couleur: th.texte, taille: 76, ecart: 0.05 },
    { texte: net(c.precision), couleur: th.texte, taille: 66, poids: 700 },
  ].filter((b) => b.texte);
}

const champ = 'w-full rounded-lg border border-border bg-surface p-1.5 text-sm';

/** Liste déroulante des villes de la zone : le choix remplit le champ de texte, qui reste modifiable à la main. */
function ListeVilles({ villes, onChoix }: { villes: string[]; onChoix: (v: string) => void }) {
  if (villes.length === 0) return null;
  return (
    <select value="" onChange={(e) => e.target.value && onChoix(e.target.value)} className={`${champ} mb-1`} aria-label="Choisir une ville de la zone">
      <option value="">▼ Choisir une ville ({villes.length})</option>
      {villes.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </select>
  );
}
const legende = 'mb-1 block text-xs font-bold uppercase tracking-wide text-primary';

export default function CarteAlerte() {
  const [c, setC] = useState<Carte>({
    modele: 'annonce',
    fond: 'orange',
    departement: DEPARTEMENTS_FR['66'] ?? 'Pyrénées-Orientales',
    nomPage: NOM_PAGE,
    drapeau: true,
    recordVille: 'Perpignan',
    recordLigne: 'Record Mensuel de 1936 battu',
    recordValeur: '36.9°C',
    alerteTitre: 'incendie en cours',
    alerteVille: 'Prades',
    alerteLignes: 'Température : 30°C\nHumidex : 39\nRafales : 25 km/h',
    annonce: 'ORAGE\nSUR PERPIGNAN\nENTRE 18h et 22h',
    niveau: 'orange',
    phenomene: 'Orages',
    periode: "Aujourd'hui de 14h à 22h",
    precision: '',
  });
  const [formatId, setFormatId] = useState<FormatId>('facebook');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const format = FORMATS.find((f) => f.id === formatId)!;
  const regler = (p: Partial<Carte>) => setC((x) => ({ ...x, ...p }));

  const [codeDep, setCodeDep] = useState('66');
  // Villes de la zone (liste à faire défiler pour choisir le lieu) : les principales communes du département et celles de montagne ; en France, les chefs-lieux.
  const [villes, setVilles] = useState<string[]>([]);
  useEffect(() => {
    const controleur = new AbortController();
    const lire = (url: string) =>
      fetch(url, { signal: controleur.signal })
        .then((r) => (r.ok ? (r.json() as Promise<{ points: { nom: string; ville?: string }[] }>) : { points: [] }))
        .then((j) => j.points.map((p) => (codeDep === 'FR' ? p.ville ?? p.nom : p.nom)))
        .catch(() => [] as string[]);
    const base = '/api/carte-meteo/previsions/?modele=arome';
    Promise.all(codeDep === 'FR' ? [lire(base)] : [lire(`${base}&dep=${codeDep}`), lire(`${base}&montagne=1&deps=${codeDep}&alt=500`)]).then((listes) => {
      if (!controleur.signal.aborted) setVilles([...new Set(listes.flat())].sort((a, b) => a.localeCompare(b, 'fr')));
    });
    return () => controleur.abort();
  }, [codeDep]);
  const changerZone = (code: string) => {
    setCodeDep(code);
    const nom = code === 'FR' ? 'France' : DEPARTEMENTS_FR[code] ?? code;
    regler({ departement: nom, nomPage: NOM_PAGE, drapeau: code === '66' });
  };
  const changerNiveau = (niveau: Niveau) => regler({ niveau, fond: niveau === 'jaune' ? 'jaune' : niveau === 'rouge' ? 'rouge' : 'orange' });

  const cle = useMemo(() => JSON.stringify(c), [c]);
  useEffect(() => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext('2d');
    if (ctx) dessiner(ctx, format.l, format.h, c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, format]);

  function exporter(type: 'png' | 'jpg') {
    const cv = document.createElement('canvas');
    cv.width = format.l;
    cv.height = format.h;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    dessiner(ctx, format.l, format.h, c);
    cv.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `carte-alerte-${c.modele}-${codeDep}-${format.id}.${type}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      },
      type === 'png' ? 'image/png' : 'image/jpeg',
      0.95
    );
  }

  const largeurMax = format.h > format.l * 1.2 ? '24rem' : '40rem';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4 rounded-2xl border-2 border-primary/30 bg-primary/5 p-5">
        <div className="text-sm font-medium">
          <span className={legende}>Modèle de carte</span>
          <div className="grid grid-cols-2 gap-2">
            {MODELES.map((m) => (
              <button key={m.id} type="button" onClick={() => regler({ modele: m.id })} aria-pressed={c.modele === m.id} className={`rounded-lg border px-2 py-1.5 text-sm ${c.modele === m.id ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}>
                {m.libelle}
              </button>
            ))}
          </div>
        </div>

        {c.modele === 'record' && (
          <>
            <label className="text-sm font-medium">
              <span className={legende}>🏙️ Ville</span>
              <ListeVilles villes={villes} onChoix={(v) => regler({ recordVille: v })} />
              <input value={c.recordVille} onChange={(e) => regler({ recordVille: e.target.value })} className={champ} />
            </label>
            <label className="text-sm font-medium">
              <span className={legende}>🏆 Record</span>
              <input value={c.recordLigne} onChange={(e) => regler({ recordLigne: e.target.value })} className={champ} />
            </label>
            <label className="text-sm font-medium">
              <span className={legende}>🌡️ Valeur</span>
              <input value={c.recordValeur} onChange={(e) => regler({ recordValeur: e.target.value })} className={champ} />
            </label>
          </>
        )}

        {c.modele === 'alerte' && (
          <>
            <label className="text-sm font-medium">
              <span className={legende}>⚠️ Titre de l’alerte</span>
              <input value={c.alerteTitre} onChange={(e) => regler({ alerteTitre: e.target.value })} className={champ} />
            </label>
            <label className="text-sm font-medium">
              <span className={legende}>🏙️ Lieu</span>
              <ListeVilles villes={villes} onChoix={(v) => regler({ alerteVille: v })} />
              <input value={c.alerteVille} onChange={(e) => regler({ alerteVille: e.target.value })} className={champ} />
            </label>
            <label className="text-sm font-medium">
              <span className={legende}>📋 Relevés (une ligne chacun)</span>
              <textarea value={c.alerteLignes} onChange={(e) => regler({ alerteLignes: e.target.value })} rows={4} className={champ} />
            </label>
          </>
        )}

        {c.modele === 'annonce' && (
          <label className="text-sm font-medium">
            <span className={legende}>✍️ Texte (un retour à la ligne par ligne)</span>
            <textarea value={c.annonce} onChange={(e) => regler({ annonce: e.target.value })} rows={5} className={champ} />
          </label>
        )}

        {c.modele === 'vigilance' && (
          <>
            <div className="text-sm font-medium">
              <span className={legende}>🚦 Niveau de vigilance</span>
              <div className="flex gap-2">
                {(Object.keys(NIVEAUX) as Niveau[]).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => changerNiveau(n)}
                    aria-pressed={c.niveau === n}
                    style={{ background: NIVEAUX[n].fond, color: NIVEAUX[n].texte }}
                    className={`flex-1 rounded-lg border-2 px-2 py-1.5 text-sm font-bold ${c.niveau === n ? 'border-black' : 'border-transparent opacity-70'}`}
                  >
                    {NIVEAUX[n].libelle}
                  </button>
                ))}
              </div>
            </div>
            <label className="text-sm font-medium">
              <span className={legende}>🌩️ Phénomène</span>
              <input list="phenomenes-vigilance" value={c.phenomene} onChange={(e) => regler({ phenomene: e.target.value })} className={champ} />
              <datalist id="phenomenes-vigilance">
                {PHENOMENES.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </label>
            <label className="text-sm font-medium">
              <span className={legende}>🕒 Période</span>
              <input value={c.periode} onChange={(e) => regler({ periode: e.target.value })} className={champ} />
            </label>
            <label className="text-sm font-medium">
              <span className={legende}>💬 Précision (facultative)</span>
              <input value={c.precision} onChange={(e) => regler({ precision: e.target.value })} placeholder="Rafales jusqu’à 100 km/h" className={champ} />
            </label>
          </>
        )}

        <label className="text-sm font-medium">
          <span className={legende}>📍 Zone</span>
          <select value={codeDep} onChange={(e) => changerZone(e.target.value)} className={champ}>
            <option value="FR">France entière</option>
            {CODES_DEPARTEMENTS.map((code) => (
              <option key={code} value={code}>
                {code} — {DEPARTEMENTS_FR[code]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          <span className={legende}>🎨 Couleur du fond</span>
          <div className="flex gap-2">
            {(Object.keys(THEMES) as Fond[]).map((f) => (
              <button key={f} type="button" onClick={() => regler({ fond: f })} aria-pressed={c.fond === f} className={`flex-1 rounded-lg border px-2 py-1.5 text-sm ${c.fond === f ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}>
                {THEMES[f].libelle}
              </button>
            ))}
          </div>
        </label>
        <label className="text-sm font-medium">
          <span className={legende}>🏷️ Nom en bas de la carte</span>
          <input value={c.nomPage} onChange={(e) => regler({ nomPage: e.target.value })} className={champ} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={c.drapeau} onChange={(e) => regler({ drapeau: e.target.checked })} />
          Drapeau catalan
        </label>
        <label className="text-sm font-medium">
          <span className={legende}>📐 Format</span>
          <select value={formatId} onChange={(e) => setFormatId(e.target.value as FormatId)} className={champ}>
            {FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.libelle}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => exporter('png')} className="flex-1 rounded-lg border border-red-600 bg-red-600 px-3 py-2.5 text-sm font-semibold text-white">
            ⬇️ Image PNG
          </button>
          <button type="button" onClick={() => exporter('jpg')} className="flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-semibold">
            ⬇️ Image JPG
          </button>
        </div>
        <p className="text-xs text-muted">
          Image de {format.l} × {format.h} pixels, prête à publier.
        </p>
      </div>
      <div className="flex flex-col items-center">
        <canvas ref={canvasRef} width={format.l} height={format.h} style={{ maxWidth: largeurMax }} className="h-auto w-full rounded-2xl border border-border shadow-lg" aria-label="Aperçu de la carte d’alerte" />
      </div>
    </div>
  );
}
