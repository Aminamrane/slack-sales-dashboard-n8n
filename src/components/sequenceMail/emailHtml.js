// src/components/sequenceMail/emailHtml.js
//
// Préparation du HTML d'un e-mail pour l'aperçu : liens personnels neutralisés, champs
// personnalisés (`{{prénom}}`) surlignés, politique de sécurité de l'iframe. Fonctions pures
// (testées sous Node : `emailHtml.test.js`).

const MERGE_RE = /\{\{[^{}]{1,40}\}\}/g;
const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Un caractère d'une balise : hors guillemets, ou un attribut entier entre guillemets (un `>` y est permis). */
const TAG_CHAR = `(?:[^>"']|"[^"]*"|'[^']*')`;
/** Balise ouvrante `<a …>` : les attributs sont lus guillemets compris (`title="a > b"` ne coupe plus la balise). */
const ANCHOR_RE = new RegExp(`<a\\b(${TAG_CHAR}*)>`, 'gi');
/** Commentaire (dont les commentaires conditionnels) ou balise quelconque : tout ce qui n'est pas du texte. */
const MARKUP_RE = new RegExp(`(<!--[\\s\\S]*?-->|<${TAG_CHAR}*>)`);
/** L'attribut `href` d'une balise (entre guillemets doubles, simples, ou sans guillemets). */
const HREF_RE = /(^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const TARGET_TITLE_RE = /\s(?:target|title)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+)/gi;

/**
 * Politique de sécurité posée DANS le document de l'e-mail, en plus du `sandbox` de l'iframe (jamais de
 * `allow-scripts`) : aucun script, aucun formulaire, aucun cadre imbriqué, quoi que contienne le HTML.
 */
const CSP = "script-src 'none'; form-action 'none'; frame-src 'none'";

const FRAME_CSS =
  '.smx-merge{background:#e8f0fe;color:#174ea6;border-radius:3px;padding:0 3px;font-weight:500}' +
  'a[data-personal]{cursor:help}html{overflow:hidden}';

/**
 * @brief Prépare le HTML d'un e-mail pour l'aperçu (liens personnels neutralisés, champs surlignés).
 * @returns Document HTML complet, prêt pour `srcDoc`.
 */
export function prepareHtml(html) {
  // 1. Liens personnels (`…/EVENT_ID`) : on garde l'adresse en infobulle, mais le clic ne fait rien.
  let out = html.replace(ANCHOR_RE, (tag, attrs) => {
    const found = HREF_RE.exec(attrs);
    const href = found ? found[2] ?? found[3] ?? found[4] ?? '' : '';
    if (!href.includes('EVENT_ID')) return tag;
    const rest = attrs.replace(found[0], '').replace(TARGET_TITLE_RE, '');
    const hint = escapeAttr(`Lien personnel, généré pour chaque inscrit à l'envoi : ${href}`);
    return `<a${rest} href="#" target="_self" data-personal="1" title="${hint}">`;
  });

  // 2. Champs personnalisés : surlignés dans le texte uniquement (jamais dans un attribut, un commentaire
  //    ni un <style>).
  const parts = out.split(MARKUP_RE);
  let skip = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const p = parts[i];
    if (p.startsWith('<')) {
      if (/^<(style|title|script)\b/i.test(p)) skip += 1;
      else if (/^<\/(style|title|script)\b/i.test(p)) skip = Math.max(0, skip - 1);
    } else if (!skip && p.includes('{{')) {
      parts[i] = p.replace(MERGE_RE, (m) => `<span class="smx-merge">${m}</span>`);
    }
  }
  out = parts.join('');

  // 3. Politique de sécurité, référent masqué, base et styles de l'aperçu, injectés en tête de <head> (ou en
  //    tête du document s'il n'en a pas) : la politique passe avant tout le reste du document.
  const inject =
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">` +
    '<meta name="referrer" content="no-referrer">' +
    `<base target="_blank"><meta name="color-scheme" content="light"><style>${FRAME_CSS}</style>`;
  const HEAD_RE = /<head(?:\s[^>]*)?>/i;
  return HEAD_RE.test(out) ? out.replace(HEAD_RE, (m) => m + inject) : inject + out;
}

/** @brief Vrai si le contenu porte au moins un champ personnalisé (`{{prénom}}`). */
export function hasMergeFields(content) {
  return typeof content === 'string' && /\{\{[^{}]{1,40}\}\}/.test(content);
}
