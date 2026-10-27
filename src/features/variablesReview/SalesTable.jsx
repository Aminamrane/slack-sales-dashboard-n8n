import { useEffect, useRef, useState } from "react";
import { motion as Motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, ChevronDown, MoreHorizontal, Pencil, Search } from "lucide-react";
import { money, Rational } from "./calculation.js";
import { ChannelIcon } from "./ChannelIcon.jsx";
import { InfoTip } from "./InfoTip.jsx";
import { INDICATOR, ROW, ROW_MAX, ROW_STEP } from "./motion.js";
import { CHANNELS, decimalLabel, euros, rowStatus } from "./presentation.js";
import { StatusIcon, StatusPill } from "./StatusIcon.jsx";
import { groupSections, saleGroup } from "./team.js";
import { AutoHeight, Collapse } from "./transitions.jsx";
import { IconButton } from "./ui.jsx";

// Mêmes mots et mêmes couleurs que les groupes et la carte : où va l'argent.
const STATUS_CHIPS = [["ALL", "Toutes"], ["counted", "Dans la paie", "paid"], ["deferred", "Paie suivante", "later"],
  ["pending", "Pas encore payées", "waiting"], ["lost", "Perdues", "lost"]];
// « Paie suivante » et « Perdues » n'apparaissent que s'il y en a (ou si le filtre est actif).
const OPTIONAL_CHIPS = new Set(["deferred", "lost"]);
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

// Ventes de la personne pour le mois, en liste : un groupe par destination de l'argent (dans la paie du mois,
// dans une paie suivante, pas encore payées, perdues), chaque vente avec son statut en pastille et son montant.
// Changement de données : l'ancien corps disparaît dans l'image même, le nouveau est déjà là,
// ses lignes entrent par un court déplacement en cascade ; la hauteur suit en ressort.
export function SalesTable({
  readingDay, period, groups, total, rows, counts, breakdown, filters, onFilters, page, pages, onPage,
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
            <li>Une vente entre dans la paie du mois où le client a payé sa première échéance Owner, même s’il est en retard ensuite.</li>
            <li>Commission = base × coefficient. Base : prix Owner / 12 ; « 80 % » : à partir de 6 salariés en cold call, Ads et cold call setter, (total × 80 %) / 12, total = prix Owner / 0,7. Formule au survol.</li>
            <li>Icône : canal d’origine du lead (légende dans les puces), modifiable au clic.</li>
            <li>Rapprochement Finance par lead, puis par e-mail unique.</li>
            <li>Barème en vérification. Ventes de la personne seulement ; la part d’équipe d’un head a son propre tableau.</li>
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
            {STATUS_CHIPS.filter(([key]) => !OPTIONAL_CHIPS.has(key) || counts.status[key] > 0 || filters.status === key).map(([key, label, tone]) => [
              <Chip key={key} group="status" active={filters.status === key} count={counts.status[key]} onClick={() => setFilter({ status: key })}>
                {tone && <StatusIcon tone={tone} size={14} />}{label}
              </Chip>,
              key === "pending" && (
                <InfoTip key="pending-info" label="Détail des ventes pas encore payées">
                  {breakdown.length ? (
                    <dl className="vr-breakdown">
                      {breakdown.map((g) => (
                        <div key={g.key}>
                          <dt>{g.label}{g.hint && <small>{g.hint}</small>}</dt>
                          <dd className="vr-num">{g.count}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : <span>Aucune vente pas encore payée.</span>}
                </InfoTip>
              ),
            ])}
          </div>
          <div className="vr-chips" role="group" aria-label="Canal d’origine">
            {CHANNEL_CHIPS.map(([key, label]) => (
              <Chip key={key} group="channel" active={filters.channel === key} count={counts.channel[key] || 0}
                onClick={() => setFilter({ channel: filters.channel === key ? "ALL" : key })}><ChannelIcon channel={key} size={14} />{label}</Chip>
            ))}
          </div>
        </div>

        <div className="vr-table" role="table" aria-label="Ventes">
          <AutoHeight>
            <SalesBody key={bodyKey} rows={rows} groups={groups} period={period} rowEntry={rowEntry} rowDelay={rowDelay}
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

// En-tête de groupe : icône et titre dans la couleur du statut, nombre de ventes, total aligné sur les montants.
// onToggle : le groupe s'ouvre et se ferme au clic (chevron) ; sub : intertitre dans un groupe (ventes signées un
// mois précédent, dans la même paie), jamais repliable.
export function GroupHeader({ text, total, sub = false, groupKey, open = true, onToggle, motionProps }) {
  const content = (
    <>
      <span className="vr-group-title">
        {!sub && <StatusIcon tone={text.tone} size={16} />}
        <strong>{text.title}</strong>
        <small>{text.subtitle}</small>
      </span>
      <span className="vr-group-end">
        {total && <span className="vr-group-total vr-num">{money(total)}</span>}
        {onToggle && <ChevronDown size={16} className="vr-group-chevron" aria-hidden="true" />}
      </span>
    </>
  );
  const className = `vr-group ${text.tone} ${sub ? "sub" : ""} ${open ? "open" : "closed"}`;
  return onToggle ? (
    <Motion.button type="button" className={className} data-group={groupKey} aria-expanded={open} onClick={onToggle} {...motionProps}>
      {content}
    </Motion.button>
  ) : (
    <Motion.div role="row" className={className} data-group={groupKey} {...motionProps}>{content}</Motion.div>
  );
}

// Liste en sections repliables (ventes et part d'équipe) : en-tête toujours visible, lignes dans un Collapse.
// initialOpen(clé) : ouvert au départ ; focus : groupe à ouvrir sur demande (lien depuis la carte).
// Remonté à chaque changement de personne, de mois, de filtre ou de page : les lignes présentes à l'ouverture
// entrent en cascade (30 ms, plafonnée) ; ensuite, ouvrir ou fermer un groupe ne fait bouger que sa hauteur.
export function SectionList({ rows, stats, period, laterMonths, rowEntry, rowDelay, initialOpen = () => true, focus, renderRow }) {
  const reduce = useReducedMotion();
  const sections = groupSections(rows, stats, period, laterMonths);
  const [open, setOpen] = useState(() => Object.fromEntries(sections.map((s) => [s.key, initialOpen(s.key)])));
  const opening = useRef(true);
  const list = useRef(null);
  useEffect(() => { opening.current = false; }, []);
  // Lien depuis la carte : un seul mouvement. La section s'ouvre d'un coup (sans déplier), puis la page glisse
  // jusqu'à son en-tête ; un dépliage pendant le défilement l'interromprait. Un clic sur l'en-tête, lui, déplie.
  const [instant, setInstant] = useState(null);
  const scrollTo = useRef(null);
  useEffect(() => {
    if (!focus?.key) return;
    scrollTo.current = focus.key;
    setInstant(focus.key);
    setOpen((o) => ({ ...o, [focus.key]: true }));
  }, [focus]);
  // Le défilement part une fois la section ouverte dans la page (sinon sa cible est calculée trop tôt).
  useEffect(() => {
    const key = scrollTo.current;
    if (!key || !open[key]) return undefined;
    scrollTo.current = null;
    const frame = requestAnimationFrame(() => list.current?.querySelector(`[data-section="${key}"]`)
      ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [open, reduce]);
  let index = 0;
  const motion = () => {
    const delay = rowDelay + Math.min(index++, ROW_MAX - 1) * ROW_STEP;
    return { initial: opening.current && rowEntry && !reduce ? rowEntry : false, animate: { x: 0, y: 0, transition: { ...ROW, delay } } };
  };
  return (
    <div role="rowgroup" className="vr-table-body" ref={list}>
      {sections.map((section) => {
        const isOpen = open[section.key] ?? true;
        return (
          <div key={section.key} className="vr-section" data-section={section.key}>
            <GroupHeader text={section.text} total={section.total} groupKey={section.key} open={isOpen} motionProps={motion()}
              onToggle={() => { setInstant(null); setOpen((o) => ({ ...o, [section.key]: !isOpen })); }} />
            <Collapse open={isOpen} instant={instant === section.key}>
              {section.items.map((item) => (item.type === "sub"
                ? <GroupHeader key={`sub-${item.key}`} text={item.text} total={item.total} sub groupKey={item.key} motionProps={motion()} />
                : renderRow(item.row, motion())))}
            </Collapse>
          </div>
        );
      })}
    </div>
  );
}

// Ventes de la personne : toutes les sections ouvertes.
function SalesBody({ rows, groups, period, rowEntry, rowDelay, inline, onInline, onDeal, onEdit }) {
  const laterMonths = [...new Set(rows.filter((r) => r.status === "deferred").map((r) => r.countedMonth).filter(Boolean))];
  return (
    <SectionList rows={rows} stats={groups} period={period} laterMonths={laterMonths} rowEntry={rowEntry} rowDelay={rowDelay}
      renderRow={(row, motionProps) => (
        <SaleLine key={row.ref} row={row} motionProps={motionProps} inline={inline?.ref === row.ref ? inline : null}
          onInline={onInline} onDeal={onDeal} onEdit={onEdit} meta={<SaleMeta row={row} plan />} />
      )} />
  );
}

// Une vente : à gauche l'origine (icône) et le client, avec une seule ligne de détail ; au milieu le statut
// (pastille) ; à droite le montant et, dessous, son calcul. Canal, coefficient et montant se modifient au clic.
export function SaleLine({ row, motionProps, inline, onInline, onDeal, onEdit, meta, label }) {
  const amount = inline ? (inline.preview ?? "À vérifier") : row.value;
  const editLabel = label || row.client;
  return (
    <Motion.div role="row" className={`vr-line ${row.status} ${row.edited ? "edited" : ""} ${inline ? "editing" : ""}`} data-group={saleGroup(row)} {...motionProps}>
      <div role="cell" className="vr-line-client">
        <OriginMark row={row} onDeal={onDeal} />
        <span className="vr-line-text">
          <strong title={row.client}>{row.client}</strong>
          <span className="vr-line-meta">{meta}</span>
        </span>
      </div>
      <div role="cell" className="vr-line-status"><StatusPill status={rowStatus(row)} /></div>
      <div role="cell" className="vr-line-amount">
        <button type="button" className="vr-amount vr-num" onClick={() => onEdit(row.ref, editLabel)} title="Modifier ce montant">{amount}</button>
        <CalcLine row={row} inline={inline} onInline={onInline} onEdit={onEdit} label={editLabel} />
      </div>
    </Motion.div>
  );
}

// Ligne de détail sous le client : date de signature (en couleur si un mois précédent), tranche, paiement.
// prefix : vendeur (part d'équipe) ; plan : mensuel / annuel (absent de la part d'équipe).
export function SaleMeta({ row, plan = false, prefix = null }) {
  return (
    <>
      {prefix}
      <span className={`vr-meta-signed ${row.signedBefore ? "earlier" : ""}`} title={row.timeline}>Signée le {row.signedDay || "?"}</span>
      <span>{row.range ? `${row.range} salariés` : "Tranche non renseignée"}</span>
      {plan && <span>{row.plan === "A" ? "annuel" : "mensuel"}</span>}
      {row.exception && <span className="vr-meta-flag">calcul individuel</span>}
      {row.boardLost && row.status !== "lost" && (
        <span className="vr-meta-board" title="Client fini au board après le paiement de sa 1re échéance : la commission reste due (règle du 25/10).">
          board : {row.boardState}
        </span>
      )}
    </>
  );
}

// Canal d'origine en icône (légende : les puces du haut) ; nom du canal et origine du lead au survol.
// Modifiable si onDeal ; un canal corrigé à la main porte un point.
function OriginMark({ row, onDeal }) {
  const name = CHANNELS[row.channel] || "Canal non retrouvé";
  const title = [name, row.origin && `origine du lead : ${row.origin}`, row.overridden && `corrigé, origine ${CHANNELS[row.originChannel] || "non retrouvée"}`]
    .filter(Boolean).join(" · ");
  const className = `vr-origin ${row.overridden ? "overridden" : ""}`;
  return onDeal
    ? <button type="button" className={className} onClick={() => onDeal(row)} title={`${title} · modifier`} aria-label={`${name}, modifier le canal`}><ChannelIcon channel={row.channel} size={17} /></button>
    : <span className={className} title={title} role="img" aria-label={name}><ChannelIcon channel={row.channel} size={17} /></span>;
}

// Calcul sous le montant : « 80 % » pour la base total × 80 % de l'Excel (formule au survol), base × coefficient.
// Le coefficient se modifie en ligne (onInline) ou dans la fenêtre (onEdit). Formule libre : son libellé.
function CalcLine({ row, inline, onInline, onEdit, label }) {
  if (row.parts.kind !== "coefficient")
    return <button type="button" className="vr-calc vr-calc-custom" onClick={() => onEdit(row.ref, label)}>{row.parts.label}<Pencil size={10} /></button>;
  return (
    <span className="vr-calc vr-num" title={row.baseCaption || undefined}>
      {row.baseTotal && <span className="vr-base-tag">80 %</span>}
      <span>{euros(Rational.from(row.parts.base))} ×</span>
      {inline ? <CoefficientField row={row} inline={inline} onInline={onInline} /> : (
        <button type="button" className="vr-coef-text" aria-label={`Modifier le coefficient de ${row.client}`} title="Modifier le coefficient"
          onClick={() => (onInline ? onInline.start(row) : onEdit(row.ref, label))}>
          {decimalLabel(row.parts.coefficient)}<Pencil size={10} />
        </button>
      )}
    </span>
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
      <button type="button" className="vr-coef-more" aria-label="Plus d’options" title="Plus d’options" onMouseDown={(e) => e.preventDefault()}
        onClick={() => { settled.current = true; onInline.more(row); }}>
        <MoreHorizontal size={14} />
      </button>
    </span>
  );
}
