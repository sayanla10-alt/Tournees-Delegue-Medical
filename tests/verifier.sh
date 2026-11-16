#!/bin/bash
# tests/verifier.sh : à lancer avant chaque publication. Vérifie la syntaxe de tous les fichiers, puis parcourt
# l'application de bout en bout sur un téléphone simulé, contre un faux serveur (rien ne touche la vraie base).
# Usage : bash tests/verifier.sh        (code de sortie 0 = tout est conforme)
cd "$(dirname "$0")/.." || exit 1
export PORT_WEB=${PORT_WEB:-8777} PORT_API=${PORT_API:-8779} JETON="$(pwd)/tests/.jeton"
echo "== Syntaxe"
node -e "
const fs=require('fs'),vm=require('vm');let ko=0;
const l=['app.js','commun.js','moteur.js','sw.js'].concat(fs.readdirSync('apps-script').filter(f=>f.endsWith('.gs')).map(f=>'apps-script/'+f)).concat(fs.existsSync('journal.js')?['journal.js']:[]);
for(const f of l){try{new vm.Script(fs.readFileSync(f,'utf8').replace(/^﻿/,''),{filename:f});}catch(e){ko++;console.log('ÉCHEC '+f+' : '+e.message);}}
console.log(ko?ko+' fichier(s) en erreur':'OK    '+l.length+' fichiers');process.exit(ko?1:0);" || exit 1
node tests/serveur.js > tests/.serveur.log 2>&1 & P1=$!
python3 -m http.server "$PORT_WEB" > /dev/null 2>&1 & P2=$!
trap 'kill $P1 $P2 2>/dev/null' EXIT
for i in $(seq 1 40); do grep -q "^ok" tests/.serveur.log 2>/dev/null && break; sleep 0.5; done
echo "== Parcours de l'application"
node tests/e2e.js 2>&1 | grep -v "agent-proxy\|^- \|Allowed\|For details"
exit ${PIPESTATUS[0]}
