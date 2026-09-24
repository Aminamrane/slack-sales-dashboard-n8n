// src/utils/botIaBilling.js

/**
 * @file botIaBilling.js
 * @brief Facturation de Sub Tickets (/ceo/Sub-Tickets) : tarifs, coût d'un échange, formatage.
 *
 * @note Module PUR (aucune API navigateur), utilisé des DEUX côtés : le
 * serveur (api/bot-ia/chat.mjs) calcule le coût réel avec, le front
 * l'utilise pour formater. Une seule formule, pas deux qui divergent.
 *
 * @note Le coût est calculé à partir du `usage` renvoyé par l'API Anthropic,
 * lu dans l'évènement `message_delta` du flux — le seul qui porte le total
 * définitif (celui de `message_start` est partiel et 10x trop bas).
 */

/**
 * @brief Tarifs officiels Anthropic, en dollars par MILLION de tokens.
 * @note Claude Opus 5, vérifiés sur la doc tarifaire le 2026-09-07. Les
 * écritures de cache 5 min et 1 h n'ont PAS le même prix : il faut les
 * distinguer, d'où la lecture de `usage.cache_creation`.
 */
export const PRICING_USD_PER_MTOK = {
  input: 5,           // entrée non mise en cache
  output: 25,         // sortie — les tokens de réflexion y sont DÉJÀ inclus
  cacheRead: 0.5,     // lecture de cache      (0,1 × input)
  cacheWrite5m: 6.25, // écriture de cache 5 min (1,25 × input)
  cacheWrite1h: 10,   // écriture de cache 1 h   (2 × input)
};

/**
 * @brief Taux de repli USD → EUR, utilisé seulement si `fetchUsdToEur` échoue.
 * @note Le vrai taux est récupéré à l'exécution côté serveur (cf. `fetchUsdToEur`).
 */
export const FALLBACK_USD_TO_EUR = 0.86;

/**
 * @brief Coût d'un échange en DOLLARS, à partir du `usage` de l'API.
 * @param usage Objet `usage` renvoyé par l'API Anthropic.
 * @returns Le coût en dollars.
 * @warning Deux pièges évités volontairement :
 *  - `output_tokens_details.thinking_tokens` n'est PAS ajouté : ces tokens
 *    sont déjà comptés dans `output_tokens`. Les additionner surfacturerait
 *    la réflexion d'environ un tiers.
 *  - les trois natures d'entrée (fraîche, lue en cache, écrite en cache) ne
 *    sont pas additionnées avant multiplication : elles n'ont pas le même
 *    tarif, et confondre une lecture de cache avec de l'entrée fraîche
 *    surfacturerait d'un facteur 10.
 */
export function costUsdFromUsage(usage = {}) {
  const {
    input_tokens = 0,
    output_tokens = 0,
    cache_read_input_tokens = 0,
    cache_creation_input_tokens = 0,
    cache_creation = null,
  } = usage;

  // Détail 5 min / 1 h quand l'API le fournit ; sinon on retombe sur le total
  // d'écriture, facturé au tarif 5 min (le cas courant).
  const write5m = cache_creation?.ephemeral_5m_input_tokens ?? cache_creation_input_tokens;
  const write1h = cache_creation?.ephemeral_1h_input_tokens ?? 0;

  const P = PRICING_USD_PER_MTOK;
  return (
    (input_tokens             / 1e6) * P.input +
    (output_tokens            / 1e6) * P.output +
    (cache_read_input_tokens  / 1e6) * P.cacheRead +
    (write5m                  / 1e6) * P.cacheWrite5m +
    (write1h                  / 1e6) * P.cacheWrite1h
  );
}

/**
 * @brief Coût d'un échange en EUROS.
 * @param usage Objet `usage` renvoyé par l'API Anthropic.
 * @param usdToEur Taux de change à appliquer (défaut : `FALLBACK_USD_TO_EUR`).
 * @returns Le coût en euros.
 */
export function costEurFromUsage(usage, usdToEur = FALLBACK_USD_TO_EUR) {
  return costUsdFromUsage(usage) * (Number(usdToEur) || FALLBACK_USD_TO_EUR);
}

/**
 * @brief Récupère le taux USD → EUR du jour (référence BCE, sans clé d'API).
 * @param options.timeoutMs Délai maximal avant repli (défaut 3000 ms).
 * @returns `{ rate, live, date? }` — `live: false` si le taux réel n'a pas pu être récupéré.
 * @note Le domaine `.app` renvoie une redirection 301 vers `.dev` : on
 * appelle `.dev` directement, sinon un runtime qui ne suit pas les
 * redirections échoue en silence. Le taux BCE n'est publié que les jours
 * ouvrés — une date de réponse antérieure à aujourd'hui est normale, ce
 * n'est pas une panne.
 * @warning Appelée côté SERVEUR uniquement (le front reçoit des euros déjà convertis).
 */
export async function fetchUsdToEur({ timeoutMs = 3000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(
      "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR",
      { signal: ctrl.signal },
    );
    if (!res.ok) return { rate: FALLBACK_USD_TO_EUR, live: false };
    const data = await res.json();
    const rate = Number(data?.rates?.EUR);
    if (!Number.isFinite(rate) || rate <= 0) return { rate: FALLBACK_USD_TO_EUR, live: false };
    return { rate, live: true, date: data?.date || null };
  } catch {
    return { rate: FALLBACK_USD_TO_EUR, live: false };
  } finally {
    clearTimeout(timer);
  }
}

// ── Affichage ─────────────────────────────────────────────────────────────
export const COLOR_CREDIT = "#3df269"; // solde disponible
export const COLOR_EMPTY = "#ff2b2b";  // solde épuisé

/**
 * @brief Formate le SOLDE comme une somme d'argent : « 20 € », « 19,58 € ».
 * @param amount Montant en euros.
 * @returns Le solde formaté.
 * @note Sous le centime mais non nul, on écrit « < 0,01 € » plutôt que
 * « 0 € » — dire zéro alors qu'il reste du crédit serait un mensonge, et le
 * test d'épuisement doit de toute façon porter sur le nombre, pas sur ce texte.
 */
export function formatEur(amount) {
  const n = Number(amount) || 0;
  if (n > 0 && n < 0.005) return "< 0,01 €";
  // 20 - 0.0001 doit rester « 20 € » et non « 20,00 € » : on arrondit avant
  // de décider s'il y a une partie décimale à montrer.
  const rounded = Math.round(n * 100) / 100;
  const decimals = Number.isInteger(rounded) ? 0 : 2;
  return `${rounded.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} €`;
}

/**
 * @brief Formate le COÛT d'un échange, qui vit dans une autre échelle (souvent quelques millièmes d'euro).
 * @param amount Montant en euros.
 * @returns Le coût formaté, avec toujours deux chiffres significatifs (jusqu'à quatre décimales) :
 *
 *   1,5     -> « 1,50 € »      0,031   -> « 0,031 € »
 *   0,22    -> « 0,22 € »      0,0073  -> « 0,0073 € »
 *   0,00004 -> « < 0,0001 € »  0       -> « 0 € »
 * @note Avec la règle du solde (`formatEur`) ce montant s'afficherait
 * « 0 € », ce qui laisserait croire que c'est gratuit.
 */
export function formatEurCost(amount) {
  const n = Number(amount) || 0;
  if (n <= 0) return "0 €";
  if (n < 0.0001) return "< 0,0001 €";
  const decimals = n >= 0.1 ? 2 : n >= 0.01 ? 3 : 4;
  return `${n.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} €`;
}
