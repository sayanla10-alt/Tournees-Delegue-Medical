#!/usr/bin/env node
/* scripts/minifier.js : produit les versions compactes servies aux téléphones, à partir des fichiers lisibles.
   app.js -> app.min.js, commun.js -> commun.min.js, moteur.js -> moteur.min.js, journal.js -> journal.min.js,
   app.css -> app.min.css. On modifie TOUJOURS les fichiers lisibles, jamais les .min (ils sont régénérés).
   node scripts/minifier.js             -> régénère les fichiers .min
   node scripts/minifier.js --verifier  -> échoue si un .min ne correspond pas à son fichier lisible actuel
   Chaque .min commence par l'empreinte de sa source : un .min oublié est détecté (tests/verifier.sh et GitHub). */
var fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
var racine = path.join(__dirname, '..');
var OUTILS = path.join(racine, 'scripts', '.outils');
var VERSIONS = { terser: '5.36.0', lightningcss: '1.28.2' };

function charger(nom) {
  try { return require(nom); } catch (e) {}
  try { return require(path.join(OUTILS, 'node_modules', nom)); } catch (e) {}
  console.log('Installation de ' + nom + ' ' + VERSIONS[nom] + ' (une seule fois)...');
  cp.execSync('npm install --silent --no-save --no-package-lock --prefix "' + OUTILS + '" ' + nom + '@' + VERSIONS[nom], { stdio: 'inherit' });
  return require(path.join(OUTILS, 'node_modules', nom));
}

var FICHIERS = ['commun.js', 'moteur.js', 'app.js', 'journal.js', 'app.css'];
function cible(f) { return f.replace(/\.(js|css)$/, '.min.$1'); }
function lire(f) { return fs.readFileSync(path.join(racine, f), 'utf8').replace(/^﻿/, ''); }
function empreinte(src) { return crypto.createHash('sha1').update(src).digest('hex').slice(0, 12); }
function entete(f, src) { return '/*! ' + f + ' ' + empreinte(src) + ' : version compacte générée par scripts/minifier.js, ne pas modifier */\n'; }

if (process.argv.indexOf('--verifier') >= 0) {
  var ko = FICHIERS.filter(function (f) {
    var m = path.join(racine, cible(f));
    return !fs.existsSync(m) || fs.readFileSync(m, 'utf8').split('\n')[0] !== entete(f, lire(f)).trim();
  });
  if (ko.length) { console.error('Version compacte périmée : ' + ko.join(', ') + ' (lancez « node scripts/minifier.js »).'); process.exit(1); }
  console.log('OK    versions compactes à jour (' + FICHIERS.length + ' fichiers)');
  process.exit(0);
}

(async function () {
  var terser = charger('terser'), lcss = charger('lightningcss');
  for (var i = 0; i < FICHIERS.length; i++) {
    var f = FICHIERS[i], src = lire(f), sortie;
    if (/\.css$/.test(f)) {
      sortie = lcss.transform({ filename: f, code: Buffer.from(src), minify: true }).code.toString();
    } else {
      // Les noms globaux (window.*, fonctions de premier niveau partagées entre fichiers) ne sont jamais renommés.
      sortie = (await terser.minify(src, { ecma: 2017, compress: { passes: 2 }, mangle: true, format: { comments: false } })).code;
    }
    fs.writeFileSync(path.join(racine, cible(f)), entete(f, src) + sortie + '\n');
    console.log(f.padEnd(11) + ' ' + String(src.length).padStart(8) + ' -> ' + String(sortie.length).padStart(8) + ' octets  ' + cible(f));
  }
})().catch(function (e) { console.error(e); process.exit(1); });
