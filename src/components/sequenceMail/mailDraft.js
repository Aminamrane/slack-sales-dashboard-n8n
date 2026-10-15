// src/components/sequenceMail/mailDraft.js
//
// Brouillons d'e-mails de l'éditeur de « Schéma de séquence » (PROTOTYPE) : fonctions pures qui
// superposent une modification locale à l'étape d'origine, et dérivent du HTML édité les champs
// que le reste de l'interface lit déjà (version texte, aperçu de liste, liens).
//
// Rien ici ne touche le réseau ni le stockage : un brouillon n'est qu'un objet en mémoire (cf.
// `setMailDraft` dans dataStore.js). Les trois dérivations ci-dessous reprennent la règle de
// scripts/webinar-sequences/build.mjs, qui a produit le contenu d'origine : un e-mail édité
// reste donc cohérent avec ceux qui ne le sont pas (même « Texte brut », même aperçu en liste,
// mêmes « Boutons » et « Liens » dans les informations de séquence).

const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&rsquo;': '’', '&lsquo;': '‘', '&zwnj;': '' };
const decode = (s) => s.replace(/&(?:nbsp|amp|lt|gt|quot|#39|rsquo|lsquo|zwnj);/g, (m) => ENTITIES[m] ?? m);
const stripTags = (s) => decode(s.replace(/<[^>]+>/g, ''));

/** @brief Version texte générée depuis le HTML (même règle que `htmlToPlainText` de la landing). */
export function htmlToPlainText(html) {
  return (
    decode(
      html
        .replace(/<head[\s\S]*?<\/head>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<div style="(?:overflow:hidden;max-height:0|display:none;max-height:0)[\s\S]*?<\/div>/gi, '')
        .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
          const l = String(label).replace(/<[^>]+>/g, '').trim();
          return href && !String(href).startsWith('mailto:') ? `${l} : ${href}` : l;
        })
        .replace(/<li[^>]*>/gi, '\n- ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|ul|ol|table|tr|h[1-6])>/gi, '\n')
        .replace(/<[^>]+>/g, '')
    )
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n'
  );
}

/** @brief Ligne d'aperçu de la liste : le début du texte, sans la formule d'appel. */
export function snippetOf(text) {
  const lines = String(text || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
  while (lines.length > 1 && lines[0].length < 60 && /^(bonjour|salut|on est en live)/i.test(lines[0])) lines.shift();
  return lines.join(' ').replace(/\s+/g, ' ').slice(0, 220);
}

/** @brief Liens de l'e-mail (boutons, liens personnels, désinscription), comme dans le contenu d'origine. */
export function linksOfHtml(html) {
  if (!html) return [];
  const seen = new Set();
  const links = [];
  for (const m of html.matchAll(/<a\s([^>]*?)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = `${m[1]} ${m[3]}`;
    const href = decode(m[2]);
    const label = stripTags(m[4]).replace(/\s+/g, ' ').trim();
    if (!label && !href) continue;
    const key = `${label}|${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({
      label,
      href,
      personal: href.includes('EVENT_ID'),
      unsubscribe: /\/u\/EVENT_ID/.test(href),
      button: /display:\s*inline-block/.test(attrs),
    });
  }
  return links.slice(0, 24);
}

/**
 * @brief Champs dérivés d'un corps HTML édité : tout ce que l'interface lit en plus du HTML lui-même.
 * @returns `{ text, snippet, links }`.
 */
export function deriveFromHtml(html) {
  const text = htmlToPlainText(html);
  return { text, snippet: snippetOf(text), links: linksOfHtml(html) };
}

/** Hôte plausible : nom de domaine avec extension (≥ 2 lettres, IDN en punycode) — jamais un nom seul (`a`, `localhost`). */
const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

/**
 * @brief Vrai si `value` est une adresse web acceptable : analysable, http(s), sans identifiants
 * (`https://nom:mot@hôte`) et avec un hôte plausible.
 */
function isPlausibleWebUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  return DOMAIN_RE.test(url.hostname) || IPV4_RE.test(url.hostname);
}

/**
 * @brief Adresse d'un lien saisi dans l'éditeur, ou `null` si elle n'est pas acceptable.
 * @note Liste blanche de schémas : un `javascript:` ou `data:` n'a rien à faire dans un e-mail.
 * Une adresse sans schéma (« owner.com/page », « www… », « owner.com:8080/x », « owner.com?x=1 »,
 * « owner.com#a ») est complétée en https ; l'hôte doit être plausible (« https://a » est refusé).
 */
export function normalizeLinkUrl(raw) {
  const value = String(raw ?? '').trim();
  if (!value || /\s/.test(value)) return null;
  if (/^https?:\/\//i.test(value)) return isPlausibleWebUrl(value) ? value : null;
  if (/^(?:mailto|tel):\S+$/i.test(value)) return value;
  if (/^[\\/]/.test(value)) return null; // « //hôte » : adresse relative au protocole, jamais complétée en silence
  // « owner.com:8080/x » ressemble à un schéma (`owner.com:`) : le numéro de port derrière l'hôte les distingue.
  const hostWithPort = /^[^\s:/?#@]+:\d{1,5}(?:[/?#]|$)/.test(value);
  if (!hostWithPort && /^[a-z][a-z0-9+.-]*:/i.test(value)) return null; // un autre schéma (javascript:, data:, file:…)
  if (!hostWithPort && /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(value)) return `mailto:${value}`;
  return isPlausibleWebUrl(`https://${value}`) ? `https://${value}` : null;
}

// ── Superposition d'un brouillon sur une étape ────────────────────────────────

/**
 * @brief État d'un brouillon : `'confirmed'` si la confirmation (simulée) est postérieure à la
 * dernière modification, `'editing'` sinon.
 */
export function draftState(draft) {
  if (!draft) return null;
  return draft.confirmedAt && draft.confirmedAt >= draft.editedAt ? 'confirmed' : 'editing';
}

/**
 * @brief L'étape telle qu'elle apparaît une fois le brouillon appliqué.
 * @param step Étape d'origine (jamais modifiée).
 * @param draft `{ subject?, html?, text?, snippet?, links?, editedAt, confirmedAt? }` ou undefined.
 * @returns `step` elle-même sans brouillon ; sinon une copie portant `draftStatus`.
 */
export function applyDraft(step, draft) {
  if (!draft) return step;
  const next = { ...step, draftStatus: draftState(draft) };
  if (typeof draft.subject === 'string') next.subject = draft.subject;
  if (typeof draft.html === 'string') {
    next.html = draft.html;
    next.text = draft.text ?? step.text;
    next.snippet = draft.snippet ?? snippetOf(next.text);
    next.links = draft.links ?? step.links;
    next.textDerived = true;
  } else if (typeof draft.text === 'string') {
    next.text = draft.text;
    next.snippet = draft.snippet ?? snippetOf(draft.text);
  }
  return next;
}

/**
 * @brief Étapes d'une cohorte avec leurs brouillons appliqués.
 * @param cohortDrafts `{ [kind]: draft }` de la cohorte (ou undefined).
 * @returns `steps` elle-même (même référence) quand il n'y a aucun brouillon : les mémos en aval tiennent.
 */
export function draftedSteps(steps, cohortDrafts) {
  if (!cohortDrafts || !Object.keys(cohortDrafts).length) return steps;
  return steps.map((step) => applyDraft(step, cohortDrafts[step.kind]));
}

/**
 * @brief Vrai si au moins un e-mail porte un brouillon (garde « perdus au rechargement », cf. draftsGuard.js).
 * @param drafts `{ [cohortId]: { [kind]: brouillon } }` tel que le garde dataStore.js ; une cohorte sans
 * brouillon n'y figure pas, mais une tranche vide ne compte jamais.
 */
export function hasAnyDraft(drafts) {
  if (!drafts || typeof drafts !== 'object') return false;
  return Object.values(drafts).some((slice) => Boolean(slice) && typeof slice === 'object' && Object.keys(slice).length > 0);
}
