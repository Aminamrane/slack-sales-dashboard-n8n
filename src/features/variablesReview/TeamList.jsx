import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Search } from "lucide-react";
import { money } from "./calculation.js";
import { EXIT, SPRING_UI, STAGGER, STAGGER_MAX } from "./motion.js";
import { ProfileAvatar } from "./profileAvatar.jsx";
import { Slide } from "./Slide.jsx";

const salesLabel = (counted, signed) =>
  signed === 0 ? "Aucune vente" : `${counted}/${signed} vente${signed > 1 ? "s" : ""}`;

// Liste de l'équipe pour le mois : total de l'équipe en tête, une ligne par personne.
// Nouveau mois = nouvelle liste (l'ancienne se referme, la nouvelle monte en cascade) ;
// dans un même mois, un ajustement qui change l'ordre fait glisser les lignes à leur place.
export function TeamList({ source, period, rows, totals, selected, direction, onSelect }) {
  const [search, setSearch] = useState("");
  const visible = rows.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()));
  const grouped = rows.some((r) => r.head) && rows.some((r) => !r.head);
  const items = [];
  visible.forEach((r, i) => {
    if (grouped && (i === 0 || visible[i - 1].head !== r.head))
      items.push({ key: r.head ? "group-heads" : "group-sales", label: r.head ? "Heads" : "Sales" });
    items.push({ key: r.person, row: r });
  });
  return (
    <aside className="vr-team" aria-label="Équipe">
      <div className="vr-team-total">
        <span className="vr-kicker">Équipe · {rows.length} personne{rows.length > 1 ? "s" : ""}</span>
        <strong className="vr-num"><Slide id={money(totals.total)} direction={direction}>{money(totals.total)}</Slide></strong>
        {totals.pending.n !== 0n && (
          <small><span className="vr-num">{money(totals.pending)}</span> en attente d’encaissement</small>
        )}
      </div>
      <div className="vr-search">
        <Search size={15} />
        <input aria-label="Rechercher un collaborateur" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="vr-team-list">
        <AnimatePresence mode="wait" initial={false}>
          <Motion.div
            key={period}
            initial={{ clipPath: "inset(0% 0% 0% 0%)" }}
            animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
            exit={{ clipPath: "inset(0% 0% 100% 0%)", transition: EXIT }}
          >
            <TeamItems source={source} period={period} items={items} selected={selected} direction={direction} onSelect={onSelect} />
          </Motion.div>
        </AnimatePresence>
        {!visible.length && <div className="vr-team-empty">Aucun résultat</div>}
      </div>
    </aside>
  );
}

function TeamItems({ source, period, items, selected, direction, onSelect }) {
  // Lignes présentes à l'ouverture du mois : cascade ; ligne qui apparaît ensuite (recherche) : dépliée.
  const opening = useRef(true);
  useEffect(() => { opening.current = false; }, []);
  let index = 0;
  return (
    <AnimatePresence>
      {items.map((item) => {
        const delay = Math.min(index++, STAGGER_MAX) * STAGGER;
        const motionProps = {
          layout: "position",
          initial: opening.current ? { y: 14 } : { height: 0, overflow: "hidden" },
          animate: { y: 0, height: "auto", transition: { ...SPRING_UI, delay: opening.current ? delay : 0 }, transitionEnd: { overflow: "visible" } },
          exit: { height: 0, overflow: "hidden", transition: EXIT },
          transition: SPRING_UI,
        };
        return item.row ? (
          <Motion.div key={item.key} className="vr-person-slot" {...motionProps}>
            <PersonRow source={source} period={period} row={item.row} selected={item.row.person === selected} direction={direction} onSelect={onSelect} />
          </Motion.div>
        ) : (
          <Motion.div key={item.key} className="vr-team-group" {...motionProps}>{item.label}</Motion.div>
        );
      })}
    </AnimatePresence>
  );
}

function PersonRow({ source, period, row, selected, direction, onSelect }) {
  const amount = row.total ? money(row.total) : null;
  return (
    <button type="button" className={`vr-person ${selected ? "selected" : ""}`} aria-current={selected ? "true" : undefined} onClick={() => onSelect(row.person)}>
      {selected && <Motion.span layoutId={`vr-person-active-${period}`} className="vr-person-active" transition={SPRING_UI} />}
      <ProfileAvatar source={source} person={row.person} />
      <span className="vr-person-text">
        <strong>{row.name}</strong>
        <small>{salesLabel(row.counted, row.signed)}</small>
      </span>
      <span className={`vr-person-amount vr-num ${amount ? "" : "blocked"}`}>
        {amount ? <Slide id={amount} direction={direction} align="end">{amount}</Slide> : "Calcul bloqué"}
      </span>
    </button>
  );
}
