// ReceiptsView.jsx — onglet « Encaissements » : les derniers montants récupérés.
//
// Demande dev 2026-09-03 : « un vrai onglet qui recense les derniers montants
// récupérés — le nom de la société, le montant récupéré, à quelle date, quand
// il a été saisi, par qui. » Il remplace « Par état » et « Mes clients », qui
// ne pilotaient rien.
//
// Source : GET /finance-periods/receipts — la saisie dans la page (signée de
// son auteur) et la détection par le sync du classeur (sans auteur), fondues
// en un seul journal, du plus récent au plus ancien.
//
// Rendu (dev 10/11/2026) : le langage des Statistiques. Une page (titre, phrase,
// fenêtre et actualisation à droite), les chiffres clés, deux répartitions (par
// prestataire, par personne et par mois concerné), puis le journal. Chaque tuile
// et chaque barre filtre le journal ; rien n'est rechargé pour un filtre.

import React, { useEffect, useId, useMemo, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  Banknote, Building2, CalendarClock, CalendarDays, CreditCard, FileSpreadsheet, History, Landmark, PenLine,
  ReceiptText, Search, Shapes, Tags, Users, Wallet, X,
} from 'lucide-react';

import apiClient from '../../../services/apiClient.js';
import { useDrawn } from '../../../components/perfSales/motion.jsx';
import { orderedReceipts } from '../receipts.js';
import { formatEUR, formatDateFR, formatMonthLabel, PSP_COLORS } from '../constants.js';
import {
  Avatar, Card, Empty, OpenCue, Page, RefreshButton, Reveal, Segmented, Stat, Stats, TableBox, Tag, Th, Who,
} from './PageKit.jsx';
import './ReceiptsLosses.css';

const WINDOWS = [
  { days: 30, label: '30 jours' },
  { days: 60, label: '60 jours' },
  { days: 90, label: '90 jours' },
];
const WINDOW_OPTIONS = WINDOWS.map((w) => ({ key: w.days, label: w.label, title: `Encaissements des ${w.days} derniers jours` }));

// `tone` : étiquette pastel de l'entité ; `color` : sa part dans les barres.
const ENTITY = {
  owner:   { label: 'Owner',    tone: 'green', color: '#86d3a6' },
  optilex: { label: "Opti'lex", tone: 'blue',  color: '#8fbdf3' },
};

const KIND_LABEL = {
  month:   'Échéance du mois',
  overdue: 'Créance antérieure',
};

const NO_PSP = 'Non renseigné';
const SYNC = 'Classeur (sync)';
const PAGE = 25;
const SPRING = { type: 'spring', stiffness: 520, damping: 40 };

const pspOf = (r) => r.psp || NO_PSP;
// L'auteur d'une saisie ; le sync du classeur n'en a pas.
const whoOf = (r) => r.who || (r.source === 'classeur' ? SYNC : '—');
const monthOf = (r) => (r.period ? String(r.period).slice(0, 7) : '');
const plural = (n, one, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

const whenLabel = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  const date = new Date(s);
  const day = Number.isNaN(date.getTime()) ? formatDateFR(s) : date.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  if (!/T\d\d:\d\d/.test(s)) return day;
  try {
    const time = new Date(s).toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
    });
    return `${day} · ${time}`;
  } catch {
    return day;
  }
};

// Regroupe les encaissements selon `keyOf` : montant, nombre et part de chaque entité.
function groupBy(rows, keyOf) {
  const groups = new Map();
  for (const r of rows) {
    const key = keyOf(r);
    const g = groups.get(key) || { key, total: 0, n: 0, owner: 0, optilex: 0 };
    g.total += r.amount;
    g.n += 1;
    if (r.entity === 'owner') g.owner += r.amount; else g.optilex += r.amount;
    groups.set(key, g);
  }
  return [...groups.values()];
}

const NO_FILTER = { kind: 'all', entity: null, psp: null, who: null, month: null, query: '' };

export default function ReceiptsView({ scope, onOpenClient }) {
  const [days, setDays] = useState(30);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [reloading, setReloading] = useState(false);
  // Filtres du journal : locaux, ils ne relancent aucun chargement.
  const [filter, setFilter] = useState(NO_FILTER);

  const [refresh, setRefresh] = useState(0);
  const load = () => setRefresh((n) => n + 1);

  useEffect(() => {
    setItems(null);
    setError(null);
    let cancelled = false;
    let pending = false;
    const fetchItems = async (silent = false) => {
      if (pending) return;
      pending = true;
      if (!silent) setReloading(true);
      try {
        const d = await apiClient.get(`/api/v1/finance-periods/receipts?days=${days}&limit=500&scope=${scope}`);
        if (!cancelled) {
          setItems(orderedReceipts(d?.items || [], scope));
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e?.data?.detail || e?.message || 'chargement impossible');
      } finally {
        pending = false;
        if (!cancelled) setReloading(false);
      }
    };
    fetchItems();
    const refreshVisible = () => { if (!document.hidden) fetchItems(true); };
    const timer = setInterval(refreshVisible, 15000);
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [days, scope, refresh]);

  const visible = useMemo(() => orderedReceipts(items || [], scope), [items, scope]);

  const totaux = useMemo(() => {
    const t = { total: 0, n: visible.length, owner: 0, optilex: 0, overdue: 0 };
    for (const r of visible) {
      t.total += r.amount;
      if (r.entity === 'owner') t.owner += r.amount; else t.optilex += r.amount;
      if (r.kind === 'overdue') t.overdue += r.amount;
    }
    return t;
  }, [visible]);

  // Répartitions : toujours sur toute la fenêtre, pour rester une carte de lecture quand le journal est filtré.
  const parts = useMemo(() => ({
    psp: groupBy(visible, pspOf).sort((a, b) => b.total - a.total),
    who: groupBy(visible, whoOf).sort((a, b) => b.total - a.total),
    month: groupBy(visible, monthOf).sort((a, b) => b.key.localeCompare(a.key)),
  }), [visible]);

  // Un périmètre Owner ou Opti'lex n'a qu'une entité : le filtre d'entité n'y a pas de sens.
  const active = scope === 'global' ? filter : { ...filter, entity: null };
  const toggle = (key, value) => setFilter((f) => ({ ...f, [key]: f[key] === value ? NO_FILTER[key] : value }));

  const loading = items === null;
  const known = !loading;
  const failed = Boolean(error) && loading;
  const amount = (value) => (known ? value : null);

  return (
    <Page
      title="Encaissements"
      sub="Chaque montant récupéré, saisi dans la page ou détecté dans le classeur : qui a payé, combien, quand, et qui l’a saisi."
      actions={(
        <>
          <Segmented options={WINDOW_OPTIONS} value={days} onChange={setDays} label="Fenêtre des encaissements" />
          <RefreshButton onClick={load} busy={reloading} />
        </>
      )}
    >
      <Stats>
        <Stat
          label="Encaissé sur la période" Icon={Wallet} tone="green"
          value={amount(totaux.total)} format={formatEUR}
          note={known ? `${plural(totaux.n, 'encaissement')} · ${days} derniers jours` : `${days} derniers jours`}
        />
        {scope === 'global' && (
          <>
            <Stat
              label="Owner" Icon={Building2} value={amount(totaux.owner)} format={formatEUR} note="part Owner"
              onClick={() => toggle('entity', 'owner')} pressed={active.entity === 'owner'} title="Ne voir que les encaissements Owner"
            />
            <Stat
              label="Opti'lex" Icon={Landmark} value={amount(totaux.optilex)} format={formatEUR} note="part Opti'lex"
              onClick={() => toggle('entity', 'optilex')} pressed={active.entity === 'optilex'} title="Ne voir que les encaissements Opti'lex"
            />
          </>
        )}
        <Stat
          label="Sur créances antérieures" Icon={History} tone="amber"
          value={amount(totaux.overdue)} format={formatEUR} note="récupéré sur les mois précédents"
          onClick={() => toggle('kind', 'overdue')} pressed={active.kind === 'overdue'} title="Ne voir que les créances antérieures récupérées"
        />
      </Stats>

      {failed ? (
        <div className="fst-error" role="alert">
          Encaissements indisponibles — {error}
          <button type="button" onClick={load}>Réessayer</button>
        </div>
      ) : known && visible.length === 0 ? (
        <>
          {error && <RefreshError onRetry={load} />}
          <Empty boxed>Aucun encaissement sur la période.</Empty>
        </>
      ) : (
        <>
          <Reveal className="fst-grid is-even" amount={0.05}>
            <ProviderCard groups={parts.psp} loading={loading} split={scope === 'global'}
              selected={active.psp} onSelect={(key) => toggle('psp', key)} />
            <PeopleCard people={parts.who} months={parts.month} loading={loading}
              selected={active.who} onSelect={(key) => toggle('who', key)}
              month={active.month} onMonth={(key) => toggle('month', key)} />
          </Reveal>
          <Reveal amount={0.03}>
            <Journal rows={visible} loading={loading} refreshError={known ? error : null} onRetry={load}
              days={days} scope={scope} filter={active} setFilter={setFilter} onOpenClient={onOpenClient} />
          </Reveal>
        </>
      )}
    </Page>
  );
}

// L'actualisation silencieuse a échoué alors que le journal est déjà à l'écran.
const RefreshError = ({ onRetry }) => (
  <div className="fst-error" role="alert" style={{ marginBottom: 14 }}>
    Actualisation indisponible, réessayez.
    <button type="button" onClick={onRetry}>Réessayer</button>
  </div>
);

const cardState = (loading) => ({ data: loading ? null : true, loading });

// Par prestataire de paiement : une barre par prestataire, découpée par entité en périmètre global.
function ProviderCard({ groups, loading, split, selected, onSelect }) {
  const drawn = useDrawn();
  const largest = Math.max(1, ...groups.map((g) => g.total));
  return (
    <Card title="Par prestataire" Icon={CreditCard} state={cardState(loading)} skeleton={260}
      hint={split ? 'Par où l’argent est arrivé, chaque barre découpée par entité. Un clic filtre le journal.' : 'Par où l’argent est arrivé. Un clic filtre le journal.'}>
      {groups.map((g) => (
        <button key={g.key} type="button" className="fst-hbar rl-money" data-on={selected === g.key || undefined} aria-pressed={selected === g.key}
          onClick={() => onSelect(g.key)}>
          <span className="fst-tip" role="presentation">
            <b>{g.key}</b><br />
            {plural(g.n, 'encaissement')}<br />
            {split && <span>Owner · {formatEUR(g.owner)}<br />Opti&apos;lex · {formatEUR(g.optilex)}</span>}
          </span>
          <span className="fst-hbar-name">{g.key}<span className="rl-name-sub">{plural(g.n, 'encaissement')}</span></span>
          <span className="fst-hbar-track rl-track" style={{ width: `${Math.max(0, g.total / largest) * 100}%` }}>
            {split ? ['owner', 'optilex'].filter((key) => g[key] > 0).map((key) => (
              <i key={key} style={{ width: `${drawn ? (g[key] / g.total) * 100 : 0}%`, background: ENTITY[key].color }} />
            )) : <i style={{ width: drawn ? '100%' : '0%', background: 'var(--charcoal)' }} />}
          </span>
          <span className="fst-hbar-num fst-num">{formatEUR(g.total)}</span>
        </button>
      ))}
      {split && (
        <div className="fst-keys">
          {['owner', 'optilex'].map((key) => (
            <span key={key}><span className="fst-dot" style={{ background: ENTITY[key].color }} />{ENTITY[key].label}</span>
          ))}
        </div>
      )}
    </Card>
  );
}

// Qui a saisi (ou le sync du classeur), puis le mois que chaque encaissement vient régler.
function PeopleCard({ people, months, loading, selected, onSelect, month, onMonth }) {
  const drawn = useDrawn();
  const largest = Math.max(1, ...people.map((p) => p.total));
  const largestMonth = Math.max(1, ...months.map((m) => m.total));
  return (
    <Card title="Saisi par" Icon={Users} state={cardState(loading)} skeleton={260}
      hint="Ce que chacun a saisi dans la page, et ce que le sync du classeur a détecté seul. Un clic filtre le journal.">
      {people.map((p) => (
        <button key={p.key} type="button" className="fst-hbar rl-money has-avatar" data-on={selected === p.key || undefined} aria-pressed={selected === p.key}
          onClick={() => onSelect(p.key)}>
          {p.key === SYNC
            ? <span className="fst-avatar" aria-hidden="true"><FileSpreadsheet size={13} /></span>
            : <Avatar name={p.key === '—' ? '?' : p.key} />}
          <span className="fst-hbar-name">{p.key === '—' ? 'Auteur inconnu' : p.key}<span className="rl-name-sub">{plural(p.n, 'saisie')}</span></span>
          <span className="fst-hbar-track rl-track" style={{ width: `${Math.max(0, p.total / largest) * 100}%` }}>
            <i style={{ width: drawn ? '100%' : '0%', background: p.key === SYNC ? 'var(--faint)' : 'var(--charcoal)' }} />
          </span>
          <span className="fst-hbar-num fst-num">{formatEUR(p.total)}</span>
        </button>
      ))}

      <div className="fst-chart">
        <div className="fst-chart-title"><span>Mois concernés</span><span>ce que chaque encaissement vient régler</span></div>
        <div className="fst-legend">
          {months.map((m) => (
            <button key={m.key || 'none'} type="button" className="fst-legend-row rl-month" aria-pressed={month === m.key} onClick={() => onMonth(m.key)}
              title="Voir ces encaissements dans le journal">
              <span>{m.key ? formatMonthLabel(m.key) : 'Sans mois'}</span>
              <span className="fst-hbar-track">
                <i style={{ width: `${drawn ? Math.max(0, m.total / largestMonth) * 100 : 0}%`, background: 'var(--charcoal)' }} />
              </span>
              <b className="fst-num">{formatEUR(m.total)}</b>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

const matches = (r, f) => (f.kind === 'all' || r.kind === f.kind)
  && (!f.entity || r.entity === f.entity)
  && (!f.psp || pspOf(r) === f.psp)
  && (!f.who || whoOf(r) === f.who)
  && (f.month == null || monthOf(r) === f.month);

function Journal({ rows, loading, refreshError, onRetry, days, scope, filter, setFilter, onOpenClient }) {
  const tabId = useId();
  const query = filter.query.trim().toLowerCase();
  // Les compteurs des onglets suivent les autres filtres, pas la nature elle-même.
  const scoped = useMemo(() => rows.filter((r) => matches(r, { ...filter, kind: 'all' })
    && (!query || `${r.societe || ''} ${r.numero_client || ''} ${whoOf(r)} ${pspOf(r)}`.toLowerCase().includes(query))), [rows, filter, query]);
  const shownRows = useMemo(() => (filter.kind === 'all' ? scoped : scoped.filter((r) => r.kind === filter.kind)), [scoped, filter.kind]);
  const counts = useMemo(() => scoped.reduce((acc, r) => { acc[r.kind] = (acc[r.kind] || 0) + 1; return acc; }, {}), [scoped]);
  const total = useMemo(() => shownRows.reduce((sum, r) => sum + r.amount, 0), [shownRows]);

  const signature = `${JSON.stringify(filter)}|${days}|${scope}`;
  const [page, setPage] = useState({ signature: '', shown: PAGE });
  const shown = page.signature === signature ? page.shown : PAGE;

  const tabs = [
    { key: 'all', label: 'Tous', n: scoped.length },
    ...Object.keys(KIND_LABEL).filter((key) => counts[key] > 0 || filter.kind === key).map((key) => ({ key, label: KIND_LABEL[key], n: counts[key] || 0 })),
  ];
  const chips = [
    filter.entity && { key: 'entity', label: ENTITY[filter.entity]?.label || filter.entity },
    filter.psp && { key: 'psp', label: filter.psp },
    filter.who && { key: 'who', label: filter.who === '—' ? 'Auteur inconnu' : filter.who },
    filter.month != null && { key: 'month', label: filter.month ? formatMonthLabel(filter.month) : 'Sans mois' },
  ].filter(Boolean);
  const clear = (key) => setFilter((f) => ({ ...f, [key]: NO_FILTER[key] }));
  const openable = Boolean(onOpenClient);

  return (
    <Card title="Journal des encaissements" Icon={ReceiptText} state={cardState(loading)} skeleton={340}
      hint="Dernières saisies en premier · heure de Paris. Un clic sur une ligne ouvre la fiche du client.">
      {refreshError && <RefreshError onRetry={onRetry} />}
      <div className="fst-tools">
        <div className="fst-tabs" role="group" aria-label="Nature de l’encaissement">
          {tabs.map((tab) => (
            <button key={tab.key} type="button" className="fst-tab" aria-pressed={filter.kind === tab.key} onClick={() => setFilter((f) => ({ ...f, kind: tab.key }))}>
              {filter.kind === tab.key && <Motion.span layoutId={`rl-receipts-tab-${tabId}`} className="fst-tab-bg" transition={SPRING} />}
              <span>{tab.label}</span><span className="fst-tab-count fst-num">{tab.n}</span>
            </button>
          ))}
        </div>
        <AnimatePresence initial={false}>
          {chips.map((chip) => (
            <Motion.button key={chip.key} type="button" className="fst-chip" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }} onClick={() => clear(chip.key)} title="Retirer ce filtre">
              {chip.label}<X size={13} />
            </Motion.button>
          ))}
        </AnimatePresence>
        <label className="fst-search">
          <Search size={14} />
          <input type="search" placeholder="Client, n°, prestataire, auteur…" value={filter.query}
            onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))} aria-label="Chercher un encaissement" />
        </label>
      </div>

      <TableBox minWidth={980} after={(
        <>
          {shownRows.length === 0 && <Empty>Aucun encaissement ne correspond à ces filtres.</Empty>}
          {shownRows.length > shown && (
            <div className="fst-more">
              <button type="button" onClick={() => setPage({ signature, shown: shown + PAGE * 2 })}>
                Afficher les {Math.min(PAGE * 2, shownRows.length - shown)} suivants
              </button>
            </div>
          )}
        </>
      )}>
        <thead>
          <tr>
            <Th Icon={CalendarClock}>Saisi le</Th>
            <Th Icon={Building2}>Client</Th>
            <Th Icon={Shapes}>Entité</Th>
            <Th Icon={Tags}>Nature</Th>
            <Th Icon={Banknote} num>Montant</Th>
            <Th Icon={CreditCard} title="Prestataire renseigné pour cette échéance">Prestataire</Th>
            <Th Icon={CalendarDays}>Mois concerné</Th>
            <Th Icon={PenLine}>Saisi par</Th>
          </tr>
        </thead>
        <tbody key={signature}>
          {shownRows.slice(0, shown).map((r, i) => {
            const entity = ENTITY[r.entity];
            return (
              <tr key={r.id} style={{ '--i': i % PAGE }} data-open={openable || undefined}
                onClick={() => onOpenClient?.(r.client_id)} title={openable ? 'Ouvrir la fiche du client' : undefined}>
                <td className="fst-num fst-cell-muted">{whenLabel(r.at)}</td>
                <td>
                  <div className="fst-cell-main">{r.societe || '—'}{openable && <OpenCue />}</div>
                  {r.numero_client && <div className="fst-cell-sub fst-num">n° {r.numero_client}</div>}
                </td>
                <td>{entity ? <Tag tone={entity.tone}>{entity.label}</Tag> : <span className="fst-cell-muted">{r.entity || '—'}</span>}</td>
                <td>
                  <Tag tone={r.kind === 'overdue' ? 'peach' : undefined}
                    title={r.kind === 'overdue' ? 'Récupéré sur un mois précédent' : undefined}>
                    {KIND_LABEL[r.kind] || r.kind}
                  </Tag>
                </td>
                <td className="is-num fst-num" style={{ fontWeight: 500 }}>{formatEUR(r.amount)}</td>
                <td>
                  <Tag tone={PSP_COLORS[r.psp] ? 'green' : undefined} title="Prestataire renseigné pour cette échéance">{pspOf(r)}</Tag>
                </td>
                <td className="fst-cell-muted">{r.period ? formatMonthLabel(String(r.period).slice(0, 7)) : '—'}</td>
                <td>
                  {r.who ? <Who name={r.who} />
                    : r.source === 'classeur' ? <Tag title="Détecté par le sync du classeur, sans auteur">{SYNC}</Tag>
                      : <span className="fst-cell-muted">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
        {shownRows.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={4}>{plural(shownRows.length, 'encaissement')}{shownRows.length !== rows.length ? ` sur ${rows.length}` : ''}</td>
              <td className="is-num fst-num">{formatEUR(total)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        )}
      </TableBox>
    </Card>
  );
}
