-- =============================================================================
-- MediPlanner : Schéma de base de données PostgreSQL pour Supabase
-- Version : 1.0.0
-- Compatible à 100 % avec le modèle de données Google Sheets existant
-- =============================================================================

-- Extension pour la génération automatique des UUID si besoin
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------
-- 1. Table : Praticiens (Médecins & Spécialistes)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.praticiens (
    code VARCHAR(32) PRIMARY KEY,                    -- CodeContact (ex: MED-001)
    type VARCHAR(32) NOT NULL DEFAULT 'Médecin',     -- Type (Médecin, Pharmacie, etc.)
    nom TEXT NOT NULL,                               -- Nom complet du praticien
    specialite TEXT NOT NULL DEFAULT 'Généraliste',  -- Spécialité médicale canonique
    note SMALLINT NOT NULL DEFAULT 2 CHECK (note BETWEEN 1 AND 3), -- Potentiel (1=C, 2=B, 3=A)
    conventionne BOOLEAN NOT NULL DEFAULT false,     -- Engagé / Prescription engagée
    telephone VARCHAR(32),                           -- Numéro de téléphone normalisé
    derniere DATE,                                   -- Date dernière visite (YYYY-MM-DD)
    statut VARCHAR(64),                              -- Dernier statut de visite
    commentaire TEXT,                                -- Dernier commentaire / compte-rendu
    nb_visites INTEGER NOT NULL DEFAULT 0,           -- Nombre total de visites réalisées
    actif BOOLEAN NOT NULL DEFAULT true,             -- Actif dans le répertoire
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour la recherche et les tris fréquents
CREATE INDEX IF NOT EXISTS idx_praticiens_nom ON public.praticiens (nom);
CREATE INDEX IF NOT EXISTS idx_praticiens_specialite ON public.praticiens (specialite);
CREATE INDEX IF NOT EXISTS idx_praticiens_note ON public.praticiens (note);
CREATE INDEX IF NOT EXISTS idx_praticiens_actif ON public.praticiens (actif);

-- -------------------------------------------------------------
-- 2. Table : Présences (Lieux de consultation et créneaux des médecins)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.presences (
    id VARCHAR(64) PRIMARY KEY,                      -- IdPresence (ex: PRES-001)
    code VARCHAR(32) NOT NULL REFERENCES public.praticiens(code) ON UPDATE CASCADE ON DELETE CASCADE,
    nom TEXT,                                        -- Nom du praticien (dénormalisé pour lecture rapide)
    lieu TEXT NOT NULL,                              -- Hôpital, CHU, polyclinique ou cabinet
    quartier TEXT,                                   -- Quartier ou repère
    commune VARCHAR(64) NOT NULL,                    -- Commune (Cocody, Plateau, Treichville...)
    zone VARCHAR(32),                                -- Zone (Nord, Sud, etc.)
    lundi VARCHAR(32),                               -- Créneaux du lundi (ex: "Matin", "Matin/Soir", "08:00-12:00")
    mardi VARCHAR(32),
    mercredi VARCHAR(32),
    jeudi VARCHAR(32),
    vendredi VARCHAR(32),
    horaire_matin VARCHAR(32),                       -- Heure précise matin (ex: "08:00-12:00")
    horaire_soir VARCHAR(32),                        -- Heure précise soir (ex: "15:00-18:00")
    lat DOUBLE PRECISION,                            -- Coordonnées GPS latitude
    lon DOUBLE PRECISION,                            -- Coordonnées GPS longitude
    reperes TEXT,                                    -- Repères d'accès (ex: "Enceinte CHU, Bâtiment B")
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presences_code ON public.presences (code);
CREATE INDEX IF NOT EXISTS idx_presences_commune ON public.presences (commune);
CREATE INDEX IF NOT EXISTS idx_presences_lieu ON public.presences (lieu);

-- -------------------------------------------------------------
-- 3. Table : Pharmacies (Officines et points de distribution)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharmacies (
    code VARCHAR(32) PRIMARY KEY,                    -- CodeContact (ex: PHA-001)
    nom TEXT NOT NULL,                               -- Nom de l'officine
    titulaire TEXT,                                  -- Pharmacien titulaire
    quartier TEXT,                                   -- Quartier
    commune VARCHAR(64) NOT NULL,                    -- Commune
    zone VARCHAR(32),
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    telephone VARCHAR(32),
    horaire_matin VARCHAR(32),
    horaire_soir VARCHAR(32),
    note SMALLINT NOT NULL DEFAULT 2 CHECK (note BETWEEN 1 AND 3),
    conventionne BOOLEAN NOT NULL DEFAULT false,     -- Partenariat / Commande engagée
    derniere DATE,                                   -- Date dernière visite
    statut VARCHAR(64),
    commentaire TEXT,
    nb_visites INTEGER NOT NULL DEFAULT 0,
    actif BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pharmacies_commune ON public.pharmacies (commune);
CREATE INDEX IF NOT EXISTS idx_pharmacies_actif ON public.pharmacies (actif);

-- -------------------------------------------------------------
-- 4. Table : Établissements (Répertoire de référence des structures de santé)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.etablissements (
    code VARCHAR(32) PRIMARY KEY,                    -- CodeEtab
    nom TEXT NOT NULL,                               -- Nom officiel
    categorie VARCHAR(64),                           -- CHU, HG, Polyclinique, Clinique, Cabinet
    commune VARCHAR(64) NOT NULL,
    quartier TEXT,
    zone VARCHAR(32),
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    telephone VARCHAR(32),
    reperes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etablissements_nom ON public.etablissements (nom);
CREATE INDEX IF NOT EXISTS idx_etablissements_commune ON public.etablissements (commune);

-- -------------------------------------------------------------
-- 5. Table : Visites (Historique des passages et comptes-rendus)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.visites (
    uid VARCHAR(64) PRIMARY KEY,                     -- IdSync (UUID généré côté client)
    date DATE NOT NULL,                              -- Date de la visite (YYYY-MM-DD)
    horodatage TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- Heure exacte d'enregistrement
    delegue VARCHAR(64) NOT NULL,                    -- Nom du délégué médical
    code VARCHAR(32) NOT NULL,                       -- CodeContact
    id_presence VARCHAR(64),                         -- Référence au lieu visité
    nom TEXT NOT NULL,                               -- Nom du praticien ou de l'officine
    type VARCHAR(32) NOT NULL DEFAULT 'Médecin',     -- Médecin ou Pharmacie
    specialite VARCHAR(64),
    note SMALLINT DEFAULT 2,
    commune VARCHAR(64),
    quartier TEXT,
    lieu TEXT,
    creneau VARCHAR(32),                             -- Matin, Soir, ou horaire fixe
    statut VARCHAR(64) NOT NULL,                     -- "Vu / Échange réalisé", "Absent", etc.
    type_echange VARCHAR(64),                        -- Présentation produit, Remise échantillons, etc.
    produits_presentes JSONB,                        -- Tableau JSON des molécules abordées
    echantillons JSONB,                              -- Tableau JSON des échantillons remis
    prochaine_visite DATE,                           -- Date prévue du prochain passage
    commentaire TEXT,                                -- Synthèse / remarques
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visites_date ON public.visites (date);
CREATE INDEX IF NOT EXISTS idx_visites_delegue ON public.visites (delegue);
CREATE INDEX IF NOT EXISTS idx_visites_code ON public.visites (code);

-- -------------------------------------------------------------
-- 6. Table : Plannings (Tournées prévues par délégué et par date)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plannings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delegue VARCHAR(64) NOT NULL,
    date DATE NOT NULL,                              -- Date planifiée
    heure VARCHAR(16),                               -- Heure de passage prévue (ex: "09:30")
    creneau VARCHAR(32),
    debut INTEGER,                                   -- Minute de début dans la journée
    fin INTEGER,                                     -- Minute de fin dans la journée
    id_presence VARCHAR(64),
    code VARCHAR(32) NOT NULL,
    nom TEXT NOT NULL,
    specialite VARCHAR(64),
    note SMALLINT DEFAULT 2,
    quartier TEXT,
    commune VARCHAR(64),
    lieu TEXT,
    statut VARCHAR(64),
    etat VARCHAR(32) DEFAULT 'planifie',             -- 'planifie', 'valide', 'reporte'
    programme VARCHAR(64),                           -- Libellé du programme
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plannings_delegue_date ON public.plannings (delegue, date);

-- -------------------------------------------------------------
-- 7. Table : Rapports Journaliers (Synthèses de fin de journée)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rapports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delegue VARCHAR(64) NOT NULL,
    date DATE NOT NULL,
    valide_le TIMESTAMPTZ DEFAULT NOW(),
    prevues INTEGER NOT NULL DEFAULT 0,
    faites INTEGER NOT NULL DEFAULT 0,
    non_faites INTEGER NOT NULL DEFAULT 0,
    sans_cr INTEGER NOT NULL DEFAULT 0,
    synthese TEXT,
    faits TEXT,
    concurrence TEXT,
    besoins TEXT,
    km NUMERIC(6, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_rapport_delegue_date UNIQUE (delegue, date)
);

-- -------------------------------------------------------------
-- 8. Activation de la Sécurité Ligne par Ligne (Row Level Security)
-- -------------------------------------------------------------
ALTER TABLE public.praticiens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etablissements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plannings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rapports ENABLE ROW LEVEL SECURITY;

-- Politiques ouvertes pour l'application cliente (avec la clé publique anon)
CREATE POLICY "Lecture autorisée pour tous" ON public.praticiens FOR SELECT USING (true);
CREATE POLICY "Écriture autorisée pour tous" ON public.praticiens FOR ALL USING (true);

CREATE POLICY "Lecture presences" ON public.presences FOR SELECT USING (true);
CREATE POLICY "Écriture presences" ON public.presences FOR ALL USING (true);

CREATE POLICY "Lecture pharmacies" ON public.pharmacies FOR SELECT USING (true);
CREATE POLICY "Écriture pharmacies" ON public.pharmacies FOR ALL USING (true);

CREATE POLICY "Lecture etablissements" ON public.etablissements FOR SELECT USING (true);
CREATE POLICY "Écriture etablissements" ON public.etablissements FOR ALL USING (true);

CREATE POLICY "Lecture visites" ON public.visites FOR SELECT USING (true);
CREATE POLICY "Écriture visites" ON public.visites FOR ALL USING (true);

CREATE POLICY "Lecture plannings" ON public.plannings FOR SELECT USING (true);
CREATE POLICY "Écriture plannings" ON public.plannings FOR ALL USING (true);

CREATE POLICY "Lecture rapports" ON public.rapports FOR SELECT USING (true);
CREATE POLICY "Écriture rapports" ON public.rapports FOR ALL USING (true);

-- -------------------------------------------------------------
-- 9. Données initiales d'exemple MediPlanner
-- -------------------------------------------------------------
INSERT INTO public.praticiens (code, type, nom, specialite, note, conventionne, telephone, actif)
VALUES
('MED-001', 'Médecin', 'Dr Kouassi Marcel', 'Cardiologue', 3, true, '07 07 12 34 56', true),
('MED-002', 'Médecin', 'Dr Yao Ahou Estelle', 'Pédiatre', 2, false, '05 04 22 11 00', true),
('MED-003', 'Médecin', 'Dr Diallo Ibrahima', 'Diabétologue', 3, true, '01 02 88 99 77', true),
('MED-004', 'Médecin', 'Dr Bamba Souleymane', 'Généraliste', 1, false, '07 48 33 22 11', true),
('PHA-001', 'Pharmacie', 'Pharmacie des Lagunes', 'Pharmacie', 3, true, '27 20 21 00 11', true),
('MED-005', 'Médecin', 'Dr Koné Fatou', 'Gynécologue', 2, true, '07 55 44 33 22', true),
('MED-006', 'Médecin', 'Dr N''Goran Jean-Paul', 'Pneumologue', 3, false, '05 11 22 33 44', true),
('PHA-002', 'Pharmacie', 'Pharmacie Saint-Jean', 'Pharmacie', 2, true, '27 22 44 55 66', true),
('MED-007', 'Médecin', 'Dr Touré Amadou', 'Cardiologue', 3, true, '01 99 88 77 66', true),
('MED-008', 'Médecin', 'Dr Bakayoko Mariam', 'Pédiatre', 2, false, '07 12 34 56 78', true),
('MED-009', 'Médecin', 'Dr Cissé Lamine', 'Généraliste', 1, false, '05 66 77 88 99', true),
('PHA-003', 'Pharmacie', 'Grande Pharmacie de Treich', 'Pharmacie', 3, true, '27 21 24 00 00', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.presences (id, code, nom, lieu, commune, lundi, mardi, mercredi, jeudi, vendredi, lat, lon)
VALUES
('PRES-01', 'MED-001', 'Dr Kouassi Marcel', 'CHU Treichville (Pavillon Cardiologie)', 'Treichville', NULL, 'Matin', NULL, 'Soir', NULL, 5.3012, -4.0045),
('PRES-02', 'MED-001', 'Dr Kouassi Marcel', 'Polyclinique Sainte Anne-Marie (PISAM)', 'Cocody', 'Soir', NULL, 'Matin', NULL, NULL, 5.3421, -3.9982),
('PRES-03', 'MED-002', 'Dr Yao Ahou Estelle', 'Clinique Farah', 'Marcory', 'Matin', 'Matin', 'Matin', 'Matin', 'Matin', 5.3120, -3.9850),
('PRES-04', 'MED-003', 'Dr Diallo Ibrahima', 'HG Yopougon Attié', 'Yopougon', NULL, NULL, 'Toute la journée', NULL, NULL, 5.3450, -4.0780),
('PRES-05', 'PHA-001', 'Pharmacie des Lagunes', 'Avenue Chardy, Immeuble Alpha', 'Plateau', 'Journée', 'Journée', 'Journée', 'Journée', 'Journée', 5.3210, -4.0190)
ON CONFLICT (id) DO NOTHING;

