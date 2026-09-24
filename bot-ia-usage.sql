-- bot-ia-usage.sql — 2026-09-07

/**
 * @brief Registre des dépenses de Sub Tickets (/ceo/Sub-Tickets) : une ligne par échange réellement facturé par l'API Anthropic.
 * @note Le solde affiché à l'écran se déduit de cette table, donc il survit
 * à un F5 et à un changement de poste.
 * @warning STRICTEMENT ADDITIF, même discipline que bot-ia-prompts.sql :
 * aucun DROP, aucun ALTER sur une table existante, aucune contrainte posée
 * sur une table existante, `IF NOT EXISTS` partout -> rejouable sans effet
 * de bord.
 * @note À exécuter dans l'éditeur SQL Supabase (SQL Editor -> New query -> Run).
 */

-- ─────────────────────────────────────────────────────────────────────────
-- 1) La table
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bot_ia_usage (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Qui. Recopie du JWT cote serveur, jamais envoye par le navigateur.
    -- Volontairement PAS de foreign key vers public.users : aucune
    -- dependance posee sur une table deja en place.
    user_id     uuid,
    user_email  text,
    user_role   text,

    -- Quel echange. `prompt_id` renvoie vers public.bot_ia_prompts.id
    -- (sans FK, meme raison). `request_id` est l'id de la reponse
    -- Anthropic : il rend l'ecriture idempotente en cas de re-essai.
    prompt_id   uuid,
    request_id  text,

    -- Quel modele, a quel effort.
    model       text        NOT NULL,
    effort      text,

    -- Tokens, tels que renvoyes par `usage` dans la reponse Anthropic.
    -- `thinking_tokens` est DEJA COMPRIS dans `output_tokens` : il est
    -- stocke pour information, il ne doit jamais etre refacture a part.
    input_tokens                 integer NOT NULL DEFAULT 0,
    output_tokens                integer NOT NULL DEFAULT 0,
    cache_creation_input_tokens  integer NOT NULL DEFAULT 0,
    cache_read_input_tokens      integer NOT NULL DEFAULT 0,
    thinking_tokens              integer NOT NULL DEFAULT 0,

    -- Cout. Calcule cote serveur au moment de l'echange, puis fige : on ne
    -- veut pas qu'un changement de tarif ou de taux de change reecrive
    -- l'historique. `usd_to_eur` garde le taux applique ce jour-la.
    cost_usd    numeric(14,8) NOT NULL DEFAULT 0,
    cost_eur    numeric(14,8) NOT NULL DEFAULT 0,
    usd_to_eur  numeric(10,6) NOT NULL,

    -- Origine de l'ecriture, pour reutiliser la table si un autre ecran
    -- consomme le meme budget plus tard.
    source      text        NOT NULL DEFAULT 'bot_ia',
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Les index : les deux lectures attendues
-- ─────────────────────────────────────────────────────────────────────────
-- Solde GLOBAL et historique recent.
CREATE INDEX IF NOT EXISTS bot_ia_usage_created_at_idx
    ON public.bot_ia_usage (created_at DESC);

-- Solde PAR UTILISATEUR et historique d'une personne.
CREATE INDEX IF NOT EXISTS bot_ia_usage_user_id_created_at_idx
    ON public.bot_ia_usage (user_id, created_at DESC);

-- Idempotence : deux ecritures pour la meme reponse Anthropic sont
-- impossibles, donc un re-essai reseau ne debite pas deux fois.
CREATE UNIQUE INDEX IF NOT EXISTS bot_ia_usage_request_id_uniq
    ON public.bot_ia_usage (request_id)
    WHERE request_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) RLS activee SANS policy
-- ─────────────────────────────────────────────────────────────────────────
/**
 * @brief RLS activée SANS policy.
 * @note Conséquence vérifiée sur bot_ia_prompts le 2026-09-07 avec la clé anon :
 *   SELECT -> HTTP 200 et tableau vide (aucune ligne visible, silencieux)
 *   INSERT -> HTTP 401, code 42501 "new row violates row-level security policy"
 * @warning La clé anon est publique (elle part dans le bundle du front),
 * elle ne doit donc jamais pouvoir lire un coût ni en écrire un. Seuls la
 * clé service_role (BYPASSRLS) et le rôle propriétaire `postgres` de l'API
 * FastAPI y accèdent.
 */
ALTER TABLE public.bot_ia_usage ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.bot_ia_usage IS
    'Registre des dépenses de Sub Tickets (/ceo/Sub-Tickets) : une ligne par échange facturé. Table additive (2026-09-07), indépendante du reste du schéma.';

-- ─────────────────────────────────────────────────────────────────────────
-- 4) Les totaux
-- ─────────────────────────────────────────────────────────────────────────
/**
 * @brief Totaux des dépenses de Sub Tickets, exposés en RPC.
 * @param p_user_id `NULL` pour le solde GLOBAL, ou l'identifiant d'un utilisateur pour son solde individuel.
 * @returns `{ exchanges, total_usd, total_eur, last_at }`.
 * @note Vérifié le 2026-09-07 : les fonctions d'agrégat sont DÉSACTIVÉES sur
 * PostgREST pour ce projet (`?select=cost_eur.sum()` -> HTTP 400, PGRST123
 * "Use of aggregate functions is not allowed"). D'où l'exposition du total
 * par une fonction RPC plutôt que par un agrégat dans l'URL.
 * @warning SECURITY INVOKER (le défaut) : la RLS s'applique à l'appelant,
 * donc la clé anon obtient des totaux vides. Ne jamais passer cette
 * fonction en SECURITY DEFINER, ce serait rouvrir la table à tout le monde.
 */
CREATE OR REPLACE FUNCTION public.bot_ia_usage_totals(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
    exchanges  bigint,
    total_usd  numeric,
    total_eur  numeric,
    last_at    timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT count(*)::bigint,
           COALESCE(sum(u.cost_usd), 0)::numeric,
           COALESCE(sum(u.cost_eur), 0)::numeric,
           max(u.created_at)
      FROM public.bot_ia_usage u
     WHERE p_user_id IS NULL OR u.user_id = p_user_id;
$$;

COMMENT ON FUNCTION public.bot_ia_usage_totals(uuid) IS
    'Totaux des dépenses de Sub Tickets. p_user_id NULL = global, sinon par utilisateur. SECURITY INVOKER : la RLS s''applique.';

-- Ceinture et bretelles : on retire le droit d execution aux roles publics
-- de Supabase quand ils existent (ils n existent pas sur un Postgres nu).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE EXECUTE ON FUNCTION public.bot_ia_usage_totals(uuid) FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE EXECUTE ON FUNCTION public.bot_ia_usage_totals(uuid) FROM authenticated;
    END IF;
END
$$;
