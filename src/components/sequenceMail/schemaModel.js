// src/components/sequenceMail/schemaModel.js
//
// Modèle pur du schéma de séquence : regroupe les e-mails d'une cohorte en chaînes
// chronologiques — une par séquence × segment, le même découpage que `neighborsOf` (model.js),
// qui sert déjà à afficher « Précédent »/« Suivant » dans le lecteur — et calcule le délai entre
// étapes consécutives via `delayBetween`. Aucun accès réseau ni React ici : module testé sous Node
// (`schemaModel.test.js`).
//
// Les envois ponctuels (« oneshot ») ne sont jamais reliés entre eux : ce sont des diffusions
// indépendantes, pas les étapes d'un même parcours (ex. 05-26 : le report de date et l'invitation
// à froid n'ont ni le même public ni de succession réelle).
//
// Les étapes SYNTHÉTISÉES (`fallback: true`, cf. `fallbackStep` dans model.js) — des types d'e-mails
// connus du seul CRM, sans contenu local — n'entrent jamais dans une chaîne : leur ordre et leur
// séquence seraient devinés, et le schéma ne doit pas inventer un parcours.

import { SEGMENTS, SEQUENCES, delayBetween } from './model.js';

const SEGMENT_ORDER = { missed: 0, attended: 1, all: 2 };
const segmentRank = (segment) => (segment ? SEGMENT_ORDER[segment] ?? 3 : -1);
const byOrder = (a, b) => a.order - b.order;

/** @brief Vrai pour une étape synthétisée sans contenu local (contrat avec hooks.js : `fallback === true`). */
export const isFallbackEmail = (email) => email?.fallback === true;

/**
 * @param emails E-mails de la cohorte sélectionnée (forme de `deriveEmails`, cf. hooks.js).
 * @returns Chaînes triées (pré-webinaire, puis post-webinaire par segment, puis envois ponctuels),
 *   chacune `{ id, sequence, segment, label, connected, steps, gaps }` :
 *   - `connected` : faux pour les envois ponctuels (pas de flèche entre eux) ;
 *   - `gaps[i]` : délai entre `steps[i]` et `steps[i + 1]` (texte lisible, ou `null` si les deux
 *     étapes ne sont pas planifiées sur une base comparable — délai réellement variable, jamais
 *     inventé) ;
 *   - aucune étape synthétisée (`fallback`) : elles sont ignorées.
 */
export function buildSchemaChains(emails) {
  const groups = new Map();
  for (const email of emails) {
    if (isFallbackEmail(email)) continue;
    const key = `${email.sequence}::${email.segment || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(email);
  }

  const chains = [];
  for (const [key, list] of groups) {
    const steps = [...list].sort(byOrder);
    const sequence = steps[0].sequence;
    const segment = steps[0].segment || null;
    const connected = sequence !== 'oneshot';
    const label = [SEQUENCES[sequence]?.label ?? sequence, segment ? SEGMENTS[segment] : null]
      .filter(Boolean)
      .join(' · ');
    const gaps = connected ? steps.slice(1).map((step, i) => delayBetween(steps[i], step)) : [];
    chains.push({ id: key, sequence, segment, label, connected, steps, gaps });
  }

  return chains.sort((a, b) => {
    const bySeq = (SEQUENCES[a.sequence]?.order ?? 99) - (SEQUENCES[b.sequence]?.order ?? 99);
    return bySeq !== 0 ? bySeq : segmentRank(a.segment) - segmentRank(b.segment);
  });
}

// ── Conditions d'envoi ────────────────────────────────────────────────────────

/** Une condition qui peut faire SAUTER l'étape (« Sauté si la date tombe un jour de rappel… »). */
const SKIP_RE = /saut/i;
/** Du mot « sauté » à la fin de la phrase (la première ponctuation finale). */
const SKIP_CLAUSE_RE = /[Ss]aut\p{L}*[^.]*/u;

/**
 * @brief Résume les conditions d'envoi d'une étape (champ `conditions` des JSON de cohorte).
 * @param conditions Phrases telles qu'écrites dans le contenu (tableau de chaînes, ou rien).
 * @returns `{ full, short, skippable }` :
 *   - `full` : toutes les phrases, bout à bout (infobulle, lecteur d'écran) ;
 *   - `skippable` : au moins une phrase dit que l'étape peut être sautée — la flèche qui y mène ne
 *     garantit alors pas un enchaînement ;
 *   - `short` : la proposition « Sauté si… » extraite telle quelle (parenthèse finale retirée, majuscule
 *     initiale) ; chaîne vide quand l'étape n'est pas sautable. Aucun texte n'est inventé.
 */
export function conditionSummary(conditions) {
  const list = (Array.isArray(conditions) ? conditions : [])
    .filter((c) => typeof c === 'string')
    .map((c) => c.trim())
    .filter(Boolean);
  if (!list.length) return { full: '', short: '', skippable: false };
  const full = list.join(' ');
  const skipSentence = list.find((c) => SKIP_RE.test(c));
  if (!skipSentence) return { full, short: '', skippable: false };
  const clause = SKIP_CLAUSE_RE.exec(skipSentence)?.[0] ?? skipSentence;
  const short = clause.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return { full, short: short.charAt(0).toUpperCase() + short.slice(1), skippable: true };
}

/**
 * @brief Résumé des conditions de chaque étape d'un contenu de cohorte, par type d'e-mail (`kind`).
 * @param steps Étapes d'origine (`content.data.steps`) ou rien.
 * @returns `Map<kind, { full, short, skippable }>` — seulement les étapes qui ont des conditions.
 */
export function conditionsByKind(steps) {
  const map = new Map();
  for (const step of Array.isArray(steps) ? steps : []) {
    const summary = conditionSummary(step?.conditions);
    if (summary.full) map.set(step.kind, summary);
  }
  return map;
}

// ── Navigation au clavier ─────────────────────────────────────────────────────

/**
 * @brief Étape voisine pour la navigation fléchée du schéma (une seule tabulation, flèches pour circuler).
 * @param chains Chaînes de `buildSchemaChains`.
 * @param key Clé de l'étape courante.
 * @param move `'up'` | `'down'` (dans la chaîne) | `'left'` | `'right'` (chaîne voisine, même rang, ramené à
 *   sa dernière étape si elle est plus courte) | `'first'` | `'last'` (de la chaîne).
 * @returns La clé de l'étape visée, ou `null` quand il n'y a rien dans cette direction (le focus ne bouge pas).
 */
export function schemaNeighborKey(chains, key, move) {
  for (let c = 0; c < chains.length; c += 1) {
    const { steps } = chains[c];
    const i = steps.findIndex((s) => s.key === key);
    if (i < 0) continue;
    switch (move) {
      case 'up':
        return i > 0 ? steps[i - 1].key : null;
      case 'down':
        return i < steps.length - 1 ? steps[i + 1].key : null;
      case 'first':
        return steps[0].key;
      case 'last':
        return steps[steps.length - 1].key;
      case 'left':
      case 'right': {
        const other = chains[c + (move === 'left' ? -1 : 1)];
        return other ? other.steps[Math.min(i, other.steps.length - 1)].key : null;
      }
      default:
        return null;
    }
  }
  return null;
}

/**
 * @brief Étape qui porte la tabulation (tabindex itinérant) : la dernière visitée si elle existe encore,
 * sinon l'étape sélectionnée dans « Gestion de séquence », sinon la première du schéma.
 * @returns Une clé, ou `null` quand le schéma est vide.
 */
export function schemaStopKey(chains, preferredKey, selectedKey) {
  const has = (key) => Boolean(key) && chains.some((c) => c.steps.some((s) => s.key === key));
  if (has(preferredKey)) return preferredKey;
  if (has(selectedKey)) return selectedKey;
  return chains[0]?.steps[0]?.key ?? null;
}
