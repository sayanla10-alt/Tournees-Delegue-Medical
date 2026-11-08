-- =============================================================================
-- jumelage_bidirectionnel.sql (3.28.12) : Supabase principale, Google Sheets en appoint
-- Toute modification faite directement dans Supabase (Table Editor, SQL, autre outil) est marquée
-- maj_source = 'supabase' (Table Editor, éditeur SQL) et reportée dans le Sheet par le serveur (Jumelage.gs).
-- Le serveur écrit avec l'en-tête x-mediplanner: sheets, ses écritures ne sont donc pas renvoyées.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.jumelage_suppressions (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL,
  cle jsonb,
  source text,
  le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.jumelage_suppressions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acces complet jumelage_suppressions" ON public.jumelage_suppressions;
CREATE POLICY "Acces complet jumelage_suppressions" ON public.jumelage_suppressions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.jumelage_source() RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE h text;
BEGIN
  h := current_setting('request.headers', true);
  IF h IS NULL OR h = '' THEN RETURN 'supabase'; END IF;
  -- appel d'API sans l'en-tête du serveur (ancienne version de l'appli) : 'api', écrasé par le Sheet
  RETURN coalesce(h::json->>'x-mediplanner', 'api');
END $$;

CREATE OR REPLACE FUNCTION public.jumelage_marquer() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  NEW.maj_source := public.jumelage_source();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.jumelage_suppression() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE src text;
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
  FOREACH t IN ARRAY ARRAY['praticiens','presences','pharmacies','etablissements','visites','plannings','rapports','quartiers','fiches_produits','listes_reference'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS maj_source text', t);
    EXECUTE format('DROP TRIGGER IF EXISTS jumelage_marquer ON public.%I', t);
    EXECUTE format('CREATE TRIGGER jumelage_marquer BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.jumelage_marquer()', t);
    EXECUTE format('DROP TRIGGER IF EXISTS jumelage_suppression ON public.%I', t);
    EXECUTE format('CREATE TRIGGER jumelage_suppression AFTER DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.jumelage_suppression()', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (maj_source)', t || '_maj_source_idx', t);
  END LOOP;
END $$;

-- les lignes déjà présentes (maj_source vide) viennent du Sheet : rien à reporter
NOTIFY pgrst, 'reload schema';
