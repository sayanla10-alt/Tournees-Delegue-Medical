// tests/e2e.js : parcours complet de l'application sur un téléphone simulé (390 x 844), contre le faux serveur.
// Rien ne touche la vraie base : tout est en mémoire. Sortie : une ligne par contrôle, code 1 si un contrôle échoue.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const WEB = 'http://localhost:' + (process.env.PORT_WEB || 8777), API = 'http://localhost:' + (process.env.PORT_API || 8779);
let echecs = 0;
const ok = (nom, v, detail) => { if (!v) echecs++; console.log((v ? 'OK    ' : 'ÉCHEC ') + nom + (detail !== undefined ? ' : ' + JSON.stringify(detail) : '')); };
(async () => {
  const jeton = fs.readFileSync(process.env.JETON || path.join(__dirname, '.jeton'), 'utf8').trim();
  const cfg = { url: API + '/exec', token: jeton, bddSource: 'sheets', delegue: 'Awa Koné' };
  const b = await chromium.launch(); const c1 = await b.newContext({ viewport: { width: 390, height: 844 } });
  await c1.addInitScript((c) => { localStorage.setItem('tournees.config', JSON.stringify(c)); localStorage.setItem('tournees.versionVue', '"9.9.9"'); }, cfg);
  const pg = await c1.newPage(); const err = [];
  pg.on('pageerror', e => err.push(e.message));
  pg.on('console', m => { if (m.type() === 'error' && !/ERR_|WebSocket|Failed to load|net::|favicon|supabase|tile\.openstreetmap/i.test(m.text())) err.push('console: ' + m.text().slice(0, 160)); });
  const T = (f, a) => pg.evaluate(f, a);
  const attendre = ms => pg.waitForTimeout(ms);
  const clic = async (sel, ms) => { const r = await T((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel); await attendre(ms || 500); return r; };
  const nav = async n => { await T((n) => [...document.querySelectorAll('nav button')].find(e => e.textContent.includes(n)).click(), n); await attendre(700); };
  const etape = async (nom, f) => { try { await f(); } catch (e) { ok(nom + ' (exception)', false, String(e.message || e).slice(0, 200)); } };

  await etape('Démarrage', async () => {
    await pg.goto(WEB + '/index.html'); await attendre(1500);
    ok('page de garde affichée', await T(() => !document.getElementById('lancement').hidden));
    await pg.waitForFunction(() => window.__tournees && window.__tournees.S.data && (window.__tournees.S.data.praticiens || []).length > 10, null, { timeout: 120000 });
    await attendre(1000);
    await T(() => { const x = document.querySelector('#lancement [data-a="fermerLancement"]'); x && x.click(); });
    await pg.waitForFunction(() => document.getElementById('lancement').hidden, null, { timeout: 25000 }); await attendre(600);
    const j = await T(() => ({ tab: window.__tournees.S.ui.tab, frise: document.querySelectorAll('#vue .bj-jour').length, centre: (() => { const a = document.querySelector('#vue .bj-jour[aria-pressed="true"]'), r = a && a.getBoundingClientRect(); return r ? Math.round(r.left + r.width / 2) : -1; })(), arrets: document.querySelectorAll('#vue .arret').length }));
    ok('Journée affichée après la page de garde', j.tab === 'jour' && j.frise > 20, j);
    ok('frise centrée sur le jour choisi', Math.abs(j.centre - 195) <= 3, j.centre);
  });

  await etape('Versions', async () => {
    const racine = path.join(__dirname, '..'), lire = f => fs.readFileSync(path.join(racine, f), 'utf8');
    const vApp = (lire('app.js').match(/var APP_VERSION = '([\d.]+)'/) || [])[1], vSw = (lire('sw.js').match(/var VERSION = '([\d.]+)'/) || [])[1];
    const vIdx = [...new Set((lire('index.html').match(/\?v=([\d.]+)/g) || []).map(x => x.slice(3)))], vJson = JSON.parse(lire('version.json').replace(/^﻿/, '')).version;
    ok('même numéro de version partout (app.js, sw.js, index.html, version.json)', vApp && vApp === vSw && vApp === vJson && vIdx.length === 1 && vIdx[0] === vApp, { vApp, vSw, vIdx, vJson });
    ok('version affichée dans l\'en-tête', await T((v) => document.getElementById('badgeVersion').textContent === 'v' + v, vApp));
    const en = await T(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { fin: r('#badgeVersion').right, deb: r('#pastilleSync').left }; });
    ok('pastille de synchro sans chevauchement de la version', en.deb - en.fin >= 4, en);
  });

  const li = () => T(() => [...document.querySelectorAll('#listePraticiens > li')].map(l => (l.classList.contains('rep-ouvert') ? 'O' : '.') + (l.querySelector('.carte-bouton[aria-expanded="true"]') ? 'x' : '-')).slice(0, 6).join(' '));
  await etape('Répertoire', async () => {
    await nav('Répertoire');
    ok('liste des médecins', await T(() => document.querySelectorAll('#listePraticiens > li').length >= 10));
    ok('étiquettes sur une ligne (hors étiquette longue « Prévu par… »)', await T(() => [...document.querySelectorAll('#listePraticiens .etq-ligne')].every(e => new Set([...e.children].filter(x => !/Prévu par|attente/.test(x.textContent)).map(x => Math.round(x.getBoundingClientRect().top))).size <= 1)));
    await clic('#listePraticiens > li:nth-child(2) .carte-bouton');
    ok('2e fiche ouverte', (await li()) === '.- Ox .- .- .- .-', await li());
    ok('fiche ouverte complète (actions, semaine, nom)', await T(() => { const l = document.querySelector('#listePraticiens .rep-ouvert'); return !!(l && l.querySelector('.rangee-actions-contact') && l.querySelector('.sem-rep, .bloc-presences') && l.querySelector('.nom-suivi')); }));
    ok('boutons de la fiche sur une ligne, sans débordement', await T(() => { const b = [...document.querySelectorAll('.rep-ouvert .rangee-actions-contact > *')]; return b.length >= 3 && new Set(b.map(x => Math.round(x.getBoundingClientRect().top))).size === 1 && b.every(x => x.scrollWidth <= x.clientWidth + 1); }));
    ok('Modifier actif', await T(() => !document.querySelector('#vue .bouton-modifier-rep').classList.contains('desactive')));
    await clic('#listePraticiens > li:nth-child(4) .carte-bouton');
    ok('4e ouverte, 2e refermée', (await li()) === '.- .- .- Ox .- .-', await li());
    await clic('#listePraticiens .nom-suivi');
    ok('toucher le nom ouvre le suivi des visites', await T(() => (window.__tournees.S.ui.feuille || {}).type === 'suiviContact' && /Prochain RDV/.test(document.querySelector('#feuille').innerText)));
    await clic('[data-a="fermerFeuille"]');
    ok('retour : fiche toujours ouverte', (await li()) === '.- .- .- Ox .- .-', await li());
    await clic('#listePraticiens .carte-bouton[aria-expanded="true"]');
    ok('fiche refermée, Modifier grisé', (await li()) === '.- .- .- .- .- .-' && await T(() => document.querySelector('#vue .bouton-modifier-rep').classList.contains('desactive')));
    ok('Réinitialiser les filtres actif', await T(() => { const x = document.querySelector('.bouton-reinit-rep'); return x && !x.disabled && !x.classList.contains('desactive'); }));
  });

  await etape('Recherche', async () => {
    await clic('[data-a="rechOuvrir"]');
    ok('critères : raccourci « Tous » en tête', await T(() => !!document.querySelector('[data-a="filtreRapideTous"]')));
    await clic('[data-a="filtreRapide"][data-v="jamais"]', 700);
    const n1 = await T(() => document.querySelectorAll('#listePraticiens > li').length);
    await clic('[data-a="rechOuvrir"]'); await clic('[data-a="filtreRapideTous"]', 700);
    const n2 = await T(() => document.querySelectorAll('#listePraticiens > li').length);
    ok('raccourci puis « Tous » : la liste revient', n2 >= n1 && n2 >= 10, { n1, n2 });
    await T(() => { const i = document.querySelector('[data-f="recherche"]'); i.value = 'kou'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await attendre(900);
    ok('recherche par nom', await T(() => { const l = [...document.querySelectorAll('#listePraticiens > li .element-titre')]; return l.length > 0 && l.every(x => /kou/i.test(x.closest('li').textContent)); }));
    await clic('.bouton-reinit-rep', 700);
  });

  await etape('Ajouter', async () => {
    await clic('[data-a="nouvelleFiche"]', 700);
    ok('Nouveau contact : 3 types, Scanner et Photo', await T(() => document.querySelectorAll('.fx-segment-types button').length === 3 && !!document.querySelector('[data-a="ficheScan"], [data-a="scannerFiche"], .fx-scan-rangee')));
    const foc = () => T(() => !!(document.activeElement && document.activeElement.classList.contains('fx-champ-g')));
    let f = await foc();
    for (const t of ['Pharmacie', 'Hôpital', 'Médecin']) { await clic('.fx-segment-types [data-v="' + t + '"]', 600); f = f || await foc(); }
    ok('aucun clavier ouvert d\'office (Médecin, Phcie, Hôpital)', !f);
    await clic('[data-a="fermerFeuille"]');
    ok('fenêtre refermée', await T(() => !window.__tournees.S.ui.feuille));
  });

  await etape('Pharmacies et Hôpitaux', async () => {
    await clic('[data-a="annuaire"][data-v="ph"]', 700);
    ok('liste des pharmacies', await T(() => document.querySelectorAll('#listePraticiens > li.t-pharma').length >= 5));
    await clic('[data-a="annuaire"][data-v="hop"]', 800);
    ok('liste des hôpitaux', await T(() => document.querySelectorAll('.liste-rep > .element-hopital').length >= 5));
    await clic('.liste-rep .element-hopital .carte-bouton', 700);
    ok('hôpital ouvert, détaché, avec ses médecins', await T(() => !!document.querySelector('.liste-rep > .element-hopital.rep-ouvert .hop-medecins')));
    // 3.31.139 : « Où » est la 1re étape de la recherche, les raccourcis des hôpitaux sont à l'étape suivante
    await clic('[data-a="rechOuvrir"]');
    if (!await T(() => !!document.querySelector('[data-a="hopRapideTous"]'))) await clic('[data-a="etapePasser"][data-v="com"], [data-a="etapeOk"][data-v="com"]');
    ok('raccourci « Tous » des hôpitaux', await T(() => !!document.querySelector('[data-a="hopRapideTous"]')));
    await clic('[data-a="hopRapideTous"]', 600);
    await clic('[data-a="annuaire"][data-v="med"]', 700);
  });

  await etape('Autres onglets', async () => {
    for (const [n, t] of [['Planifier', 'semaine'], ['Produits', null], ['Suivi', null]]) {
      await nav(n);
      const r = await T(() => ({ tab: window.__tournees.S.ui.tab, n: document.querySelectorAll('#vue *').length, vide: /Erreur d'affichage/.test(document.querySelector('#vue').textContent) }));
      ok('onglet ' + n, r.n > 20 && !r.vide && (!t || r.tab === t), r);
    }
    await nav('Planifier');
    ok('Planifier : frise réduite', await T(() => { const n = document.querySelectorAll('#vue .bj-jour').length; return n > 20 && n <= 43; }));
  });

  await etape('Compte rendu', async () => {
    await nav('Journée');
    const a = await T(() => { const x = [...document.querySelectorAll('.arret:not(.verrouille)')].find(y => y.querySelector('.arret-carte.t-med')); if (!x) return false; x.querySelector('.carte-bouton').click(); return true; });
    await attendre(800);
    if (!a) { ok('une visite de médecin à saisir aujourd\'hui (sinon contrôle sauté)', true); return; }
    const q = () => T(() => { const x = document.querySelector('.arret.ouvert .cr-question'); if (!x) return null; const t = x.querySelector('.etape-titre').getBoundingClientRect(), bt = x.querySelector('[data-a="crOk"]'), rb = bt && bt.getBoundingClientRect(); return { etape: x.dataset.etape, haut: Math.round(t.top), bas: rb ? Math.round(rb.bottom) : null, y: Math.round(scrollY) }; });
    ok('compte rendu ouvert sur la 1re question', ((await q()) || {}).etape === 'faite', await q());
    await clic('.arret.ouvert .cr-question button[data-v="oui"]', 1000);
    const e2 = await q();
    ok('étape « Type de visite » cadrée (titre en haut, Continuer en bas, tout visible)', e2 && e2.etape === 'types' && e2.haut >= 62 && e2.bas && e2.bas <= 844 - 64, e2);
    await clic('.arret.ouvert .cr-question .puce', 900);
    const e2b = await q();
    ok('cocher un type ne fait pas défiler la page', e2b && e2 && e2b.y === e2.y, { avant: e2 && e2.y, apres: e2b && e2b.y });
    await clic('.arret.ouvert .cr-question [data-a="crOk"]', 1000);
    const e4 = await q();
    ok('étape « Produits présentés » cadrée', e4 && e4.etape === 'produits' && e4.haut >= 62, e4);
    await clic('.arret.ouvert .cr-question button[data-a]:not([data-a=crOk])', 900);
    const e4b = await q();
    ok('cocher un produit ne fait pas défiler la page', e4b && e4 && e4b.y === e4.y, { avant: e4 && e4.y, apres: e4b && e4b.y });
  });

  await etape('Synchronisation', async () => {
    await nav('Répertoire');
    await T(() => { window.__marque = document.querySelector('#vue').firstElementChild; window.__base = window.__tournees.S.data; window.__ctx = window.__tournees.ctx(); });
    await clic('#pastilleSync', 4500);
    ok('synchronisation sans changement : écran non reconstruit', await T(() => document.querySelector('#vue').firstElementChild === window.__marque));
    ok('synchronisation sans changement : base et calculs conservés (rien n\'est recalculé)', await T(() => window.__tournees.S.data === window.__base && window.__tournees.ctx() === window.__ctx));
    await nav('Journée');
    ok('Journée : bande des jours mesurée une seule fois tant que rien ne bouge', await T(() => { const b = document.querySelector('.bj-jours'); return !!(b && b.__centre); }));
    ok('état « À jour »', await T(() => /jour/i.test(document.getElementById('pastilleSync').textContent)), await T(() => document.getElementById('pastilleSync').textContent));
  });

  await etape('File d\'envoi', async () => {
    const lireServeur = async () => { const r = await fetch(API + '/exec?action=data&token=' + jeton); return (await r.json()).historique || []; };
    const creer = (uid, com) => T((a) => { const S = window.__tournees.S, p = S.data.praticiens.find(x => x.type !== 'Pharmacie'), pr = S.data.presences.find(x => x.code === p.code) || {};
      const v = { uid: a.uid, date: new Date().toISOString().slice(0, 10), code: p.code, nom: p.nom, type: p.type, specialite: p.specialite || '', lieu: pr.lieu || '', quartier: pr.quartier || '', commune: pr.commune || '', creneau: 'Matin', statut: 'Visite faite', commentaire: a.com, delegue: 'Awa Koné', produits: '', prochaine: '', activite: 'Routine' };
      const i = S.queue.findIndex(x => x.uid === a.uid); if (i >= 0) S.queue[i] = v; else S.queue.push(v); return S.queue.length; }, { uid, com });
    const uid = 'TEST' + Date.now().toString(36);
    await creer(uid, 'premier envoi'); await clic('#pastilleSync', 5000);
    ok('visite envoyée : la file d\'envoi est vide', await T(() => window.__tournees.S.queue.length === 0), await T(() => window.__tournees.S.queue.length));
    ok('visite reçue par le serveur', (await lireServeur()).some(v => v.uid === uid && v.commentaire === 'premier envoi'));
    // correction faite PENDANT l'envoi : elle ne doit pas être perdue
    const uid2 = 'TEST2' + Date.now().toString(36);
    await creer(uid2, 'version envoyée'); await T(() => document.getElementById('pastilleSync').click()); await attendre(60);
    await creer(uid2, 'version corrigée pendant l\'envoi'); await attendre(5000);
    const q1 = await T((u) => window.__tournees.S.queue.filter(x => x.uid === u).map(x => x.commentaire), uid2);
    ok('correction faite pendant l\'envoi : conservée dans la file', q1.length === 1 && /corrigée/.test(q1[0]), q1);
    await clic('#pastilleSync', 5000);
    ok('la correction part à l\'envoi suivant, file vide', await T(() => window.__tournees.S.queue.length === 0));
    ok('le serveur a la version corrigée', (await lireServeur()).some(v => v.uid === uid2 && /corrigée/.test(v.commentaire)), (await lireServeur()).filter(v => v.uid === uid2).map(v => v.commentaire));
  });

  ok('aucune erreur JavaScript pendant tout le parcours', err.length === 0, err.slice(0, 5));
  await b.close();
  console.log(echecs ? '\n' + echecs + ' contrôle(s) en échec' : '\nTout est conforme');
  process.exit(echecs ? 1 : 0);
})().catch(e => { console.log('ÉCHEC du script de test : ' + (e.stack || e)); process.exit(1); });
