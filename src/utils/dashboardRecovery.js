// Calendar benchmark for the dashboard, separate from invoice due-date logic.
export function recoveryPace(received, expected, period, now = new Date()) {
  const valid = received != null && expected != null && Number.isFinite(Number(received)) && Number.isFinite(Number(expected));
  const percentage = valid && Number(expected) > 0 ? Number(received) / Number(expected) * 100 : null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(({type, value}) => [type, value]));
  const current = `${parts.year}-${parts.month}`;
  const validPeriod = /^\d{4}-(0[1-9]|1[0-2])$/.test(period || '');
  const benchmark = !validPeriod || period > current ? null : period < current ? 100
    : Number(parts.day) / new Date(Date.UTC(Number(parts.year), Number(parts.month), 0)).getUTCDate() * 100;
  if (percentage == null || benchmark == null) return { percentage, benchmark, tone: 'neutral', label: null };
  // Within 25% of the calendar pace is amber; further behind is red.
  const tone = percentage >= benchmark ? 'good' : percentage >= benchmark * .75 ? 'watch' : 'behind';
  return { percentage, benchmark, tone, label: tone === 'good' ? 'Au rythme du mois' : tone === 'watch' ? 'Rythme à renforcer' : 'Sous le rythme du mois' };
}

export function newSalesCash(sales) {
  if (sales?.monthly == null || sales?.annual == null) return null;
  const total = Number(sales.monthly) + Number(sales.annual);
  return Number.isFinite(total) ? Math.round((total + Number.EPSILON) * 100) / 100 : null;
}
