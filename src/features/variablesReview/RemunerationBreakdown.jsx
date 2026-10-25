import { Pencil, Plus } from "lucide-react";
import { money, Rational } from "./calculation.js";
import { Modal } from "./ui.jsx";

export function RemunerationBreakdown({ model, rows, settings, subtitle, onClose, onFixed, onRules, onBonus, onCommission }) {
  return (
    <Modal title="Détail de la rémunération" subtitle={subtitle} onClose={onClose}>
      <div className="vr-form-body vr-remuneration-detail">
        <div className="vr-remuneration-line">
          <div><strong>Fixe</strong>{model.appliedTier && <small>Palier de {model.appliedTier.sales} ventes atteint</small>}</div>
          <b>{money(model.effectiveFixed)}</b>
          <button className="vr-button" disabled={!model.fixedCell} onClick={onFixed}><Pencil size={14}/>Modifier</button>
        </div>
        <div className="vr-remuneration-line">
          <div><strong>Commissions encaissées</strong><small>{model.amountRefs.length} vente{model.amountRefs.length !== 1 ? "s" : ""} comptabilisée{model.amountRefs.length !== 1 ? "s" : ""}</small></div>
          <b>{money(model.commission)}</b>
          <button className="vr-button" onClick={onRules}><Pencil size={14}/>Coefficients</button>
        </div>
        {model.amountRefs.length > 0 && <div className="vr-remuneration-sales">
          {model.amountRefs.map(ref => {
            const row = rows.find(entry => entry.amountCell === ref);
            const client = row?.client || "Ajustement de commission";
            return <button key={ref} onClick={() => onCommission(ref, client)} aria-label={`Modifier la commission de ${client}`}><span>{client}</span><b>{money(model.calculator.value(ref))}</b><Pencil size={12}/></button>;
          })}
        </div>}
        <div className="vr-remuneration-line">
          <strong>Primes</strong><b>{money(model.bonuses)}</b>
          <button className="vr-button" onClick={onBonus}><Plus size={14}/>Ajouter</button>
        </div>
        {(settings.bonuses || []).map(bonus => <div className="vr-remuneration-bonus" key={bonus.id}><span>{bonus.label}</span><b>{money(Rational.from(bonus.amount))}</b></div>)}
        {model.remainder.n !== 0n && <div className="vr-remuneration-line"><strong>Autres ajustements</strong><b>{money(model.remainder)}</b></div>}
        <div className="vr-remuneration-total"><span>Total à payer</span><strong>{money(model.total)}</strong></div>
      </div>
      <div className="vr-dialog-footer"><button className="vr-button primary" onClick={onClose}>Fermer</button></div>
    </Modal>
  );
}
