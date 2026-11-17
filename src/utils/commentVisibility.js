// Visibilité d'un message du fil d'un client (dev 17/11/2026, « commentaires facturation ») : le fil du board est
// partagé entre Owner, le cabinet et le sales du client, message par message. Le serveur fait foi
// (services/client_comments côté API) ; ces règles servent l'écran : choix proposé, badges, envoi bloqué, liens.
//   board    : le fil d'avant, Owner, cabinet Opti'Lex et finance (défaut) ;
//   internal : Owner seulement, jamais le cabinet ;
//   sales    : Owner et le sales du client, qui le lit dans sa Tracking Sheet ; jamais le cabinet.
// Une réponse prend la visibilité de son message.
import { mentionedIds } from './mentions.js';

export const SALES_ROLES = ['sales', 'head_of_sales', 'head_of_sales_manager'];
export const isSalesRole = (role) => SALES_ROLES.includes(role);

// Les trois choix du board, dans l'ordre demandé (Interne / Board / Sales), avec la phrase qui dit qui lira.
export const VISIBILITY_CHOICES = [
  { key: 'internal', label: 'Interne', scope: 'Interne : Owner seulement, jamais le cabinet. @ prévient par e-mail et notification.' },
  { key: 'board', label: 'Board', scope: 'Visible par Owner, le cabinet Opti’Lex et la finance. @ prévient par e-mail et notification.' },
  { key: 'sales', label: 'Sales', scope: 'Sales : Owner et le sales du client, jamais le cabinet. Mentionnez le sales avec @.' },
];
export const scopeOf = (visibility) => (VISIBILITY_CHOICES.find((c) => c.key === visibility) || VISIBILITY_CHOICES[1]).scope;

// Le choix est proposé à Owner (le cabinet écrit au board seulement ; un sales écrit depuis sa Tracking Sheet).
export const canChooseVisibility = (role) => !!role && role !== 'optilex' && !isSalesRole(role);

// Badge d'un message : « Interne » ou « Sales » ; rien pour un message du board.
export function visibilityBadge(visibility) {
  if (visibility === 'internal') return { key: 'internal', label: 'Interne', title: 'Message interne Owner : le cabinet ne le voit pas' };
  if (visibility === 'sales') return { key: 'sales', label: 'Sales', title: 'Partagé avec le sales du client, sans le cabinet' };
  return null;
}

// Un message « Sales » doit mentionner un sales : l'aide à montrer tant qu'il manque, sinon une chaîne vide.
export function sendBlocker(visibility, body, people) {
  if (visibility !== 'sales') return '';
  const ids = new Set(mentionedIds(body, people));
  return (people || []).some((p) => ids.has(p.id) && isSalesRole(p.role)) ? '' : 'Mentionnez le sales du client avec @ pour envoyer.';
}

// Dates du serveur sans fuseau : UTC.
const stamp = (iso) => {
  if (!iso) return 0;
  const d = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(String(iso)) ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};
const excerpt = (text, limit) => {
  const flat = String(text || '').split(/\s+/).filter(Boolean).join(' ');
  return flat.length <= limit ? flat : `${flat.slice(0, limit - 1).trimEnd()}…`;
};

// Message écrit par un sales (rôle de l'auteur, donné par le serveur) : « Commentaire du sales » côté finance.
export const isSalesAuthored = (comment) => isSalesRole(comment?.author_role);

// Dernier commentaire d'un sales dans le fil, pour la ligne « Sales » de la fiche finance : { id, author, at, text, count }.
export function latestSalesComment(comments, limit = 110) {
  const list = (comments || []).filter(isSalesAuthored);
  if (!list.length) return null;
  const last = list.reduce((a, b) => (stamp(b.created_at) > stamp(a.created_at) || (stamp(b.created_at) === stamp(a.created_at) && b.id > a.id) ? b : a));
  const files = last.attachments?.length || 0;
  const text = last.body || (files ? `${files} pièce${files > 1 ? 's' : ''} jointe${files > 1 ? 's' : ''}` : '');
  return { id: last.id, author: last.author_name || last.author_email || 'Sales', at: last.created_at, text: excerpt(text, limit), count: list.length };
}

// Lien direct d'une notification de sales : « ?lead=<id>&focus=comments&comment=<id> ». null sans lead valide.
export function leadCommentLink(search) {
  const params = new URLSearchParams(search || '');
  const leadId = Number(params.get('lead'));
  if (!Number.isInteger(leadId) || leadId <= 0) return null;
  const commentId = Number(params.get('comment'));
  return { leadId, focus: params.get('focus') === 'comments', commentId: Number.isInteger(commentId) && commentId > 0 ? commentId : null };
}

// Fil d'un client : les messages de premier niveau, par dernière activité (le message ou sa réponse la plus récente),
// chacun avec ses réponses dans l'ordre. Une réponse dont le message n'est pas dans la liste reste montrée seule.
export function threadOf(comments) {
  const list = comments || [];
  const ids = new Set(list.map((c) => c.id));
  const replies = new Map();
  const tops = [];
  for (const c of list) {
    if (c.parent_id && ids.has(c.parent_id)) replies.set(c.parent_id, [...(replies.get(c.parent_id) || []), c]);
    else tops.push(c);
  }
  return tops.map((c) => {
    const own = (replies.get(c.id) || []).slice().sort((a, b) => stamp(a.created_at) - stamp(b.created_at) || a.id - b.id);
    return { ...c, replies: own, at: Math.max(stamp(c.created_at), ...own.map((r) => stamp(r.created_at))) };
  }).sort((a, b) => b.at - a.at || b.id - a.id);
}
