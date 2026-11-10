#!/usr/bin/env node
/* scripts/commun.js : copie commun.js (source unique) vers apps-script/Commun.gs.
   node scripts/commun.js            -> écrit apps-script/Commun.gs
   node scripts/commun.js --verifier -> échoue si les deux fichiers diffèrent (à lancer avant chaque publication) */
var fs = require('fs'), path = require('path');
var racine = path.join(__dirname, '..');
var src = fs.readFileSync(path.join(racine, 'commun.js'), 'utf8');
var cible = path.join(racine, 'apps-script', 'Commun.gs');
if (process.argv.indexOf('--verifier') >= 0) {
  var actuel = fs.existsSync(cible) ? fs.readFileSync(cible, 'utf8') : '';
  if (actuel !== src) { console.error('apps-script/Commun.gs diffère de commun.js : lancez « node scripts/commun.js ».'); process.exit(1); }
  console.log('Commun.gs identique à commun.js.');
} else {
  fs.writeFileSync(cible, src);
  console.log('apps-script/Commun.gs mis à jour depuis commun.js.');
}
