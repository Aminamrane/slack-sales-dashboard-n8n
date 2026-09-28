// src/components/sequenceMail/highlight.js
//
// Surlignage de recherche insensible aux accents et à la casse.

const ACCENT_CLASSES = {
  a: '[aàâäá]', c: '[cç]', e: '[eéèêë]', i: '[iîïí]', o: '[oôöó]', u: '[uùûüú]', y: '[yÿ]', n: '[nñ]',
};
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** @brief Découpe `text` en fragments ; ceux qui correspondent à `tokens` (normalisés) sont marqués `hit`. */
export function highlightParts(text, tokens) {
  if (!text || !tokens?.length) return [{ text, hit: false }];
  const source = tokens
    .filter(Boolean)
    .map((t) => [...escapeRe(t)].map((ch) => ACCENT_CLASSES[ch] ?? ch).join(''))
    .join('|');
  if (!source) return [{ text, hit: false }];
  const re = new RegExp(`(${source})`, 'gi');
  return text
    .split(re)
    .filter((p) => p !== '')
    .map((p, i) => ({ text: p, hit: i % 2 === 1 }));
}
