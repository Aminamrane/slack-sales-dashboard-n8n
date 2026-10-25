import { ChevronRight, Clock3, History, Layers, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { money, Rational } from "./calculation.js";
import { InfoTip } from "./InfoTip.jsx";
import { ProfileAvatar } from "./profileAvatar.jsx";
import { Slide } from "./Slide.jsx";
import { IconButton } from "./ui.jsx";

const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;

// Carte de la personne ouverte : total du mois, fixe, commissions, primes, en attente.
// Chaque ligne ouvre directement sa modification ; les règles ne valent que pour ce mois.
export function PersonCard({
  source, row, model, error, settings, monthText, readingDay, direction, delay,
  onCoefficients, onTiers, onHistory, onFixed, onBreakdown, onBonusAdd, onBonusRemove, onPending, onCheckRules,
}) {
  const slide = (id, children, align = "end") => (
    <Slide id={`${row.person}|${id}`} direction={direction} delay={delay} align={align}>{children ?? id}</Slide>
  );
  const fixedMissing = !!model?.fixedCell && row.statement.fixedNeedsReview && model.effectiveFixed.n === 0n;
  const bonuses = settings.bonuses || [];
  return (
    <section className="vr-card vr-person-card" aria-label="Rémunération du mois">
      <header className="vr-person-head">
        <Slide id={row.person} direction={direction} delay={delay} className="vr-identity-window">
          <span className="vr-identity">
            <ProfileAvatar source={source} person={row.person} className="large" />
            <span>
              <h2>{row.name}</h2>
              <span className="vr-identity-meta">{row.head ? "Head of sales" : "Sales"} · {monthText}</span>
            </span>
          </span>
        </Slide>
        <InfoTip label="À propos de ce calcul">
          <ul>
            <li>Fixe, commissions personnelles et primes du mois. Commissions de management non incluses.</li>
            <li>Une vente compte dans le total dès que le client a payé sa première échéance Owner.</li>
            <li>Barème en vérification.</li>
            {readingDay && <li>Données CRM lues le {readingDay}.</li>}
          </ul>
        </InfoTip>
        <div className="vr-person-actions">
          <button type="button" className="vr-button" onClick={onCoefficients}><SlidersHorizontal size={14} />Coefficients</button>
          <button type="button" className="vr-button" onClick={onTiers}><Layers size={14} />Fixe & paliers</button>
          <IconButton label="Historique des modifications" onClick={onHistory}><History size={16} /></IconButton>
        </div>
      </header>

      {error ? (
        <div className="vr-error" role="alert">Calcul bloqué : {error}<button type="button" onClick={onCheckRules}>Vérifier les règles</button></div>
      ) : (
        <div className="vr-pay">
          <div className="vr-pay-total">
            <span className="vr-kicker">Rémunération du mois</span>
            <strong className="vr-num">{slide(money(model.total), null, "start")}</strong>
            <Slide id={`${row.person}|${row.pending.count}|${money(row.pending.amount)}`} direction={direction} delay={delay} className="vr-pending-window">
              {row.pending.count > 0 ? (
                <button type="button" className="vr-pending" onClick={onPending}>
                  <Clock3 size={14} />
                  <span>En attente d’encaissement</span>
                  <b className="vr-num">{money(row.pending.amount)}</b>
                  <span>· {plural(row.pending.count, "vente")}</span>
                </button>
              ) : <span className="vr-pending-none" />}
            </Slide>
          </div>
          <div className="vr-pay-lines">
            <button type="button" className="vr-pay-line" disabled={!model.fixedCell} onClick={onFixed}>
              <span className="vr-pay-label">
                Fixe
                {fixedMissing && <span className="vr-pill attention">Fixe à saisir</span>}
                {model.appliedTier && <span className="vr-pill">Palier {model.appliedTier.sales} ventes</span>}
              </span>
              <b className="vr-num">{slide(model.fixedCell ? money(model.effectiveFixed) : "Non identifié")}</b>
              <Pencil size={13} className="vr-pay-go" />
            </button>
            <button type="button" className="vr-pay-line" onClick={onBreakdown}>
              <span className="vr-pay-label">Commissions<small>{slide(`${row.counted} vente${row.counted > 1 ? "s" : ""} comptée${row.counted > 1 ? "s" : ""}`, null, "start")}</small></span>
              <b className="vr-num">{slide(money(model.commission))}</b>
              <ChevronRight size={15} className="vr-pay-go" />
            </button>
            <button type="button" className="vr-pay-line" onClick={onBonusAdd}>
              <span className="vr-pay-label">Primes</span>
              <b className="vr-num">{slide(money(model.bonuses))}</b>
              <Plus size={15} className="vr-pay-go" />
            </button>
            {bonuses.map((b) => (
              <div className="vr-pay-sub" key={b.id}>
                <span>{b.label}{b.reason && <small> · {b.reason}</small>}</span>
                <b className="vr-num">{money(Rational.from(b.amount))}</b>
                <IconButton label={`Retirer ${b.label}`} onClick={() => onBonusRemove(b)}><Trash2 size={13} /></IconButton>
              </div>
            ))}
            {model.remainder.n !== 0n && (
              <div className="vr-pay-line static">
                <span className="vr-pay-label">Autres ajustements</span>
                <b className="vr-num">{money(model.remainder)}</b>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
