export function notificationDate(value) {
  if (!value) return { iso: undefined, label: 'Date non renseignée' };
  const text = String(value);
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`);
  if (!Number.isFinite(date.getTime())) return { iso: undefined, label: 'Date non renseignée' };
  return { iso: date.toISOString(), label: new Intl.DateTimeFormat('fr-FR', { timeZone:'Europe/Paris', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(date) };
}
export function notificationTarget(notif) {
  if (notif.type === 'owner_rating_regression') return '/ceo/optilex-board' + (notif.data?.numero_client ? `?client=${encodeURIComponent(notif.data.numero_client)}` : '');
  if (notif.type === 'sheet_invitation') return '/tracking-sheet?view=notifications';
  if (['setter_placed_r1','setter_placed_r2'].includes(notif.type)) return '/tracking-sheet';
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
