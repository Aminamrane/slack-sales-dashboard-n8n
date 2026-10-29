import { ChevronRight, FileDown, History, Layers, Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { money } from "./calculation.js";
import { InfoTip } from "./InfoTip.jsx";
import { entryOffset, GLIDE_STEP } from "./motion.js";
import { CHANNELS, decimalLabel, monthName, ofMonth } from "./presentation.js";
import { StatusIcon } from "./StatusIcon.jsx";
import { ticketLines, tierNote } from "./ticket.js";
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
// Chaque ligne ouvre sa modification ou les ventes concernées ; les règles ne valent que pour ce mois.
// Mouvement : tout change dans la même image ; seul le grand total roule, l'identité et les
// valeurs secondaires glissent de quelques pixels, décalées de 30 ms. Une valeur inchangée ne bouge pas.
export function PersonCard({
  source, row, model, error, settings, monthText, readingDay, entry, teamShare, missed, gross,
  onCoefficients, onTiers, onHistory, onFixed, onBreakdown, onTeam, onMissed, onBonusAdd, onBonusRemove, onCheckRules,
  onPayslip, payslipBusy = false,
}) {
  const from = entryOffset(entry, 6);
  const glide = (step) => ({ from, delay: step * GLIDE_STEP });
  const period = row.statement.period;
  const fixedMissing = !!model?.fixedCell && row.statement.fixedNeedsReview && model.fixed.n === 0n;
  const bonuses = settings.bonuses || [];
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
  // Ticket « Brut du mois » : lignes calculées par ticketLines (même source que le relevé PDF), branchées ici sur
  // les actions de la carte (ventes concernées, paliers, fixe, primes, détail de la rémunération).
  const ticket = model && gross ? ticketLines({ period, model, gross, teamShare, bonuses, fixedMissing }) : null;
  const brut = ticket ? ticket.brut : model?.total;
  const actions = {
    "sales:ALL": () => onMissed("own", "ALL"), "sales:counted": () => onMissed("own", "counted"),
    "sales:deferred": () => onMissed("own", "deferred"), "sales:pending": () => onMissed("own", "pending"),
    "sales:lost": () => onMissed("own", "lost"), tiers: onTiers, team: onTeam || onBreakdown, fixed: onFixed,
    bonus: onBonusAdd, breakdown: onBreakdown,
  };
  const icons = { chevron: <ChevronRight size={15} />, pencil: <Pencil size={13} />, plus: <Plus size={15} /> };
  const tierPill = <span className="vr-pill" title="Comptée ce mois-ci grâce au palier atteint, même si le client n’a pas encore payé">au palier</span>;
  const lineView = (l) => {
    if (l.kind === "note") {
      return (
        <div key={l.key} data-line={l.key} className="vr-ticket-line note static">
          <span className="vr-ticket-label">{tierNote(l.tier, money)}</span>
        </div>
      );
    }
    const amount = typeof l.amount === "string" ? l.amount : `${l.sign ? `${l.sign} ` : ""}${money(l.amount)}`;
    const remove = l.action === "bonus-remove";
    const onClick = remove ? null : actions[l.action];
    const Tag = onClick ? "button" : "div";
    return (
      <Tag key={l.key} {...(onClick ? { type: "button", onClick, disabled: l.disabled } : {})} data-line={l.key}
        className={`vr-ticket-line${l.kind ? ` ${l.kind}` : ""}${onClick ? "" : " static"}`}>
        <span className="vr-ticket-label">
          {l.label}{l.detail && <small> · {l.detail}</small>}{l.pill && tierPill}
          {l.attention && <span className="vr-pay-pills"><span className="vr-pill attention">{l.attention}</span></span>}
        </span>
        <span className="vr-ticket-count vr-num">{l.count}</span>
        <b className={`vr-ticket-amount vr-num${l.struck ? " struck" : ""}`}>
          <Glide id={`${l.key}|${amount}`} {...glide(2)}>{l.struck ? <s>{amount}</s> : amount}</Glide>
        </b>
        <span className="vr-ticket-go">
          {remove ? <IconButton label={`Retirer ${l.label}`} onClick={() => onBonusRemove(l.bonus)}><Trash2 size={13} /></IconButton> : icons[l.icon]}
        </span>
      </Tag>
    );
  };
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
            <li>Brut du mois : fixe, commissions des ventes signées dans le mois (payées ce mois ou plus tard), commissions des ventes antérieures payées ce mois{teamShare ? ", part d’équipe" : ""} et primes. Les clients perdus n’y sont pas.</li>
            <li>Va toucher ce mois : le brut moins les clients qui paient plus tard ; versé le 1er du mois suivant.</li>
            <li>Une vente compte dans la rémunération du mois où le client a payé sa première échéance Owner.</li>
            <li>Palier atteint (ventes signées dans le mois, rétractations actées retirées) : toutes ces ventes comptent ce mois-ci, payées ou non, et la personne touche le plus grand de leurs commissions et du montant du palier, fixe en plus.</li>
            <li>Commission : base × coefficient. Base : prix Owner / 12 ; à partir de 6 salariés en cold call, Ads et cold call setter, (total × 80 %) / 12, comme l’Excel.</li>
            {teamShare && <li>Part d’équipe : chaque vente d’un membre de son équipe CRM, au mois où le client paie sa 1re échéance ; base de la vente × {teamCoefficients}.</li>}
            <li>Manque à gagner : ce que la personne aurait pu toucher en plus si les clients des ventes du mois avaient payé (pas encore payés, perdus).</li>
            <li>Dans la paie d’octobre : clients payés le mois suivant ; la commission est dans la rémunération de ce mois-là, pas en plus.</li>
            <li>Barème en vérification.</li>
            {readingDay && <li>Données CRM lues le {readingDay}.</li>}
          </ul>
        </InfoTip>
        <div className="vr-person-actions">
          {onPayslip && !error && (
            <button type="button" className="vr-button" onClick={onPayslip} disabled={payslipBusy}>
              <FileDown size={14} />{payslipBusy ? "Préparation…" : "Relevé PDF"}
            </button>
          )}
          <button type="button" className="vr-button" onClick={onCoefficients}><SlidersHorizontal size={14} />Coefficients</button>
          <button type="button" className="vr-button" onClick={onTiers}><Layers size={14} />Fixe & paliers</button>
          <IconButton label="Historique des modifications" onClick={onHistory}><History size={16} /></IconButton>
        </div>
      </header>

      {error ? (
        <div className="vr-error" role="alert">Calcul bloqué : {error}<button type="button" onClick={onCheckRules}>Vérifier les règles</button></div>
      ) : (
        <div className="vr-pay">
          <div className="vr-pay-side" data-side="paid">
            <div className="vr-pay-head">
              <span className="vr-kicker">Brut du mois</span>
              <strong className="vr-num vr-total"><Roll id={money(brut)} direction={entry.direction}>{money(brut)}</Roll></strong>
            </div>
            <div className="vr-ticket">{ticket?.lines.map(lineView)}</div>
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
        </div>
      )}
    </section>
  );
}
