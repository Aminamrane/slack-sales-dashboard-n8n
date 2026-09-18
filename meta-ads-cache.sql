-- meta-ads-cache.sql — 2026-09-18
--
-- Cache de persistance pour /meta-ads : une ligne par (kind, since, until)
-- où kind = 'campaign' | 'adset' | 'ad' | 'leaderboard'. `payload` contient
-- la reponse TELLE QUE renvoyee par l'API meta-ads d'api-owner (deja agregee
-- Meta + CRM) : cette table ne reimplemente aucun matching ni aucun score,
-- elle se contente de conserver le dernier resultat connu pour eviter de
-- rappeler api-owner a chaque ouverture de page.
--
-- STRICTEMENT ADDITIF, meme discipline que bot-ia-usage.sql : aucun DROP,
-- aucun ALTER sur une table existante, `IF NOT EXISTS` partout -> rejouable
-- sans effet de bord. Independante de toute table de cohorte/sequence.
--
-- Execute le 2026-09-18 via connexion Postgres directe (role `postgres` du
-- pooler Supabase, meme connexion que le backend api-owner et que
-- BOT_IA_DB_URL) -- PAS via l'API REST Supabase / une cle service_role.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) La table
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meta_ads_cache (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Cle logique de cache. since_date/until_date sont des dates (pas des
    -- timestamps) : les presets de la page produisent des bornes stables a
    -- la journee, donc la meme cle sert toute la journee pour tout le monde.
    kind          text        NOT NULL CHECK (kind IN ('campaign', 'adset', 'ad', 'leaderboard')),
    since_date    date        NOT NULL,
    until_date    date        NOT NULL,

    -- Dernier resultat connu. NULL tant qu'aucune synchro n'a jamais reussi
    -- pour cette cle (etat "ligne juste creee pour poser le verrou") :
    -- c'est ce NULL qui declenche le fetch synchrone du tout premier chargement.
    payload       jsonb,
    data_hash     text,       -- sha256 du payload, evite une ecriture si rien n'a change
    updated_at    timestamptz, -- dernier changement REEL du contenu

    -- Etat de synchronisation / verrou single-flight.
    sync_status   text        NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('idle', 'running', 'error')),
    started_at    timestamptz, -- pose au moment du verrou, sert aussi a l'auto-liberation
    synced_at     timestamptz, -- dernier CHECK reussi (meme si contenu identique) : sert au TTL
    last_error    text,
    last_error_status integer, -- code HTTP renvoye par api-owner, si connu (ex: 503 = tokens Meta manquants)
    last_error_at timestamptz,

    created_at    timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Unicite de la cle de cache
-- ─────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS meta_ads_cache_key_uniq
    ON public.meta_ads_cache (kind, since_date, until_date);

-- ─────────────────────────────────────────────────────────────────────────
-- 3) RLS activee SANS policy — meme discipline que bot_ia_usage
-- ─────────────────────────────────────────────────────────────────────────
-- La cle anon (publique, dans le bundle du front) ne doit jamais lire ni
-- ecrire les performances Meta Ads. Seul le role `postgres` (connexion
-- Postgres directe, cote serveur uniquement -- api/meta-ads/*.mjs), y accede.
ALTER TABLE public.meta_ads_cache ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.meta_ads_cache IS
    'Cache de la reponse agregee api-owner pour /meta-ads (Meta + CRM deja joints cote api-owner). Table additive (2026-09-18), independante du reste du schema.';
