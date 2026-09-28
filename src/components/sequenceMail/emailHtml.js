// src/components/sequenceMail/emailHtml.js
//
// Préparation du HTML d'un e-mail pour l'aperçu : liens personnels neutralisés, champs
// personnalisés (`{{prénom}}`) surlignés. Fonctions pures.

const MERGE_RE = /\{\{[^{}]{1,40}\}\}/g;
const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const FRAME_CSS =
  '.smx-merge{background:#e8f0fe;color:#174ea6;border-radius:3px;padding:0 3px;font-weight:500}' +
  'a[data-personal]{cursor:help}html{overflow:hidden}';

/**
 * @brief Prépare le HTML d'un e-mail pour l'aperçu (liens personnels neutralisés, champs surlignés).
 * @returns Document HTML complet, prêt pour `srcDoc`.
 */
export function prepareHtml(html) {
  // 1. Liens personnels : on garde l'adresse en infobulle, mais le clic ne fait rien.
  let out = html.replace(/<a\b([^>]*?)href="([^"]*EVENT_ID[^"]*)"([^>]*)>/gi, (_m, before, href, after) => {
    const strip = (attrs) => attrs.replace(/\s(?:target|title)="[^"]*"/gi, '');
    return `<a${strip(before)}href="#" target="_self" data-personal="1" title="${escapeAttr(
      `Lien personnel, généré pour chaque inscrit à l'envoi : ${href}`
    )}"${strip(after)}>`;
  });

  // 2. Champs personnalisés : surlignés dans le texte uniquement (jamais dans un attribut ni un <style>).
  const parts = out.split(/(<[^>]*>)/);
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

  // 3. Base + styles de l'aperçu, injectés dans <head> (ou en tête si le document n'en a pas).
  const inject = `<base target="_blank"><meta name="color-scheme" content="light"><style>${FRAME_CSS}</style>`;
  return /<head[^>]*>/i.test(out) ? out.replace(/<head[^>]*>/i, (m) => m + inject) : inject + out;
}

/** @brief Vrai si le contenu porte au moins un champ personnalisé (`{{prénom}}`). */
export function hasMergeFields(content) {
  return typeof content === 'string' && /\{\{[^{}]{1,40}\}\}/.test(content);
}
