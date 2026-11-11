-- =============================================================================
-- MEDIPLANNER : Schéma Complet Supabase (Aligné avec Jumelage.gs & app.js)
-- Idempotent : exécutable sans danger sur une base neuve ou déjà existante.
-- =============================================================================

-- 1. Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------
-- 2. Table : praticiens (Médecins & Spécialistes)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.praticiens (
    code VARCHAR(32) PRIMARY KEY,                    -- CodeContact (ex: MED-001)
    type TEXT NOT NULL DEFAULT 'Médecin',            -- Type (Médecin, Pharmacie, etc.)
    nom TEXT NOT NULL,                               -- Nom complet du praticien
    specialite TEXT NOT NULL DEFAULT 'Généraliste',  -- Spécialité médicale
    note SMALLINT NOT NULL DEFAULT 2 CHECK (note BETWEEN 1 AND 3), -- Potentiel (1=C, 2=B, 3=A)
    conventionne BOOLEAN NOT NULL DEFAULT false,     -- Partenariat / Engagement
    telephone TEXT,                                  -- Numéro normalisé
    derniere DATE,                                   -- Date dernière visite (YYYY-MM-DD)
    statut TEXT,                                     -- Statut dernière visite
    commentaire TEXT,                                -- Compte-rendu dernière visite
    nb_visites INTEGER NOT NULL DEFAULT 0,           -- Nombre total de visites
    actif BOOLEAN NOT NULL DEFAULT true,             -- Actif ou archivé
    prochaine TEXT,                                  -- Prochaine étape
    absent_du DATE,                                  -- Début d'absence déclarée
    absent_au DATE,                                  -- Fin d'absence déclarée
    autres JSONB,                                    -- Colonnes additionnelles du Sheet
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    maj_source TEXT
);

-- -------------------------------------------------------------
-- 3. Table : presences (Lieux & Créneaux des Médecins)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.presences (
    id VARCHAR(64) PRIMARY KEY,                      -- IdPresence (ex: PRES-001)
    code VARCHAR(32) NOT NULL REFERENCES public.praticiens(code) ON UPDATE CASCADE ON DELETE CASCADE,
    nom TEXT,                                        -- Nom dénormalisé
    lieu TEXT NOT NULL,                              -- Hôpital, CHU, polyclinique ou cabinet
    quartier TEXT,                                   -- Quartier ou repère
    commune TEXT NOT NULL,                           -- Commune (Cocody, Plateau, Treichville...)
    zone TEXT,                                       -- Zone géographique
    lundi TEXT,                                      -- Créneaux du lundi (ex: "Matin", "08:00-12:00")
    mardi TEXT,
    mercredi TEXT,
    jeudi TEXT,
    vendredi TEXT,
    horaire_matin TEXT,                              -- Heure précise matin
    horaire_soir TEXT,                               -- Heure précise soir
    lat DOUBLE PRECISION,                            -- Coordonnées GPS latitude
    lon DOUBLE PRECISION,                            -- Coordonnées GPS longitude
    reperes TEXT,                                    -- Repères d'accès
    secteur TEXT,                                    -- Secteur géographique
    origine_gps TEXT,                                -- Source des coordonnées GPS
    autres JSONB,                                    -- Colonnes additionnelles du Sheet
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    maj_source TEXT
);

-- -------------------------------------------------------------
-- 4. Table : pharmacies (Officines et Points de Vente)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharmacies (
    code VARCHAR(32) PRIMARY KEY,                    -- CodeContact (ex: PHA-001)
    nom TEXT NOT NULL,                               -- Nom de l'officine
    titulaire TEXT,                                  -- Pharmacien titulaire
    quartier TEXT,                                   -- Quartier
    commune TEXT NOT NULL,                           -- Commune
    zone TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    telephone TEXT,
    horaire_matin TEXT,
    horaire_soir TEXT,
    note SMALLINT NOT NULL DEFAULT 2 CHECK (note BETWEEN 1 AND 3),
    conventionne BOOLEAN NOT NULL DEFAULT false,
    derniere DATE,
    statut TEXT,
    commentaire TEXT,
    nb_visites INTEGER NOT NULL DEFAULT 0,
    actif BOOLEAN NOT NULL DEFAULT true,
    reperes TEXT,
    prochaine TEXT,
    source TEXT,
    origine_gps TEXT,
    autres JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    maj_source TEXT
);

-- -------------------------------------------------------------
-- 5. Table : etablissements (Structures de Santé de Référence)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.etablissements (
    code VARCHAR(32) PRIMARY KEY,                    -- CodeEtab
    nom TEXT NOT NULL,                               -- Nom officiel
    categorie TEXT,                                  -- CHU, HG, Polyclinique, Clinique, Cabinet
    commune TEXT NOT NULL,
    quartier TEXT,
    zone TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    telephone TEXT,
    reperes TEXT,
    position TEXT,
    origine_gps TEXT,
    autres JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    maj_source TEXT
);

-- -------------------------------------------------------------
-- 6. Table : visites (Historique des Passages & Comptes-Rendus)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.visites (
    uid VARCHAR(64) PRIMARY KEY,                     -- IdSync (UUID client)
    date DATE NOT NULL,                              -- Date visite (YYYY-MM-DD)
    horodatage TIMESTAMPTZ DEFAULT NOW(),            -- Heure exacte (nullable si absente du Sheet)
    delegue TEXT NOT NULL,                           -- Délégué médical
    code TEXT NOT NULL,                              -- CodeContact
    id_presence TEXT,                                -- Référence lieu visité
    nom TEXT NOT NULL,                               -- Nom praticien / pharmacie
    type TEXT NOT NULL DEFAULT 'Médecin',            -- Médecin ou Pharmacie
    specialite TEXT,
    note SMALLINT DEFAULT 2,
    commune TEXT,
    quartier TEXT,
    lieu TEXT,
    creneau TEXT,                                    -- Matin, Soir
    statut TEXT NOT NULL,                            -- "Visite faite", "Absent"...
    type_echange TEXT,                               -- Activité / Présentation produit...
    produits_presentes TEXT,                         -- Texte tel que dans le Sheet
    echantillons TEXT,                               -- Texte tel que dans le Sheet
    prochaine_visite DATE,                           -- Date prévisionnelle prochain passage
    prochaine_etape TEXT,                            -- Prochaine étape texte libre
    commentaire TEXT,                                -- Synthèse / remarques
    interlocuteur TEXT,
    reactions TEXT,
    stocks TEXT,
    commande TEXT,
    complements TEXT,
    suite TEXT,
    autres JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    maj_source TEXT
);

-- -------------------------------------------------------------
-- 7. Table : plannings (Tournées Prévues)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plannings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delegue TEXT NOT NULL,
    date DATE NOT NULL,
    heure TEXT,
    creneau TEXT,
    debut TEXT,                                      -- Heure de début (ex: "08:30")
    fin TEXT,                                        -- Heure de fin (ex: "11:30")
    id_presence TEXT,
    code TEXT NOT NULL,
    nom TEXT NOT NULL,
    specialite TEXT,
    note SMALLINT DEFAULT 2,
    quartier TEXT,
    commune TEXT,
    lieu TEXT,
    statut TEXT,
    etat TEXT DEFAULT 'planifie',
    programme TEXT,
    maj TEXT,
    id_arret TEXT,
    cible_depuis TEXT,
    autres JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    maj_source TEXT
);

-- -------------------------------------------------------------
-- 8. Table : rapports (Rapports Journaliers Délégués)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rapports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delegue TEXT NOT NULL,
    date DATE NOT NULL,
    valide_le TEXT,                                  -- Horodatage ou texte libre issu du Sheet
    prevues INTEGER NOT NULL DEFAULT 0,
    faites INTEGER NOT NULL DEFAULT 0,
    non_faites TEXT,                                 -- Liste textuelle des visites non faites
    sans_cr INTEGER NOT NULL DEFAULT 0,
    synthese TEXT,
    faits TEXT,
    concurrence TEXT,
    besoins TEXT,
    km NUMERIC(6, 2) DEFAULT 0,
    maj TEXT,
    autres JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    maj_source TEXT,
    CONSTRAINT unq_rapport_delegue_date UNIQUE (delegue, date)
);

-- -------------------------------------------------------------
-- 9. Table : fiches_produits (Monographies détaillées pour l'onglet Produits)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fiches_produits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    produit TEXT NOT NULL UNIQUE,
    gamme TEXT,
    aire TEXT,
    dci TEXT,
    classe TEXT,
    indications TEXT,
    contre_indications TEXT,
    posologie TEXT,
    precautions TEXT,
    effets TEXT,
    arguments TEXT,
    laboratoire TEXT,
    sources TEXT,
    actif BOOLEAN NOT NULL DEFAULT true,
    autres JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    maj_source TEXT
);

-- -------------------------------------------------------------
-- 10. Table : quartiers (Quartiers géolocalisés avec secteurs)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quartiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    commune TEXT NOT NULL,
    quartier TEXT NOT NULL,
    zone TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    secteur TEXT,
    autres JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    maj_source TEXT,
    CONSTRAINT unq_commune_quartier UNIQUE (commune, quartier)
);

-- -------------------------------------------------------------
-- 11. Table : listes_reference (Produits, Délégués, Statuts, Activités, Fériés)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.listes_reference (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    categorie TEXT NOT NULL, -- 'produit', 'delegue', 'statut', 'activite', 'activite_pharmacie', 'ferie'
    valeur TEXT NOT NULL,
    metadata JSONB,
    ordre INTEGER DEFAULT 0,
    actif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    maj_source TEXT,
    CONSTRAINT unq_cat_val UNIQUE (categorie, valeur)
);

-- -------------------------------------------------------------
-- 12. Table : audit_logs (Journal d'audit synchronisé depuis Audit_Logs)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    horodatage TEXT,
    auteur TEXT,
    action TEXT,
    entite TEXT,
    code TEXT,
    details TEXT,
    autres JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    maj_source TEXT
);

-- -------------------------------------------------------------
-- 13. Table : jumelage_suppressions (Journal des suppressions faites dans Supabase)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jumelage_suppressions (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    cle JSONB,
    source TEXT,
    le TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------
-- 14. Migration idempotente des bases déjà créées (colonnes & types)
-- -------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND data_type = 'character varying'
          AND table_name IN ('praticiens','presences','pharmacies','etablissements','visites','plannings','rapports','quartiers','fiches_produits','listes_reference','audit_logs')
          AND column_name NOT IN ('code','id','uid')
    LOOP
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE text', r.table_name, r.column_name);
    END LOOP;
END $$;

ALTER TABLE public.praticiens     ADD COLUMN IF NOT EXISTS prochaine TEXT, ADD COLUMN IF NOT EXISTS absent_du DATE, ADD COLUMN IF NOT EXISTS absent_au DATE;
ALTER TABLE public.presences      ADD COLUMN IF NOT EXISTS secteur TEXT, ADD COLUMN IF NOT EXISTS origine_gps TEXT;
ALTER TABLE public.pharmacies     ADD COLUMN IF NOT EXISTS reperes TEXT, ADD COLUMN IF NOT EXISTS prochaine TEXT, ADD COLUMN IF NOT EXISTS source TEXT, ADD COLUMN IF NOT EXISTS origine_gps TEXT;
ALTER TABLE public.etablissements ADD COLUMN IF NOT EXISTS position TEXT, ADD COLUMN IF NOT EXISTS origine_gps TEXT;
ALTER TABLE public.visites        ADD COLUMN IF NOT EXISTS prochaine_etape TEXT, ADD COLUMN IF NOT EXISTS interlocuteur TEXT, ADD COLUMN IF NOT EXISTS reactions TEXT,
                                  ADD COLUMN IF NOT EXISTS stocks TEXT, ADD COLUMN IF NOT EXISTS commande TEXT, ADD COLUMN IF NOT EXISTS complements TEXT, ADD COLUMN IF NOT EXISTS suite TEXT;
ALTER TABLE public.plannings      ADD COLUMN IF NOT EXISTS maj TEXT, ADD COLUMN IF NOT EXISTS id_arret TEXT, ADD COLUMN IF NOT EXISTS cible_depuis TEXT;
ALTER TABLE public.rapports       ADD COLUMN IF NOT EXISTS maj TEXT;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['praticiens','presences','pharmacies','etablissements','visites','plannings','rapports','quartiers','fiches_produits','audit_logs'] LOOP
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS autres JSONB', t);
    END LOOP;
    FOREACH t IN ARRAY ARRAY['praticiens','presences','pharmacies','etablissements','visites','plannings','rapports','quartiers','fiches_produits','listes_reference','audit_logs'] LOOP
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()', t);
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS maj_source TEXT', t);
    END LOOP;
END $$;

ALTER TABLE public.visites ALTER COLUMN horodatage DROP NOT NULL;
ALTER TABLE public.visites ALTER COLUMN produits_presentes TYPE TEXT USING produits_presentes::TEXT;
ALTER TABLE public.visites ALTER COLUMN echantillons TYPE TEXT USING echantillons::TEXT;

ALTER TABLE public.plannings ALTER COLUMN debut TYPE TEXT USING debut::TEXT;
ALTER TABLE public.plannings ALTER COLUMN fin TYPE TEXT USING fin::TEXT;

ALTER TABLE public.rapports ALTER COLUMN non_faites DROP DEFAULT;
ALTER TABLE public.rapports ALTER COLUMN non_faites TYPE TEXT USING non_faites::TEXT;
ALTER TABLE public.rapports ALTER COLUMN valide_le DROP DEFAULT;
ALTER TABLE public.rapports ALTER COLUMN valide_le TYPE TEXT USING valide_le::TEXT;

-- -------------------------------------------------------------
-- 15. Index
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_praticiens_nom ON public.praticiens (nom);
CREATE INDEX IF NOT EXISTS idx_praticiens_specialite ON public.praticiens (specialite);
CREATE INDEX IF NOT EXISTS idx_praticiens_actif ON public.praticiens (actif);

CREATE INDEX IF NOT EXISTS idx_presences_code ON public.presences (code);
CREATE INDEX IF NOT EXISTS idx_presences_commune ON public.presences (commune);
CREATE INDEX IF NOT EXISTS idx_presences_lieu ON public.presences (lieu);

CREATE INDEX IF NOT EXISTS idx_pharmacies_commune ON public.pharmacies (commune);
CREATE INDEX IF NOT EXISTS idx_pharmacies_actif ON public.pharmacies (actif);

CREATE INDEX IF NOT EXISTS idx_etablissements_nom ON public.etablissements (nom);
CREATE INDEX IF NOT EXISTS idx_etablissements_commune ON public.etablissements (commune);

CREATE INDEX IF NOT EXISTS idx_visites_date ON public.visites (date);
CREATE INDEX IF NOT EXISTS idx_visites_delegue ON public.visites (delegue);
CREATE INDEX IF NOT EXISTS idx_visites_code ON public.visites (code);

CREATE INDEX IF NOT EXISTS idx_plannings_delegue_date ON public.plannings (delegue, date);

CREATE INDEX IF NOT EXISTS idx_fiches_produits_gamme ON public.fiches_produits (gamme);
CREATE INDEX IF NOT EXISTS idx_fiches_produits_actif ON public.fiches_produits (actif);

CREATE INDEX IF NOT EXISTS idx_quartiers_commune ON public.quartiers (commune);
CREATE INDEX IF NOT EXISTS idx_quartiers_secteur ON public.quartiers (secteur);

CREATE INDEX IF NOT EXISTS idx_listes_categorie ON public.listes_reference (categorie);

-- -------------------------------------------------------------
-- 16. Déclencheurs de jumelage bidirectionnel (Sheets <-> Supabase)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jumelage_source() RETURNS TEXT LANGUAGE plpgsql STABLE AS $$
DECLARE h TEXT;
BEGIN
    h := current_setting('request.headers', true);
    IF h IS NULL OR h = '' THEN RETURN 'supabase'; END IF;
    RETURN coalesce(h::json->>'x-mediplanner', 'api');
END $$;

CREATE OR REPLACE FUNCTION public.jumelage_marquer() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := NOW();
    NEW.maj_source := public.jumelage_source();
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.jumelage_suppression() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE src TEXT;
BEGIN
    src := public.jumelage_source();
    IF src <> 'sheets' THEN
        INSERT INTO public.jumelage_suppressions (table_name, cle, source) VALUES (TG_TABLE_NAME, to_jsonb(OLD), src);
    END IF;
    RETURN OLD;
END $$;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['praticiens','presences','pharmacies','etablissements','visites','plannings','rapports','quartiers','fiches_produits','listes_reference','audit_logs'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS jumelage_marquer ON public.%I', t);
        EXECUTE format('CREATE TRIGGER jumelage_marquer BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.jumelage_marquer()', t);
        EXECUTE format('DROP TRIGGER IF EXISTS jumelage_suppression ON public.%I', t);
        EXECUTE format('CREATE TRIGGER jumelage_suppression AFTER DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.jumelage_suppression()', t);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (maj_source)', t || '_maj_source_idx', t);
    END LOOP;
END $$;

-- -------------------------------------------------------------
-- 17. Politiques de Sécurité (RLS) Ouvertes pour l'App Web & Sheets
-- -------------------------------------------------------------
ALTER TABLE public.praticiens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etablissements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plannings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rapports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiches_produits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quartiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listes_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jumelage_suppressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acces complet praticiens" ON public.praticiens;
CREATE POLICY "Acces complet praticiens" ON public.praticiens FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acces complet presences" ON public.presences;
CREATE POLICY "Acces complet presences" ON public.presences FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acces complet pharmacies" ON public.pharmacies;
CREATE POLICY "Acces complet pharmacies" ON public.pharmacies FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acces complet etablissements" ON public.etablissements;
CREATE POLICY "Acces complet etablissements" ON public.etablissements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acces complet visites" ON public.visites;
CREATE POLICY "Acces complet visites" ON public.visites FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acces complet plannings" ON public.plannings;
CREATE POLICY "Acces complet plannings" ON public.plannings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acces complet rapports" ON public.rapports;
CREATE POLICY "Acces complet rapports" ON public.rapports FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acces complet fiches_produits" ON public.fiches_produits;
CREATE POLICY "Acces complet fiches_produits" ON public.fiches_produits FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acces complet quartiers" ON public.quartiers;
CREATE POLICY "Acces complet quartiers" ON public.quartiers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acces complet listes_reference" ON public.listes_reference;
CREATE POLICY "Acces complet listes_reference" ON public.listes_reference FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acces complet audit_logs" ON public.audit_logs;
CREATE POLICY "Acces complet audit_logs" ON public.audit_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acces complet jumelage_suppressions" ON public.jumelage_suppressions;
CREATE POLICY "Acces complet jumelage_suppressions" ON public.jumelage_suppressions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------------
-- 18. Données Initiales de Démonstration (Médecins, Pharmacies & Présences)
-- -------------------------------------------------------------
INSERT INTO public.praticiens (code, type, nom, specialite, note, conventionne, telephone, actif) VALUES
('MED-001', 'Médecin', 'Dr Kouassi Marcel', 'Cardiologue', 3, true, '07 07 12 34 56', true),
('MED-002', 'Médecin', 'Dr Yao Ahou Estelle', 'Pédiatre', 2, false, '05 04 22 11 00', true),
('MED-003', 'Médecin', 'Dr Diallo Ibrahima', 'Diabétologue', 3, true, '01 02 88 99 77', true),
('MED-004', 'Médecin', 'Dr Bamba Souleymane', 'Généraliste', 1, false, '07 48 33 22 11', true),
('MED-005', 'Médecin', 'Dr Koné Fatou', 'Gynécologue', 2, true, '07 55 44 33 22', true),
('MED-006', 'Médecin', 'Dr N''Goran Jean-Paul', 'Pneumologue', 3, false, '05 11 22 33 44', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.presences (id, code, nom, lieu, commune, lundi, mardi, mercredi, jeudi, vendredi, lat, lon) VALUES
('PRES-01', 'MED-001', 'Dr Kouassi Marcel', 'CHU Treichville (Pavillon Cardiologie)', 'Treichville', NULL, 'Matin', NULL, 'Soir', NULL, 5.3012, -4.0045),
('PRES-02', 'MED-001', 'Dr Kouassi Marcel', 'Polyclinique Sainte Anne-Marie (PISAM)', 'Cocody', 'Soir', NULL, 'Matin', NULL, NULL, 5.3421, -3.9982),
('PRES-03', 'MED-002', 'Dr Yao Ahou Estelle', 'Clinique Farah', 'Marcory', 'Matin', 'Matin', 'Matin', 'Matin', 'Matin', 5.3120, -3.9850),
('PRES-04', 'MED-003', 'Dr Diallo Ibrahima', 'HG Yopougon Attié', 'Yopougon', NULL, NULL, 'Toute la journée', NULL, NULL, 5.3450, -4.0780),
('PRES-05', 'MED-005', 'Dr Koné Fatou', 'Polyclinique Sainte Anne-Marie', 'Cocody', 'Matin', NULL, 'Soir', NULL, 'Matin', 5.3418, -3.9975)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pharmacies (code, nom, titulaire, commune, quartier, telephone, note, conventionne, lat, lon, actif) VALUES
('PHA-001', 'Pharmacie des Lagunes', 'Dr Diarra Seydou', 'Plateau', 'Commerce', '27 20 21 00 11', 3, true, 5.3210, -4.0190, true),
('PHA-002', 'Pharmacie Saint-Jean', 'Dr Koffi Marie', 'Cocody', 'Saint-Jean', '27 22 44 55 66', 2, true, 5.3480, -3.9910, true),
('PHA-003', 'Grande Pharmacie de Treich', 'Dr Touré Bakary', 'Treichville', 'Arras', '27 21 24 00 00', 3, true, 5.3050, -4.0080, true)
ON CONFLICT (code) DO NOTHING;

NOTIFY pgrst, 'reload schema';
