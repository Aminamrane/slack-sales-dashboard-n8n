export function notificationDate(value) {
  if (!value) return { iso: undefined, label: 'Date non renseignée' };
  const text = String(value);
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`);
  if (!Number.isFinite(date.getTime())) return { iso: undefined, label: 'Date non renseignée' };
  return { iso: date.toISOString(), label: new Intl.DateTimeFormat('fr-FR', { timeZone:'Europe/Paris', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(date) };
}
// Board du client selon le rôle (dev 16/11/2026) : le cabinet et la facturation n'ont que /optilex-board ; la
// direction et le Client Success, /ceo/optilex-board. Sans rôle connu, le board de la direction (comme avant).
const CABINET_BOARD_ROLES = ['optilex', 'finance_team'];
export function boardPathFor(role) {
  return CABINET_BOARD_ROLES.includes(role) ? '/optilex-board' : '/ceo/optilex-board';
}
// Alertes qui portent un client du board (numero_client) : le lien ouvre sa fiche. Passage en cours de résiliation et
// client repêché (dev 17/11/2026) : la fiche du client.
export const CLIENT_NOTIFICATION_TYPES = ['owner_rating_regression', 'optilex_contract_alert', 'optilex_client_sans_guid', 'onboarding_google_change',
  'optilex_resiliation_alert', 'optilex_client_repeche'];
export function notificationTarget(notif, role) {
  if (CLIENT_NOTIFICATION_TYPES.includes(notif.type)) {
    const numero = notif.data?.numero_client;
    if (!numero) return notif.type === 'owner_rating_regression' ? boardPathFor(role) : null;
    const params = new URLSearchParams({ client: String(numero) });
    // Météo : la fiche s'ouvre sur l'échange de cette météo (onglet Échanges, défilé jusqu'à elle).
    if (notif.type === 'owner_rating_regression' && notif.data?.meteo_id) { params.set('focus', 'comments'); params.set('rating', String(notif.data.meteo_id)); }
    return `${boardPathFor(role)}?${params.toString()}`;
  }
  // Mention : chemin choisi par le serveur selon le rôle, plus le commentaire exact (la fiche défile jusqu'à lui).
  if (notif.type === 'board_mention') {
    const path = notif.data?.path || '/optilex-board';
    const id = notif.data?.comment_id;
    if (!id || /[?&]comment=/.test(path)) return path;
    return `${path}${path.includes('?') ? '&' : '?'}comment=${encodeURIComponent(String(id))}`;
  }
  // Mention dans une note interne finance : la fiche du client, onglet Échanges (chemin donné par le serveur), plus la
  // note exacte (dev 21/11/2026 : « ça ne nous met pas là où on nous a tagués ») : le fil défile jusqu'à elle.
  if (notif.type === 'finance_note_mention') {
    const path = notif.data?.path || '/tracking-finance';
    const id = notif.data?.note_id;
    if (!id || /[?&]note=/.test(path)) return path;
    return `${path}${path.includes('?') ? '&' : '?'}note=${encodeURIComponent(String(id))}`;
  }
  // Client sorti repassé dans un état actif (dev 18/11/2026) : sa fiche Finance, où la facturation décide de la reprise.
  if (notif.type === 'finance_resume_after_exit') return notif.data?.path || '/tracking-finance';
  if (notif.type === 'sheet_invitation') return '/tracking-sheet?view=notifications';
  // Lapin reprogrammé (dev 14/10/2026) ou RDV repositionné (agenda setter, dev 27/10/2026) par un setter : le commercial
  // retrouve le lead dans sa sheet.
  if (['setter_placed_r1','setter_placed_r2','setter_rescheduled_no_show','setter_rescheduled_rdv'].includes(notif.type)) return '/tracking-sheet';
  // Alertes au setter derrière un RDV (absence R1/R2, RDV reporté ou à reporter, dev 15/10/2026) : sa sheet setter.
  if (['setter_r1_no_show','setter_r2_no_show','setter_rdv_rescheduled','setter_rdv_cancelled'].includes(notif.type)) return '/tracking-setter';
  return null;
}
export function notificationPlacement(nav, bell, viewportWidth, viewportHeight) {
  const width = Math.min(460, viewportWidth - 24);
  const center = (Math.min(nav.left,bell.left) + Math.max(nav.right,bell.right)) / 2;
  const left = Math.max(12,Math.min(viewportWidth-width-12,center-width/2));
  const top = Math.max(nav.bottom,bell.bottom)+12;
  return { left, top, width, maxHeight:Math.max(100,viewportHeight-top-12) };
}
export function freshNotifications(items, seen) {
  const fresh = items.filter(n => n.id && !seen.has(n.id) && !n.read);
  items.forEach(n => { if(n.id) seen.add(n.id); });
  return fresh;
}
