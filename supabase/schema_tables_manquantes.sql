-- =============================================================================
-- MEDIPLANNER : Tables Manquantes (Produits, Quartiers, Listes de référence)
-- A exécuter dans Supabase Dashboard > SQL Editor (Projet: nldyinokqgshnzvdsxgr)
-- =============================================================================

-- 1. Table : fiches_produits (Monographies détaillées pour l'onglet Produits)
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fiches_produits_gamme ON public.fiches_produits (gamme);
CREATE INDEX IF NOT EXISTS idx_fiches_produits_actif ON public.fiches_produits (actif);

ALTER TABLE public.fiches_produits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acces complet fiches_produits" ON public.fiches_produits FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 2. Table : quartiers (429 quartiers géolocalisés avec secteurs d'Abidjan et Intérieur)
CREATE TABLE IF NOT EXISTS public.quartiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    commune VARCHAR(64) NOT NULL,
    quartier VARCHAR(128) NOT NULL,
    zone VARCHAR(64),
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    secteur VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_commune_quartier UNIQUE (commune, quartier)
);

CREATE INDEX IF NOT EXISTS idx_quartiers_commune ON public.quartiers (commune);
CREATE INDEX IF NOT EXISTS idx_quartiers_secteur ON public.quartiers (secteur);

ALTER TABLE public.quartiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acces complet quartiers" ON public.quartiers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. Table : listes_reference (Produits promotionnés, Délégués, Statuts, Activités, Fériés)
CREATE TABLE IF NOT EXISTS public.listes_reference (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    categorie VARCHAR(64) NOT NULL, -- 'produit', 'delegue', 'statut', 'activite', 'activite_pharmacie', 'ferie'
    valeur TEXT NOT NULL,
    metadata JSONB,
    ordre INTEGER DEFAULT 0,
    actif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_cat_val UNIQUE (categorie, valeur)
);

CREATE INDEX IF NOT EXISTS idx_listes_categorie ON public.listes_reference (categorie);

ALTER TABLE public.listes_reference ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acces complet listes_reference" ON public.listes_reference FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
