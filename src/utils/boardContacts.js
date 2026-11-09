// Contacts partagés entre le board Owner/Opti'Lex et la page Finance
// (table client_contact, servie par le board dans `row.shared_contacts`).
// Ce que la finance ajoute (email, téléphone) doit se voir sur la fiche.

// Numéro comparable : chiffres seuls, indicatif français ramené à 0.
export function phoneKey(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('0033')) return `0${digits.slice(4)}`;
  if (digits.startsWith('33') && digits.length === 11) return `0${digits.slice(2)}`;
  return digits;
}

// Emails ajoutés côté finance, pour le menu de l'email (étiquette « Finance »).
export function sharedEmailOptions(row) {
  const emails = row?.shared_contacts?.emails || [];
  return emails
    .filter((e) => e?.value)
    .map((e) => ({ email: String(e.value).trim(), source: e.label ? `Finance · ${e.label}` : 'Finance' }));
}

// Rang des contacts (dev 29/10/2026 : « primaire, secondaire, etc., pas pro / perso ») : le contact principal
// (client_contact.is_primary) d'abord, puis les autres dans leur ordre ; sans principal désigné, la valeur du board
// est la primaire. Libellés : Primaire, Secondaire, Tertiaire, puis 4e, 5e…
const RANKS = ['Primaire', 'Secondaire', 'Tertiaire'];
export const rankLabel = (i) => RANKS[i] || `${i + 1}e`;
const keyOf = (kind, value) => (kind === 'phone' ? phoneKey(value) : String(value || '').trim().toLowerCase());

// Tous les e-mails ou téléphones du client, sans doublon : la valeur du board (chaque numéro d'un champ
// « +33… - 06… » compte), puis les contacts partagés avec la finance. Chacun porte son rang.
export function contactEntries(kind, boardValue, shared = []) {
  const out = [];
  const seen = new Map();
  const push = (value, contact) => {
    const v = String(value || '').trim();
    const k = keyOf(kind, v);
    if (!v || (kind === 'phone' ? k.length < 8 : !k)) return;
    const prev = seen.get(k);
    if (prev) {
      if (contact && !prev.id) Object.assign(prev, { id: contact.id, primary: !!contact.is_primary });
      return;
    }
    const entry = { value: v, id: contact?.id ?? null, primary: !!contact?.is_primary, fromBoard: !contact };
    seen.set(k, entry);
    out.push(entry);
  };
  const boardParts = kind === 'phone' ? String(boardValue || '').split(/\s[-–]\s|[,;/|·]/) : [boardValue];
  for (const part of boardParts) push(part, null);
  for (const c of shared) push(c?.value, c);
  const hasPrimary = out.some((e) => e.primary);
  const ordered = hasPrimary ? [...out.filter((e) => e.primary), ...out.filter((e) => !e.primary)] : out;
  return ordered.map((e, i) => ({ ...e, primary: i === 0, rank: rankLabel(i) }));
}
