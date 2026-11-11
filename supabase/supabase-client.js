// =============================================================================
// supabase-client.js : Connecteur de lecture Supabase pour MediPlanner
// Lecture paginée alignée sur app.js ; toute écriture passe par Google Apps
// Script (Jumelage.gs) — les écritures directes client sont désactivées.
// =============================================================================

(function (window) {
  'use strict';

  // 3.28.10+ : Supabase est tenu à jour par le serveur Google Apps Script (Jumelage.gs).
  // Le client n'écrit jamais directement dans Supabase (évite les fiches TMP orphelines et les écritures perdues).
  var MIROIR_CLIENT = false;

  var SupabaseClient = {
    MIROIR_CLIENT: MIROIR_CLIENT,
    client: null,

    // Initialisation avec les clés publiques du projet
    init: function (url, anonKey) {
      if (!url || !anonKey || typeof window.supabase === 'undefined') return false;
      try {
        this.client = window.supabase.createClient(url, anonKey);
        return true;
      } catch (e) {
        console.error('Erreur initialisation Supabase:', e);
        return false;
      }
    },

    estPret: function () {
      return !!this.client;
    },

    // Lecture paginée (order + offset par pages de 1000 lignes, comme supabaseGetTout_ dans app.js)
    lireTout_: async function (table, ordre, max) {
      if (!this.client) throw new Error('Supabase non initialisé');
      var pas = 1000;
      var tout = [];
      var offset = 0;

      while (true) {
        var res = await this.client
          .from(table)
          .select('*')
          .order(ordre, { ascending: true })
          .range(offset, offset + pas - 1);

        if (res.error) throw res.error;
        var lignes = res.data || [];
        tout = tout.concat(lignes);
        if (lignes.length < pas || (max && tout.length >= max)) break;
        offset += pas;
      }

      return tout;
    },

    // 1. Chargement paginé de tous les praticiens, présences et pharmacies
    chargerTout: async function () {
      if (!this.client) throw new Error('Supabase non initialisé');

      const [rawPrats, rawPres, rawPharm] = await Promise.all([
        this.lireTout_('praticiens', 'code'),
        this.lireTout_('presences', 'id'),
        this.lireTout_('pharmacies', 'code')
      ]);

      // Formatage compatible avec les structures attendues par MediPlanner (app.js)
      var praticiens = rawPrats.map(function (p) {
        return {
          code: String(p.code),
          type: p.type || 'Médecin',
          nom: p.nom,
          specialite: p.specialite || 'Généraliste',
          note: +p.note || 2,
          conventionne: (p.conventionne === true || p.conventionne === 'Oui') ? 'Oui' : 'Non',
          telephone: p.telephone || '',
          derniere: p.derniere ? String(p.derniere).slice(0, 10) : '',
          statut: p.statut || '',
          commentaire: p.commentaire || '',
          nbVisites: +p.nb_visites || 0,
          actif: (p.actif === false || p.actif === 'Non' || p.actif === '0') ? 'Non' : 'Oui',
          prochaine: p.prochaine || '',
          absentDu: p.absent_du || '',
          absentAu: p.absent_au || ''
        };
      });

      // Ajouter les pharmacies au format unifié
      rawPharm.forEach(function (ph) {
        praticiens.push({
          code: String(ph.code),
          type: 'Pharmacie',
          nom: ph.nom,
          specialite: 'Pharmacien',
          note: +ph.note || 2,
          conventionne: (ph.conventionne === true || ph.conventionne === 'Oui') ? 'Oui' : 'Non',
          telephone: ph.telephone || '',
          derniere: ph.derniere ? String(ph.derniere).slice(0, 10) : '',
          statut: ph.statut || '',
          commentaire: ph.commentaire || '',
          nbVisites: +ph.nb_visites || 0,
          actif: (ph.actif === false || ph.actif === 'Non' || ph.actif === '0') ? 'Non' : 'Oui',
          prochaine: ph.prochaine || '',
          titulaire: ph.titulaire || '',
          territoire: ph.territoire || '',
          subdivision: ph.subdivision || '',
          secteur: ph.secteur || ''
        });
      });

      var presences = rawPres.map(function (pr) {
        return {
          id: String(pr.id),
          code: String(pr.code),
          nom: pr.nom || '',
          lieu: pr.lieu || '',
          quartier: pr.quartier || '',
          commune: pr.commune || '',
          zone: pr.zone || '',
          lundi: pr.lundi || '',
          mardi: pr.mardi || '',
          mercredi: pr.mercredi || '',
          jeudi: pr.jeudi || '',
          vendredi: pr.vendredi || '',
          horaireMatin: pr.horaire_matin || '',
          horaireSoir: pr.horaire_soir || '',
          lat: isFinite(pr.lat) && pr.lat !== null ? +pr.lat : null,
          lon: isFinite(pr.lon) && pr.lon !== null ? +pr.lon : null,
          reperes: pr.reperes || '',
          territoire: pr.territoire || '',
          subdivision: pr.subdivision || '',
          secteur: pr.secteur || '',
          origineGps: pr.origine_gps || ''
        };
      });

      return {
        ok: true,
        version: 1,
        source: 'supabase',
        praticiens: praticiens,
        presences: presences,
        syncedAt: new Date().toISOString()
      };
    },

    // 2. Écriture directe DÉSACTIVÉE : toutes les visites passent par Google Apps Script
    enregistrerVisites: async function () {
      if (!MIROIR_CLIENT || !this.MIROIR_CLIENT) {
        console.warn('SupabaseClient.enregistrerVisites désactivé (MIROIR_CLIENT = false) : utilisez Google Apps Script.');
        return {
          ok: false,
          desactive: true,
          erreur: 'Écriture directe Supabase désactivée (MIROIR_CLIENT = false) : passage obligatoire par Apps Script.'
        };
      }
      return { ok: false, desactive: true };
    },

    // 3. Écriture directe DÉSACTIVÉE : toutes les fiches passent par Google Apps Script
    enregistrerFiche: async function () {
      if (!MIROIR_CLIENT || !this.MIROIR_CLIENT) {
        console.warn('SupabaseClient.enregistrerFiche désactivé (MIROIR_CLIENT = false) : utilisez Google Apps Script.');
        return {
          ok: false,
          desactive: true,
          erreur: 'Écriture directe Supabase désactivée (MIROIR_CLIENT = false) : passage obligatoire par Apps Script.'
        };
      }
      return { ok: false, desactive: true };
    },

    // Configuration par défaut du projet MediPlanner
    CONFIG_PAR_DEFAUT: {
      url: 'https://nldyinokqgshnzvdsxgr.supabase.co',
      publishableKey: 'sb_publishable_WOPLZ8hA_zrUwtK1iqgQQA_kIntbRyL'
    }
  };

  // Auto-init si la librairie Supabase est déjà présente
  if (typeof window !== 'undefined' && window.supabase) {
    SupabaseClient.init(SupabaseClient.CONFIG_PAR_DEFAUT.url, SupabaseClient.CONFIG_PAR_DEFAUT.publishableKey);
  }

  window.SupabaseClient = SupabaseClient;

})(typeof window !== 'undefined' ? window : this);
