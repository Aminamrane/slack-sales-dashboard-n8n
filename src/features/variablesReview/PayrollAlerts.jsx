import { useState } from "react";
import { BellRing, ChevronDown, ChevronRight } from "lucide-react";
import { Rational, money } from "./calculation.js";
import { alertText } from "./payroll.js";
import { dayMonthLabel, monthName, ofMonth } from "./presentation.js";
import { Collapse } from "./transitions.jsx";

const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;
const NOTICES = new Set(["missing", "late"]);
const amountOf = (value) => {
  try {
    return value == null ? null : money(Rational.from(value));
  } catch {
    return null;
  }
};

// Changements après la paie, sous l'en-tête : un compteur toujours visible, la liste rangée par paie (la plus récente
// d'abord) au clic. Chaque alerte dit ce qui a changé et quoi faire ; un clic ouvre la personne et le mois concernés.
export function PayrollAlerts({ source, alerts, onOpen }) {
  const [open, setOpen] = useState(false);
  if (!alerts.length) return null;
  const changes = alerts.filter((a) => !NOTICES.has(a.type)).length, notices = alerts.length - changes;
  const months = [...new Set(alerts.map((a) => a.month))];
  const summary = [changes && `${plural(changes, "changement")} après la paie`, notices && `${plural(notices, "paie")} à vérifier`]
    .filter(Boolean).join(" · ");
  return (
    <section className={`vr-alerts ${open ? "open" : ""}`} aria-label="Changements après la paie">
      <button type="button" className="vr-alerts-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <BellRing size={16} />
        <strong>{summary}</strong>
        <small>Ce qui a changé sur ce qui a déjà été versé, le 1er de chaque mois</small>
        <ChevronDown size={16} className="vr-alerts-chevron" />
      </button>
      <Collapse open={open}>
        <div className="vr-alerts-list">
          {months.map((month) => {
            const payDate = source.payroll?.payDates?.[month];
            return (
              <div key={month} className="vr-alerts-month">
                <span className="vr-kicker">Paie {ofMonth(monthName(month))}{payDate && `, versée le ${dayMonthLabel(payDate)}`}</span>
                {alerts.filter((a) => a.month === month).map((alert) => {
                  const text = alertText(source, alert), amount = amountOf(text.amount);
                  return (
                    <button key={alert.id} type="button" className={`vr-alert ${alert.type}`} disabled={!alert.person}
                      onClick={() => onOpen(alert)}>
                      <span className="vr-alert-text">
                        <strong>{text.title}</strong>
                        <span>{text.subject && <b>{text.subject} : </b>}{text.detail}</span>
                      </span>
                      {amount && <b className="vr-num">{amount}</b>}
                      {alert.person ? <ChevronRight size={15} className="vr-pay-go" /> : <span />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </Collapse>
    </section>
  );
}
