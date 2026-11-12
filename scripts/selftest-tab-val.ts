import assert from 'node:assert/strict';
import { lireListeValeurs } from '../src/lib/carte-meteo/tab-val';

const exemple = `20.9°C à Perpignan - El Vernet
20.7°C à Cabestany
20.2°C à Céret
19.9°C à Perpignan
19.8°C à Torreilles
19.7°C au Boulou
19.5°C à Canet-en-Roussillon
19.4°C à Ille-sur-Tet
19.2°C à Vinça
18.8°C au Perthus
18.6°C à Vives
18.6°C à Saint-Paul-de-Fenouillet
18°C à Eus
17.3°C à Cap Béar
17.3°C à Estoher
17.3°C à Caixas
17.3°C à Serralongue
17.1°C à Taurinya
16.6°C à Saint-Marsal
16.6°C à Le Tech - La Llau
15.8°C à Railleu
15.6°C à Mosset
14.1°C à Formiguères
11.9°C à Targassonne`;

const r = lireListeValeurs(exemple);
assert.equal(r.lignes.length, 24, 'les 24 lignes sont comprises');
assert.equal(r.ignorees.length, 0);
assert.equal(r.unite, '°');
assert.deepEqual(r.lignes[0], { nom: 'Perpignan - El Vernet', valeur: 20.9, unite: '°' });
assert.equal(r.lignes[5].nom, 'Le Boulou', '« au Boulou » devient « Le Boulou »');
assert.equal(r.lignes[9].nom, 'Le Perthus');
assert.equal(r.lignes[12].valeur, 18, 'valeur entière');
assert.equal(r.lignes[19].nom, 'Le Tech - La Llau', '« à Le Tech » : le nom garde son article');
assert.equal(r.lignes[6].nom, 'Canet-en-Roussillon', "« en » dans un nom composé n'est pas une préposition");

const autres = lireListeValeurs(`Perpignan : 20,9°C
1. 45 km/h aux Angles
12 mm à la Llagonne
−3,5 °C à l'Hospitalet
Ligne sans valeur
20.9`);
assert.deepEqual(autres.lignes.map((l) => l.nom), ['Perpignan', 'Les Angles', 'La Llagonne', 'L’Hospitalet']);
assert.deepEqual(autres.lignes.map((l) => l.valeur), [20.9, 45, 12, -3.5]);
assert.deepEqual(autres.lignes.map((l) => l.unite), ['°', 'km/h', 'mm', '°']);
assert.deepEqual(autres.ignorees, ['Ligne sans valeur', '20.9']);
console.log('OK : lecture des listes de valeurs (Tab Val)');
