-- bot-ia-prompts.sql — 2026-08-28

/**
 * @brief Table de stockage des tickets saisis sur la page « Sub Tickets » (/ceo/Sub-Tickets).
 * @note Remplace ceo-test-prompts.sql, qui n'a JAMAIS été exécuté : la table
 * `ceo_test_prompts` n'existe pas et n'a pas à être créée.
 * @warning STRICTEMENT ADDITIF : aucun DROP, aucun ALTER sur une table
 * existante, aucune contrainte (FK/trigger) posée sur une table existante.
 * `IF NOT EXISTS` partout → le script est rejouable sans effet de bord.
 * @note Contexte vérifié le 2026-08-28 : base `postgres`, PostgreSQL 17.4,
 * 107 tables dans `public`, aucune nommée `bot_ia_prompts`.
 * @note À exécuter dans l'éditeur SQL Supabase (SQL Editor → New query → Run).
 */

CREATE TABLE IF NOT EXISTS public.bot_ia_prompts (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    content     text        NOT NULL,
    -- Auteur : recopié depuis le JWT au moment de l'écriture.
    -- Volontairement PAS de foreign key vers public.users : on ne pose
    -- aucune dépendance sur une table déjà en place.
    user_id     uuid,
    user_email  text,
    user_role   text,
    -- Origine de la saisie, pour pouvoir réutiliser la table si d'autres
    -- écrans écrivent dedans plus tard.
    source      text        NOT NULL DEFAULT 'bot_ia',
    created_at  timestamptz NOT NULL DEFAULT now()
);

/** @brief Index de lecture : « derniers tickets » et « tickets d'un utilisateur ». */
CREATE INDEX IF NOT EXISTS bot_ia_prompts_created_at_idx
    ON public.bot_ia_prompts (created_at DESC);

CREATE INDEX IF NOT EXISTS bot_ia_prompts_user_id_created_at_idx
    ON public.bot_ia_prompts (user_id, created_at DESC);

/**
 * @brief RLS activée SANS policy.
 * @note PostgREST (clé anon, publique une fois le front déployé) ne peut
 * donc ni lire ni écrire cette table. L'API FastAPI, elle, se connecte au
 * Postgres avec le rôle `postgres` — propriétaire, qui contourne la RLS —
 * donc /api/v1/bot-ia-prompts continue de fonctionner. (Rôle de connexion
 * vérifié le 2026-08-28 : current_user = postgres.)
 */
ALTER TABLE public.bot_ia_prompts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.bot_ia_prompts IS
    'Tickets saisis depuis la page CEO Sub Tickets (/ceo/Sub-Tickets). Table additive (2026-08-28), independante du reste du schema.';
