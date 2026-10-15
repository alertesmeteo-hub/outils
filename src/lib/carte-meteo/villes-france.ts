/**
 * Carte de France : ville représentée par le picto de chaque département de la carte de référence (et des ajouts
 * « Élevé »). La valeur affichée est celle de cette commune (nom exact des fichiers de prévisions), et non plus celle de
 * la commune la plus proche du centre du département : le picto des Bouches-du-Rhône est à Marseille, sa température
 * venait des environs de Salon-de-Provence. Le nom de la ville sert aussi à l'info-bulle et aux noms « Villes ».
 */
export const VILLES_FRANCE: Record<string, string> = {
  '01': 'Bourg-en-Bresse', '02': 'Laon', '03': 'Vichy', '04': 'Digne-les-Bains', '05': 'Gap', '06': 'Nice', '08': 'Charleville-Mézières',
  '09': 'Foix', '10': 'Troyes', '11': 'Carcassonne', '12': 'Rodez', '13': 'Marseille', '14': 'Caen', '15': 'Aurillac', '16': 'Angoulême',
  '17': 'La Rochelle', '18': 'Bourges', '21': 'Dijon', '22': 'Saint-Brieuc', '24': 'Périgueux', '26': 'Montélimar', '27': 'Évreux',
  '29': 'Brest', '2A': 'Ajaccio', '2B': 'Bastia', '30': 'Nîmes', '31': 'Toulouse', '33': 'Bordeaux', '34': 'Montpellier', '35': 'Rennes',
  '37': 'Tours', '38': 'Grenoble', '40': 'Mont-de-Marsan', '43': 'Le Puy-en-Velay', '44': 'Nantes', '45': 'Orléans', '46': 'Cahors',
  '47': 'Agen', '50': 'Cherbourg-en-Cotentin', '51': 'Reims', '52': 'Chaumont', '54': 'Nancy', '56': 'Vannes', '57': 'Metz', '59': 'Lille',
  '61': 'Alençon', '63': 'Clermont-Ferrand', '64': 'Bayonne', '65': 'Tarbes', '66': 'Perpignan', '67': 'Strasbourg', '68': 'Colmar',
  '69': 'Lyon', '71': 'Chalon-sur-Saône', '72': 'Le Mans', '73': 'Albertville', '75': 'Paris', '76': 'Rouen', '80': 'Amiens', '84': 'Avignon',
  '85': 'La Roche-sur-Yon', '86': 'Poitiers', '87': 'Limoges', '89': 'Auxerre', '90': 'Belfort',
};

/**
 * Altitude maximale (m) du point de grille d'une ville de VILLES_FRANCE : au-delà, le relief lissé du modèle la refroidit
 * trop (Gap est à 1 095 m sur la grille d'AROME pour ~735 m en réalité) et on garde la règle du centre du département.
 */
export const ALTITUDE_MAX_VILLE_FRANCE = 800;
