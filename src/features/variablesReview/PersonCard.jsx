import { ChevronRight, History, Layers, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { money, Rational } from "./calculation.js";
import { InfoTip } from "./InfoTip.jsx";
import { entryOffset, GLIDE_STEP } from "./motion.js";
import { CHANNELS, decimalLabel, monthName, ofMonth } from "./presentation.js";
import { StatusIcon } from "./StatusIcon.jsx";
import { ProfileAvatar } from "./profileAvatar.jsx";
import { Glide, Roll } from "./transitions.jsx";
import { IconButton } from "./ui.jsx";

const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;
// Raison du manque à gagner : même mot, même icône et même couleur que les groupes du tableau.
const MISSED = { pending: { label: "Pas encore payées", tone: "waiting" }, lost: { label: "Clients perdus", tone: "lost" } };

// Carte de la personne ouverte : trois totaux qui s'additionnent, puis le report.
// - « Va toucher ce mois » : rémunération du mois (fixe, commissions comptées, part d'équipe, primes) ;
// - « Manque à gagner » : ce qu'elle aurait pu toucher en plus si les clients des ventes du mois avaient payé
//   (pas encore payés, perdus) ; pour un head, ses ventes puis celles de son équipe ;
// - « Aurait dû toucher » = va toucher ce mois + manque à gagner ;
// - « Reporté » (dans aucun total) : clients payés le mois suivant, versé avec la paie de ce mois-là.
// - « À confirmer » (dans aucun total) : ventes de la transition peut-être déjà versées par l'ancienne paie.
// Chaque ligne ouvre sa modification ou les ventes concernées ; les règles ne valent que pour ce mois. Paie figée
// (locked : mois clôturé ou versé hors de la page) : rien ne se modifie.
// Mouvement : tout change dans la même image ; seul le grand total roule, l'identité et les
// valeurs secondaires glissent de quelques pixels, décalées de 30 ms. Une valeur inchangée ne bouge pas.
export function PersonCard({
  source, row, model, error, settings, monthText, readingDay, entry, teamShare, missed, signedBefore = { own: 0, team: 0 },
  held = null, locked = false,
  onCoefficients, onTiers, onHistory, onFixed, onBreakdown, onTeam, onMissed, onHeld, onBonusAdd, onBonusRemove, onCheckRules,
}) {
  const from = entryOffset(entry, 6);
  const glide = (step) => ({ from, delay: step * GLIDE_STEP });
  const period = row.statement.period;
  const fixedMissing = !!model?.fixedCell && row.statement.fixedNeedsReview && model.effectiveFixed.n === 0n;
  const bonuses = settings.bonuses || [];
  const fixedText = model?.fixedCell ? money(model.effectiveFixed) : "Non identifié";
  // « dont 7 signées avant » : ventes comptées ce mois mais signées un mois précédent (groupe à part dans les tableaux).
  const before = (n) => (n > 0 ? ` · dont ${n} signée${n > 1 ? "s" : ""} avant` : "");
  const countedText = `${row.counted} vente${row.counted > 1 ? "s" : ""} comptée${row.counted > 1 ? "s" : ""}${before(signedBefore.own)}`;
  const teamText = teamShare && `${plural(teamShare.counted.length, "vente")} de l’équipe${before(signedBefore.team)}`;
  const teamCoefficients = Object.entries(CHANNELS)
    .filter(([key]) => settings.acquisition?.[key]?.team != null)
    .map(([key, name]) => `${decimalLabel(settings.acquisition[key].team)} ${name.toLowerCase()}`)
    .join(", ");
  const missedLines = (groups, scope) => ["pending", "lost"].filter((status) => groups[status].count > 0).map((status) => {
    const group = groups[status], { label, tone } = MISSED[status], amount = money(group.amount);
    return (
      <Glide as="div" key={`${scope}|${status}`} id={`${row.person}|${scope}|${status}|${group.count}|${amount}`} className="vr-missed-item" {...glide(2)}>
        <button type="button" className="vr-pay-line" data-missed={`${scope}-${status}`} onClick={() => onMissed(scope, status)}>
          <span className="vr-pay-label"><StatusIcon tone={tone} size={14} />{label}<small>{plural(group.count, "vente")}</small></span>
          <b className="vr-num">{amount}</b>
          <ChevronRight size={15} className="vr-pay-go" />
        </button>
        {status === "pending" && group.reasons.length > 1 && (
          <ul className="vr-missed-reasons">
            {group.reasons.map((r) => <li key={r.key}>{r.label}<span className="vr-num">{r.count}</span></li>)}
          </ul>
        )}
      </Glide>
    );
  });
  // Report : clients payés après le mois, la commission est versée avec la paie du mois du paiement (ni ce mois-ci,
  // ni en plus). Ventes de la personne et, pour un head, de son équipe.
  const deferred = missed ? [missed.own, missed.team].filter(Boolean).map((g) => g.deferred) : [];
  const laterCount = deferred.reduce((n, g) => n + g.count, 0);
  const laterMonths = [...new Set(deferred.flatMap((g) => g.months))].sort();
  const laterMonth = laterMonths.length === 1 ? monthName(laterMonths[0], period) : null;
  const ownMissed = missed ? missedLines(missed.own, "own") : [];
  const teamMissed = missed?.team ? missedLines(missed.team, "team") : [];
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
            <li>{teamShare ? "Rémunération : fixe, commissions personnelles, part d’équipe et primes du mois." : "Rémunération : fixe, commissions personnelles et primes du mois."}</li>
            <li>Une vente compte dans la rémunération du mois où le client a payé sa première échéance Owner.</li>
            <li>Commission : base × coefficient. Base : prix Owner / 12 ; à partir de 6 salariés en cold call, Ads et cold call setter, (total × 80 %) / 12, comme l’Excel.</li>
            {teamShare && <li>Part d’équipe : chaque vente d’un membre de son équipe CRM, au mois où le client paie sa 1re échéance ; base de la vente × {teamCoefficients}.</li>}
            <li>Manque à gagner : ce que la personne aurait pu toucher en plus si les clients des ventes du mois avaient payé (pas encore payés, perdus). Aurait dû toucher = va toucher ce mois + manque à gagner.</li>
            <li>Dans la paie d’octobre : clients payés le mois suivant ; la commission est dans la rémunération de ce mois-là, pas en plus.</li>
            <li>Paie clôturée : figée ; une vente versée ne l’est jamais une seconde fois. À confirmer : ventes signées avant la page, peut-être déjà versées par l’ancienne paie.</li>
            <li>Barème en vérification.</li>
            {readingDay && <li>Données CRM lues le {readingDay}.</li>}
          </ul>
        </InfoTip>
        <div className="vr-person-actions">
          {!locked && <button type="button" className="vr-button" onClick={onCoefficients}><SlidersHorizontal size={14} />Coefficients</button>}
          {!locked && <button type="button" className="vr-button" onClick={onTiers}><Layers size={14} />Fixe & paliers</button>}
          <IconButton label="Historique des modifications" onClick={onHistory}><History size={16} /></IconButton>
        </div>
      </header>

      {error ? (
        <div className="vr-error" role="alert">Calcul bloqué : {error}<button type="button" onClick={onCheckRules}>Vérifier les règles</button></div>
      ) : (
        <div className="vr-pay">
          <div className="vr-pay-side" data-side="paid">
            <div className="vr-pay-head">
              <span className="vr-kicker">Va toucher ce mois</span>
              <strong className="vr-num vr-total"><Roll id={money(model.total)} direction={entry.direction}>{money(model.total)}</Roll></strong>
            </div>
            <div className="vr-pay-lines">
              <button type="button" className="vr-pay-line" disabled={locked || !model.fixedCell} onClick={onFixed}>
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
                {locked ? <span /> : <Pencil size={13} className="vr-pay-go" />}
              </button>
              <button type="button" className="vr-pay-line" onClick={onBreakdown}>
                <span className="vr-pay-label">Commissions<small><Glide id={countedText} {...glide(2)}>{countedText}</Glide></small></span>
                <b className="vr-num"><Glide id={money(model.commission)} {...glide(2)}>{money(model.commission)}</Glide></b>
                <ChevronRight size={15} className="vr-pay-go" />
              </button>
              {teamShare && (
                <button type="button" className="vr-pay-line" data-line="team" onClick={onTeam || onBreakdown}>
                  <span className="vr-pay-label">Part d’équipe<small><Glide id={teamText} {...glide(3)}>{teamText}</Glide></small></span>
                  <b className="vr-num"><Glide id={money(teamShare.amount)} {...glide(3)}>{money(teamShare.amount)}</Glide></b>
                  <ChevronRight size={15} className="vr-pay-go" />
                </button>
              )}
              <button type="button" className="vr-pay-line" disabled={locked} onClick={onBonusAdd}>
                <span className="vr-pay-label">Primes</span>
                <b className="vr-num"><Glide id={money(model.bonuses)} {...glide(3)}>{money(model.bonuses)}</Glide></b>
                {locked ? <span /> : <Plus size={15} className="vr-pay-go" />}
              </button>
              {bonuses.map((b) => (
                <Glide as="div" key={b.id} id={`${row.person}|${b.id}`} className="vr-pay-sub" {...glide(3)}>
                  <span>{b.label}{b.reason && <small> · {b.reason}</small>}</span>
                  <b className="vr-num">{money(Rational.from(b.amount))}</b>
                  {locked ? <span /> : <IconButton label={`Retirer ${b.label}`} onClick={() => onBonusRemove(b)}><Trash2 size={13} /></IconButton>}
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
          <div className="vr-pay-side missed" data-side="missed">
            <div className="vr-pay-head">
              <span className="vr-kicker">Manque à gagner du mois</span>
              <strong className="vr-num vr-total-missed"><Glide id={money(missed?.total ?? null)} {...glide(1)}>{money(missed?.total ?? null)}</Glide></strong>
            </div>
            <div className="vr-pay-lines">
              {!ownMissed.length && !teamMissed.length && <div className="vr-pay-none">Aucun : pas de client impayé ni perdu sur les ventes du mois.</div>}
              {teamMissed.length > 0 && ownMissed.length > 0 && <span className="vr-pay-group">Ses ventes</span>}
              {ownMissed}
              {teamMissed.length > 0 && <span className="vr-pay-group">Part d’équipe</span>}
              {teamMissed}
            </div>
          </div>
          <div className="vr-should" data-should>
            <span className="vr-kicker">Aurait dû toucher</span>
            <small className="vr-num">{money(model.total)} + {money(missed?.total ?? null)} de manque à gagner</small>
            <strong className="vr-num"><Glide id={money(missed ? model.total.add(missed.total) : null)} {...glide(2)}>{money(missed ? model.total.add(missed.total) : null)}</Glide></strong>
          </div>
          {laterCount > 0 && (
            <button type="button" className="vr-later" data-later onClick={() => onMissed("own", "deferred")}
              title="Clients payés après le mois : la commission est dans la paie de ce mois-là, ni dans ce mois ni dans le manque à gagner.">
              <StatusIcon tone="later" size={15} />
              <span className="vr-later-label">{laterMonth ? `Dans la paie ${ofMonth(laterMonth)}` : "Dans une paie suivante"}
                <small>{plural(laterCount, "vente")} · clients payés {laterMonth ? `en ${laterMonth}` : "plus tard"}</small></span>
              <b className="vr-num">{money(missed.later)}</b>
              <ChevronRight size={15} className="vr-pay-go" />
            </button>
          )}
          {held?.count > 0 && (
            <button type="button" className="vr-later check" data-held onClick={onHeld}
              title="Ventes signées un mois versé par l’ancienne paie : déjà versées, ou à verser ? Elles ne sont versées qu’après confirmation.">
              <StatusIcon tone="check" size={15} />
              <span className="vr-later-label">À confirmer<small>{plural(held.count, "vente")} · peut-être déjà versées par l’ancienne paie</small></span>
              <b className="vr-num">{money(held.amount)}</b>
              <ChevronRight size={15} className="vr-pay-go" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
