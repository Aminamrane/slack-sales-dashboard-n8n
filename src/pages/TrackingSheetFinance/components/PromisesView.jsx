// PromisesView.jsx — onglet « Promesses de règlement ».
//
// Demande dev 2026-09-28 : « un onglet où on peut checker toutes les personnes
// qui ont été mises en promesse de paiement, et si elles ont payé. » Chaque
// promesse garde sa date promise, le commentaire posé avec elle, qui l'a
// notée, et son issue : en cours, dépassée (date promise passée sans que le
// client soit à jour), tenue (le client ne doit plus rien, levée
// automatiquement) ou retirée.
//
// Refonte dev 10/11/2026 : la vue parle le langage des Statistiques (chiffres
// clés, répartition des issues, montants en barres, tableau à en-têtes
// illustrés). Les chargements, les statuts et les règles de montant sont
// ceux d'origine.
//
// Source : GET /finance-periods/client/payment-promises.

import React, { useEffect, useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  Banknote, Building2, CalendarClock, CalendarDays, CircleCheck, CircleDot, Coins, FileText, Hourglass, ListChecks, MessageSquare, PieChart,
  Search, User, Wallet,
} from 'lucide-react';

import apiClient from '../../../services/apiClient.js';
import { useDrawn } from '../../../components/perfSales/motion.jsx';
import { formatEUR, formatDateFR } from '../constants.js';
import { count, pct } from '../statistics/model.js';
import { Fill, ProgressRing } from '../statistics/parts.jsx';
import { Card, Empty, Num, OpenCue, Page, Pill, RefreshButton, Reveal, Stat, Stats, TableBox, Tag, Th, Who } from './PageKit.jsx';
import './FollowupTabs.css';

const SPRING = { type: 'spring', stiffness: 520, damping: 40 };
const PAGE = 25;

// `tone` : couleur de la pastille de statut ; `color` : la même issue dans la répartition.
const STATUS = {
  open:      { label: 'En cours',     many: 'En cours',  tone: 'blue',  color: '#8fbdf3' },
  late:      { label: 'Dépassée',     many: 'Dépassées', tone: 'red',   color: '#ee8f8a' },
  kept:      { label: 'Tenue · payé', many: 'Tenues',    tone: 'green', color: '#6cc493' },
  withdrawn: { label: 'Retirée',      many: 'Retirées',  tone: 'ghost', color: '#dedad3' },
};
const ORDER = ['open', 'late', 'kept', 'withdrawn'];

const FILTERS = [
  { key: 'all',       label: 'Toutes' },
  { key: 'open',      label: 'En cours' },
  { key: 'late',      label: 'Dépassées' },
  { key: 'kept',      label: 'Tenues' },
  { key: 'withdrawn', label: 'Retirées' },
];

// Montant vu dans la vision active (Owner, Opti'Lex ou les deux).
const inScope = (scope, owner, optilex) => {
  if (owner == null && optilex == null) return null;
  if (scope === 'owner') return owner ?? 0;
  if (scope === 'optilex') return optilex ?? 0;
  return (owner ?? 0) + (optilex ?? 0);
};

const dayLabel = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? formatDateFR(String(iso))
    : d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
};

// Écart en jours entre aujourd'hui et la date promise (négatif : la date est passée).
const daysTo = (ymd) => {
  if (!ymd) return null;
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const now = new Date();
  return Math.round((new Date(y, m - 1, d).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
};

const delay = (p) => {
  if (p.status !== 'open' && p.status !== 'late') return null;
  const days = daysTo(p.promised_for);
  if (days == null) return null;
  if (days === 0) return 'aujourd’hui';
  return days > 0 ? `dans ${days} j` : `depuis ${-days} j`;
};

const fold = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const euros = (n) => formatEUR(n);

export default function PromisesView({ scope, onOpenClient }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [reloading, setReloading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState({ signature: '', shown: PAGE });
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReloading(true);
      try {
        const d = await apiClient.get('/api/v1/finance-periods/client/payment-promises');
        if (!cancelled) { setItems(d?.items || []); setError(null); }
      } catch (e) {
        if (!cancelled) setError(e?.data?.detail || e?.message || 'chargement impossible');
      } finally {
        if (!cancelled) setReloading(false);
      }
    })();
    const onFocus = () => setRefresh((n) => n + 1);
    window.addEventListener('focus', onFocus);
    return () => { cancelled = true; window.removeEventListener('focus', onFocus); };
  }, [refresh]);

  const counts = useMemo(() => {
    const c = { all: 0, open: 0, late: 0, kept: 0, withdrawn: 0 };
    for (const p of items || []) { c.all += 1; c[p.status] = (c[p.status] || 0) + 1; }
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const q = fold(query.trim());
    return (items || []).filter((p) => (filter === 'all' || p.status === filter)
      && (!q || fold([p.client?.societe, p.client?.numero_client, p.note, p.created_by_name].join(' ')).includes(q)));
  }, [items, filter, query]);

  // Ce qui est rentré depuis les promesses, et ce qui reste à récupérer sur
  // celles qui courent encore.
  const totaux = useMemo(() => {
    let recu = 0; let reste = 0; let du = 0; let resteDepasse = 0; let sansDate = 0;
    for (const p of items || []) {
      du += inScope(scope, p.due_owner, p.due_optilex) || 0;
      recu += inScope(scope, p.received_owner, p.received_optilex) || 0;
      if (p.status === 'open' || p.status === 'late') {
        const r = inScope(scope, p.remaining_owner, p.remaining_optilex) || 0;
        reste += r;
        if (p.status === 'late') resteDepasse += r;
        if (!p.promised_for) sansDate += 1;
      }
    }
    return { recu, reste, du, resteDepasse, sansDate };
  }, [items, scope]);

  // Pied du tableau : la somme des lignes filtrées, pas seulement de celles affichées.
  const pied = useMemo(() => {
    let du = 0; let recu = 0; let reste = 0;
    for (const p of visible) {
      du += inScope(scope, p.due_owner, p.due_optilex) || 0;
      recu += inScope(scope, p.received_owner, p.received_optilex) || 0;
      if (p.status === 'open' || p.status === 'late') reste += inScope(scope, p.remaining_owner, p.remaining_optilex) || 0;
    }
    return { du, recu, reste };
  }, [visible, scope]);

  const reload = () => setRefresh((n) => n + 1);
  const signature = `${filter}|${query}`;
  const shown = page.signature === signature ? page.shown : PAGE;
  const rows = visible.slice(0, shown);

  const head = {
    title: 'Promesses de règlement',
    sub: 'Chaque client qui a promis de régler : la date annoncée, ce qu’il devait, ce qui est rentré depuis.',
    actions: <RefreshButton onClick={reload} busy={reloading} />,
  };

  if (error && items === null) {
    return (
      <Page {...head}>
        <div className="fst-error" role="alert">Promesses indisponibles — {error}<button type="button" onClick={reload}>Réessayer</button></div>
      </Page>
    );
  }
  if (items === null) return <Page {...head}><Empty boxed>Chargement des promesses…</Empty></Page>;

  const running = counts.open + counts.late;

  return (
    <Page {...head}>
      <Stats>
        <Stat label="En cours" Icon={Hourglass} value={running} tone={counts.late ? 'red' : undefined}
          note={counts.late ? `dont ${counts.late} dépassée${counts.late > 1 ? 's' : ''}` : 'aucune dépassée'} />
        <Stat label="Tenues" Icon={CircleCheck} value={counts.kept} tone="green" note="le client s'est mis à jour" />
        <Stat label="Reçu depuis les promesses" Icon={Banknote} value={totaux.recu} format={euros} tone="green" note="saisies et encaissements détectés" />
        <Stat label="Reste à récupérer" Icon={Wallet} value={totaux.reste} format={euros} tone={totaux.reste > 0 ? 'amber' : undefined}
          note="sur les promesses en cours" />
      </Stats>

      {counts.all > 0 && (
        <Reveal className="fst-grid is-even">
          <Outcomes counts={counts} filter={filter} onFilter={setFilter} />
          <Amounts totaux={totaux} running={running} />
        </Reveal>
      )}

      <Reveal amount={0.03}>
        <Card title="Toutes les promesses" Icon={ListChecks}
          hint={`Les plus récentes d'abord${error ? ' · Actualisation indisponible, réessayez.' : ''}`}>
          <div className="fst-tools">
            <div className="fst-tabs" role="group" aria-label="Issue de la promesse">
              {FILTERS.map((f) => (
                <button key={f.key} type="button" className="fst-tab" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                  {filter === f.key && <Motion.span layoutId="fup-promise-tab" className="fst-tab-bg" transition={SPRING} />}
                  <span>{f.label}</span><span className="fst-tab-count fst-num">{count(counts[f.key] || 0)}</span>
                </button>
              ))}
            </div>
            <label className="fst-search">
              <Search size={14} />
              <input type="search" placeholder="Client, n°, commentaire, auteur…" value={query} onChange={(e) => setQuery(e.target.value)}
                aria-label="Chercher une promesse" />
            </label>
          </div>

          <TableBox minWidth={1180}
            after={(
              <>
                {visible.length === 0 && (
                  <Empty>{query.trim() ? 'Aucune promesse ne correspond à cette recherche.'
                    : filter === 'all' ? 'Aucune promesse de règlement notée.' : 'Aucune promesse dans cet état.'}</Empty>
                )}
                {visible.length > shown && (
                  <div className="fst-more">
                    <button type="button" onClick={() => setPage({ signature, shown: shown + PAGE * 2 })}>
                      Afficher les {count(Math.min(PAGE * 2, visible.length - shown))} suivantes
                    </button>
                  </div>
                )}
              </>
            )}>
            <thead>
              <tr>
                <Th Icon={Building2}>Client</Th>
                <Th Icon={CalendarDays}>Notée le</Th>
                <Th Icon={User}>Par</Th>
                <Th Icon={CalendarClock}>Règlement promis</Th>
                <Th Icon={MessageSquare}>Commentaire</Th>
                <Th Icon={FileText} num>Dû à la pose</Th>
                <Th Icon={Banknote} num>Reçu depuis</Th>
                <Th Icon={Wallet} num>Reste dû</Th>
                <Th Icon={CircleDot}>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => {
                const st = STATUS[p.status] || STATUS.open;
                const du = inScope(scope, p.due_owner, p.due_optilex);
                const recu = inScope(scope, p.received_owner, p.received_optilex);
                const reste = inScope(scope, p.remaining_owner, p.remaining_optilex);
                const live = p.status === 'open' || p.status === 'late';
                const openable = Boolean(onOpenClient) && p.client?.id != null;
                const eta = delay(p);
                return (
                  <tr key={p.id} style={{ '--i': Math.min(i, 14) }} data-open={openable || undefined}
                    onClick={openable ? () => onOpenClient(p.client.id) : undefined} title={openable ? 'Ouvrir la fiche du client' : undefined}>
                    <td>
                      <div className="fst-cell-main">{p.client?.societe || '—'}<OpenCue /></div>
                      {p.client?.numero_client && <div className="fst-cell-sub fst-num">n° {p.client.numero_client}</div>}
                    </td>
                    <td className="is-nowrap fst-num">{dayLabel(p.created_at)}</td>
                    <td><Who name={p.created_by_name} /></td>
                    <td className="is-nowrap">
                      {p.promised_for
                        ? (p.status === 'late'
                          ? <Tag tone="red" title="Date promise passée sans que le client soit à jour">{formatDateFR(p.promised_for)}</Tag>
                          : <span className="fst-num" style={{ fontWeight: 500 }}>{formatDateFR(p.promised_for)}</span>)
                        : <span className="fst-cell-muted">Non précisée</span>}
                      {eta && <div className={`fst-cell-sub${p.status === 'late' ? ' fup-tone-red' : ''}`}>{eta}</div>}
                    </td>
                    <td className="is-wrap">
                      {p.note ? <div className="fup-clip" title={p.note}>{p.note}</div> : <span className="fst-cell-muted">–</span>}
                    </td>
                    <td className="is-num fst-num">{du == null ? '—' : formatEUR(du)}</td>
                    <td className={`is-num fst-num ${recu > 0 ? 'fup-tone-green' : 'fup-tone-zero'}`}>{recu == null ? '—' : formatEUR(recu)}</td>
                    <td className={`is-num fst-num ${live && reste > 0 ? 'fup-tone-amber' : 'fup-tone-zero'}`}>
                      {live && reste != null ? formatEUR(reste) : '—'}
                    </td>
                    <td>
                      <Pill tone={st.tone}>{st.label}</Pill>
                      {p.closed_at && (
                        <div className="fst-cell-sub" title={p.close_note || ''}>
                          le {dayLabel(p.closed_at)}{p.closed_by_name ? ` · ${p.closed_by_name}` : ''}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {visible.length > 1 && (
              <tfoot>
                <tr>
                  <td colSpan={5}>{count(visible.length)} promesses{filter !== 'all' || query.trim() ? ' dans cette sélection' : ''}</td>
                  <td className="is-num fst-num">{formatEUR(pied.du)}</td>
                  <td className="is-num fst-num">{formatEUR(pied.recu)}</td>
                  <td className="is-num fst-num">{formatEUR(pied.reste)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </TableBox>
        </Card>
      </Reveal>
    </Page>
  );
}

// ── Où en sont les promesses : la part tenue, puis chaque issue (un clic filtre la liste) ───────────
function Outcomes({ counts, filter, onFilter }) {
  const drawn = useDrawn();
  const judged = counts.all - counts.withdrawn;
  const rate = judged ? counts.kept / judged : 0;
  const present = ORDER.filter((key) => counts[key] > 0);

  return (
    <Card title="Où en sont les promesses" Icon={PieChart} hint="La part des promesses tenues, puis chaque issue. Un clic filtre la liste.">
      <div className="fst-goal fup-goal">
        <ProgressRing value={rate} color="#6cc493" label={`${counts.kept} promesses tenues sur ${judged}`}>
          <Num className="fst-ring-num" value={counts.kept} />
          <div className="fst-ring-sub">sur {count(judged)}</div>
        </ProgressRing>
        <div style={{ minWidth: 0 }}>
          <Num className="fst-rate-big" value={rate} format={(n) => pct(n, 0)} />
          <div className="fst-rate-note">
            {judged ? 'des promesses ont été tenues : le client s’est mis à jour.' : 'Aucune promesse à juger pour l’instant.'}
            {counts.withdrawn > 0 && ` Hors ${counts.withdrawn} retirée${counts.withdrawn > 1 ? 's' : ''}.`}
          </div>
        </div>
      </div>

      <div className="fst-split" aria-hidden="true">
        {present.map((key) => (
          <i key={key} style={{ flexGrow: drawn ? counts[key] : 0, flexBasis: 0, background: STATUS[key].color, opacity: filter === 'all' || filter === key ? 1 : 0.25 }} />
        ))}
      </div>
      <div className="fst-legend">
        {present.map((key) => (
          <button key={key} type="button" className="fst-legend-row" aria-pressed={filter === key} onClick={() => onFilter(filter === key ? 'all' : key)}
            title="Voir ces promesses dans la liste">
            <span className="fst-dot" style={{ background: STATUS[key].color }} />
            {STATUS[key].many}
            <b className="fst-num">{count(counts[key])}</b>
            <small className="fst-num">{pct(counts.all ? counts[key] / counts.all : 0, 0)}</small>
          </button>
        ))}
      </div>
    </Card>
  );
}

// ── Les montants : ce qui était dû à la pose des promesses, ce qui est rentré, ce qui court encore ──
function Amounts({ totaux, running }) {
  const largest = Math.max(1, totaux.du, totaux.recu, totaux.reste);
  const lines = [
    { label: 'Dû à la pose', value: totaux.du, color: '#cfc8bd' },
    { label: 'Reçu depuis', value: totaux.recu, color: '#6cc493' },
    { label: 'Reste en cours', value: totaux.reste, color: '#f1b76a' },
  ];

  return (
    <Card title="Les montants" Icon={Coins} hint="Ce que ces clients devaient quand la promesse a été notée, et ce qui est rentré depuis.">
      <div className="fst-rate-top">
        <div>
          <Num className="fst-rate-big" value={totaux.du ? totaux.recu / totaux.du : 0} format={(n) => pct(n, 0)} />
          <div className="fst-rate-note">du dû à la pose est rentré depuis.</div>
        </div>
      </div>
      <div className="fst-dist fup-money">
        {lines.map((line) => (
          <div key={line.label} className="fst-dist-row">
            <span>{line.label}</span>
            <Fill value={line.value / largest} color={line.color} />
            <span><Num value={line.value} format={euros} /></span>
          </div>
        ))}
      </div>
      <dl className="fst-kv">
        <dt>Promesses qui courent encore</dt><dd className="fst-num">{count(running)}</dd>
        <dt>Reste dû sur les dépassées</dt>
        <dd className={totaux.resteDepasse > 0 ? 'fup-tone-red' : undefined}><Num value={totaux.resteDepasse} format={euros} /></dd>
        <dt>En cours sans date précisée</dt><dd className="fst-num">{count(totaux.sansDate)}</dd>
      </dl>
    </Card>
  );
}
