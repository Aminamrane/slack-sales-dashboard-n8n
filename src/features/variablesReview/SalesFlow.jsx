import { motion as Motion, useReducedMotion } from "framer-motion";
import { money } from "./calculation.js";
import { InfoTip } from "./InfoTip.jsx";
import { SPRING_UI } from "./motion.js";
import { monthName, safeMoney, saleTimeline } from "./presentation.js";
import { Glide } from "./transitions.jsx";

// Ordre des segments (et de la légende) ; salesFlow garde l'ordre de priorité du classement.
const ORDER = {
  signed: ["paid", "laterDue", "laterPayment", "noFinance", "lost"],
  paid: ["signedHere", "signedBefore", "adjustment"],
};
const salesWord = (n) => (n === 0 ? "Aucune vente" : `${n} vente${n > 1 ? "s" : ""}`);
const positive = (rational) => Math.max(0, rational.toNumber());

// Bande « ventes du mois » de la carte : ce que la personne aurait touché sur ses ventes signées
// du mois, et ce qu'elle touche ce mois avec les clients qui ont payé leur 1re échéance.
// Deux lignes sur la même échelle (le plus grand des deux = 100 %), détail au clic sur la légende.
export function SalesFlow({ flow, period, source, entries, model, glide }) {
  const month = monthName(period, period);
  const max = Math.max(positive(flow.signed.amount), positive(flow.paid.amount));
  const describe = (ref) => {
    const entry = entries.get(ref);
    return {
      client: entry?.client || source.cells[`B${ref.slice(1)}`]?.input || "Ajustement de commission",
      amount: safeMoney(model.calculator, ref),
      timeline: entry ? saleTimeline(entry) : "",
    };
  };
  return (
    <div className="vr-flow" role="group" aria-label="Ventes du mois">
      <FlowRow kind="signed" title={`Signées en ${month}`} group={flow.signed} max={max} describe={describe} glide={glide} />
      <FlowRow kind="paid" title={`Payées en ${month}`} group={flow.paid} max={max} describe={describe} glide={glide} />
    </div>
  );
}

function FlowRow({ kind, title, group, max, describe, glide }) {
  const reduce = useReducedMotion();
  const spring = reduce ? { duration: 0 } : SPRING_UI;
  const parts = ORDER[kind].map((key) => group.parts.find((p) => p.key === key)).filter(Boolean);
  const listed = parts.filter((p) => p.count > 0);
  const drawn = parts.filter((p) => p.amount.n > 0n);
  const total = money(group.amount);
  const fill = max > 0 ? (positive(group.amount) / max) * 100 : 0;
  const summary = [`${title} : ${total}, ${salesWord(group.count).toLowerCase()}`,
    ...listed.map((p) => `${p.label} ${money(p.amount)}`)].join(" ; ");
  const legendKey = listed.map((p) => `${p.key}:${money(p.amount)}:${p.count}`).join("|");
  return (
    <div className="vr-flow-row" data-row={kind} data-count={group.count} aria-label={summary}>
      <div className="vr-flow-head">
        <Glide id={`${title}|${group.count}`} {...glide}>
          <span className="vr-flow-title">{title}</span>
          <span className="vr-flow-count">{group.count ? ` · ${salesWord(group.count)}` : " · Aucune vente"}</span>
        </Glide>
      </div>
      <div className="vr-flow-bar" aria-hidden="true">
        <Motion.span className="vr-flow-fill" initial={false} animate={{ width: `${fill}%` }} transition={spring}>
          {drawn.map((p) => (
            <Motion.span key={p.key} className={`vr-flow-segment ${p.key}`} initial={{ flexGrow: 0 }}
              animate={{ flexGrow: positive(p.amount) }} transition={spring} />
          ))}
        </Motion.span>
      </div>
      <div className="vr-flow-total vr-num"><Glide id={total} {...glide}>{total}</Glide></div>
      <Glide as="div" id={legendKey || "vide"} className="vr-flow-legend" {...glide}>
        {listed.map((p) => (
          <InfoTip key={p.key} label={`${p.label} : détail des ventes`} triggerClassName="vr-flow-chip" triggerProps={{ "data-part": p.key, "data-count": p.count }}
            trigger={<>
              <span className={`vr-flow-swatch ${p.key}`} aria-hidden="true" />
              <span className="vr-flow-label">{p.label}</span>
              <span className="vr-flow-amount vr-num">{money(p.amount)}{p.unreadable ? " (à vérifier)" : ""}</span>
              <span className="vr-flow-count">· {p.count}</span>
            </>}>
            <ul className="vr-flow-list">
              {p.refs.map((ref) => {
                const sale = describe(ref);
                return (
                  <li key={ref}>
                    <span className="vr-flow-client">{sale.client}</span>
                    <b className="vr-num">{sale.amount}</b>
                    {sale.timeline && <small>{sale.timeline}</small>}
                  </li>
                );
              })}
            </ul>
          </InfoTip>
        ))}
      </Glide>
    </div>
  );
}
