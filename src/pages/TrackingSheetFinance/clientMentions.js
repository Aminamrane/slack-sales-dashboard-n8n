// clientMentions.js — les notifications non lues qui parlent d'un client de la fiche (dev 17/11/2026 : le compteur
// de l'onglet « Échanges » passe au rouge dès qu'on y a été mentionné).
//
// Deux sortes de mentions, servies par GET /notifications/global :
//   - `board_mention` : mention dans l'espace commun du board, `data.numero_client` ;
//   - `finance_note_mention` : mention dans une note interne finance, `data.client_id` (ou `client=<id>` dans
//     `data.path`, le lien de la fiche), et `data.numero_client`.
// Fonctions pures, sans appel réseau.

export const CLIENT_MENTION_TYPES = ['board_mention', 'finance_note_mention'];

// Le numéro client s'écrit parfois « n°691 », parfois « 691 » : on compare la même forme.
export const numeroKey = (value) => String(value ?? '').trim().replace(/^n°\s*/i, '').trim().toLowerCase();

const clientInPath = (path) => String(path || '').match(/[?&]client=(\d+)/)?.[1] ?? null;

// La notification parle-t-elle de ce client ? Une note interne se rattache d'abord par l'identifiant du client
// (deux fiches peuvent partager un numéro), une mention du board par son numéro.
export function isClientMention(notification, { clientId = null, numero = null } = {}) {
  if (!notification || !CLIENT_MENTION_TYPES.includes(notification.type)) return false;
  const data = notification.data || {};
  if (notification.type === 'finance_note_mention') {
    const id = data.client_id ?? clientInPath(data.path);
    if (id != null && clientId != null) return String(id) === String(clientId);
  }
  const numero_ = numeroKey(data.numero_client);
  return numero_ !== '' && numero_ === numeroKey(numero);
}

// Identifiants des mentions NON LUES de ce client. `readLocally` : celles qu'on vient de marquer lues dans cette
// fiche, qu'une réponse partie avant la lecture ne doit pas rallumer.
export function unreadClientMentions(notifications, who, readLocally = new Set()) {
  return (Array.isArray(notifications) ? notifications : [])
    .filter((n) => n && n.id != null && !n.read && !readLocally.has(n.id) && isClientMention(n, who))
    .map((n) => n.id);
}
