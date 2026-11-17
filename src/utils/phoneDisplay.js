// Affichage d'un numéro (dev 17/11/2026) : les numéros enregistrés en chiffres (« 0600004411 », « +33600004411 »)
// s'affichent groupés comme le téléphone du lead (« 06 00 00 44 11 », « +33 6 00 00 44 11 »). Seul l'affichage change :
// la valeur copiée et enregistrée reste celle du serveur. Un numéro qu'on ne sait pas lire s'affiche tel quel.
const pairs = (digits) => digits.replace(/(\d{2})(?=\d)/g, '$1 ');

export function formatPhoneDisplay(value) {
  const raw = String(value ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!raw.startsWith('+') && /^0[1-9]\d{8}$/.test(digits)) return pairs(digits);
  if (raw.startsWith('+') && /^33[1-9]\d{8}$/.test(digits)) return `+33 ${digits[2]} ${pairs(digits.slice(3))}`;
  return raw;
}
