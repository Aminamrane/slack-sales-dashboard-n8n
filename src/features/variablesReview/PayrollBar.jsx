import { useState } from "react";
import { History, Lock, LockOpen } from "lucide-react";
import { money } from "./calculation.js";
import { closedLabel, monthName, ofMonth } from "./presentation.js";
import { CLOSED_HERE, PAID_OUTSIDE, payrollOf } from "./payroll.js";
import { StatusIcon } from "./StatusIcon.jsx";
import { Modal } from "./ui.jsx";

const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;

// Paie du mois affiché, sous l'en-tête : clôturée ici (figée), versée hors de la page (relevé indicatif), ou à
// clôturer (premier mois ouvert, écoulé). Rien pour un mois en cours.
export function PayrollBanner({ source, statement, onClose }) {
  const payroll = payrollOf(statement);
  const month = monthName(statement.period);
  if (payroll.state === CLOSED_HERE) {
    const when = closedLabel(payroll.closedAt);
    return (
      <div className="vr-payroll closed" role="status">
        <Lock size={15} />
        <span>Paie {ofMonth(month)} clôturée{when && ` le ${when}`}{payroll.closedBy && ` par ${payroll.closedBy}`}
          <small>Montants, fixe et réglages figés : rien ne peut être versé deux fois.</small></span>
      </div>
    );
  }
  if (payroll.state === PAID_OUTSIDE) {
    return (
      <div className="vr-payroll outside" role="status">
        <History size={15} />
        <span>Paie {ofMonth(month)} versée hors de cette page
          <small>Ancienne page ou Excel : ce relevé est indicatif, rien n’y est versé.</small></span>
      </div>
    );
  }
  if (source.payroll?.closable !== statement.period) return null;
  return (
    <div className="vr-payroll open" role="status">
      <LockOpen size={15} />
      <span>Paie {ofMonth(month)} à clôturer<small>Une fois clôturée, elle est figée et chaque vente versée l’est pour de bon.</small></span>
      <button type="button" className="vr-button primary" onClick={onClose}><Lock size={14} />Clôturer la paie</button>
    </div>
  );
}

// Clôture d'un mois : récapitulatif (relevés, lignes versées, total, ventes à confirmer laissées de côté), puis
// confirmation. Tant qu'aucune paie n'a été clôturée ici, le mois peut aussi être déclaré versé hors de la page.
export function ClosureDialog({ month, summary, error, canMarkOutside, busy, onCancel, onConfirm, onMarkOutside }) {
  const [outside, setOutside] = useState(false);
  const name = monthName(month);
  if (outside) {
    return (
      <Modal title={`Paie ${ofMonth(name)} déjà versée ?`} subtitle="Versée avec l’ancienne page ou l’Excel" onClose={onCancel}>
        <div className="vr-form-body vr-closure">
          <p>La page ne versera rien pour {name}. Les ventes signées en {name} et payées plus tard seront à confirmer, une par une.</p>
        </div>
        <div className="vr-dialog-footer">
          <button type="button" className="vr-button" onClick={() => setOutside(false)} disabled={busy}>Retour</button>
          <button type="button" className="vr-button primary" onClick={onMarkOutside} disabled={busy}>Elle a déjà été versée</button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal title={`Clôturer la paie ${ofMonth(name)} ?`} subtitle={summary ? plural(summary.people, "relevé") : undefined} onClose={onCancel}>
      <div className="vr-form-body vr-closure">
        {error ? <div className="vr-error" role="alert">{error}</div> : (
          <dl className="vr-closure-summary">
            <div><dt>Total versé</dt><dd className="vr-num">{money(summary.total)}</dd></div>
            <div><dt>Ventes et parts d’équipe versées</dt><dd className="vr-num">{summary.lines}</dd></div>
            {summary.held > 0 && (
              <div className="held">
                <dt><StatusIcon tone="check" size={14} />À confirmer, hors de cette paie</dt>
                <dd className="vr-num">{plural(summary.held, "vente")}</dd>
              </div>
            )}
          </dl>
        )}
        <p>Une fois clôturée, la paie {ofMonth(name)} est figée : montants, fixes et réglages ne bougent plus, et une
          vente versée ne pourra jamais l’être une seconde fois.</p>
        {canMarkOutside && (
          <button type="button" className="vr-link" onClick={() => setOutside(true)} disabled={busy}>
            Cette paie a déjà été versée hors de la page
          </button>
        )}
      </div>
      <div className="vr-dialog-footer">
        <button type="button" className="vr-button" onClick={onCancel} disabled={busy}>Annuler</button>
        <button type="button" className="vr-button primary" onClick={onConfirm} disabled={busy || !!error}>
          <Lock size={14} />Clôturer la paie
        </button>
      </div>
    </Modal>
  );
}

// Vente « à confirmer » (transition) : l'ancienne page versait une vente au mois de sa signature. Déjà versée : jamais
// versée par la page ; à verser : elle entre dans la paie de son mois (ou du premier mois ouvert s'il est clôturé).
export function HeldDialog({ row, target, busy, onCancel, onDecide }) {
  const outside = monthName(row.pay?.outsideMonth), into = monthName(target);
  return (
    <Modal title="Vente à confirmer" subtitle={[row.client, row.sellerName].filter(Boolean).join(" · ")} onClose={onCancel}>
      <div className="vr-form-body vr-closure">
        <p>{row.timeline}. L’ancienne page versait une vente au mois de sa signature : la paie {ofMonth(outside)} a pu
          la verser.</p>
        <dl className="vr-closure-summary">
          <div><dt>{row.seller ? "Part d’équipe" : "Commission"}</dt><dd className="vr-num">{row.value}</dd></div>
        </dl>
        <p className="vr-muted">Une seule réponse, définitive, pour la commission et la part d’équipe de cette vente.</p>
      </div>
      <div className="vr-dialog-footer">
        <button type="button" className="vr-button" onClick={onCancel} disabled={busy}>Annuler</button>
        <button type="button" className="vr-button" onClick={() => onDecide("deja_versee")} disabled={busy}>Déjà versée en {outside}</button>
        <button type="button" className="vr-button primary" onClick={() => onDecide("a_verser")} disabled={busy}>À verser en {into}</button>
      </div>
    </Modal>
  );
}
