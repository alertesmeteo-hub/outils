'use client';

/* eslint-disable @next/next/no-img-element -- pictos locaux (public/), exportés tels quels en JPG */
import { forwardRef } from 'react';
import { PALIERS_TEMPERATURE, palierDe } from '@/lib/carte-meteo/cartes-info';
import { cheminPictoImage } from '@/lib/carte-meteo/pictos';
import { couleurRafale } from '@/lib/carte-meteo/vent';

export interface CelluleJour {
  maxi: number | null;
  mini: number | null;
  picto: string | null;
  rafale: number | null;
}
export interface LigneTableau {
  nom: string;
  cellules: (CelluleJour | null)[];
}

export const LARGEUR_TABLEAU = 1280;
const POLICE = "Impact, 'Arial Narrow Bold', 'Arial Black', sans-serif";
const SEUIL_RAFALE = 80;

const jourLong = (dateISO: string) =>
  new Date(`${dateISO}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).toUpperCase();

/**
 * Tableau de prévisions (une ligne par région, département ou ville ; par jour : picto, maximale, minimale et rafale), exportable en JPG.
 * Le conteneur a une largeur fixe (LARGEUR_TABLEAU) : l'export donne la même image sur tous les écrans.
 */
const TableauPrevisions = forwardRef<HTMLDivElement, { dates: string[]; lignes: LigneTableau[]; titre: string; sousTitre: string; logoUrl: string | null; logoFondBlanc?: boolean }>(
  function TableauPrevisions({ dates, lignes, titre, sousTitre, logoUrl, logoFondBlanc = true }, ref) {
    const colonneNom = 330;
    const largeurJour = (LARGEUR_TABLEAU - 48 - colonneNom) / dates.length;
    return (
      <div ref={ref} style={{ width: LARGEUR_TABLEAU, background: 'linear-gradient(160deg, #0b2a4a 0%, #123c6b 100%)', color: '#fff', fontFamily: 'Arial, Helvetica, sans-serif', padding: 24, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 16 }}>
          {logoUrl && <img src={logoUrl} alt="" style={{ height: 76, background: logoFondBlanc ? '#fff' : 'transparent', borderRadius: 8 }} />}
          <div style={{ background: 'rgba(255,255,255,0.94)', borderRadius: 12, padding: '10px 26px', flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: POLICE, fontSize: 40, lineHeight: 1.05, color: '#0b2a4a', whiteSpace: 'nowrap', overflow: 'hidden' }}>{titre}</div>
            <div style={{ fontFamily: POLICE, fontSize: 21, color: '#2563a8', marginTop: 2 }}>{sousTitre}</div>
          </div>
        </div>
        <div style={{ display: 'flex', background: '#0a2342', borderRadius: '10px 10px 0 0', fontFamily: POLICE, fontSize: 22, letterSpacing: 0.5 }}>
          <div style={{ width: colonneNom, padding: '10px 14px' }}> </div>
          {dates.map((d) => (
            <div key={d} style={{ width: largeurJour, padding: '10px 6px', textAlign: 'center', borderLeft: '2px solid rgba(255,255,255,0.25)' }}>
              {jourLong(d)}
            </div>
          ))}
        </div>
        {lignes.map((l, i) => (
          <div key={l.nom} style={{ display: 'flex', alignItems: 'center', background: i % 2 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.18)', minHeight: 62 }}>
            <div style={{ width: colonneNom, padding: '0 14px', fontFamily: POLICE, fontSize: 25, letterSpacing: 0.3 }}>{l.nom.toUpperCase()}</div>
            {l.cellules.map((c, k) => (
              <div key={k} style={{ width: largeurJour, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden', borderLeft: '2px solid rgba(255,255,255,0.25)', alignSelf: 'stretch' }}>
                {c ? (
                  <>
                    {c.picto && cheminPictoImage(c.picto) && <img src={cheminPictoImage(c.picto)} alt="" style={{ width: 50, height: 50, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }} />}
                    <span style={{ fontFamily: POLICE, fontSize: 30, color: '#111', background: c.maxi != null ? palierDe(PALIERS_TEMPERATURE, c.maxi).fond : '#ddd', borderRadius: 8, padding: '2px 10px', minWidth: 54, textAlign: 'center' }}>
                      {c.maxi != null ? `${Math.round(c.maxi)}°` : '–'}
                    </span>
                    <span style={{ fontFamily: POLICE, fontSize: 26, color: '#9fd0ff', minWidth: 46, textAlign: 'center' }}>{c.mini != null ? `${Math.round(c.mini)}°` : '–'}</span>
                    {c.rafale != null && c.rafale >= SEUIL_RAFALE ? (
                      <span style={{ fontFamily: POLICE, fontSize: 16, background: couleurRafale(Math.round(c.rafale / 5) * 5).fond, color: couleurRafale(Math.round(c.rafale / 5) * 5).texte, border: '2px solid #fff', borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}>
                        {Math.round(c.rafale / 5) * 5}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span style={{ opacity: 0.5 }}>–</span>
                )}
              </div>
            ))}
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 16, color: '#cfe3fa' }}>
          <span>
            Maximale sur fond de couleur, <span style={{ color: '#9fd0ff' }}>minimale en bleu</span>, rafales de {SEUIL_RAFALE} km/h et plus
          </span>
          <span style={{ fontFamily: POLICE, fontSize: 22, color: '#fff' }}>www.alertes-meteo.com</span>
        </div>
      </div>
    );
  }
);
export default TableauPrevisions;
