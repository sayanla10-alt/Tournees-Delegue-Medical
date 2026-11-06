#!/usr/bin/env node
/* =============================================================================
   scripts/build.js : Assemblage modulaire de src/ vers app.js (cross-platform Node.js)
   ============================================================================= */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appJsPath = path.join(root, 'app.js');

const modules = [
  'src/core/utils.js',
  'src/storage/storage.js',
  'src/core/format.js',
  'src/api/api.js',
  'src/ui/render.js',
  'src/views/views.js',
  'src/views/feuilles.js',
  'src/engine/engine.js',
  'src/ui/lifecycle.js'
];

console.log('Construction de app.js depuis les modules src/...');
let totalLignes = 0;
let contenu = '';

for (const mod of modules) {
  const modPath = path.join(root, mod);
  if (!fs.existsSync(modPath)) {
    console.error(`Erreur : Module manquant : ${mod}`);
    process.exit(1);
  }
  const code = fs.readFileSync(modPath, 'utf8');
  const lignes = code.split(/\r?\n/).length;
  totalLignes += lignes;
  console.log(`  + ${mod} (${lignes} lignes)`);
  contenu += code.replace(/\r?\n/g, '\r\n') + '\r\n';
}

fs.writeFileSync(appJsPath, contenu.trimEnd() + '\r\n', 'utf8');
console.log(`\nSuccès : app.js regénéré (${totalLignes} lignes).`);
