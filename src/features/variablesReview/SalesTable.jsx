import { useEffect, useRef } from "react";
import { motion as Motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, ChevronDown, Info, Pencil, Search } from "lucide-react";
import { money, Rational } from "./calculation.js";
import { InfoTip } from "./InfoTip.jsx";
import { INDICATOR, ROW, ROW_MAX, ROW_STEP } from "./motion.js";
import { CHANNELS, decimalLabel } from "./presentation.js";
import { AutoHeight } from "./transitions.jsx";
import { IconButton } from "./ui.jsx";

const STATUS_CHIPS = [["ALL", "Toutes"], ["counted", "Comptées"], ["deferred", "Reportées"], ["pending", "En attente"], ["lost", "Perdues"]];
// « Reportées » et « Perdues » n'apparaissent que s'il y en a (ou si le filtre est actif).
const OPTIONAL_CHIPS = new Set(["deferred", "lost"]);
const GROUP_LABELS = { counted: "Comptées", deferred: "Reportées", pending: "En attente d’encaissement", lost: "Perdues" };
const CHANNEL_CHIPS = [...Object.entries(CHANNELS), ["UNKNOWN", "Non retrouvée"]];
const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;

// Les compteurs sont des entiers : remplacés nets, dans la même image que les lignes.
function Chip({ active, count, group, onClick, children }) {
  const reduce = useReducedMotion();
  return (
    <button type="button" className={`vr-chip ${active ? "active" : ""}`} aria-pressed={active} disabled={!count && !active} onClick={onClick}>
      {active && (reduce
        ? <span className="vr-chip-active" />
        : <Motion.span layoutId={`vr-chip-${group}`} className="vr-chip-active" transition={INDICATOR} />)}
      <span className="vr-chip-text">{children}</span>
      <span className="vr-chip-count vr-num">{count}</span>
    </button>
  );
}

// Ventes de la personne pour le mois : filtres en puces, comptées, en attente, perdues.
// Changement de données : l'ancien corps disparaît dans l'image même, le nouveau est déjà là,
// ses lignes entrent par un court déplacement en cascade ; la hauteur suit en ressort.
export function SalesTable({
  readingDay, total, rows, counts, breakdown, filters, onFilters, page, pages, onPage,
  bodyKey, rowEntry, rowDelay, inline, onInline, onDeal, onEdit,
}) {
  const setFilter = (patch) => onFilters({ ...filters, ...patch });
  return (
    <section className="vr-sales" aria-label="Ventes et commissions">
      <div className="vr-sales-head">
        <h3>Ventes & commissions <span className="vr-count vr-num">{total}</span></h3>
        <InfoTip label="Méthode de calcul des ventes" align="start">
          <ul>
            <li>Ventes signées dans le mois (heure de Paris, une seule par lead), et ventes signées avant dont la première échéance est payée dans le mois.</li>
            <li>Une vente compte dans le total du mois où le client a payé sa première échéance Owner, même s’il est en retard ensuite.</li>
            <li>Au mois de sa signature, une vente payée un autre mois apparaît « Reportée », hors total.</li>
            <li>Rapprochement Finance par lead, puis par e-mail unique.</li>
            <li>Barème en vérification, hors commissions de management.</li>
            {readingDay && <li>Données CRM lues le {readingDay}.</li>}
          </ul>
        </InfoTip>
        <div className="vr-search compact">
          <Search size={14} />
          <input aria-label="Rechercher un client" placeholder="Client…" value={filters.query} onChange={(e) => setFilter({ query: e.target.value })} />
        </div>
      </div>
      <div className="vr-card vr-table-card">
        <div className="vr-toolbar">
          <div className="vr-chips" role="group" aria-label="Statut des ventes">
            {STATUS_CHIPS.filter(([key]) => !OPTIONAL_CHIPS.has(key) || counts.status[key] > 0 || filters.status === key).map(([key, label]) => [
              <Chip key={key} group="status" active={filters.status === key} count={counts.status[key]} onClick={() => setFilter({ status: key })}>{label}</Chip>,
              key === "pending" && (
                <InfoTip key="pending-info" label="Détail des ventes en attente">
                  {breakdown.length ? (
                    <dl className="vr-breakdown">
                      {breakdown.map((g) => (
                        <div key={g.key}>
                          <dt>{g.label}{g.hint && <small>{g.hint}</small>}</dt>
                          <dd className="vr-num">{g.count}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : <span>Aucune vente en attente.</span>}
                </InfoTip>
              ),
            ])}
          </div>
          <div className="vr-chips" role="group" aria-label="Catégorie de rémunération">
            {CHANNEL_CHIPS.map(([key, label]) => (
              <Chip key={key} group="channel" active={filters.channel === key} count={counts.channel[key] || 0}
                onClick={() => setFilter({ channel: filters.channel === key ? "ALL" : key })}>{label}</Chip>
            ))}
          </div>
        </div>

        <div className="vr-table" role="table" aria-label="Ventes">
          <div className="vr-row vr-row-head" role="row">
            <span role="columnheader">Client</span>
            <span role="columnheader">Rémunération</span>
            <span role="columnheader">Base × coefficient</span>
            <span role="columnheader" className="end">Commission HT</span>
          </div>
          <AutoHeight>
            <SalesBody key={bodyKey} rows={rows} counts={counts} showGroups={filters.status === "ALL"} rowEntry={rowEntry} rowDelay={rowDelay}
              inline={inline} onInline={onInline} onDeal={onDeal} onEdit={onEdit} />
            {!rows.length && <div className="vr-empty">Aucune vente correspondante</div>}
          </AutoHeight>
        </div>

        <footer className="vr-table-footer">
          <span>{plural(counts.status[filters.status] ?? 0, "vente")}</span>
          {pages > 1 && (
            <div className="vr-pager">
              <IconButton label="Page précédente" disabled={page <= 1} onClick={() => onPage(page - 1)}><ArrowLeft size={14} /></IconButton>
              <span className="vr-num">{page} / {pages}</span>
              <IconButton label="Page suivante" disabled={page >= pages} onClick={() => onPage(page + 1)}><ArrowRight size={14} /></IconButton>
            </div>
          )}
        </footer>
      </div>
    </section>
  );
}

// Corps du tableau, remonté à chaque changement de personne, de mois, de filtre ou de page.
// Seules les lignes présentes à l'ouverture entrent en cascade (30 ms, plafonnée à 8 lignes) ;
// une ligne qui apparaît ensuite (recherche) s'affiche directement à sa place.
function SalesBody({ rows, counts, showGroups, rowEntry, rowDelay, inline, onInline, onDeal, onEdit }) {
  const reduce = useReducedMotion();
  const opening = useRef(true);
  useEffect(() => { opening.current = false; }, []);
  let index = 0;
  return (
    <div role="rowgroup" className="vr-table-body">
      {rows.map((row, i) => {
        const group = showGroups && (i === 0 || rows[i - 1].status !== row.status);
        const delay = rowDelay + Math.min(index++, ROW_MAX - 1) * ROW_STEP;
        const motionProps = {
          initial: opening.current && rowEntry && !reduce ? rowEntry : false,
          animate: { x: 0, y: 0, transition: { ...ROW, delay } },
        };
        return [
          group && (
            <Motion.div key={`group-${row.status}`} role="row" className={`vr-row-group ${row.status}`} {...motionProps}>
              <span role="cell">{GROUP_LABELS[row.status]}<b className="vr-num">{counts.status[row.status]}</b></span>
            </Motion.div>
          ),
          <SaleRow key={row.ref} row={row} motionProps={motionProps} inline={inline?.ref === row.ref ? inline : null}
            onInline={onInline} onDeal={onDeal} onEdit={onEdit} />,
        ];
      })}
    </div>
  );
}

function SaleRow({ row, motionProps, inline, onInline, onDeal, onEdit }) {
  const meta = [row.range || "Tranche non renseignée", row.origin, row.signedLabel && `signée le ${row.signedLabel}`].filter(Boolean);
  const amount = inline ? (inline.preview ?? "À vérifier") : row.value;
  return (
    <Motion.div role="row" className={`vr-row ${row.status} ${row.edited ? "edited" : ""} ${inline ? "editing" : ""}`} {...motionProps}>
      <div role="cell" className="vr-cell-client">
        <div className="vr-client-line">
          <strong title={row.client}>{row.client}</strong>
          <SalePills row={row} />
        </div>
        <div className="vr-client-meta">{meta.join(" · ")}</div>
      </div>
      <div role="cell" className="vr-cell-channel">
        <button type="button" className={`vr-channel ${row.channel.toLowerCase()}`} onClick={() => onDeal(row)}>
          {CHANNELS[row.channel] || "Non retrouvée"}<ChevronDown size={11} />
        </button>
        <small>{row.plan === "A" ? "Annuelle" : "Mensuelle"}{row.overridden && ` · origine ${CHANNELS[row.originChannel] || row.originLabel || "non retrouvée"}`}</small>
      </div>
      <div role="cell" className="vr-cell-calc">
        {row.parts.kind === "coefficient" ? (
          <>
            <span className="vr-num vr-base">{money(Rational.from(row.parts.base))}</span>
            <span className="vr-times">×</span>
            {inline ? (
              <CoefficientField row={row} inline={inline} onInline={onInline} />
            ) : (
              <button type="button" className="vr-coef vr-num" aria-label={`Modifier le coefficient de ${row.client}`} title="Modifier le coefficient"
                onClick={() => onInline.start(row)}>
                {decimalLabel(row.parts.coefficient)}<Pencil size={11} />
              </button>
            )}
          </>
        ) : (
          <button type="button" className="vr-custom" onClick={() => onEdit(row.ref, row.client)}>{row.parts.label}<Pencil size={11} /></button>
        )}
        {row.exception && <small className="vr-tag">Calcul individuel</small>}
      </div>
      <div role="cell" className="vr-cell-amount">
        <button type="button" className="vr-amount vr-num" onClick={() => onEdit(row.ref, row.client)} title="Plus d’options">{amount}</button>
      </div>
    </Motion.div>
  );
}

// Pastilles d'une vente : statut Finance, puis mois croisé (« Signée en septembre »,
// « Comptée en octobre »). Une seule pastille ouvre le détail, la chronologie de la vente
// (« Signée le 30/09 · 1re échéance octobre · payée le 22/10 ») ou l'explication du statut.
function SalePills({ row }) {
  const pill = (label, tone, detail) => (detail ? (
    <InfoTip label={label} triggerClassName={`vr-pill ${tone}`} trigger={<>{label}<Info size={11} strokeWidth={2.4} /></>}>
      <span>{detail}</span>
    </InfoTip>
  ) : <span className={`vr-pill ${tone}`}>{label}</span>);
  const financeDetail = row.finance.hint || (!row.crossMonth && row.paidInfo ? row.timeline : null);
  return (
    <>
      {pill(row.finance.label, row.finance.tone, financeDetail)}
      {row.crossMonth && pill(row.crossMonth, "month", row.timeline)}
    </>
  );
}

// Saisie en ligne : Entrée valide, Échap annule, sortir du champ valide une valeur modifiée.
// La commission se recalcule pendant la frappe ; « Plus d’options » ouvre la fenêtre complète.
function CoefficientField({ row, inline, onInline }) {
  const settled = useRef(false);
  const finish = (save) => {
    if (settled.current) return;
    settled.current = true;
    if (save) onInline.commit(row);
    else onInline.cancel();
  };
  return (
    <span className="vr-coef-edit">
      <input
        autoFocus
        inputMode="decimal"
        className={`vr-num ${inline.valid ? "" : "invalid"}`}
        aria-label={`Coefficient de ${row.client}`}
        aria-invalid={!inline.valid}
        value={inline.text}
        disabled={inline.saving}
        onFocus={(e) => e.target.select()}
        onChange={(e) => onInline.change(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); if (inline.valid) finish(true); }
          else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(false); }
        }}
        onBlur={(e) => { if (!e.relatedTarget?.closest?.(".vr-coef-more")) finish(inline.valid); }}
      />
      <button type="button" className="vr-coef-more" onMouseDown={(e) => e.preventDefault()}
        onClick={() => { settled.current = true; onInline.more(row); }}>
        Plus d’options
      </button>
    </span>
  );
}
