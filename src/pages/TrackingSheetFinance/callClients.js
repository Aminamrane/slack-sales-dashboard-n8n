// callClients.js — quel client se cache derrière un numéro d'appel ?
//
// L'API des appels ne donne que le numéro appelé (et, parfois, le nom du
// contact Allo). L'onglet « Tracking des appels » veut lire, pour chaque appel,
// le client concerné : son nom, son numéro de client, puis le téléphone.
//
// On rapproche donc le numéro des téléphones que la page connaît déjà :
//   - les fiches du mois affiché (téléphone principal + contacts secondaires) ;
//   - le board Owner/Opti'Lex, déjà chargé par la page : téléphone d'origine,
//     téléphone corrigé à la main (`phone_ovr`), contacts partagés — et les
//     clients qui n'ont pas (encore) de fiche ce mois-ci.
// Un champ téléphone peut porter plusieurs numéros (« +33… - 06… ») : chacun
// compte. « +33 6 12… », « 06 12… » et « +33 (0)6 12… » sont le même numéro.
// Fonctions pures, sans appel réseau.

import { phoneForms, splitClientIdentity } from './constants.js';

// Sous ce nombre de chiffres, ce n'est pas un numéro qu'on peut attribuer à un
// client (numéro court, saisie tronquée) : on n'affirme rien.
const MIN_DIGITS = 6;
// Un numéro international compte 15 chiffres au plus (E.164) : au-delà, le champ
// en porte plusieurs.
const MAX_DIGITS = 15;
// Ce qui sépare deux numéros dans un champ libre. Le tiret seul n'en fait pas
// partie (« 06-12-34-56-78 » est UN numéro) : il faut des espaces autour.
const SEPARATORS = /\s[-–—]\s|[/,;·|\n\r]+|\s+(?:et|ou)\s+/i;

// Chaque numéro d'un champ téléphone, réduit à ses chiffres.
export function numbersIn(field) {
  const found = [];
  for (const piece of String(field ?? '').split(SEPARATORS)) {
    const digits = piece.replace(/\D/g, '');
    if (digits.length < MIN_DIGITS) continue;
    if (digits.length <= MAX_DIGITS) { found.push(digits); continue; }
    // Numéros collés sans séparateur (« 0612345678 0798765432 ») : on les
    // découpe à la française, tant que le début ressemble à un numéro.
    let rest = digits;
    while (rest.length >= 10) {
      const size = rest.startsWith('0033') ? 13 : rest.startsWith('33') ? 11 : rest.startsWith('0') ? 10 : 0;
      if (!size || rest.length < size) break;
      found.push(rest.slice(0, size));
      rest = rest.slice(size);
    }
  }
  return found;
}

// Formes comparables d'un numéro : celles de la recherche de la page (chiffres
// bruts, forme nationale d'un +33), plus « +33 (0)6… » et le 0 initial oublié.
function formsOf(digits) {
  const forms = new Set(phoneForms(digits));
  if (digits.length === 12 && digits.startsWith('330')) forms.add(`0${digits.slice(3)}`);
  if (digits.length === 14 && digits.startsWith('00330')) forms.add(`0${digits.slice(5)}`);
  if (digits.length === 9 && !digits.startsWith('0')) forms.add(`0${digits}`);
  return [...forms].filter((form) => form.length >= MIN_DIGITS);
}

const fieldForms = (field) => numbersIn(field).flatMap(formsOf);

// Annuaire « forme du numéro → clients ». Un même numéro peut appartenir à
// plusieurs fiches (un dirigeant, deux sociétés) : on garde tous les clients.
export function buildCallClientIndex(rows, boardRows) {
  const index = new Map();
  const entries = new Map();
  const byNumero = new Map();
  const remember = (entry, field) => {
    for (const form of fieldForms(field)) {
      if (!index.has(form)) index.set(form, new Map());
      index.get(form).set(entry.key, entry);
    }
  };
  const create = (key, name, numero) => {
    const entry = { key, name, numero, order: entries.size };
    entries.set(key, entry);
    if (numero) byNumero.set(numero, entry);
    return entry;
  };

  for (const row of rows || []) {
    const client = row?.client;
    if (!client) continue;
    const numero = client.numero_client ? String(client.numero_client) : null;
    const key = client.id ?? numero;
    if (key == null || entries.has(key)) continue;
    const { societeName, representant } = splitClientIdentity(client);
    const name = societeName || representant || null;
    if (!name && !numero) continue;
    const entry = create(key, name, numero);
    for (const phone of [client.phone, ...(client.contact_phones || [])]) remember(entry, phone);
  }

  // Le board : même client (même numéro) → ses téléphones s'ajoutent à la fiche ;
  // client absent des fiches du mois → il compte quand même, sous son nom du board.
  for (const board of boardRows || []) {
    if (!board) continue;
    const numero = board.numero_client ? String(board.numero_client) : null;
    let entry = numero ? byNumero.get(numero) : null;
    if (!entry) {
      const { societeName, representant } = splitClientIdentity({
        societe: board.crm_societe || board.societe_sheet,
        representative_name: board.contact_name_ovr || board.contact_name,
      });
      const name = societeName || representant || null;
      if (!name && !numero) continue;
      const key = `board:${board.row_key ?? numero ?? name}`;
      entry = entries.get(key) || create(key, name, numero);
    }
    const shared = (board.shared_contacts?.phones || []).map((phone) => phone?.value);
    for (const phone of [board.contact_phone, board.phone_ovr, ...shared]) remember(entry, phone);
  }
  return index;
}

// Clients dont une fiche porte ce numéro ; tableau vide si aucun. L'ordre est
// celui des fiches, quel que soit le format sous lequel le numéro a été trouvé.
export function clientsForNumber(index, number) {
  const found = new Map();
  if (!index || !index.size) return [];
  for (const form of fieldForms(number)) {
    for (const [key, entry] of index.get(form) || []) found.set(key, entry);
  }
  return [...found.values()].sort((a, b) => a.order - b.order).map(({ key, name, numero }) => ({ key, name, numero }));
}
