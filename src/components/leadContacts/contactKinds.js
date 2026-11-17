// Types de contact d'un lead et champ de la fiche sous lequel chacun se range (dev 17/11/2026).
// La fiche n'a que deux champs, « Téléphone » et « Email » : le numéro WhatsApp se range sous le téléphone, à côté
// des autres numéros, avec son badge. Il n'est jamais prioritaire : le prioritaire est le téléphone du lead, celui des
// relances, des SMS et du contrat. Fonctions pures, partagées par le compteur, la liste et l'ajout.

// Ordre des types proposés à l'ajout.
export const KIND_ORDER = ['phone', 'whatsapp', 'email'];
const PANELS = { phone: ['phone', 'whatsapp'], email: ['email'] };

export const panelOf = (kind) => (kind === 'email' ? 'email' : 'phone');
export const kindsOf = (panel) => PANELS[panel] || [panel];

// Les contacts rangés sous un champ : les téléphones d'abord, puis les numéros WhatsApp, chacun dans son ordre.
export function rowsOf(data, panel) {
  const kinds = kindsOf(panel);
  return (data?.contacts || [])
    .filter((contact) => kinds.includes(contact?.kind))
    .sort((a, b) => kinds.indexOf(a.kind) - kinds.indexOf(b.kind));
}

export const countOf = (data, panel) => rowsOf(data, panel).length;

// Types que le serveur accepte (ceux dont il donne les catégories) : un serveur qui ne connaît pas encore WhatsApp
// ne le voit pas proposé.
export const choicesOf = (categories) => KIND_ORDER.filter((kind) => categories?.[kind]);

export const canPromote = (contact) => contact?.kind !== 'whatsapp';
