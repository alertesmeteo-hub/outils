/** Régions administratives (2016) de France métropolitaine, par département. Corse interrogée en « 20 ». */
export const REGIONS: { code: string; name: string; depts: string[] }[] = [
  { code: 'ara', name: 'Auvergne-Rhône-Alpes', depts: ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'] },
  { code: 'bfc', name: 'Bourgogne-Franche-Comté', depts: ['21', '25', '39', '58', '70', '71', '89', '90'] },
  { code: 'bre', name: 'Bretagne', depts: ['22', '29', '35', '56'] },
  { code: 'cvl', name: 'Centre-Val de Loire', depts: ['18', '28', '36', '37', '41', '45'] },
  { code: 'cor', name: 'Corse', depts: ['20'] },
  { code: 'ges', name: 'Grand Est', depts: ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'] },
  { code: 'hdf', name: 'Hauts-de-France', depts: ['02', '59', '60', '62', '80'] },
  { code: 'idf', name: 'Île-de-France', depts: ['75', '77', '78', '91', '92', '93', '94', '95'] },
  { code: 'nor', name: 'Normandie', depts: ['14', '27', '50', '61', '76'] },
  { code: 'naq', name: 'Nouvelle-Aquitaine', depts: ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'] },
  { code: 'occ', name: 'Occitanie', depts: ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'] },
  { code: 'pdl', name: 'Pays de la Loire', depts: ['44', '49', '53', '72', '85'] },
  { code: 'pac', name: 'Provence-Alpes-Côte d’Azur', depts: ['04', '05', '06', '13', '83', '84'] },
];
const byDept = new Map(REGIONS.flatMap((r) => r.depts.map((d) => [d, r] as const)));
export const regionOf = (dept: string) => byDept.get(dept);
