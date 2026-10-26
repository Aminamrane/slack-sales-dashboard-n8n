import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { GLIDE } from "./motion.js";
import { monthLabel } from "./presentation.js";
import { Roll } from "./transitions.jsx";
import { IconButton } from "./ui.jsx";

// Mois de toute la page : flèches ← →, ou choix direct dans la liste.
// Le libellé glisse horizontalement dans une fenêtre à la largeur du mois le plus long ;
// ancien et nouveau suivent la même courbe : jamais de chevauchement.
export function MonthNav({ periods, value, direction, onChange }) {
  const index = periods.indexOf(value);
  const labels = periods.map(monthLabel);
  return (
    <div className="vr-month" role="group" aria-label="Mois">
      <IconButton label="Mois précédent" disabled={index <= 0} onClick={() => onChange(periods[index - 1])}>
        <ChevronLeft size={16} />
      </IconButton>
      <label className="vr-month-label">
        <Roll id={value} axis="x" direction={direction} transition={GLIDE} align="center" sizers={labels}>{monthLabel(value)}</Roll>
        <ChevronDown size={13} aria-hidden="true" />
        <select aria-label="Choisir le mois" value={value} onChange={(e) => onChange(e.target.value)}>
          {[...periods].reverse().map((p) => <option key={p} value={p}>{monthLabel(p)}</option>)}
        </select>
      </label>
      <IconButton label="Mois suivant" disabled={index < 0 || index >= periods.length - 1} onClick={() => onChange(periods[index + 1])}>
        <ChevronRight size={16} />
      </IconButton>
    </div>
  );
}
