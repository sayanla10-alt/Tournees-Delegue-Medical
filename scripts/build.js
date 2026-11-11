#!/usr/bin/env node
/* =============================================================================
   scripts/build.js : Assemblage modulaire de src/ vers app.js (cross-platform Node.js)
   ============================================================================= */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appJsPath = path.join(root, 'app.js');
const force = process.argv.includes('--force');

const modules = [
  'src/core/utils.js',
  'src/storage/storage.js',
  'src/core/format.js',
  'src/api/supabase.js',
  'src/api/api.js',
  'src/ui/render.js',
  'src/views/accueil.js',
  'src/views/jour.js',
  'src/views/planifier.js',
  'src/views/produits.js',
  'src/views/autour.js',
  'src/views/equipe.js',
  'src/views/repertoire.js',
  'src/views/suivi.js',
  'src/views/reglages.js',
  'src/views/feuilles.js',
  'src/engine/export.js',
  'src/engine/planning.js',
  'src/engine/actions.js',
  'src/ui/lifecycle.js'
];

function extraireVersion(code) {
  const m = String(code || '').match(/var\s+APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}

function comparerVersions(a, b) {
  const pa = String(a || '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

console.log('Construction de app.js depuis les modules src/...');
let totalLignes = 0;
let inclus = 0;
let contenu = '';

for (const mod of modules) {
  const modPath = path.join(root, mod);
  if (!fs.existsSync(modPath)) {
    if (mod === 'src/api/supabase.js') {
      console.warn(`  ! ${mod} absent, ignoré.`);
      continue;
    }
    console.error(`Erreur : Module manquant : ${mod}`);
    process.exit(1);
  }
  const code = fs.readFileSync(modPath, 'utf8');
  const lignes = code.split(/\r?\n/).length;
  totalLignes += lignes;
  inclus++;
  console.log(`  + ${mod} (${lignes} lignes)`);
  contenu += code.replace(/\r?\n/g, '\r\n') + '\r\n';
}

const srcVersion = extraireVersion(contenu);
if (fs.existsSync(appJsPath)) {
  const appJsActuel = fs.readFileSync(appJsPath, 'utf8');
  const appVersion = extraireVersion(appJsActuel);
  if (appVersion && (!srcVersion || comparerVersions(srcVersion, appVersion) < 0)) {
    if (!force) {
      console.error(
        `\nRefus d'écraser app.js (version ${appVersion}) par src/ (version ${srcVersion || 'inconnue'}).`
      );
      console.error(
        'app.js est la source canonique actuelle : les modules src/ ne sont plus à jour.'
      );
      console.error(
        'Relancez avec --force uniquement si vous souhaitez explicitement écraser app.js.'
      );
      process.exit(1);
    }
    console.warn(
      `\nAvertissement (--force) : écrasement de app.js (${appVersion}) par src/ (${srcVersion || 'inconnue'}).`
    );
  }
}

fs.writeFileSync(appJsPath, contenu.trimEnd() + '\r\n', 'utf8');
console.log(`\nSuccès : app.js regénéré (${totalLignes} lignes, ${inclus} modules).`);
