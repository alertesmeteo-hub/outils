// GÉNÉRÉ depuis l'API publique ADEME (jeu « Base carbone® / Base Empreinte », data.ademe.fr/datasets/base-carboner),
// éléments « Valide générique », catégorie « Transport de personnes », export du 2026-09-19.
// Ne pas modifier les valeurs à la main : régénérer depuis la source. `id` = « Identifiant de l'élément » ADEME.
// Facteurs « kgCO2e/km » = par kilomètre de véhicule ; « kgCO2e/passager.km » = par passager et par kilomètre.
export type Unit = 'kgCO2e/km' | 'kgCO2e/passager.km';
export type Factor = { id: number; label: string; value: number; unit: Unit };

export const ADEME_SOURCE = {
  name: 'ADEME – Base Empreinte® (Base Carbone®)',
  url: 'https://data.ademe.fr/datasets/base-carboner',
  exportedAt: '2026-09-19',
};

export const factors = {
  car_moyenne: { id: 43791, label: "Voiture, motorisation moyenne", value: 0.256, unit: 'kgCO2e/km' },
  car_essence: { id: 43787, label: "Voiture essence", value: 0.357, unit: 'kgCO2e/km' },
  car_gazole: { id: 43788, label: "Voiture gazole", value: 0.19, unit: 'kgCO2e/km' },
  car_gpl: { id: 43790, label: "Voiture GPL", value: 0.224, unit: 'kgCO2e/km' },
  car_e85: { id: 43786, label: "Voiture E85 (superéthanol)", value: 0.174, unit: 'kgCO2e/km' },
  car_electrique: { id: 28007, label: "Voiture électrique (compacte)", value: 0.103, unit: 'kgCO2e/km' },
  moto_petite: { id: 43779, label: "Moto ≤ 250 cm³", value: 0.087, unit: 'kgCO2e/km' },
  moto_grosse: { id: 43782, label: "Moto > 250 cm³", value: 0.217, unit: 'kgCO2e/km' },
  tgv: { id: 43256, label: "TGV", value: 0.00293, unit: 'kgCO2e/passager.km' },
  ter: { id: 43255, label: "TER", value: 0.0277, unit: 'kgCO2e/passager.km' },
  intercites: { id: 43272, label: "Intercités", value: 0.0075, unit: 'kgCO2e/passager.km' },
  rer: { id: 43254, label: "RER / Transilien (Île-de-France)", value: 0.00978, unit: 'kgCO2e/passager.km' },
  metro: { id: 43778, label: "Métro (Île-de-France)", value: 0.00442, unit: 'kgCO2e/passager.km' },
  tram: { id: 43785, label: "Tramway (Île-de-France)", value: 0.00421, unit: 'kgCO2e/passager.km' },
  bus: { id: 43739, label: "Autobus (gazole)", value: 0.122, unit: 'kgCO2e/passager.km' },
  autocar: { id: 43740, label: "Autocar (gazole)", value: 0.0376, unit: 'kgCO2e/passager.km' },
  velo_elec: { id: 28331, label: "Vélo à assistance électrique", value: 0.011, unit: 'kgCO2e/km' },
  trottinette: { id: 28329, label: "Trottinette électrique", value: 0.0249, unit: 'kgCO2e/km' },
  avion_lt500_t: { id: 43745, label: "Avion <500 km (avec traînées)", value: 0.289, unit: 'kgCO2e/passager.km' },
  avion_lt500: { id: 43746, label: "Avion <500 km (sans traînées)", value: 0.159, unit: 'kgCO2e/passager.km' },
  avion_500_t: { id: 43743, label: "Avion 500-1000 km (avec traînées)", value: 0.225, unit: 'kgCO2e/passager.km' },
  avion_500: { id: 43744, label: "Avion 500-1000 km (sans traînées)", value: 0.124, unit: 'kgCO2e/passager.km' },
  avion_1000_t: { id: 43741, label: "Avion 1000-2000 km (avec traînées)", value: 0.185, unit: 'kgCO2e/passager.km' },
  avion_1000: { id: 43742, label: "Avion 1000-2000 km (sans traînées)", value: 0.102, unit: 'kgCO2e/passager.km' },
  avion_2000_t: { id: 43747, label: "Avion 2000-5000 km (avec traînées)", value: 0.167, unit: 'kgCO2e/passager.km' },
  avion_2000: { id: 43748, label: "Avion 2000-5000 km (sans traînées)", value: 0.0918, unit: 'kgCO2e/passager.km' },
  avion_5000_t: { id: 43749, label: "Avion >5000 km (avec traînées)", value: 0.178, unit: 'kgCO2e/passager.km' },
  avion_5000: { id: 43750, label: "Avion >5000 km (sans traînées)", value: 0.0979, unit: 'kgCO2e/passager.km' },
} as const satisfies Record<string, Factor>;
