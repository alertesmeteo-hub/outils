import type { ToolDefinition, Tone } from '../types';
import { fmt } from '../engine';

export const indiceUv: ToolDefinition = {
  slug: 'indice-uv',
  path: '/soleil/indice-uv',
  name: 'Indice UV : niveau de risque et protection',
  category: 'meteo',
  icon: '☀️',
  shortDescription: 'Situez un indice UV sur l’échelle de l’OMS et découvrez les mesures de protection associées.',
  h1: 'Indice UV : niveau de risque et protection solaire',
  title: 'Indice UV : échelle OMS et protection solaire recommandée',
  metaDescription: 'Saisissez l’indice UV du jour pour connaître son niveau (faible à extrême) selon l’échelle de l’OMS et les mesures de protection recommandées pour la peau et les yeux.',
  keywords: ['indice UV', 'échelle UV', 'protection solaire', 'coup de soleil', 'UV OMS', 'indice UV extrême', 'crème solaire'],
  intro:
    'L’indice UV mesure l’intensité du rayonnement ultraviolet solaire à un endroit et à un moment donnés : plus il est élevé, plus les dommages à la peau et aux yeux surviennent vite. Saisissez l’indice UV du jour, relevé dans un bulletin météo ou une application : l’outil le situe sur l’échelle de l’OMS et liste les protections recommandées.',
  method: [
    'Échelle de l’Indice UV mondial (OMS, OMM, PNUE, Commission internationale de protection contre les rayonnements non ionisants) : 0 à 2 faible ; 3 à 5 modéré ; 6 à 7 élevé ; 8 à 10 très élevé ; 11 et plus extrême.',
    'L’outil ne calcule pas l’indice UV : il l’interprète. La valeur doit provenir d’une prévision ou d’une mesure.',
    'Les conseils de protection sont ceux de l’échelle : ils sont généraux et ne dépendent pas de votre phototype.',
  ],
  example: 'Un indice UV de 7 est « élevé » : protection nécessaire, éviter le soleil en milieu de journée, chapeau, lunettes et crème solaire.',
  interpretation: [
    'L’indice UV dépend de la hauteur du soleil, de la saison, de l’altitude, de la couverture nuageuse et de la réflexion du sol (neige, sable, eau).',
    'Même par temps nuageux, une grande partie des UV peut atteindre le sol.',
    'Les enfants, les personnes à peau claire, celles qui prennent certains médicaments et les personnes ayant des antécédents de cancer de la peau doivent être particulièrement prudentes. Pour un avis personnalisé, consultez un professionnel de santé.',
  ],
  faq: [
    { q: 'Quel indice UV est dangereux ?', a: 'À partir de 3 une protection est recommandée ; à partir de 8 le risque est très élevé et l’exposition doit être limitée.' },
    { q: 'Où trouver l’indice UV du jour ?', a: 'Dans les bulletins de Météo-France et les applications météo, qui le prévoient pour la journée, souvent par ciel dégagé.' },
    { q: 'Y a-t-il des UV quand il y a des nuages ?', a: 'Oui : les nuages n’arrêtent qu’une partie des UV, et des éclaircies peuvent renforcer momentanément le rayonnement.' },
    { q: 'La crème solaire suffit-elle ?', a: 'Elle ne doit pas être utilisée pour prolonger l’exposition : associez-la à l’ombre, aux vêtements couvrants, au chapeau et aux lunettes.' },
  ],
  related: ['lever-coucher-soleil', 'indice-chaleur', 'humidex'],
  sources: ['Indice UV mondial : guide pratique (OMS, OMM, PNUE, ICNIRP), échelle et catégories d’exposition.'],
  disclaimer: 'Information générale de prévention, non médicale. Pour un avis personnalisé, consultez un professionnel de santé.',
  fields: [{ id: 'uv', label: 'Indice UV', type: 'number', min: 0, max: 16, required: true, default: '6', placeholder: 'ex. 6' }],
  compute: (p) => {
    const uv = p.uv as number;
    let label: string, tone: Tone, items: string[];
    if (uv < 3) { label = 'Faible'; tone = 'ok'; items = ['Aucune protection particulière nécessaire pour la plupart des personnes.', 'Portez des lunettes de soleil par temps clair, surtout sur neige.'];
    } else if (uv < 6) { label = 'Modéré'; tone = 'info'; items = ['Protection recommandée : chapeau, lunettes de soleil, crème solaire.', 'Cherchez l’ombre en milieu de journée.'];
    } else if (uv < 8) { label = 'Élevé'; tone = 'warn'; items = ['Protection nécessaire : chapeau, lunettes, vêtements couvrants et crème solaire.', 'Limitez l’exposition entre 12 h et 16 h.'];
    } else if (uv < 11) { label = 'Très élevé'; tone = 'danger'; items = ['Protection renforcée indispensable.', 'Évitez le soleil en milieu de journée : cherchez l’ombre et un abri.', 'La peau non protégée peut brûler en quelques minutes.'];
    } else { label = 'Extrême'; tone = 'extreme'; items = ['Protection maximale indispensable.', 'Évitez l’exposition au soleil en milieu de journée.', 'Les coups de soleil surviennent très rapidement.']; }
    return {
      level: { label: `Indice UV ${label.toLowerCase()}`, tone },
      headline: { label: 'Indice UV', value: fmt(uv, 1) },
      gauge: { value: Math.min(12, uv), min: 0, max: 12, caption: 'Échelle de l’indice UV (OMS)', segments: [{ to: 3, tone: 'ok' }, { to: 6, tone: 'info' }, { to: 8, tone: 'warn' }, { to: 11, tone: 'danger' }, { to: 12, tone: 'extreme' }] },
      lists: [{ title: 'Protection recommandée', items }],
      notes: ['Information générale de prévention, non médicale.'],
      shareText: `Indice UV ${fmt(uv, 1)} : ${label.toLowerCase()} (échelle OMS).`,
    };
  },
  addedAt: '2026-09-20',
  updatedAt: '2026-09-20',
};
