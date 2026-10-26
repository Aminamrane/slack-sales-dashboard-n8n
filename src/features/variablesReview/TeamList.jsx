import { useEffect, useRef, useState } from "react";
import { motion as Motion, useReducedMotion } from "framer-motion";
import { Search } from "lucide-react";
import { money } from "./calculation.js";
import { FLIP, GLIDE, INDICATOR } from "./motion.js";
import { ProfileAvatar } from "./profileAvatar.jsx";
import { Glide, Roll } from "./transitions.jsx";

const salesLabel = (counted, signed) =>
  signed === 0 ? "Aucune vente" : `${counted}/${signed} vente${signed > 1 ? "s" : ""}`;

// Liste de l'équipe pour le mois : total de l'équipe en tête, une ligne par personne.
// Changement de mois : les personnes présentes dans les deux mois glissent vers leur nouveau
// rang (FLIP), celles qui arrivent apparaissent à leur place en entrant par le côté du mois,
// celles qui partent disparaissent dans l'image même. La liste n'est jamais vide.
export function TeamList({ source, period, rows, totals, selected, direction, onSelect }) {
  const [search, setSearch] = useState("");
  const reduce = useReducedMotion(); // mouvement réduit : aucune animation de mise en page
  // Mois affiché au rendu précédent : les lignes montées par un changement de mois entrent
  // par le côté ; celles montées par la recherche apparaissent sans déplacement.
  const shownPeriod = useRef(period);
  const arriving = shownPeriod.current !== period && !reduce ? { x: 16 * direction } : false;
  useEffect(() => { shownPeriod.current = period; }, [period]);

  const visible = rows.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()));
  const grouped = rows.some((r) => r.head) && rows.some((r) => !r.head);
  const items = [];
  visible.forEach((r, i) => {
    if (grouped && (i === 0 || visible[i - 1].head !== r.head))
      items.push({ key: r.head ? "group-heads" : "group-sales", label: r.head ? "Heads" : "Sales" });
    items.push({ key: r.person, row: r });
  });
  const pendingText = totals.pending.n !== 0n ? money(totals.pending) : null;
  return (
    <aside className="vr-team" aria-label="Équipe">
      <div className="vr-team-total">
        <span className="vr-kicker">Équipe · {rows.length} personne{rows.length > 1 ? "s" : ""}</span>
        <strong className="vr-num"><Roll id={money(totals.total)} direction={direction}>{money(totals.total)}</Roll></strong>
        {pendingText && (
          <small><Glide id={pendingText} from={{ x: 0, y: 6 * direction }}><span className="vr-num">{pendingText}</span> en attente d’encaissement</Glide></small>
        )}
      </div>
      <div className="vr-search">
        <Search size={15} />
        <input aria-label="Rechercher un collaborateur" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <Motion.div className="vr-team-list" layoutScroll={!reduce}>
        {items.map((item) => (
          <Motion.div
            key={item.key}
            layout={reduce ? false : "position"}
            className={item.row ? "vr-person-slot" : "vr-team-group"}
            initial={arriving}
            animate={{ x: 0, transition: GLIDE }}
            transition={{ layout: FLIP }}
          >
            {item.row ? (
              <PersonRow source={source} row={item.row} selected={item.row.person === selected} slide={!reduce} onSelect={onSelect} />
            ) : item.label}
          </Motion.div>
        ))}
        {!visible.length && <div className="vr-team-empty">Aucun résultat</div>}
      </Motion.div>
    </aside>
  );
}

function PersonRow({ source, row, selected, slide, onSelect }) {
  return (
    <button type="button" className={`vr-person ${selected ? "selected" : ""}`} aria-current={selected ? "true" : undefined} onClick={() => onSelect(row.person)}>
      {selected && (slide
        ? <Motion.span layoutId="vr-person-active" className="vr-person-active" transition={INDICATOR} />
        : <span className="vr-person-active" />)}
      <ProfileAvatar source={source} person={row.person} />
      <span className="vr-person-text">
        <strong>{row.name}</strong>
        <small>{salesLabel(row.counted, row.signed)}</small>
      </span>
      <span className={`vr-person-amount vr-num ${row.total ? "" : "blocked"}`}>{row.total ? money(row.total) : "Calcul bloqué"}</span>
    </button>
  );
}
