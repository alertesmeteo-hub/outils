'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ordreRepartition } from '@/lib/carte-meteo/echantillonnage';
import { exporterEnJpg } from '@/lib/carte-meteo/ExportJpg';
import { LOGOS_PRESETS } from '@/lib/carte-meteo/logos';
import { PALIERS_TEMPERATURE, palierDe } from '@/lib/carte-meteo/cartes-info';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { REGIONS_FR } from '@/lib/carte-meteo/regions-fr';
import { NIVEAUX_DETAIL } from '@/lib/carte-meteo/niveaux-detail';
import { cheminPictoImage } from '@/lib/carte-meteo/pictos';
import { CODES_DEPARTEMENTS, DUREES_TENDANCES, ajouterJours, type PointCarte } from '@/lib/carte-meteo/previsions-modeles';
import { ajusterVue, unirBoites, versEcran, versMonde } from '@/lib/carte-meteo/projection-france';
import { pictoDuJour, versPointJour, type PointJour } from '@/lib/carte-meteo/planches-jours';
import { BOITE_FRANCE, codesDeLaZone, normaliser, useContours, FICHIERS_CONTOURS } from './CarteMeteo';

const LARGEUR = 1600;
const MARGE = 24;
const ECART = 14;
const HAUTEUR_TITRE = 120;
const HAUTEUR_PIED = 44;
const HAUTEUR_JOUR = 36;
/** Colonnes de la grille selon le nombre de cartes : 2 cartes côte à côte, 16 cartes en 4 × 4… */
const COLONNES: Record<number, number> = { 2: 2, 4: 2, 6: 3, 8: 4, 10: 5, 12: 4, 14: 5, 16: 4 };
const POLICE = "Impact, 'Arial Narrow Bold', 'Arial Black', sans-serif";
const selectBarre = 'rounded-lg border border-border bg-surface p-1.5 text-sm';

const jourLibelle = (dateISO: string) =>
  new Date(`${dateISO}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).toUpperCase();

interface Props {
  aujourdhui: string;
  modele: { id: string; libelle: string; fournisseur: string };
  /** France : un point par département et par jour (null : jour que le modèle ne couvre pas). */
  jours: Record<string, PointJour[] | null>;
}

/**
 * Planches « jours » : un seul JPG avec une carte par jour (2 cartes pour 2 jours, 4 pour 4… 16 pour 16 jours), pour la France, une
 * région ou un département, avec un seul picto par point (le temps de la journée) et ses températures.
 */
export default function PlanchesJours({ aujourdhui, modele, jours }: Props) {
  const [duree, setDuree] = useState<number>(4);
  /** Premier jour des cartes : 0 = aujourd'hui, 1 = demain (planche sans la carte du jour). */
  const [depart, setDepart] = useState(0);
  const [niveauDetail, setNiveauDetail] = useState<number>(1);
  const [zone, setZone] = useState('france');
  const [logoId, setLogoId] = useState('aucun');
  const [donneesDep, setDonneesDep] = useState<Record<string, PointJour[] | null>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [enExport, setEnExport] = useState(false);
  const [facteur, setFacteur] = useState(1);
  const colonneRef = useRef<HTMLDivElement>(null);
  const planchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = colonneRef.current;
    if (!c) return;
    const o = new ResizeObserver(() => setFacteur(Math.min(1, c.clientWidth / LARGEUR)));
    o.observe(c);
    return () => o.disconnect();
  }, []);

  const enDepartement = zone.startsWith('dep:');
  const dates = useMemo(() => Array.from({ length: duree }, (_, k) => ajouterJours(aujourdhui, depart + k)), [aujourdhui, duree, depart]);

  // Département : prévisions des villes, jour par jour (le serveur ne publie que la France entière).
  useEffect(() => {
    if (!enDepartement) return;
    const dep = zone.slice(4);
    const controleur = new AbortController();
    setErreur(null);
    (async () => {
      for (const date of dates) {
        const cle = `${dep}|${date}`;
        if (donneesDep[cle] !== undefined) continue;
        try {
          const r = await fetch(`/api/carte-meteo/previsions/?modele=${modele.id}&date=${date}&dep=${dep}`, { signal: controleur.signal });
          const points = r.ok ? ((await r.json()) as { points: PointCarte[] }).points.map(versPointJour).filter((p): p is PointJour => p != null) : null;
          setDonneesDep((d) => ({ ...d, [cle]: points }));
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
          setErreur('Prévisions des villes momentanément indisponibles.');
          return;
        }
      }
    })();
    return () => controleur.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enDepartement, zone, dates, modele.id]);

  const contours = useContours(FICHIERS_CONTOURS.departements);
  const codes = useMemo(() => new Set(codesDeLaZone(zone)), [zone]);
  const colonnes = COLONNES[duree];
  const largeurCarte = (LARGEUR - 2 * MARGE - (colonnes - 1) * ECART) / colonnes;
  const hauteurCarte = Math.round(largeurCarte * (zone === 'france' ? 1 : 0.92));
  const lignes = Math.ceil(duree / colonnes);
  const hauteur = HAUTEUR_TITRE + lignes * (hauteurCarte + ECART) + HAUTEUR_PIED;

  const vue = useMemo(() => {
    const boite = unirBoites(contours.filter((c) => codes.has(c.code)).map((c) => c.boite)) ?? BOITE_FRANCE;
    return ajusterVue(boite, { gauche: 8, haut: HAUTEUR_JOUR + 6, droite: largeurCarte - 8, bas: hauteurCarte - 8 }, zone === 'france' ? 0.01 : 0.05);
  }, [contours, codes, largeurCarte, hauteurCarte, zone]);

  const taillePicto = Math.max(24, Math.min(54, Math.round(largeurCarte * 0.09)));
  /** Nombre de points affichés par carte : ce que la carte peut porter sans chevauchement. */
  const partDetail = NIVEAUX_DETAIL.find((n) => n.id === niveauDetail)?.part ?? 1;
  const nombreMax = Math.max(3, Math.floor((largeurCarte / (taillePicto * 1.7)) ** 2 * (zone === 'france' ? 0.55 : enDepartement ? 0.14 : 0.3)));

  /** Points de chaque jour, dans la zone, répartis sur la carte (les premiers sont toujours bien espacés). */
  const cartes = useMemo(
    () =>
      dates.map((date) => {
        const brut = enDepartement ? donneesDep[`${zone.slice(4)}|${date}`] : jours[date];
        const dansZone = (brut ?? []).filter((p) => enDepartement || codes.has(p.code));
        const ecran = dansZone.map((p) => ({ p, ...versEcran(versMonde(p.lat, p.lon), vue) })).filter((e) => e.x > 10 && e.x < largeurCarte - 10 && e.y > HAUTEUR_JOUR && e.y < hauteurCarte - 10);
        const rang = new Map(ordreRepartition(ecran.map((e) => ({ code: e.p.code, x: e.x, y: e.y }))).map((c, i) => [c, i]));
        const retenus = ecran.sort((a, b) => (rang.get(a.p.code) ?? 0) - (rang.get(b.p.code) ?? 0)).slice(0, Math.max(3, Math.round(Math.min(nombreMax, ecran.length) * partDetail)));
        return { date, charge: brut !== undefined, vide: brut === null, points: retenus };
      }),
    [dates, jours, donneesDep, enDepartement, zone, codes, vue, largeurCarte, hauteurCarte, nombreMax, partDetail]
  );

  const nomZone = zone === 'france' ? 'France' : zone.startsWith('reg:') ? zone.slice(4) : `${DEPARTEMENTS_FR[zone.slice(4)] ?? zone.slice(4)} (${zone.slice(4)})`;
  const logo = LOGOS_PRESETS.find((l) => l.id === logoId);
  const titre = `TENDANCE SUR ${duree} JOURS : ${nomZone.toUpperCase()}`;
  const sousTitre = `DU ${jourLibelle(dates[0])} AU ${jourLibelle(dates[dates.length - 1])} · ${modele.libelle}`;

  async function exporter() {
    if (!planchRef.current) return;
    setEnExport(true);
    try {
      await exporterEnJpg(planchRef.current, `tendance-${duree}-jours${depart ? '-sans-j0' : ''}-${normaliser(nomZone).replace(/ /g, '-')}-${aujourdhui}-${modele.id}`, LARGEUR, hauteur);
    } catch (e) {
      console.error('Export de la planche en JPG', e);
      setErreur("L'export a échoué. Réessayez dans un instant.");
    } finally {
      setEnExport(false);
    }
  }

  return (
    <section id="planches-jours" className="scroll-mt-4">
      <h2 className="text-2xl font-extrabold">Une planche JPG : une carte par jour</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Un seul JPG avec les cartes de chaque jour : 2 cartes pour 2 jours, 4 pour 4 jours… jusqu&apos;à 16 cartes pour 16 jours, pour la France, une région ou un département.
        Un seul picto par point (le temps de la journée), avec la maximale et la minimale.
      </p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Durée">
        {DUREES_TENDANCES.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={d === duree}
            onClick={() => setDuree(d)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${d === duree ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}
          >
            {d} jours
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl border border-border bg-surface p-4">
        <label className="text-sm font-medium">
          <span className="mb-1 block">Quantité d&apos;infos</span>
          <select value={niveauDetail} onChange={(e) => setNiveauDetail(Number(e.target.value))} className={selectBarre}>
            {NIVEAUX_DETAIL.map((n) => (
              <option key={n.id} value={n.id}>
                {n.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          <span className="mb-1 block">Premier jour</span>
          <select value={depart} onChange={(e) => setDepart(Number(e.target.value))} className={selectBarre}>
            <option value={0}>Avec aujourd&apos;hui (J0)</option>
            <option value={1}>Sans la carte J0 (dès demain)</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          <span className="mb-1 block">Zone</span>
          <select value={zone} onChange={(e) => setZone(e.target.value)} className={selectBarre}>
            <option value="france">France</option>
            <optgroup label="Régions">
              {REGIONS_FR.map((r) => (
                <option key={r} value={`reg:${r}`}>
                  {r}
                </option>
              ))}
            </optgroup>
            <optgroup label="Départements">
              {CODES_DEPARTEMENTS.map((d) => (
                <option key={d} value={`dep:${d}`}>
                  {d} — {DEPARTEMENTS_FR[d] ?? d}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className="text-sm font-medium">
          <span className="mb-1 block">Logo</span>
          <select value={logoId} onChange={(e) => setLogoId(e.target.value)} className={selectBarre}>
            {LOGOS_PRESETS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nom}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={exporter} disabled={enExport || contours.length === 0} className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {enExport ? 'Export en cours…' : 'Exporter la planche en JPG'}
        </button>
      </div>
      {erreur && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {erreur}
        </p>
      )}

      <div ref={colonneRef} className="mt-4 min-w-0">
        <div style={{ height: hauteur * facteur }}>
          <div
            ref={planchRef}
            style={{
              width: LARGEUR,
              height: hauteur,
              transform: `scale(${facteur})`,
              transformOrigin: 'top left',
              background: 'linear-gradient(160deg, #0b2a4a 0%, #123c6b 100%)',
              color: '#fff',
              fontFamily: 'Arial, Helvetica, sans-serif',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ height: HAUTEUR_TITRE, display: 'flex', alignItems: 'center', gap: 24, padding: `0 ${MARGE}px` }}>
              {logo?.fichier ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo.fichier} alt="" style={{ height: 84, background: logo.fondBlanc === false ? 'transparent' : '#fff', borderRadius: 8 }} />
              ) : null}
              <div style={{ background: 'rgba(255,255,255,0.94)', borderRadius: 12, padding: '10px 26px', flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: POLICE, fontSize: 42, lineHeight: 1.05, color: '#0b2a4a', whiteSpace: 'nowrap', overflow: 'hidden' }}>{titre}</div>
                <div style={{ fontFamily: POLICE, fontSize: 22, color: '#2563a8', marginTop: 2 }}>{sousTitre}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colonnes}, ${largeurCarte}px)`, gap: ECART, padding: `0 ${MARGE}px`, justifyContent: 'center' }}>
              {cartes.map(({ date, charge, vide, points }) => {
                const premier = points[0]?.p;
                return (
                  <div key={date} style={{ position: 'relative', width: largeurCarte, height: hauteurCarte, borderRadius: 10, overflow: 'hidden', background: '#0a2342', border: '2px solid rgba(255,255,255,0.7)' }}>
                    <svg width={largeurCarte} height={hauteurCarte} style={{ position: 'absolute', left: 0, top: 0 }}>
                      <g transform={`translate(${vue.tx} ${vue.ty}) scale(${vue.echelle})`}>
                        {contours.map((c) => {
                          const dedans = codes.has(c.code);
                          const point = (enDepartement ? [] : jours[date] ?? []).find((p) => p.code === c.code);
                          const fond = dedans && point?.maxi != null ? palierDe(PALIERS_TEMPERATURE, point.maxi).fond : dedans ? '#6f86d6' : '#061428';
                          return <path key={c.code} d={c.d} fill={fond} fillOpacity={dedans ? 0.88 : 0.4} stroke="#fff" strokeOpacity={dedans ? 0.55 : 0.2} strokeWidth={0.7 / vue.echelle} />;
                        })}
                      </g>
                    </svg>
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: HAUTEUR_JOUR, background: 'rgba(255,255,255,0.94)', color: '#0b2a4a', fontFamily: POLICE, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: 0.5 }}>
                      {jourLibelle(date)}
                    </div>
                    {points.map(({ p, x, y }) => (
                      <div key={p.code} style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -62%)', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={cheminPictoImage(pictoDuJour(p)) ?? ''} alt="" style={{ width: taillePicto, height: taillePicto, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.55))' }} />
                        <span style={{ fontFamily: POLICE, fontSize: Math.round(taillePicto * 0.5), color: '#111', textShadow: '0 0 3px #fff, 0 0 3px #fff, 1px 1px 0 #fff, -1px -1px 0 #fff', whiteSpace: 'nowrap' }}>
                          {p.maxi != null ? `${Math.round(p.maxi)}°` : ''}
                          {p.mini != null ? <span style={{ color: '#1f6fe0', fontSize: '0.8em' }}> {Math.round(p.mini)}°</span> : null}
                        </span>
                      </div>
                    ))}
                    {premier == null && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cfe3fa', fontSize: 16, textAlign: 'center', padding: 20 }}>
                        {!charge ? 'Chargement…' : vide ? 'Pas encore de prévision pour ce jour' : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: HAUTEUR_PIED, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${MARGE}px`, fontSize: 16, color: '#cfe3fa' }}>
              <span>
                Prévisions {modele.libelle} ({modele.fournisseur}) · un point par {enDepartement ? 'ville' : 'département'} · maximale puis <span style={{ color: '#7db4ff' }}>minimale</span>
              </span>
              <span style={{ fontFamily: POLICE, fontSize: 24, color: '#fff' }}>www.alertes-meteo.com</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
