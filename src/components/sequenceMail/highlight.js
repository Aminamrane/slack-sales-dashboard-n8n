// src/components/sequenceMail/highlight.js
//
// Surlignage de recherche insensible aux accents, à la casse et aux apostrophes typographiques
// (même repli que `normalize`, cf. format.js). Module pur : il tourne tel quel sous Node.

const ACCENT_CLASSES = {
  a: '[aàâäá]', c: '[cç]', e: '[eéèêë]', i: '[iîïí]', o: '[oôöó]', u: '[uùûüú]', y: '[yÿ]', n: '[nñ]',
};
/** Apostrophe droite et ses variantes typographiques (’ ‘ ʼ). */
const APOSTROPHES = "['\u2018\u2019\u02bc]";
/** Au-delà, les mots saisis en plus ne sont plus surlignés (l'expression régulière resterait raisonnable). */
const MAX_TOKENS = 12;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @brief Motif d'un mot déjà normalisé : chaque lettre accepte ses variantes accentuées, « oe »/« ae »
 * acceptent aussi les ligatures œ/æ, l'apostrophe droite accepte les typographiques.
 */
function tokenPattern(token) {
  const chars = [...token];
  let out = '';
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    const pair = ch + (chars[i + 1] ?? '');
    if (pair === 'oe') {
      out += `(?:${ACCENT_CLASSES.o}${ACCENT_CLASSES.e}|\u0153)`;
      i += 1;
    } else if (pair === 'ae') {
      out += `(?:${ACCENT_CLASSES.a}${ACCENT_CLASSES.e}|\u00e6)`;
      i += 1;
    } else if (ch === "'") {
      out += APOSTROPHES;
    } else {
      out += ACCENT_CLASSES[ch] ?? escapeRe(ch);
    }
  }
  return out;
}

/**
 * @brief Découpe `text` en fragments ; ceux qui correspondent à `tokens` (normalisés) sont marqués `hit`.
 * @note `split` avec un groupe capturant alterne « hors correspondance » (indices pairs) et « correspondance »
 * (indices impairs) : la parité doit être lue AVANT de retirer les chaînes vides (un texte qui commence par
 * la correspondance produit une chaîne vide en tête).
 */
export function highlightParts(text, tokens) {
  const list = (tokens ?? []).filter(Boolean).slice(0, MAX_TOKENS);
  if (!text || !list.length) return [{ text, hit: false }];
  // Les mots les plus longs d'abord : « web » ne doit pas masquer « webinaire ».
  const source = [...list].sort((a, b) => b.length - a.length).map(tokenPattern).join('|');
  const re = new RegExp(`(${source})`, 'gi');
  return String(text)
    .split(re)
    .map((part, i) => ({ text: part, hit: i % 2 === 1 }))
    .filter((p) => p.text !== '');
}
