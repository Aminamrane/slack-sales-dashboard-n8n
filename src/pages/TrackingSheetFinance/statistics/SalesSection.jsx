import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  ArrowDown, ArrowUpRight, Banknote, Building2, CalendarDays, ChevronRight, CircleCheck, FileText, Megaphone, ReceiptText, Search, Target, User, Users, Wallet, X,
} from 'lucide-react';
import { useDrawn } from '../../../components/perfSales/motion.jsx';
import {
  ORIGIN_GROUPS, PAYMENT_ORDER, count, dayShort, eur, filterSales, originColor, originDetail, originGroups, originTone, paymentMeta,
  paymentNote, pct, plural, statusCounts, sumBy,
} from './model.js';
import { monthLabel } from './period.js';
import { Avatar, Card, Collapse, Fill, Num, Pill, ProgressRing } from './parts.jsx';

const euros = (n) => eur(Math.round(n));
const TONE_COLOR = { green: '#6cc493', red: '#ee8f8a', blue: '#8fbdf3', amber: '#f1b76a', grey: '#b5b0a8', ghost: '#dedad3' };
const COLUMNS = [
  { label: 'Date', Icon: CalendarDays, title: 'Jour où la vente est comptée' }, { label: 'Client', Icon: Building2 }, { label: 'Sales', Icon: User }, { label: 'Origine', Icon: Megaphone },
  { label: 'Contrat annuel HT', Icon: FileText, num: true }, { label: 'Cash à la signature', Icon: Banknote, num: true }, { label: 'Encaissé', Icon: Wallet, num: true },
  { label: 'Paiement', Icon: CircleCheck },
];
const SPRING = { type: 'spring', stiffness: 520, damping: 40 };

// ── Objectif du mois et paiement des ventes ─────────────────────────────────────────────────────────
export function GoalCard({ state, status, onStatus }) {
  const drawn = useDrawn();
  const data = state.data;
  const goal = data?.goal || {};
  const totals = data?.totals || {};
  const months = data?.period?.months || 1;
  const left = goal.target != null ? goal.target - (goal.sales || 0) : null;
  const statuses = PAYMENT_ORDER.filter((key) => totals[key] > 0);

  return (
    <Card title="Objectif et paiements" Icon={Target} state={state} skeleton={420}
      hint="Les ventes comptées sur la période, et ce qu’elles ont déjà rapporté.">
      <div className="fst-goal">
        <ProgressRing value={goal.target ? (goal.sales || 0) / goal.target : 0} color={left != null && left <= 0 ? 'var(--green)' : 'var(--charcoal)'}
          label={goal.target ? `${goal.sales} ventes sur ${goal.target}` : `${goal.sales || 0} ventes`}>
          <Num className="fst-ring-num" value={goal.sales} />
          <div className="fst-ring-sub">{goal.target ? `sur ${count(goal.target)}` : 'ventes'}</div>
        </ProgressRing>
        <div style={{ minWidth: 0 }}>
          {goal.target ? (
            <>
              <Num className="fst-rate-big" value={goal.rate} format={(n) => pct(n, 0)} />
              <div className="fst-rate-note">
                {left > 0 ? `Encore ${plural(left, 'vente')} pour l’objectif` : left === 0 ? 'Objectif atteint' : `Objectif dépassé de ${plural(-left, 'vente')}`}
              </div>
            </>
          ) : <div className="fst-rate-note">Pas d’objectif saisi sur cette période.</div>}
        </div>
      </div>

      {months > 1 && goal.months?.length > 0 && (
        <dl className="fst-kv">
          {goal.months.map((month) => (
            <React.Fragment key={month.month}>
              <dt style={{ textTransform: 'capitalize' }}>{monthLabel(month.month)}</dt>
              <dd className="fst-num">{count(month.sales)}{month.target != null ? ` / ${count(month.target)}` : ''}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}

      <div className="fst-split" aria-hidden="true">
        {statuses.map((key) => (
          <i key={key} style={{ flexGrow: drawn ? totals[key] : 0, flexBasis: 0, background: TONE_COLOR[paymentMeta(key).tone], opacity: status === 'all' || status === key ? 1 : 0.25 }} />
        ))}
      </div>
      <div className="fst-legend">
        {statuses.map((key) => (
          <button key={key} type="button" className="fst-legend-row" aria-pressed={status === key} onClick={() => onStatus(status === key ? 'all' : key)}
            title="Voir ces ventes dans le détail">
            <span className="fst-dot" style={{ background: TONE_COLOR[paymentMeta(key).tone] }} />
            {paymentMeta(key).label}
            <b className="fst-num">{count(totals[key])}</b>
            <small className="fst-num">{pct(totals.sales ? totals[key] / totals.sales : 0, 0)}</small>
          </button>
        ))}
      </div>

      <dl className="fst-kv">
        <dt>Déjà encaissé sur ces ventes</dt><dd><Num value={totals.received_eur} format={euros} /></dd>
        <dt>Cash à la signature</dt><dd><Num value={totals.cash_eur} format={euros} /></dd>
        <dt>Contrats signés, annuel HT</dt><dd><Num value={totals.revenue_eur} format={euros} /></dd>
      </dl>
    </Card>
  );
}

// ── Ventes par origine ──────────────────────────────────────────────────────────────────────────────
function OriginRow({ origin, open, onToggle, onHover, onSee }) {
  const paidNote = [origin.paid ? `${count(origin.paid)} ${origin.paid > 1 ? 'ont payé' : 'a payé'}` : null,
    origin.unpaid ? `${count(origin.unpaid)} pas encore` : null, origin.retracted ? `${plural(origin.retracted, 'rétractée')}` : null].filter(Boolean).join(' · ');
  return (
    <div onMouseEnter={() => onHover(origin.key)} onMouseLeave={() => onHover(null)}>
      <button type="button" className="fst-row" aria-expanded={open} onClick={onToggle}>
        <span className="fst-row-ico"><span className="fst-dot" style={{ background: origin.color }} /></span>
        <span className="fst-row-name">{origin.label}<small>{paidNote || 'Aucun paiement pour l’instant'}</small></span>
        <Fill value={origin.share} color={origin.color} />
        <span className="fst-row-num fst-num">{count(origin.sales)}<small>{pct(origin.share, 0)}</small></span>
        <ChevronRight size={14} className="fst-chev" />
      </button>
      <Collapse open={open}>
        <div className="fst-sub-list">
          {origin.definition && <p className="fst-card-hint" style={{ margin: '2px 8px 6px' }}>{origin.definition}</p>}
          {(origin.details || []).map((detail) => (
            <div key={detail.label} className="fst-sub-row">
              <span title={detail.label}>{detail.label}</span>
              <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>
                {detail.paid ? `${count(detail.paid)} payé${detail.paid > 1 ? 's' : ''}` : ''}{detail.paid && detail.unpaid ? ' · ' : ''}{detail.unpaid ? `${count(detail.unpaid)} pas encore` : ''}
              </span>
              <b className="fst-num">{count(detail.sales)}</b>
            </div>
          ))}
          <div className="fst-sub-row" style={{ color: 'var(--muted)' }}>
            <span>Déjà encaissé</span><span /><b className="fst-num">{eur(origin.received_eur)}</b>
          </div>
          <button type="button" className="fst-link" onClick={onSee}>Voir {origin.sales > 1 ? `ces ${count(origin.sales)} ventes` : 'cette vente'}<ArrowDown size={13} /></button>
        </div>
      </Collapse>
    </div>
  );
}

export function OriginsCard({ state, onSee }) {
  const drawn = useDrawn();
  const [open, setOpen] = useState(null);
  const [hover, setHover] = useState(null);
  const groups = useMemo(() => originGroups(state.data?.by_origin), [state.data]);
  const total = state.data?.totals?.sales || 0;

  return (
    <Card title="D’où viennent les ventes" Icon={Megaphone} state={state} skeleton={360}
      hint="Même classement que le Suivi des ventes : publicité, initiative d’un setter, autres canaux.">
      {total === 0 ? <div className="fst-empty">Aucune vente comptée sur cette période.</div> : (
        <>
          <div className="fst-stack" data-focus={hover || open || undefined} aria-hidden="true">
            {groups.flatMap((group) => group.items).map((origin) => (
              <i key={origin.key} data-on={origin.key === (hover || open) || undefined} title={`${origin.label} : ${origin.sales}`}
                style={{ flexGrow: drawn ? origin.sales : 0, flexBasis: 0, background: origin.color }} />
            ))}
          </div>
          {groups.map((group) => (
            <div key={group.key} className="fst-group">
              <div className="fst-group-head">
                <span className="fst-group-name">{group.label}</span>
                <span className="fst-group-chip fst-num">{pct(group.share, 0)}</span>
                <span className="fst-group-count fst-num" title={`${plural(group.sales, 'vente')} sur ${count(total)}`}><b>{count(group.sales)}</b><i>/</i>{count(total)}</span>
              </div>
              {group.items.map((origin) => (
                <OriginRow key={origin.key} origin={origin} open={open === origin.key} onHover={setHover}
                  onToggle={() => setOpen(open === origin.key ? null : origin.key)} onSee={() => onSee({ origin: origin.key })} />
              ))}
            </div>
          ))}
        </>
      )}
    </Card>
  );
}

// ── Ventes par sales, découpées par origine ─────────────────────────────────────────────────────────
export function PeopleCard({ state, person, onPerson }) {
  const drawn = useDrawn();
  const people = (state.data?.by_sales_person || []).filter((p) => p.sales > 0);
  const largest = Math.max(1, ...people.map((p) => p.sales));
  const order = ORIGIN_GROUPS.flatMap((group) => group.sources);
  const labels = new Map((state.data?.by_origin || []).map((o) => [o.key, o.label]));
  const present = order.filter((key) => people.some((p) => p.by_origin?.[key]));

  return (
    <Card title="Par sales" Icon={Users} state={state} skeleton={360} hint="Chaque barre est découpée par origine. Un clic filtre le détail.">
      {people.length === 0 ? <div className="fst-empty">Aucune vente comptée sur cette période.</div> : (
        <>
          {people.map((p) => (
            <button key={p.name} type="button" className="fst-hbar" data-on={person === p.name || undefined} aria-pressed={person === p.name}
              onClick={() => onPerson(person === p.name ? null : p.name)}>
              <span className="fst-tip" role="presentation">
                <b>{p.name}</b><br />
                {order.filter((key) => p.by_origin?.[key]).map((key) => <React.Fragment key={key}>{labels.get(key) || key} <span>· {p.by_origin[key]}</span><br /></React.Fragment>)}
                <span>{count(p.paid || 0)} payé{p.paid > 1 ? 's' : ''} · {eur(p.received_eur)} encaissé</span>
              </span>
              <Avatar name={p.name} />
              <span className="fst-hbar-name">{p.name}</span>
              <span className="fst-hbar-track" style={{ width: `${(p.sales / largest) * 100}%` }}>
                {order.filter((key) => p.by_origin?.[key]).map((key) => (
                  <i key={key} style={{ width: `${drawn ? (p.by_origin[key] / p.sales) * 100 : 0}%`, background: originColor(key) }} />
                ))}
              </span>
              <span className="fst-hbar-num fst-num">{count(p.sales)}</span>
            </button>
          ))}
          <div className="fst-keys">
            {present.map((key) => (
              <span key={key}>
                <span className="fst-dot" style={{ background: originColor(key) }} />{labels.get(key) || key}
              </span>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ── Détail des ventes ───────────────────────────────────────────────────────────────────────────────
const PAGE = 25;

export function SalesTable({ state, filter, setFilter, canOpen, onOpenClient, anchorRef }) {
  const lines = useMemo(() => state.data?.sales || [], [state.data]);
  const scoped = useMemo(() => filterSales(lines, { ...filter, status: 'all' }), [lines, filter]);
  const rows = useMemo(() => filterSales(lines, filter), [lines, filter]);
  const counts = useMemo(() => statusCounts(scoped), [scoped]);
  const signature = JSON.stringify(filter) + (state.data?.period?.from || '') + (state.data?.period?.to || '');
  const [page, setPage] = useState({ signature: '', shown: PAGE });
  const shown = page.signature === signature ? page.shown : PAGE;
  const labels = new Map((state.data?.by_origin || []).map((o) => [o.key, o.label]));
  const tabs = [{ key: 'all', label: 'Toutes' }, ...PAYMENT_ORDER.filter((key) => counts[key] > 0 || filter.status === key).map((key) => ({ key, label: paymentMeta(key).label }))];
  const chips = [
    filter.origin && { key: 'origin', label: labels.get(filter.origin) || filter.origin },
    filter.group && { key: 'group', label: ORIGIN_GROUPS.find((g) => g.key === filter.group)?.label },
    filter.person && { key: 'person', label: filter.person },
  ].filter(Boolean);

  return (
    <Card title="Détail des ventes" Icon={ReceiptText} state={state} skeleton={320}
      hint="Chaque vente comptée sur la période, ce qu’elle a rapporté et si le client a déjà payé." ref={anchorRef} style={{ scrollMarginTop: 78 }}>
      <div className="fst-tools">
        <div className="fst-tabs" role="group" aria-label="Paiement">
          {tabs.map((tab) => (
            <button key={tab.key} type="button" className="fst-tab" aria-pressed={filter.status === tab.key} onClick={() => setFilter({ ...filter, status: tab.key })}>
              {filter.status === tab.key && <Motion.span layoutId="fst-sales-tab" className="fst-tab-bg" transition={SPRING} />}
              <span>{tab.label}</span><span className="fst-tab-count fst-num">{count(counts[tab.key] || 0)}</span>
            </button>
          ))}
        </div>
        <AnimatePresence initial={false}>
          {chips.map((chip) => (
            <Motion.button key={chip.key} type="button" className="fst-chip" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }} onClick={() => setFilter({ ...filter, [chip.key]: null })} title="Retirer ce filtre">
              {chip.label}<X size={13} />
            </Motion.button>
          ))}
        </AnimatePresence>
        <label className="fst-search">
          <Search size={14} />
          <input type="search" placeholder="Client, sales, origine, n°…" value={filter.query} onChange={(e) => setFilter({ ...filter, query: e.target.value })} aria-label="Chercher une vente" />
        </label>
      </div>

      <div className="fst-table-box">
        <div className="fst-table-scroll">
          <table className="fst-table">
            <thead>
              <tr>
                {COLUMNS.map(({ label, Icon, num, title }) => (
                  <th key={label} className={num ? 'is-num' : undefined} title={title}><span className="fst-th"><Icon size={14} strokeWidth={1.8} />{label}</span></th>
                ))}
              </tr>
            </thead>
            <tbody key={signature}>
              {rows.slice(0, shown).map((line, i) => {
                const meta = paymentMeta(line.payment?.status);
                const detail = originDetail(line);
                const openable = Boolean(line.client_id) && canOpen(line.client_id);
                const owner = line.payment?.received_owner_eur || 0;
                const partner = line.payment?.received_partner_eur || 0;
                return (
                  <tr key={line.sale_id} style={{ '--i': i % PAGE }} data-open={openable || undefined} onClick={openable ? () => onOpenClient(line.client_id) : undefined}
                    title={openable ? 'Ouvrir la fiche du client' : undefined}>
                    <td className="fst-num fst-cell-muted">{dayShort(line.counted_at)}</td>
                    <td>
                      <div className="fst-cell-main">{line.client || 'Sans nom'}{openable && <span className="fst-open" aria-hidden="true"><ArrowUpRight size={14} /></span>}</div>
                      <div className="fst-cell-sub">{line.numero_client ? `n° ${line.numero_client}` : 'Pas de fiche client'}{line.headcount ? ` · ${plural(line.headcount, 'salarié')}` : ''}</div>
                    </td>
                    <td>{line.sales_person ? <span className="fst-who"><Avatar name={line.sales_person} />{line.sales_person}</span> : <span className="fst-cell-muted">–</span>}</td>
                    <td>
                      <span className="fst-tag" data-tone={originTone(line.origin)}>{line.origin_label || labels.get(line.origin) || line.origin}</span>
                      {detail && <div className="fst-cell-sub">{detail}</div>}
                    </td>
                    <td className="is-num fst-num">{eur(line.amount_eur)}</td>
                    <td className="is-num fst-num">{line.cash_eur ? eur(line.cash_eur) : <span style={{ color: 'var(--faint)' }}>–</span>}</td>
                    <td className="is-num fst-num">
                      <span style={{ fontWeight: owner ? 500 : 400, color: owner ? 'var(--ink)' : 'var(--faint)' }}>{owner ? eur(owner) : '–'}</span>
                      {partner > 0 && <div className="fst-cell-sub">+ {eur(partner)} Opti’Lex</div>}
                    </td>
                    <td>
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                      {paymentNote(line.payment) && <div className="fst-cell-sub">{paymentNote(line.payment)}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4}>{plural(rows.length, 'vente')}{rows.length !== lines.length ? ` sur ${count(lines.length)}` : ''}</td>
                  <td className="is-num fst-num">{eur(sumBy(rows, (l) => l.amount_eur))}</td>
                  <td className="is-num fst-num">{eur(sumBy(rows, (l) => l.cash_eur))}</td>
                  <td className="is-num fst-num">{eur(sumBy(rows, (l) => l.payment?.received_owner_eur))}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {rows.length === 0 && <div className="fst-empty">{lines.length ? 'Aucune vente ne correspond à ces filtres.' : 'Aucune vente comptée sur cette période.'}</div>}
        {rows.length > shown && (
          <div className="fst-more">
            <button type="button" onClick={() => setPage({ signature, shown: shown + PAGE * 2 })}>Afficher les {count(Math.min(PAGE * 2, rows.length - shown))} suivantes</button>
          </div>
        )}
      </div>
    </Card>
  );
}
