import { Clock3, Pencil, Plus } from "lucide-react";
import { money, Rational } from "./calculation.js";
import { Modal } from "./ui.jsx";

const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;

export function RemunerationBreakdown({ model, rows, settings, subtitle, pending, onClose, onFixed, onRules, onBonus, onCommission }) {
  return (
    <Modal title="Détail de la rémunération" subtitle={subtitle} onClose={onClose}
      info={<span>Seules les ventes comptées (première échéance Owner payée) entrent dans le total.</span>}>
      <div className="vr-form-body vr-remuneration-detail">
        <div className="vr-remuneration-line">
          <div><strong>Fixe</strong>{model.appliedTier && <small>Palier de {model.appliedTier.sales} ventes atteint</small>}</div>
          <b className="vr-num">{money(model.effectiveFixed)}</b>
          <button type="button" className="vr-button" disabled={!model.fixedCell} onClick={onFixed}><Pencil size={13} />Modifier</button>
        </div>
        <div className="vr-remuneration-line">
          <div><strong>Commissions comptées</strong><small>{plural(model.amountRefs.length, "vente")}</small></div>
          <b className="vr-num">{money(model.commission)}</b>
          <button type="button" className="vr-button" onClick={onRules}><Pencil size={13} />Coefficients</button>
        </div>
        {model.amountRefs.length > 0 && (
          <div className="vr-remuneration-sales">
            {model.amountRefs.map((ref) => {
              const row = rows.find((entry) => entry.amountCell === ref);
              const client = row?.client || "Ajustement de commission";
              return (
                <button type="button" key={ref} onClick={() => onCommission(ref, client)} aria-label={`Modifier la commission de ${client}`}>
                  <span>{client}</span><b className="vr-num">{money(model.calculator.value(ref))}</b><Pencil size={12} />
                </button>
              );
            })}
          </div>
        )}
        <div className="vr-remuneration-line">
          <strong>Primes</strong><b className="vr-num">{money(model.bonuses)}</b>
          <button type="button" className="vr-button" onClick={onBonus}><Plus size={13} />Ajouter</button>
        </div>
        {(settings.bonuses || []).map((bonus) => (
          <div className="vr-remuneration-bonus" key={bonus.id}><span>{bonus.label}</span><b className="vr-num">{money(Rational.from(bonus.amount))}</b></div>
        ))}
        {model.remainder.n !== 0n && (
          <div className="vr-remuneration-line"><strong>Autres ajustements</strong><b className="vr-num">{money(model.remainder)}</b></div>
        )}
        <div className="vr-remuneration-total"><span>Total du mois</span><strong className="vr-num">{money(model.total)}</strong></div>
        {pending.count > 0 && (
          <div className="vr-remuneration-pending">
            <Clock3 size={14} />
            <span>En attente d’encaissement, hors total · {plural(pending.count, "vente")}</span>
            <b className="vr-num">{money(pending.amount)}</b>
          </div>
        )}
      </div>
      <div className="vr-dialog-footer"><button type="button" className="vr-button primary" onClick={onClose}>Fermer</button></div>
    </Modal>
  );
}
