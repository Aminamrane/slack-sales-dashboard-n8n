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

// Le champ du board peut contenir plusieurs numéros (« +33… - 06… ») : on
// ajoute seulement les téléphones partagés qui n'y figurent pas déjà.
export function phoneDisplay(boardPhone, sharedPhones = []) {
  const base = String(boardPhone || '').trim();
  const known = new Set(base.split(/[-–,;/·|]+/).map((p) => phoneKey(p)).filter((k) => k.length >= 8));
  const extra = [];
  for (const p of sharedPhones) {
    const key = phoneKey(p?.value);
    if (key.length < 8 || known.has(key)) continue;
    known.add(key);
    extra.push(String(p.value).trim());
  }
  return [base, ...extra].filter(Boolean).join(' · ');
}

// Emails ajoutés côté finance, pour le menu de l'email (étiquette « Finance »).
export function sharedEmailOptions(row) {
  const emails = row?.shared_contacts?.emails || [];
  return emails
    .filter((e) => e?.value)
    .map((e) => ({ email: String(e.value).trim(), source: e.label ? `Finance · ${e.label}` : 'Finance' }));
}
