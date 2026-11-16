// tests/serveur.js : faux serveur Apps Script (code réel de apps-script/ exécuté sur un classeur simulé, en mémoire)
// Serveur de test « charge réelle » : même mock, avec un historique et des plannings volumineux (en mémoire seulement)
const http = require('http'); const { creer } = require('./mock-gas.js');
const { ctx, sheets, D } = creer(require('path').join(__dirname, '..', 'apps-script') + '/');
ctx.reinitialiserTout(); const jeton = ctx.obtenirJeton();
require('fs').writeFileSync(process.env.JETON || (__dirname + '/.jeton'), jeton);
const pres = sheets.Presences.d.slice(1).filter(r => r && r[0]);
const prat = {}; sheets.Praticiens.d.slice(1).forEach(r => { if (r && r[0]) prat[r[0]] = r; });
const deleg = ['Awa Koné', 'Koffi Yao', 'Mariam Traoré', 'Jean Kouassi', 'Fatou Bamba'];
const statuts = ['Visite faite', 'Visite faite', 'Visite faite', 'Visite faite', 'Absent', 'Reportée', 'RDV confirmé'];
const coms = ['Intéressé par le nouveau dosage, demande des échantillons.', 'Discussion sur les cas cliniques, documentation remise', 'En congé, retour prévu dans 2 semaines', 'Prescrit déjà la gamme', ''];
let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
const iso = d => d.toISOString().slice(0, 10);
const t0 = new Date('2026-11-16T00:00:00Z');
const N = +(process.env.NHIST || 6000);
for (let i = 0; i < N; i++) {
  const p = pres[Math.floor(rnd() * pres.length)], pr = prat[p[1]] || [];
  const d = new Date(t0.getTime() - Math.floor(rnd() * 365) * 864e5); if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
  const st = statuts[Math.floor(rnd() * statuts.length)];
  sheets.Historique.d.push([iso(d), iso(d) + 'T10:00:00Z', p[0], p[1], p[2], pr[1] || 'Médecin', pr[3] || '', pr[4] || 2, p[5], p[4], p[3], rnd() < .6 ? 'Matin' : 'Soir', st, coms[Math.floor(rnd() * coms.length)], 'H' + i, deleg[Math.floor(rnd() * deleg.length)], '', '', '', '', '', '', '', '', '', '']);
}
// plannings : 4 semaines autour d'aujourd'hui, 8 visites par jour et par délégué
for (let k = -14; k < 14; k++) {
  const d = new Date(t0.getTime() + k * 864e5); if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
  deleg.forEach((dl, j) => { for (let n = 0; n < 8; n++) { const p = pres[Math.floor(rnd() * pres.length)];
    sheets.Plannings.d.push([dl, iso(d), (8 + n) + ':00', n < 5 ? 'Matin' : 'Soir', '', '', p[0], p[1], p[2], '', 2, p[4], p[5], p[3], k < 0 ? 'Visite faite' : '', '', 'Validé', '', 'A' + k + j + n, '']); } });
}
console.log('hist', sheets.Historique.getLastRow(), 'plan', sheets.Plannings.getLastRow());
http.createServer((req, res) => { const u = new URL(req.url, 'http://x'); let body = '';
  req.on('data', c => body += c); req.on('end', () => { setTimeout(() => { let out;
      if (req.method === 'GET') out = ctx.doGet({ parameter: Object.fromEntries(u.searchParams) }); else out = ctx.doPost({ postData: { contents: body } });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(out.t); }, 200); });
}).listen(+(process.env.PORT_API || 8779), () => console.log('ok'));
