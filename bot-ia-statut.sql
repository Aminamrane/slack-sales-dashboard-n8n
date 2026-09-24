-- bot-ia-statut.sql — 2026-09-07

/**
 * @brief Ajoute la colonne de STATUT à public.bot_ia_prompts pour piloter la file d'attente de Sub Tickets.
 * @note Permet de savoir si un ticket est en attente, en cours de
 * traitement, ou traité.
 * @warning STRICTEMENT ADDITIF, même discipline que bot-ia-prompts.sql :
 * aucun DROP, aucun ALTER destructif, `IF NOT EXISTS` partout -> rejouable
 * sans effet de bord. La colonne a une valeur par défaut, donc les INSERT
 * existants (POST /api/v1/bot-ia-prompts) continuent de fonctionner tels quels.
 * @note Valeurs de `statut` :
 *   'en_attente' (défaut) — nouveau ticket, personne ne le traite encore
 *   'en_cours'            — traitement en cours (les « … »)
 *   'traite'              — traitement terminé
 */

ALTER TABLE public.bot_ia_prompts
    ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'en_attente';

/** @brief Horodatage du dernier changement de statut, pour la traçabilité. */
ALTER TABLE public.bot_ia_prompts
    ADD COLUMN IF NOT EXISTS statut_maj_at timestamptz;

/** @brief Index de lecture rapide : « les tickets en attente, le plus ancien d'abord ». */
CREATE INDEX IF NOT EXISTS bot_ia_prompts_statut_idx
    ON public.bot_ia_prompts (statut, created_at);

COMMENT ON COLUMN public.bot_ia_prompts.statut IS
    'File d''attente Sub Tickets : en_attente | en_cours | traite. Voir instruction_file_dattente.md.';
