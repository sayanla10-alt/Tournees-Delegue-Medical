-- =============================================================================
-- jumelage_colonnes.sql : Supabase reçoit TOUTES les colonnes du Google Sheet
-- (3.28.11) À exécuter une fois dans Supabase > SQL Editor. Sans risque : n'efface rien.
-- =============================================================================

-- 1. Textes sans limite de longueur (sauf les clés code / id / uid)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type = 'character varying'
      AND table_name IN ('praticiens','presences','pharmacies','etablissements','visites','plannings','rapports','quartiers','fiches_produits','listes_reference')
      AND column_name NOT IN ('code','id','uid')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE text', r.table_name, r.column_name);
  END LOOP;
END $$;

-- 2. Colonnes du Sheet absentes de Supabase
ALTER TABLE public.praticiens     ADD COLUMN IF NOT EXISTS prochaine text, ADD COLUMN IF NOT EXISTS absent_du date, ADD COLUMN IF NOT EXISTS absent_au date;
ALTER TABLE public.presences      ADD COLUMN IF NOT EXISTS secteur text, ADD COLUMN IF NOT EXISTS origine_gps text;
ALTER TABLE public.pharmacies     ADD COLUMN IF NOT EXISTS reperes text, ADD COLUMN IF NOT EXISTS prochaine text, ADD COLUMN IF NOT EXISTS source text, ADD COLUMN IF NOT EXISTS origine_gps text;
ALTER TABLE public.etablissements ADD COLUMN IF NOT EXISTS position text, ADD COLUMN IF NOT EXISTS origine_gps text;
ALTER TABLE public.visites        ADD COLUMN IF NOT EXISTS prochaine_etape text, ADD COLUMN IF NOT EXISTS interlocuteur text, ADD COLUMN IF NOT EXISTS reactions text,
                                  ADD COLUMN IF NOT EXISTS stocks text, ADD COLUMN IF NOT EXISTS commande text, ADD COLUMN IF NOT EXISTS complements text, ADD COLUMN IF NOT EXISTS suite text;
ALTER TABLE public.plannings      ADD COLUMN IF NOT EXISTS maj text, ADD COLUMN IF NOT EXISTS id_arret text, ADD COLUMN IF NOT EXISTS cible_depuis text;
ALTER TABLE public.rapports       ADD COLUMN IF NOT EXISTS valide_le text, ADD COLUMN IF NOT EXISTS maj text;

-- 3. Produits présentés et échantillons : texte tel que dans le Sheet
ALTER TABLE public.visites ALTER COLUMN produits_presentes TYPE text USING produits_presentes::text;
ALTER TABLE public.visites ALTER COLUMN echantillons TYPE text USING echantillons::text;

ALTER TABLE public.rapports ALTER COLUMN valide_le TYPE text USING valide_le::text;

-- 4. Rafraîchir le cache de l'API
NOTIFY pgrst, 'reload schema';

-- 3.28.12 : aucune information perdue
-- « autres » reçoit toute colonne du Sheet sans colonne dédiée (ex. Praticiens > Conventionné)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['praticiens','presences','pharmacies','etablissements','visites','plannings','rapports','quartiers','fiches_produits'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS autres jsonb', t);
  END LOOP;
END $$;
-- « Non faites » contient les noms des visites non faites (texte), pas un nombre
ALTER TABLE public.rapports ALTER COLUMN non_faites DROP DEFAULT;
ALTER TABLE public.rapports ALTER COLUMN non_faites TYPE text USING non_faites::text;
NOTIFY pgrst, 'reload schema';
