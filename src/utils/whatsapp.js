// Lien WhatsApp d'un numéro (dev 17/11/2026). wa.me attend le numéro international en chiffres seuls, sans « + »,
// sans 00 et sans le 0 national : « 06 12 34 56 78 » devient 33612345678. Un numéro déjà international (+CC… ou
// 00CC…) garde son indicatif. Rien n'est deviné au-delà : un numéro qu'on ne sait pas lire ne donne pas de lien
// (il reste copiable). Fonctions pures, sans appel réseau.

// Numéro français national : 0 suivi de 9 chiffres (le 2e n'est jamais 0).
const FRENCH_NATIONAL = /^0[1-9]\d{8}$/;
// Le même, écrit en international sans « + » (« 33 6 12… »).
const FRENCH_INTERNATIONAL = /^33[1-9]\d{8}$/;

export function whatsappDigits(value) {
  const raw = String(value ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  let international;
  if (raw.startsWith('+')) international = digits;
  else if (digits.startsWith('00')) international = digits.slice(2);
  else if (FRENCH_NATIONAL.test(digits)) international = `33${digits.slice(1)}`;
  else if (FRENCH_INTERNATIONAL.test(digits)) international = digits;
  else return null;
  // « +33 (0)6 12… » : le 0 national, gardé entre parenthèses, n'appartient pas au numéro international.
  if (/^330[1-9]\d{8}$/.test(international)) international = `33${international.slice(3)}`;
  // E.164 : 15 chiffres au plus, jamais d'indicatif qui commence par 0.
  return international.length >= 8 && international.length <= 15 && !international.startsWith('0') ? international : null;
}

export function whatsappUrl(value) {
  const digits = whatsappDigits(value);
  return digits ? `https://wa.me/${digits}` : null;
}
