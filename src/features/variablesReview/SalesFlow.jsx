import { money } from "./calculation.js";
import { InfoTip } from "./InfoTip.jsx";
import { monthName, safeMoney, saleTimeline } from "./presentation.js";
import { Glide } from "./transitions.jsx";

// Ordre d'affichage des motifs ; salesFlow garde l'ordre de priorité du classement.
const ORDER = {
  signed: ["paid", "laterPayment", "onboarding", "laterDue", "lost", "noFinance"],
  paid: ["signedHere", "signedBefore", "adjustment"],
};
const salesWord = (n) => (n === 0 ? "Aucune vente" : `${n} vente${n > 1 ? "s" : ""}`);

// Bande « ventes du mois » de la carte, en chiffres seulement : ce que la personne aurait touché sur
// ses ventes signées du mois (par motif), et ce qu'elle touche ce mois avec les clients qui ont payé
// leur 1re échéance. Détail des ventes au clic sur chaque motif.
export function SalesFlow({ flow, period, source, entries, model, glide }) {
  const month = monthName(period, period);
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
      <FlowRow kind="signed" title={`Signées en ${month}`} group={flow.signed} describe={describe} glide={glide} />
      <FlowRow kind="paid" title={`Payées en ${month}`} group={flow.paid} describe={describe} glide={glide} />
    </div>
  );
}

function FlowRow({ kind, title, group, describe, glide }) {
  const listed = ORDER[kind].map((key) => group.parts.find((p) => p.key === key)).filter((p) => p?.count > 0);
  const total = money(group.amount);
  const legendKey = listed.map((p) => `${p.key}:${money(p.amount)}:${p.count}`).join("|");
  return (
    <div className="vr-flow-row" data-row={kind} data-count={group.count}>
      <div className="vr-flow-head">
        <Glide id={`${title}|${group.count}`} {...glide}>
          <span className="vr-flow-title">{title}</span>
          <span className="vr-flow-count"> · {salesWord(group.count)}</span>
        </Glide>
      </div>
      <div className="vr-flow-total vr-num"><Glide id={total} {...glide}>{total}</Glide></div>
      <Glide as="div" id={legendKey || "vide"} className="vr-flow-legend" {...glide}>
        {listed.map((p) => (
          <InfoTip key={p.key} label={`${p.label}, ${money(p.amount)}, ${salesWord(p.count).toLowerCase()} : détail des ventes`} triggerClassName="vr-flow-chip" triggerProps={{ "data-part": p.key, "data-count": p.count }}
            trigger={<>
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
