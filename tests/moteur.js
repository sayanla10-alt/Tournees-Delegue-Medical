// tests/moteur.js : contrôles unitaires du moteur de planification (commun.js + moteur.js), sans app ni serveur.
// Lancé par tests/verifier.sh à chaque publication.
var fs = require('fs'), vm = require('vm'), path = require('path');
var racine = path.join(__dirname, '..');
var sandbox = {}; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(racine, 'commun.js'), 'utf8'), sandbox, { filename: 'commun.js' });
vm.runInContext(fs.readFileSync(path.join(racine, 'moteur.js'), 'utf8'), sandbox, { filename: 'moteur.js' });
var Moteur = sandbox.Moteur;
var ko = 0;
function ok(libelle, vrai) { if (vrai) console.log('OK    ' + libelle); else { console.log('ÉCHEC ' + libelle); ko++; } }

function arret(nom, commune, quartier, lieu, lat, lon, heureDebut, heureFin, extra) {
  return Object.assign({
    uid: 'u-' + nom, code: 'c-' + nom, nom: nom, commune: commune, quartier: quartier, secteur: '',
    lieu: lieu, lat: lat, lon: lon, debut: heureDebut, fin: heureFin, rdv: '', statut: '', garde: false, impose: false
  }, extra || {});
}
var dep = { lat: 5.359, lon: -3.996 };

// 3.31.191 : plusieurs médecins du même secteur (Riviera, Cocody), un RDV à heure fixe au milieu de la journée chez
// l'un d'eux, et une visite dans un autre secteur (Angré) : la tournée ne doit jamais sortir de Riviera puis y revenir.
(function () {
  var jour = [
    arret('Riviera A', 'Cocody', 'Riviera 2', 'Cabinet A', 5.370, -3.980, '08:00', '18:00'),
    arret('Riviera B', 'Cocody', 'Riviera Golf', 'Cabinet B', 5.374, -3.976, '08:00', '18:00'),
    arret('Riviera C RDV', 'Cocody', 'Riviera 3', 'Clinique C', 5.366, -3.984, '08:00', '18:00', { rdv: '14:00', lieu: 'Clinique C', impose: true }),
    arret('Riviera D', 'Cocody', 'Riviera Palmeraie', 'Cabinet D', 5.362, -3.988, '08:00', '18:00'),
    arret('Angré X', 'Cocody', 'Angré 8e Tranche', 'Cabinet X', 5.395, -3.960, '08:00', '18:00')
  ];
  var out = Moteur.ordonnerJour(jour, dep, 0);
  var secteurs = out.map(function (a) { return Moteur.cleZoneSecteur({ a: a }); });
  var vus = {}, coupures = 0, prec = null;
  secteurs.forEach(function (s) { if (s !== prec && vus[s]) coupures++; vus[s] = true; prec = s; });
  ok('un RDV à heure fixe ne scinde pas son secteur en deux groupes', coupures === 0);
})();

// Contrôle unitaire direct de regrouper() : une route déjà construite, avec un établissement d'un autre secteur
// intercalé entre deux visites du même secteur, doit en ressortir repoussé, quand rien n'empêche de le faire
// (pas de retard, pas de détour). Avant le correctif, regrouper() ne regroupait que par établissement, jamais par secteur.
(function () {
  var route = [
    arret('Riviera 1', 'Cocody', 'Riviera 2', 'Cabinet R1', 5.370, -3.980, '08:00', '18:00'),
    arret('Riviera 2', 'Cocody', 'Riviera Golf', 'Cabinet R2', 5.374, -3.976, '08:00', '18:00'),
    arret('Angre 1', 'Cocody', 'Angré 8e Tranche', 'Cabinet A1', 5.395, -3.960, '08:00', '18:00'),
    arret('Riviera 3 RDV', 'Cocody', 'Riviera 3', 'Clinique R3', 5.366, -3.984, '08:00', '18:00', { rdv: '09:30', impose: true }),
    arret('Riviera 4', 'Cocody', 'Riviera Palmeraie', 'Cabinet R4', 5.362, -3.988, '08:00', '18:00')
  ];
  ['08:00', '08:30', '09:00', '09:30', '10:00'].forEach(function (h, i) { route[i].heure = h; });
  var items = route.map(Moteur.item);
  var out = Moteur.regrouper(items, { coord: dep });
  var noms = out.map(function (it) { return it.a.nom; });
  ok('établissement isolé d\'un autre secteur repoussé après le bloc Riviera', noms.indexOf('Angre 1') === noms.length - 1);
})();

console.log(ko ? ko + ' contrôle(s) moteur en échec' : 'OK    tous les contrôles moteur sont conformes');
process.exit(ko ? 1 : 0);
