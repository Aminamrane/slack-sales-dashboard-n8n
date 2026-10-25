import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel } from "./presentation.js";
import { Slide } from "./Slide.jsx";
import { IconButton } from "./ui.jsx";

// Mois de toute la page : flèches ← →, ou choix direct dans la liste.
export function MonthNav({ periods, value, direction, onChange }) {
  const index = periods.indexOf(value);
  return (
    <div className="vr-month" role="group" aria-label="Mois">
      <IconButton label="Mois précédent" disabled={index <= 0} onClick={() => onChange(periods[index - 1])}>
        <ChevronLeft size={16} />
      </IconButton>
      <label className="vr-month-label">
        <Slide id={value} axis="x" direction={direction} align="center">{monthLabel(value)}</Slide>
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
