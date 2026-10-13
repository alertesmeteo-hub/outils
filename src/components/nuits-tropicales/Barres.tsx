import { nombreFr } from '@/lib/nuits-tropicales/logique';
import { POLICE } from './Cadre';

export interface PointBarre {
  annee: number;
  valeur: number | null;
  /** Année en cours, comptée jusqu'à la date du dernier relevé : barre hachurée. */
  partiel?: boolean;
}

export interface ZoneDessin {
  x: number;
  y: number;
  l: number;
  h: number;
}

interface Props {
  points: PointBarre[];
  zone: ZoneDessin;
  /** Ligne pointillée de référence (par exemple la moyenne 1991-2020). */
  reference?: { valeur: number; libelle: string } | null;
  couleur: (p: PointBarre) => string;
  /** Moyennes par décennie, tracées en traits épais. */
  decennies?: { debut: number; fin: number; moyenne: number }[];
  /** Texte de l'info-bulle d'une barre. */
  info: (p: PointBarre) => string;
  /** Identifiant unique du motif de hachure (plusieurs graphiques sur une même page). */
  id: string;
  /** Légende de l'axe vertical. */
  unite: string;
}

/** Pas « rond » (1, 2, 5, 10, 20, 50…), d'au moins 1 nuit, donnant cinq à sept graduations. */
export function pasRond(maxi: number): number {
  const brut = Math.max(maxi, 1) / 6;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const rapport = brut / puissance;
  return Math.max(1, (rapport <= 1 ? 1 : rapport <= 2 ? 2 : rapport <= 5 ? 5 : 10) * puissance);
}

/** Barres annuelles en SVG (aucune bibliothèque) : valeurs par année, ligne de référence, moyennes par décennie. */
export default function Barres({ points, zone, reference, couleur, decennies, info, id, unite }: Props) {
  const MARGE_G = 46;
  const MARGE_B = 30;
  const MARGE_H = 10;
  const l = zone.l - MARGE_G - 10;
  const h = zone.h - MARGE_B - MARGE_H;
  if (points.length === 0 || l <= 0 || h <= 0) return null;

  const valeurs = points.flatMap((p) => (p.valeur === null ? [] : [p.valeur]));
  const maxi = Math.max(1, ...valeurs, reference?.valeur ?? 0, ...(decennies ?? []).map((d) => d.moyenne));
  const pas = pasRond(maxi);
  const haut = Math.ceil((maxi * 1.06) / pas) * pas;
  const x0 = zone.x + MARGE_G;
  const yBas = zone.y + MARGE_H + h;
  const echelleY = (v: number) => yBas - (v / haut) * h;
  const largeurBarre = l / points.length;
  const premiere = points[0].annee;
  const xAnnee = (a: number) => x0 + (a - premiere) * largeurBarre;
  const graduations: number[] = [];
  for (let v = 0; v <= haut + 1e-9; v += pas) graduations.push(v);
  // Étiquettes aux années rondes (1950, 1960…) ; la dernière année est ajoutée si elle n'est pas trop près de la précédente.
  const rondes = points.filter((p) => p.annee % 10 === 0);
  const derniere = points[points.length - 1];
  const dernierRonde = rondes[rondes.length - 1];
  const etiquettesAnnees = !dernierRonde || derniere.annee - dernierRonde.annee >= 4 ? [...rondes, derniere] : rondes;

  return (
    <g fontFamily={POLICE}>
      <defs>
        <pattern id={`hachure-${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#ffffff" fillOpacity="0.55" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="#ffffff" strokeWidth="3" />
        </pattern>
      </defs>
      {graduations.map((v) => (
        <g key={v}>
          <line x1={x0} x2={x0 + l} y1={echelleY(v)} y2={echelleY(v)} stroke="#cbd5e1" strokeWidth={v === 0 ? 1.4 : 0.8} />
          <text x={x0 - 6} y={echelleY(v) + 4} fontSize={11.5} textAnchor="end" fill="#475569">
            {nombreFr(v, 0)}
          </text>
        </g>
      ))}
      <text transform={`translate(${zone.x + 12} ${zone.y + MARGE_H + h / 2}) rotate(-90)`} fontSize={11.5} textAnchor="middle" fill="#475569">
        {unite}
      </text>
      {points.map((p) => {
        if (p.valeur === null) return null;
        const x = xAnnee(p.annee) + largeurBarre * 0.1;
        const w = Math.max(1.2, largeurBarre * 0.8);
        const y = echelleY(p.valeur);
        return (
          <g key={p.annee}>
            <title className="cmap-sans-export">{info(p)}</title>
            <rect x={x} y={y} width={w} height={Math.max(0, yBas - y)} fill={couleur(p)} rx={Math.min(2, w / 3)} />
            {p.partiel ? <rect x={x} y={y} width={w} height={Math.max(0, yBas - y)} fill={`url(#hachure-${id})`} rx={Math.min(2, w / 3)} stroke={couleur(p)} strokeWidth={1.2} strokeDasharray="3 2" /> : null}
          </g>
        );
      })}
      {(decennies ?? []).map((d) => {
        const xa = xAnnee(Math.max(d.debut, premiere)) + largeurBarre * 0.05;
        const xb = xAnnee(Math.min(d.fin, points[points.length - 1].annee) + 1) - largeurBarre * 0.05;
        const y = echelleY(d.moyenne);
        return (
          <g key={d.debut}>
            <line x1={xa} x2={xb} y1={y} y2={y} stroke="#0f172a" strokeWidth={3} strokeLinecap="round" />
            <text x={(xa + xb) / 2} y={y - 6} fontSize={12} fontWeight={800} textAnchor="middle" fill="#0f172a" stroke="#ffffff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">
              {nombreFr(d.moyenne, 1)}
            </text>
          </g>
        );
      })}
      {reference ? (
        <g>
          <line x1={x0} x2={x0 + l} y1={echelleY(reference.valeur)} y2={echelleY(reference.valeur)} stroke="#b3261e" strokeWidth={1.6} strokeDasharray="6 4" />
          <text x={x0 + 4} y={echelleY(reference.valeur) - 5} fontSize={11.5} fontWeight={700} fill="#b3261e" stroke="#ffffff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">
            {reference.libelle}
          </text>
        </g>
      ) : null}
      {etiquettesAnnees.map((p) => (
        <text key={`a${p.annee}`} x={xAnnee(p.annee) + largeurBarre / 2} y={yBas + 18} fontSize={11.5} textAnchor="middle" fill="#475569">
          {p.annee}
        </text>
      ))}
    </g>
  );
}
