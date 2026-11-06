import { canEditAmounts } from './constants.js';

// The server owns individual grants. Keep them in memory and bound to the
// authenticated account; a previous account's response must never unlock dates.
export function paymentDateIdentity(user) {
  return user?.id && user?.role ? `${user.id}:${user.role}` : null;
}

// Role as the Finance page judges it: the server may grant an account the
// finance direction on this page only (`finance_role` of /access). Bound to the
// account like the date grant, and never widened beyond `finance_director`.
export function financeRole(user, access) {
  if (user?.role === 'finance_team' && paymentDateIdentity(user)
    && access?.identity === paymentDateIdentity(user) && access.role === 'finance_director') {
    return 'finance_director';
  }
  return user?.role;
}

export function canEditPaymentDates(user, access) {
  return canEditAmounts(financeRole(user, access)) || Boolean(
    user?.role === 'finance_team' && paymentDateIdentity(user)
    && access?.identity === paymentDateIdentity(user) && access.allowed === true,
  );
}

export async function loadPaymentDateAccess(client) {
  const identity = paymentDateIdentity(client.getUser());
  if (!identity) return null;
  try {
    const data = await client.request('/api/v1/finance-periods/access', { method: 'GET', cache: 'no-store' });
    if (identity !== paymentDateIdentity(client.getUser())) return null;
    return { identity, allowed: data?.can_edit_payment_dates === true,
      role: typeof data?.finance_role === 'string' ? data.finance_role : null };
  } catch {
    return { identity, allowed: false, role: null };
  }
}
