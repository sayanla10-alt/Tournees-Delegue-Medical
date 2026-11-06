// =============================================================================
// supabase-client.js : Connecteur direct Supabase pour MediPlanner
// Conçu pour offrir une alternative ultra-rapide à Google Apps Script
// sans impacter le fonctionnement existant.
// =============================================================================

(function (window) {
  'use strict';

  var SupabaseClient = {
    client: null,

    // Initialisation avec les clés du projet
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

    // 1. Chargement de tous les praticiens et présences
    chargerTout: async function () {
      if (!this.client) throw new Error('Supabase non initialisé');
      
      const [resPrats, resPres, resPharm] = await Promise.all([
        this.client.from('praticiens').select('*').order('nom'),
        this.client.from('presences').select('*'),
        this.client.from('pharmacies').select('*').order('nom')
      ]);

      if (resPrats.error) throw resPrats.error;
      if (resPres.error) throw resPres.error;

      // Formatage compatible avec les structures attendues par MediPlanner
      var praticiens = (resPrats.data || []).map(function (p) {
        return {
          code: p.code,
          type: p.type || 'Médecin',
          nom: p.nom,
          specialite: p.specialite,
          note: p.note,
          conventionne: p.conventionne ? 'Oui' : 'Non',
          telephone: p.telephone || '',
          derniere: p.derniere || '',
          statut: p.statut || '',
          commentaire: p.commentaire || '',
          nbVisites: p.nb_visites || 0,
          actif: p.actif ? 'Oui' : 'Non'
        };
      });

      // Ajouter les pharmacies au format unifié si présentes
      (resPharm.data || []).forEach(function (ph) {
        praticiens.push({
          code: ph.code,
          type: 'Pharmacie',
          nom: ph.nom,
          specialite: 'Pharmacie',
          note: ph.note || 2,
          conventionne: ph.conventionne ? 'Oui' : 'Non',
          telephone: ph.telephone || '',
          derniere: ph.derniere || '',
          statut: ph.statut || '',
          commentaire: ph.commentaire || '',
          nbVisites: ph.nb_visites || 0,
          actif: ph.actif ? 'Oui' : 'Non'
        });
      });

      var presences = (resPres.data || []).map(function (pr) {
        return {
          id: pr.id,
          code: pr.code,
          nom: pr.nom,
          lieu: pr.lieu,
          quartier: pr.quartier,
          commune: pr.commune,
          zone: pr.zone,
          lundi: pr.lundi,
          mardi: pr.mardi,
          mercredi: pr.mercredi,
          jeudi: pr.jeudi,
          vendredi: pr.vendredi,
          horaireMatin: pr.horaire_matin,
          horaireSoir: pr.horaire_soir,
          lat: pr.lat,
          lon: pr.lon,
          reperes: pr.reperes
        };
      });

      return {
        ok: true,
        version: 1,
        praticiens: praticiens,
        presences: presences,
        syncedAt: new Date().toISOString()
      };
    },

    // 2. Enregistrement d'une liste de visites (Comptes-rendus)
    enregistrerVisites: async function (visites) {
      if (!this.client) throw new Error('Supabase non initialisé');
      if (!Array.isArray(visites) || !visites.length) return { ok: true, count: 0 };

      var lignes = visites.map(function (v) {
        return {
          uid: v.uid || (v.code + '_' + v.date + '_' + Date.now()),
          date: v.date,
          delegue: v.delegue || 'Délégué',
          code: v.code,
          id_presence: v.idPresence || null,
          nom: v.nom,
          type: v.type || 'Médecin',
          specialite: v.specialite || '',
          note: v.note || 2,
          commune: v.commune || '',
          quartier: v.quartier || '',
          lieu: v.lieu || '',
          creneau: v.creneau || '',
          statut: v.statut || 'Vu',
          type_echange: v.typeEchange || '',
          produits_presentes: v.produits || [],
          echantillons: v.echantillons || [],
          prochaine_visite: v.prochaine || null,
          commentaire: v.commentaire || ''
        };
      });

      // Upsert direct dans la table visites (résolution sans doublon)
      const { data, error } = await this.client
        .from('visites')
        .upsert(lignes, { onConflict: 'uid' });

      if (error) throw error;
      return { ok: true, count: lignes.length };
    },

    // 3. Enregistrement ou mise à jour d'une fiche praticien
    enregistrerFiche: async function (b) {
      if (!this.client) throw new Error('Supabase non initialisé');
      var p = b.praticien || {};
      var lieux = b.presences || [];

      // A. Upsert Praticien
      const { error: errP } = await this.client.from('praticiens').upsert({
        code: p.code,
        type: p.type || 'Médecin',
        nom: p.nom,
        specialite: p.specialite || 'Généraliste',
        note: p.note || 2,
        conventionne: p.conventionne === 'Oui' || p.conventionne === true,
        telephone: p.telephone || '',
        actif: p.actif !== 'Non',
        updated_at: new Date().toISOString()
      }, { onConflict: 'code' });

      if (errP) throw errP;

      // B. Upsert Présences associées
      if (lieux.length) {
        var lignesLieux = lieux.map(function (l, idx) {
          return {
            id: l.id || (p.code + '_' + idx),
            code: p.code,
            nom: p.nom,
            lieu: l.lieu,
            quartier: l.quartier || '',
            commune: l.commune || 'Abidjan',
            zone: l.zone || '',
            lundi: l.lundi || '',
            mardi: l.mardi || '',
            mercredi: l.mercredi || '',
            jeudi: l.jeudi || '',
            vendredi: l.vendredi || '',
            horaire_matin: l.horaireMatin || '',
            horaire_soir: l.horaireSoir || '',
            lat: isFinite(l.lat) ? l.lat : null,
            lon: isFinite(l.lon) ? l.lon : null,
            reperes: l.reperes || ''
          };
        });

        const { error: errL } = await this.client.from('presences').upsert(lignesLieux, { onConflict: 'id' });
        if (errL) throw errL;
      }

      return { ok: true, code: p.code };
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
