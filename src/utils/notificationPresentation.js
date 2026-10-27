export function notificationDate(value) {
  if (!value) return { iso: undefined, label: 'Date non renseignée' };
  const text = String(value);
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`);
  if (!Number.isFinite(date.getTime())) return { iso: undefined, label: 'Date non renseignée' };
  return { iso: date.toISOString(), label: new Intl.DateTimeFormat('fr-FR', { timeZone:'Europe/Paris', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(date) };
}
export function notificationTarget(notif) {
  if (notif.type === 'owner_rating_regression') return '/ceo/optilex-board' + (notif.data?.numero_client ? `?client=${encodeURIComponent(notif.data.numero_client)}` : '');
  if (notif.type === 'board_mention') return notif.data?.path || '/optilex-board';   // chemin choisi par le serveur selon le rôle
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
