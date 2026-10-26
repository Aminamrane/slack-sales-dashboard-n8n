import { ChevronRight, Clock3, History, Layers, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { money, Rational } from "./calculation.js";
import { InfoTip } from "./InfoTip.jsx";
import { entryOffset, GLIDE_STEP } from "./motion.js";
import { ProfileAvatar } from "./profileAvatar.jsx";
import { SalesFlow } from "./SalesFlow.jsx";
import { Glide, Roll } from "./transitions.jsx";
import { IconButton } from "./ui.jsx";

const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;

// Carte de la personne ouverte : total du mois, fixe, commissions, primes, en attente.
// Chaque ligne ouvre directement sa modification ; les règles ne valent que pour ce mois.
// Mouvement : tout change dans la même image ; seul le grand total roule, l'identité et les
// valeurs secondaires glissent de quelques pixels, décalées de 30 ms. Une valeur inchangée ne bouge pas.
export function PersonCard({
  source, row, model, error, settings, monthText, readingDay, entry, flow, entries,
  onCoefficients, onTiers, onHistory, onFixed, onBreakdown, onBonusAdd, onBonusRemove, onPending, onCheckRules,
}) {
  const from = entryOffset(entry, 6);
  const glide = (step) => ({ from, delay: step * GLIDE_STEP });
  const fixedMissing = !!model?.fixedCell && row.statement.fixedNeedsReview && model.effectiveFixed.n === 0n;
  const bonuses = settings.bonuses || [];
  const fixedText = model?.fixedCell ? money(model.effectiveFixed) : "Non identifié";
  const countedText = `${row.counted} vente${row.counted > 1 ? "s" : ""} comptée${row.counted > 1 ? "s" : ""}`;
  const pendingKey = `${row.pending.count}|${money(row.pending.amount)}`;
  return (
    <section className="vr-card vr-person-card" aria-label="Rémunération du mois">
      <header className="vr-person-head">
        <Glide id={`${row.person}|${monthText}`} className="vr-identity" {...glide(0)}>
          <ProfileAvatar source={source} person={row.person} className="large" />
          <span>
            <h2>{row.name}</h2>
            <span className="vr-identity-meta">{row.head ? "Head of sales" : "Sales"} · {monthText}</span>
          </span>
        </Glide>
        <InfoTip label="À propos de ce calcul">
          <ul>
            <li>Fixe, commissions personnelles et primes du mois. Commissions de management non incluses.</li>
            <li>Une vente compte dans le total du mois où le client a payé sa première échéance Owner.</li>
            <li>Signées : ventes signées ce mois, au barème du mois. Payées : ventes dont la 1re échéance a été payée ce mois ; c’est le total des commissions.</li>
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
            <strong className="vr-num vr-total"><Roll id={money(model.total)} direction={entry.direction}>{money(model.total)}</Roll></strong>
            {row.pending.count > 0 && (
              <Glide id={pendingKey} {...glide(4)}>
                <button type="button" className="vr-pending" onClick={onPending}>
                  <Clock3 size={14} />
                  <span>En attente d’encaissement</span>
                  <b className="vr-num">{money(row.pending.amount)}</b>
                  <span>· {plural(row.pending.count, "vente")}</span>
                </button>
              </Glide>
            )}
          </div>
          <div className="vr-pay-lines">
            <button type="button" className="vr-pay-line" disabled={!model.fixedCell} onClick={onFixed}>
              <span className="vr-pay-label">
                Fixe
                {(fixedMissing || model.appliedTier) && (
                  <Glide id={`${row.person}|${fixedMissing}|${model.appliedTier?.sales ?? ""}`} className="vr-pay-pills" {...glide(1)}>
                    {fixedMissing && <span className="vr-pill attention">Fixe à saisir</span>}
                    {model.appliedTier && <span className="vr-pill">Palier {model.appliedTier.sales} ventes</span>}
                  </Glide>
                )}
              </span>
              <b className="vr-num"><Glide id={fixedText} {...glide(1)}>{fixedText}</Glide></b>
              <Pencil size={13} className="vr-pay-go" />
            </button>
            <button type="button" className="vr-pay-line" onClick={onBreakdown}>
              <span className="vr-pay-label">Commissions<small><Glide id={countedText} {...glide(2)}>{countedText}</Glide></small></span>
              <b className="vr-num"><Glide id={money(model.commission)} {...glide(2)}>{money(model.commission)}</Glide></b>
              <ChevronRight size={15} className="vr-pay-go" />
            </button>
            <button type="button" className="vr-pay-line" onClick={onBonusAdd}>
              <span className="vr-pay-label">Primes</span>
              <b className="vr-num"><Glide id={money(model.bonuses)} {...glide(3)}>{money(model.bonuses)}</Glide></b>
              <Plus size={15} className="vr-pay-go" />
            </button>
            {bonuses.map((b) => (
              <Glide as="div" key={b.id} id={`${row.person}|${b.id}`} className="vr-pay-sub" {...glide(3)}>
                <span>{b.label}{b.reason && <small> · {b.reason}</small>}</span>
                <b className="vr-num">{money(Rational.from(b.amount))}</b>
                <IconButton label={`Retirer ${b.label}`} onClick={() => onBonusRemove(b)}><Trash2 size={13} /></IconButton>
              </Glide>
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
      {!error && flow && (
        <SalesFlow flow={flow} period={row.statement.period} source={source} entries={entries} model={model} glide={glide(4)} />
      )}
    </section>
  );
}
