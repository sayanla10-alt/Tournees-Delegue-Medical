  // ------------------------------------------------------------------ Export du programme
  function estMobile() {
    try { return window.matchMedia('(pointer: coarse)').matches && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent); } catch (e) { return false; }
  }
  function normaliserNumero(n) {
    var d = String(n || '').replace(/\D/g, '');
    if (d.indexOf('00') === 0) d = d.slice(2);
    if (d.length === 10 && d.charAt(0) === '0') d = '225' + d;
    else if (d.length === 8) d = '225' + d;
    else if (d.length === 10 && d.indexOf('225') !== 0) d = '225' + d;
    return d.length >= 11 ? d : '';
  }
  function lienItineraire(arrets) {
    var pts = arrets.filter(function (a) { return a.lat && a.lon; }).map(function (a) { return (+a.lat).toFixed(5) + ',' + (+a.lon).toFixed(5); });
    var liens = [];
    for (var i = 0; i < pts.length; i += 9) {
      var morceau = pts.slice(i === 0 ? 0 : i - 1, i + 10 - (i === 0 ? 0 : 1));
      if (i > 0 && morceau.length < 2) break;
      if (morceau.length === 1) { liens.push('https://www.google.com/maps/search/?api=1&query=' + morceau[0]); break; }
      var url = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=' + morceau[0] + '&destination=' + morceau[morceau.length - 1];
      if (morceau.length > 2) url += '&waypoints=' + morceau.slice(1, -1).join('%7C');
      liens.push(url);
      if (i + 10 >= pts.length) break;
    }
    return liens;
  }
  // Message WhatsApp : pour chaque jour, un titre puis les établissements dans l'ordre de passage,
  // chacun suivi de ses médecins
  //   Planning du vendredi 23/10/2026 (Serge Alain)
  //
  //   HMA
  //   Dr Assie Augustin
  //   ...
  // 3.25.4 : un bloc par jour ; établissements numérotés dans l'ordre de passage, médecins en puces avec l'heure
  //   *PROGRAMME DU MARDI 27/10/2026*
  //   _Serge Alain · 8 visites_
  //
  //   *1. HMA* _(Adjamé)_
  //   • 08:30  Dr Assie Augustin
  function texteProgramme(dates) {
    var blocs = [];
    dates.forEach(function (d) {
      var l = S.plan.filter(function (a) { return a.date === d; }).slice().sort(function (a, b) { return String(a.heure || '').localeCompare(String(b.heure || '')); });
      if (!l.length) return;
      var p = d.split('-'), ordre = [], parLieu = {};
      l.forEach(function (a) {
        var k = String(a.lieu || a.quartier || '').trim() || 'Autre lieu';
        if (!parLieu[k]) { parLieu[k] = { commune: a.commune || '', noms: [] }; ordre.push(k); }
        if (!parLieu[k].noms.some(function (x) { return x.nom === a.nom; })) parLieu[k].noms.push({ nom: a.nom, heure: a.heure || '' });
      });
      var lignes = ['*PROGRAMME DU ' + nomJour(d).toUpperCase() + ' ' + p[2] + '/' + p[1] + '/' + p[0] + '*',
        '_' + (moi() ? moi() + ' · ' : '') + l.length + ' visite' + (l.length > 1 ? 's' : '') + (ordre.length > 1 ? ', ' + ordre.length + ' établissements' : '') + '_'];
      ordre.forEach(function (k, n) {
        var x = parLieu[k];
        lignes.push(''); lignes.push('*' + (n + 1) + '. ' + k + '*' + (x.commune && k.indexOf(x.commune) < 0 ? ' _(' + x.commune + ')_' : ''));
        x.noms.forEach(function (m) { lignes.push('• ' + m.nom); });
      });
      blocs.push(lignes.join('\n'));
    });
    return blocs.join('\n\n━━━━━━━━━━\n\n');
  }
  function urlWhatsapp(texte, dest) {
    var num = normaliserNumero(dest || S.config.whatsapp), t = encodeURIComponent(texte);
    if (S.config.waWeb || !estMobile()) return 'https://web.whatsapp.com/send?' + (num ? 'phone=' + num + '&' : '') + 'text=' + t;
    return 'https://wa.me/' + num + '?text=' + t;
  }

  // Intents Android directs : ouverture instantanée sans page blanche intermédiaire
  function ouvrirWhatsapp(texte, dest) {
    var num = normaliserNumero(dest || S.config.whatsapp), t = encodeURIComponent(texte);
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App && window.Capacitor.Plugins.App.openUrl) {
      var capUri = num ? 'whatsapp://send?phone=' + num + '&text=' + t : 'whatsapp://send?text=' + t;
      window.Capacitor.Plugins.App.openUrl({ url: capUri }).catch(function () {
        window.location.href = urlWhatsapp(texte, dest);
      });
      return;
    }
    if (estMobile() && !S.config.waWeb) {
      var directUri = num ? 'whatsapp://send?phone=' + num + '&text=' + t : 'whatsapp://send?text=' + t;
      window.location.href = directUri;
      return;
    }
    window.open(urlWhatsapp(texte, dest), '_blank', 'noopener');
  }

  // Background Sync API / WorkManager en zone blanche
  function declencherBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then(function (reg) {
        return reg.sync.register('mediplanner-sync-queue');
      }).catch(function () {});
    }
  }

