// Mois de Perf Setter : logique pure (sans réseau), testée dans figures.test.js.

// Premier mois du journal des RDV de setters (`since` de GET /ceo-dashboard/setters : le journal commence le 01/05/2026).
export const SETTERS_SINCE = '2026-05';

export const parisMonth = () => new Intl.DateTimeFormat('fr-CA', { year: 'numeric', month: '2-digit', timeZone: 'Europe/Paris' }).format(new Date()).slice(0, 7);

// Mois proposés par le sélecteur : du plus récent au premier mois du journal, « Octobre 2026 » comme dans la Performance Sales.
export function monthOptions(since = SETTERS_SINCE, now = parisMonth()) {
  const out = [];
  let [y, m] = since.split('-').map(Number);
  const [ny, nm] = now.split('-').map(Number);
  while (y < ny || (y === ny && m <= nm)) {
    const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 15)));
    out.unshift({ value: `${y}-${String(m).padStart(2, '0')}`, label: label.charAt(0).toUpperCase() + label.slice(1) });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}
