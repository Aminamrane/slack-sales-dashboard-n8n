import { useMemo } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';

export const todayMonth = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).format(new Date());

// Sélecteur de mois des blocs Finance et Délais : du mois courant à janvier 2023,
// plus « Tout l'historique » quand le bloc le permet. Un <select> natif : lisible,
// accessible au clavier, aucune surprise.
export default function PeriodSelect({ value, onChange, all = false, label, options }) {
  const months = useMemo(() => {
    if (options) return options;
    const [year, month] = todayMonth().split('-').map(Number);
    const out = [];
    for (let y = year; y >= 2023; y--) for (let m = y === year ? month : 12; m >= 1; m--) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      out.push({ key, label: new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}-01T12:00:00Z`)) });
    }
    return out;
  }, [options]);
  return (
    <label className="an-period">
      <CalendarDays size={15} aria-hidden="true" />
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {all && <option value="all">Tout l’historique</option>}
        {months.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} aria-hidden="true" />
    </label>
  );
}
