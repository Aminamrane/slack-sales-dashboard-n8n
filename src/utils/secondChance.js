// « Seconde chance » des setters (dev 06/10/2026) : les leads que les commerciaux n'ont pas concrétisés (R1
// annulé, R2 annulé ou « pas intéressé »), à reprendre avec tout leur parcours. Logique pure, testée.
// Les dates arrivent en heure-mur de Paris (« YYYY-MM-DDTHH:MM ») : lues sur la chaîne, jamais converties.

export const STAGE_TONE = { r1: '#6a9fd8', r2: '#c48a5a' };

const RESULT_LABEL = {
  cancelled: 'annulé', annule: 'annulé', pas_interesse: 'pas intéressé', no_show: 'client absent',
  reporte: 'reporté', rescheduled: 'reporté', done: 'effectué', showed_up: 'effectué',
};

// « R1 annulé », « R2 annulé », « R2 · pas intéressé ».
export function outcomeLabel(stage, result) {
  const kind = String(stage || '').toUpperCase();
  if (result === 'pas_interesse') return `${kind} · pas intéressé`;
  return `${kind} ${RESULT_LABEL[result] || 'annulé'}`;
}

const wall = (value) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? value.slice(0, 16) : '');

// « lun. 29 sept. · 10 h 00 »
export function wallLabel(value, { time = true, year = false } = {}) {
  const v = wall(value);
  if (!v) return '';
  const day = new Date(`${v.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}),
  });
  return time ? `${day} · ${Number(v.slice(11, 13))} h ${v.slice(14, 16)}` : day;
}

// Échéance d'une reprise : l'API la renvoie déjà en heure de Paris (« YYYY-MM-DDTHH:MM »).
export function untilLabel(value) {
  return wallLabel(value, { time: false });
}

// Parcours long : au-delà de `limit` événements, seuls les premiers restent visibles et le reste (la suite, sous eux)
// se déplie d'un clic sur le bandeau placé à la fin de la liste. L'ordre chronologique est conservé.
export const TIMELINE_LIMIT = 7;
export function collapseEvents(events, expanded, limit = TIMELINE_LIMIT) {
  const list = events || [];
  if (expanded || list.length <= limit) return { shown: list, hidden: 0 };
  return { shown: list.slice(0, limit), hidden: list.length - limit };
}

// « Rendez-vous déjà eus » : les R1 / R2 du lead (événements « rdv », titre « R1 : annulé ») et ses absences
// (« no_show », « R1 : client absent ») tirés du parcours renvoyé par l'API, dans l'ordre où l'API les donne.
const RDV_TITLE = /^(R[123]) : (.+)$/;
export function rdvHistory(events) {
  return (events || []).flatMap((ev) => {
    if (ev?.kind !== 'rdv' && ev?.kind !== 'no_show') return [];
    const match = RDV_TITLE.exec(ev.title || '');
    if (!match) return [];
    return [{ kind: match[1].toLowerCase(), label: match[2], at: ev.at, detail: ev.detail || '', actor: ev.actor || '' }];
  });
}

export function itemState(item) {
  if (!item?.claim) return 'free';
  return item.claim.claimed_by_me ? 'mine' : 'taken';
}

// Onglet (« free » à reprendre, « mine » mes reprises), étape (all / r1 / r2) et recherche libre.
export function filterItems(items, { tab = 'free', stage = 'all', query = '' } = {}) {
  const q = query.trim().toLowerCase();
  return (items || []).filter((item) => {
    const state = itemState(item);
    if (tab === 'mine' ? state !== 'mine' : state === 'mine') return false;
    if (stage !== 'all' && item.stage !== stage) return false;
    if (!q) return true;
    return [item.company, item.contact_first_name, item.sales_name].some((v) => String(v || '').toLowerCase().includes(q));
  });
}

export function countItems(items) {
  const counts = { free: 0, mine: 0, taken: 0 };
  for (const item of items || []) counts[itemState(item)] += 1;
  return counts;
}
