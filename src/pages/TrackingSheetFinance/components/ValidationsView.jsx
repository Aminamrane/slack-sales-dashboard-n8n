// ValidationsView.jsx — la file des demandes de l'équipe finance, pour la direction.
//
// Dev (2026-09-23) : l'équipe finance a la même flexibilité que la direction,
// mais tout changement chez elle est en attente de validation de la direction
// financière, qui a un onglet avec ces demandes. « Il faut qu'elles soient
// claires : ce que la personne a voulu modifier, ce qu'elle a modifié, ce
// qu'elle propose. Dès qu'elle valide, c'est pris en compte. »
//
// Une carte par demande : qui, quand, quel client ; la phrase du geste ;
// le tableau mois par mois avant → proposé ; le motif ; Valider / Refuser
// (avec motif). Si un mois a bougé depuis la demande, la carte le dit et le
// serveur refuse la validation : on relit avec l'auteur, on n'écrase pas.
//
// Refonte dev 10/11/2026 : la file parle le langage des Statistiques (chiffres
// clés, répartition par auteur et par geste qui filtrent la file, cartes de
// cas). Le chargement, le rafraîchissement et les deux gestes sont ceux d'origine.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  ArrowRight, Banknote, CalendarClock, CalendarDays, Check, CircleCheck, CirclePause, CircleX, Clock3, Hourglass, Inbox, PenLine, PieChart, Scale,
  Search, Target, TriangleAlert, Undo2, Users, X,
} from 'lucide-react';

import apiClient from '../../../services/apiClient.js';
import { READ_ONLY_PROPS } from '../../../utils/readOnlyRoles.js';
import { ITEM, useDrawn } from '../../../components/perfSales/motion.jsx';
import { formatEUR, formatMonthLabel } from '../constants.js';
import { count, pct, plural } from '../statistics/model.js';
import { ProgressRing } from '../statistics/parts.jsx';
import { Avatar, Card, Empty, Num, Page, Pill, RefreshButton, Reveal, Segmented, Stat, Stats, TableBox, Tag, Th, Who } from './PageKit.jsx';
import './FollowupTabs.css';

const GREEN = '#6cc493';
const RED = '#ee8f8a';
const AMBER = '#f1b76a';
const BEIGE = '#cfc8bd';
const GHOST = '#dedad3';
const PAGE = 10;
const NONE = { author: null, action: null, status: null, drift: false };

const fmtWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const STATUS = {
  pending:   { label: 'En attente', many: 'En attente', tone: 'amber', color: AMBER },
  approved:  { label: 'Validée',    many: 'Validées',   tone: 'green', color: GREEN },
  rejected:  { label: 'Refusée',    many: 'Refusées',   tone: 'red',   color: RED },
  withdrawn: { label: 'Retirée',    many: 'Retirées',   tone: 'ghost', color: GHOST },
};

const ENTITY = { owner: 'Owner', optilex: "Opti'lex" };
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const fold = (text) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Le geste demandé, reconnu à son libellé : une teinte et une icône par famille.
const GESTURES = [
  [/pause/, 'lilac', CirclePause],
  [/report/, 'cyan', CalendarClock],
  [/attendu/, 'blue', Target],
  [/recu|encaiss/, 'green', Banknote],
  [/reste|creance/, 'peach', Scale],
];
const gesture = (label) => {
  const text = fold(label);
  const hit = GESTURES.find(([pattern]) => pattern.test(text));
  return { tone: hit?.[1], Icon: hit?.[2] || PenLine };
};

const since = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  return days <= 0 ? 'depuis aujourd’hui' : `depuis ${days} j`;
};

// Ce que la demande change, mois par mois, dans les mots de l'écran :
// attendu, reçu, reste dû, pause, report. On part des valeurs proposées ;
// l'état d'avant vient de la photo prise au moment de la demande.
function monthChanges(req) {
  const before = req.before || {};
  const proposed = req.proposed || {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(proposed)])]
    .filter((k) => !k.startsWith('__')).sort();
  const rows = [];
  for (const iso of keys) {
    const b = before[iso] || {};
    const p = proposed[iso] || {};
    const changes = [];
    for (const ent of ['owner', 'optilex']) {
      const suffix = ent === 'owner' ? 'owner' : 'optilex_ttc';
      const expB = num(b[`expected_${suffix}`]);
      const recB = (num(b[`received_${suffix}`]) || 0) + (num(b[`received_overdue_${suffix}`]) || 0);
      const resteB = b[`remaining_${ent}`] !== undefined ? num(b[`remaining_${ent}`])
        : (expB !== null ? Math.max(expB - recB, 0) : null);
      if (p[`expected_${suffix}`] !== undefined) changes.push({ what: `Attendu ${ENTITY[ent]}`, before: expB, after: num(p[`expected_${suffix}`]) });
      if (p[`received_${suffix}`] !== undefined) changes.push({ what: `Reçu ${ENTITY[ent]}`, before: num(b[`received_${suffix}`]) || 0, after: num(p[`received_${suffix}`]) });
      if (p[`remaining_${ent}`] !== undefined) changes.push({ what: `Reste dû ${ENTITY[ent]}`, before: resteB, after: num(p[`remaining_${ent}`]), note: 'ajustement de créance' });
      if (p[`deferred_out_${ent}`] !== undefined) changes.push({ what: `Créance ${ENTITY[ent]} reportée ailleurs`, before: resteB, after: Math.max((resteB || 0) - num(p[`deferred_out_${ent}`]), 0), note: `−${formatEUR(num(p[`deferred_out_${ent}`]))}` });
      if (p[`deferred_in_${ent}`] !== undefined) changes.push({ what: `Créance ${ENTITY[ent]} reçue ici`, before: resteB, after: (resteB || 0) + num(p[`deferred_in_${ent}`]), note: `+${formatEUR(num(p[`deferred_in_${ent}`]))}` });
    }
    if (p.expected_paused !== undefined) {
      changes.push({
        what: 'Pause', text: true,
        before: b.expected_paused ? 'en pause' : 'exigible',
        after: p.expected_paused ? `en pause${p.expected_paused_until ? ` jusqu'au ${String(p.expected_paused_until).slice(0, 10).split('-').reverse().join('/')}` : ''}${p.owed === 'never' ? ', rien dû' : p.owed === 'later' ? ', à rattraper' : ''}` : 'exigible',
      });
    }
    rows.push({ iso, label: formatMonthLabel(iso.slice(0, 7)), changes, context: { b } });
  }
  return rows;
}

// `readOnly` (rôles en lecture seule) : les demandes se lisent, Valider / Refuser visibles et désactivés.
export default function ValidationsView({ onOpenClient, onChanged, showToast, readOnly = false }) {
  const [tab, setTab] = useState('pending');            // 'pending' | 'done'
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [reloading, setReloading] = useState(false);
  const [acting, setActing] = useState(null);           // id en cours
  const [confirm, setConfirm] = useState(null);         // { id, kind: 'approve' | 'reject' }
  const [notes, setNotes] = useState({});               // id -> motif de refus
  const [filter, setFilter] = useState(NONE);           // lecture de la file : auteur, geste, issue, à relire
  const [query, setQuery] = useState('');
  const [page, setPage] = useState({ signature: '', shown: PAGE });

  const load = useCallback(async (silent = false) => {
    if (!silent) setReloading(true);
    try {
      const status = tab === 'pending' ? 'pending' : 'all';
      const d = await apiClient.get(`/api/v1/finance-periods/client/requests?status=${status}&limit=200`);
      const list = Array.isArray(d?.items) ? d.items : [];
      setItems(tab === 'pending' ? list : list.filter((r) => r.status !== 'pending'));
      setError(null);
    } catch (e) {
      setError(e?.data?.detail || 'Chargement impossible');
      if (items === null) setItems([]);
    } finally {
      setReloading(false);
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    let pending = false;
    setItems(null);
    const tick = async (silent) => {
      if (cancelled || pending || document.visibilityState === 'hidden') return;
      pending = true;
      try { await load(silent); } finally { pending = false; }
    };
    tick(false);
    const id = setInterval(() => tick(true), 15000);
    const onFocus = () => tick(true);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [load]);

  const act = useCallback(async (req, kind) => {
    if (readOnly || acting) return;
    const note = (notes[req.id] || '').trim();
    if (kind === 'reject' && !note) {
      showToast?.('Un motif de refus est attendu : l’auteur doit comprendre.', 'error');
      return;
    }
    setActing(req.id);
    try {
      await apiClient.post(`/api/v1/finance-periods/client/requests/${req.id}/${kind}`, { note: note || null });
      showToast?.(kind === 'approve'
        ? `Validé : ${req.requested_by_name || 'la demande'} — ${req.label}`
        : `Refusé : ${req.label}`, 'success');
      setConfirm(null);
      setNotes((n) => ({ ...n, [req.id]: '' }));
      await load(true);
      onChanged?.();
    } catch (e) {
      showToast?.(e?.data?.detail || 'Action impossible', 'error');
      await load(true);
    } finally {
      setActing(null);
    }
  }, [acting, notes, load, onChanged, showToast, readOnly]);

  const pendingCount = useMemo(() => (items || []).filter((r) => r.status === 'pending').length, [items]);

  // Les chiffres de la file : ce qui attend, ce qui est à relire, qui demande, quel geste, quelle issue.
  const facts = useMemo(() => {
    const list = items || [];
    const byStatus = { pending: 0, approved: 0, rejected: 0, withdrawn: 0 };
    const authors = new Map();
    const actions = new Map();
    let drift = 0;
    let oldest = null;
    for (const r of list) {
      if (byStatus[r.status] !== undefined) byStatus[r.status] += 1;
      const flagged = r.status === 'pending' && !!r.drift;
      if (flagged) drift += 1;
      if (r.status === 'pending' && r.requested_at && (!oldest || r.requested_at < oldest)) oldest = r.requested_at;
      const name = r.requested_by_name || 'Quelqu’un';
      const a = authors.get(name) || { key: name, name, total: 0, parts: {} };
      a.total += 1;
      const part = flagged ? 'drift' : r.status;
      a.parts[part] = (a.parts[part] || 0) + 1;
      authors.set(name, a);
      const label = r.action_label || 'Autre geste';
      const g = actions.get(label) || { key: label, name: label, total: 0, parts: {}, Icon: gesture(label).Icon };
      g.total += 1;
      g.parts[part] = (g.parts[part] || 0) + 1;
      actions.set(label, g);
    }
    const rank = (map) => [...map.values()].sort((x, y) => y.total - x.total || x.name.localeCompare(y.name, 'fr'))
      .map((row) => ({ ...row, segments: PART_ORDER.filter((key) => row.parts[key]).map((key) => ({ color: PART_COLOR[key], n: row.parts[key] })) }));
    return { byStatus, drift, oldest, authors: rank(authors), actions: rank(actions) };
  }, [items]);

  const visible = useMemo(() => {
    const q = fold(query.trim());
    return (items || []).filter((r) => (!filter.author || (r.requested_by_name || 'Quelqu’un') === filter.author)
      && (!filter.action || (r.action_label || 'Autre geste') === filter.action)
      && (!filter.status || r.status === filter.status)
      && (!filter.drift || (r.status === 'pending' && !!r.drift))
      && (!q || fold([r.client?.societe, r.client?.numero_client, r.label, r.reason, r.requested_by_name, r.action_label].join(' ')).includes(q)));
  }, [items, filter, query]);

  const signature = `${tab}|${filter.author}|${filter.action}|${filter.status}|${filter.drift}|${query}`;
  const shown = page.signature === signature ? page.shown : PAGE;
  const rest = Math.max(visible.length - shown, 0);

  const changeTab = (key) => { setTab(key); setFilter(NONE); setQuery(''); setConfirm(null); };
  const toggle = (key, value) => setFilter((f) => ({ ...f, [key]: f[key] === value ? NONE[key] : value }));
  const chips = [
    filter.author && { key: 'author', label: filter.author },
    filter.action && { key: 'action', label: filter.action },
    filter.status && { key: 'status', label: STATUS[filter.status]?.many },
    filter.drift && { key: 'drift', label: 'À relire' },
  ].filter(Boolean);
  const done = tab === 'done';
  const treated = facts.byStatus.approved + facts.byStatus.rejected + facts.byStatus.withdrawn;

  return (
    <Page title="Validations"
      sub="Les changements proposés par l’équipe finance : rien ne s’applique tant que la direction n’a pas validé."
      actions={(
        <>
          <Segmented label="Demandes" value={tab} onChange={changeTab} options={[
            { key: 'pending', label: tab === 'pending' && items ? `À valider (${pendingCount})` : 'À valider' },
            { key: 'done', label: 'Traitées' },
          ]} />
          <RefreshButton onClick={() => load(false)} busy={reloading} />
        </>
      )}>
      {error && items !== null && <div className="fst-error" role="alert">{error}<button type="button" onClick={() => load(false)}>Réessayer</button></div>}
      {items === null && <Empty boxed>Chargement…</Empty>}

      {items !== null && (
        <Stats key={`stats-${tab}`}>
          {done ? (
            <>
              <Stat label="Traitées" Icon={Inbox} value={treated} note="sur les 200 dernières demandes" />
              <Stat label="Validées" Icon={CircleCheck} value={facts.byStatus.approved} tone={facts.byStatus.approved ? 'green' : undefined}
                note={treated ? `${pct(facts.byStatus.approved / treated, 0)} des demandes traitées` : 'aucune pour l’instant'}
                onClick={() => toggle('status', 'approved')} pressed={filter.status === 'approved'} title="Ne voir que les demandes validées" />
              <Stat label="Refusées" Icon={CircleX} value={facts.byStatus.rejected} tone={facts.byStatus.rejected ? 'red' : undefined}
                note="chacune avec son motif" onClick={() => toggle('status', 'rejected')} pressed={filter.status === 'rejected'}
                title="Ne voir que les demandes refusées" />
              <Stat label="Retirées" Icon={Undo2} value={facts.byStatus.withdrawn} note="par leur auteur"
                onClick={() => toggle('status', 'withdrawn')} pressed={filter.status === 'withdrawn'} title="Ne voir que les demandes retirées" />
            </>
          ) : (
            <>
              <Stat label="En attente" Icon={Hourglass} value={pendingCount} tone={pendingCount ? 'amber' : undefined}
                note={pendingCount ? 'à valider ou à refuser' : 'rien à valider'} />
              <Stat label="À relire" Icon={TriangleAlert} value={facts.drift} tone={facts.drift ? 'red' : undefined}
                note={facts.drift ? 'les chiffres ont bougé depuis la demande' : 'aucun chiffre n’a bougé depuis'}
                onClick={() => toggle('drift', true)} pressed={filter.drift} title="Ne voir que les demandes à relire avec leur auteur" />
              <Stat label="Auteurs" Icon={Users} value={facts.authors.length} note={plural(facts.actions.length, 'geste différent', 'gestes différents')} />
              <Stat label="Plus ancienne" Icon={Clock3} text={facts.oldest ? fmtWhen(facts.oldest).slice(0, 10) : '—'}
                note={facts.oldest ? `en attente ${since(facts.oldest)}` : 'aucune demande en attente'} />
            </>
          )}
        </Stats>
      )}

      {items !== null && items.length > 0 && (
        <Reveal key={`split-${tab}`} className="fst-grid is-even">
          <Card title="Par auteur" Icon={Users}
            hint={done ? 'Qui a demandé, et ce que la direction en a fait. Un clic filtre la file.' : 'Qui attend une réponse ; en ambre, ce qui est à relire. Un clic filtre la file.'}>
            <Breakdown rows={facts.authors} active={filter.author} onPick={(key) => toggle('author', key)} />
          </Card>
          {done ? (
            <Card title="Issue des demandes" Icon={PieChart} hint="Ce que sont devenues les demandes traitées. Un clic filtre la file.">
              <Outcome counts={facts.byStatus} status={filter.status} onStatus={(key) => toggle('status', key)} />
            </Card>
          ) : (
            <Card title="Par geste" Icon={PenLine} hint="Ce que l’équipe demande de changer. Un clic filtre la file.">
              <Breakdown rows={facts.actions} active={filter.action} onPick={(key) => toggle('action', key)} wide />
            </Card>
          )}
        </Reveal>
      )}

      {items !== null && items.length === 0 && (
        <Empty boxed>{tab === 'pending' ? 'Aucune demande en attente.' : 'Aucune demande traitée.'}</Empty>
      )}

      {items !== null && items.length > 0 && (
        <>
          <div className="fup-list-head">
            <h3 className="fst-section-title">{done ? 'Demandes traitées' : 'Demandes à valider'}</h3>
            <span className="fst-cell-muted fst-num">{count(visible.length)}</span>
            <AnimatePresence initial={false}>
              {chips.map((chip) => (
                <Motion.button key={chip.key} type="button" className="fst-chip" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }} title="Retirer ce filtre"
                  onClick={() => setFilter((f) => ({ ...f, [chip.key]: NONE[chip.key] }))}>
                  {chip.label}<X size={13} />
                </Motion.button>
              ))}
            </AnimatePresence>
            <label className="fst-search" style={{ marginLeft: 'auto' }}>
              <Search size={14} />
              <input type="search" placeholder="Client, auteur, geste, motif…" value={query} onChange={(e) => setQuery(e.target.value)}
                aria-label="Chercher une demande" />
            </label>
            <p>Chaque demande dit qui, quoi et pourquoi. Valider rejoue le geste sous votre nom, avec la trace de l’auteur ; refuser demande un mot pour lui.</p>
          </div>

          {visible.length === 0 && <Empty boxed>Aucune demande ne correspond à ces filtres.</Empty>}

          <Reveal key={`list-${tab}`} className="fup-stack" amount={0.01}>
            <AnimatePresence initial={false}>
              {visible.slice(0, shown).map((req) => (
                <RequestCard
                  key={req.id}
                  req={req}
                  busy={acting === req.id}
                  confirm={confirm?.id === req.id ? confirm.kind : null}
                  onConfirm={(kind) => setConfirm(kind ? { id: req.id, kind } : null)}
                  note={notes[req.id] || ''}
                  onNote={(v) => setNotes((n) => ({ ...n, [req.id]: v }))}
                  onAct={(kind) => act(req, kind)}
                  onOpenClient={onOpenClient}
                  readOnly={readOnly}
                />
              ))}
            </AnimatePresence>
          </Reveal>

          {rest > 0 && (
            <div className="fup-more">
              <button type="button" className="fst-btn" onClick={() => setPage({ signature, shown: shown + PAGE })}>
                Afficher les {Math.min(rest, PAGE)} suivantes
              </button>
            </div>
          )}
        </>
      )}
    </Page>
  );
}

// Les états d'une demande dans une barre de répartition : en attente, à relire, validée, refusée, retirée.
const PART_COLOR = { pending: BEIGE, drift: AMBER, approved: GREEN, rejected: RED, withdrawn: GHOST };
const PART_ORDER = ['pending', 'drift', 'approved', 'rejected', 'withdrawn'];

// Une répartition en barres, comme « Par sales » des Statistiques : une ligne par personne (pastille) ou par
// catégorie (icône), découpée en segments { color, n }, qui filtre la liste au clic. Sert aussi aux états à traiter.
export function Breakdown({ rows, active, onPick, wide = false }) {
  const drawn = useDrawn();
  const largest = Math.max(...rows.map((row) => row.total), 1);
  return (
    <>
      {rows.map((row) => (
        <button key={row.key} type="button" className={`fst-hbar${wide ? ' fup-wide' : ''}`} data-on={active === row.key || undefined}
          aria-pressed={active === row.key} onClick={() => onPick(row.key)} title={row.name}>
          {row.Icon ? <span className="fup-ico"><row.Icon size={14} strokeWidth={1.9} /></span> : <Avatar name={row.name} />}
          <span className="fst-hbar-name">{row.name}</span>
          <span className="fst-hbar-track" style={{ width: `${(row.total / largest) * 100}%` }}>
            {row.segments.map((segment) => (
              <i key={segment.color} style={{ width: `${drawn ? (segment.n / row.total) * 100 : 0}%`, background: segment.color }} />
            ))}
          </span>
          <span className="fst-hbar-num fst-num">{count(row.total)}</span>
        </button>
      ))}
    </>
  );
}

// Ce que sont devenues les demandes traitées : la part validée en anneau, puis le détail qui filtre la file.
function Outcome({ counts, status, onStatus }) {
  const drawn = useDrawn();
  const decided = counts.approved + counts.rejected;
  const total = decided + counts.withdrawn;
  const rate = decided ? counts.approved / decided : null;
  const present = ['approved', 'rejected', 'withdrawn'].filter((key) => counts[key] > 0);
  return (
    <>
      <div className="fst-goal fup-goal">
        <ProgressRing value={rate || 0} size={116} stroke={10} color={GREEN} label={rate == null ? 'Aucune décision' : `${pct(rate, 0)} de demandes validées`}>
          {rate == null
            ? <div className="fst-ring-sub" style={{ marginTop: 0 }}>aucune décision</div>
            : <><Num className="fst-ring-num" value={rate} format={(v) => pct(v, 0)} /><div className="fst-ring-sub">validées</div></>}
        </ProgressRing>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="fst-rate-note" style={{ marginTop: 0 }}>
            {decided
              ? `${plural(counts.approved, 'demande validée', 'demandes validées')} sur ${count(decided)} décidées par la direction.`
              : 'Aucune demande n’a encore été décidée par la direction.'}
          </div>
          <div className="fst-split" aria-hidden="true" style={{ marginTop: 14 }}>
            {present.map((key) => (
              <i key={key} style={{ flexGrow: drawn ? counts[key] : 0, flexBasis: 0, background: STATUS[key].color, opacity: !status || status === key ? 1 : 0.25 }} />
            ))}
          </div>
        </div>
      </div>
      <div className="fst-legend">
        {present.map((key) => (
          <button key={key} type="button" className="fst-legend-row" aria-pressed={status === key} onClick={() => onStatus(key)}
            title="Voir ces demandes dans la file">
            <span className="fst-dot" style={{ background: STATUS[key].color }} />
            {STATUS[key].many}
            <b className="fst-num">{count(counts[key])}</b>
            <small className="fst-num">{pct(total ? counts[key] / total : 0, 0)}</small>
          </button>
        ))}
      </div>
    </>
  );
}

function RequestCard({ req, busy, confirm, onConfirm, note, onNote, onAct, onOpenClient, readOnly = false }) {
  const st = STATUS[req.status] || STATUS.pending;
  const months = useMemo(() => monthChanges(req), [req]);
  const pending = req.status === 'pending';
  const client = req.client || {};
  const kind = gesture(req.action_label);
  const step = confirm || 'idle';

  return (
    <Motion.article layout="position" variants={ITEM} exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.22 } }}
      className="fst-case fup-req" data-drift={(pending && !!req.drift) || undefined}>
      {/* Qui, quand, quel client */}
      <div className="fst-case-head">
        <button type="button" className="fst-case-name" onClick={() => client.id && onOpenClient?.(client.id)} title="Ouvrir la fiche du client">
          {client.societe || `Client ${req.client_id}`}
        </button>
        {client.numero_client && <span className="fst-case-num">n° {client.numero_client}</span>}
        <Pill tone={st.tone}>{st.label}</Pill>
      </div>
      <div className="fup-facts">
        <div>
          <span className="fup-k">Demandé par</span>
          {req.requested_by_name ? <Who name={req.requested_by_name} /> : <span>Quelqu’un</span>}
        </div>
        <div className="fst-num"><Clock3 size={13} strokeWidth={1.9} style={{ color: 'var(--faint)' }} />{fmtWhen(req.requested_at)}</div>
        {req.action_label && <div><Tag tone={kind.tone}>{req.action_label}</Tag></div>}
      </div>

      {/* Ce qu'elle a voulu faire */}
      <p className="fup-ask">Demande de <strong>{req.label}</strong>.</p>
      {req.reason && <p className="fup-quote">« {req.reason} »</p>}

      {/* Ce qu'elle a modifié, mois par mois : avant → proposé */}
      {months.some((m) => m.changes.length) && (
        <div className="fup-changes">
          <TableBox minWidth={620}>
            <thead>
              <tr>
                <Th Icon={CalendarDays}>Mois</Th>
                <Th Icon={PenLine}>Ce qui change</Th>
                <Th num>Avant</Th>
                <th className="fup-arrow" aria-hidden="true" />
                <Th num>Proposé</Th>
              </tr>
            </thead>
            <tbody>
              {months.flatMap((m) => m.changes.map((c, j) => (
                <tr key={`${m.iso}-${j}`}>
                  <td className="is-nowrap" style={{ fontWeight: 500 }}>{j === 0 ? m.label : ''}</td>
                  <td>{c.what}{c.note ? <span className="fst-cell-muted"> · {c.note}</span> : null}</td>
                  <td className="is-num fst-num" style={{ color: 'var(--muted)' }}>{c.text ? c.before : (c.before === null ? '—' : formatEUR(c.before))}</td>
                  <td className="fup-arrow" aria-hidden="true"><ArrowRight size={14} /></td>
                  <td className="is-num fst-num fup-after">{c.text ? c.after : (c.after === null ? '—' : formatEUR(c.after))}</td>
                </tr>
              )))}
            </tbody>
          </TableBox>
        </div>
      )}

      {/* Ce qui a bougé depuis : on n'écrase pas en silence */}
      {pending && req.drift && (
        <div className="fup-warn" role="status">
          <TriangleAlert size={15} />
          <span>{req.drift.charAt(0).toUpperCase() + req.drift.slice(1)} : à revoir avec {req.requested_by_name || 'l’auteur'} avant de valider.</span>
        </div>
      )}

      {/* Traitée : par qui, quand, pourquoi */}
      {!pending && (
        <p className="fup-decided">
          {req.status === 'approved' && <>Validée par {req.decided_by_name || 'la direction'} le {fmtWhen(req.decided_at)}{req.decision_note ? ` — « ${req.decision_note} »` : ''}.</>}
          {req.status === 'rejected' && <>Refusée par {req.decided_by_name || 'la direction'} le {fmtWhen(req.decided_at)}{req.decision_note ? ` — « ${req.decision_note} »` : ''}.</>}
          {req.status === 'withdrawn' && <>Retirée par {req.decided_by_name || 'son auteur'} le {fmtWhen(req.decided_at)}.</>}
        </p>
      )}

      {/* Valider / Refuser, en deux temps, au même endroit */}
      {pending && (
        <div className="fup-actions">
          <AnimatePresence mode="wait" initial={false}>
            <Motion.div key={step} className="fup-actions-row" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}>
              {confirm === 'reject' ? (
                <>
                  <input
                    className="fup-input"
                    value={note}
                    onChange={(e) => onNote(e.target.value)}
                    placeholder="Pourquoi (visible par l’auteur et dans le fil du client)"
                    aria-label="Motif du refus"
                    autoFocus
                  />
                  <button type="button" className="fst-btn fup-danger" disabled={busy || !note.trim()} data-busy={busy || undefined} onClick={() => onAct('reject')}>
                    <X size={14} /> {busy ? 'Refus…' : 'Confirmer le refus'}
                  </button>
                  <button type="button" className="fst-btn fup-quiet" disabled={busy} onClick={() => onConfirm(null)}>Garder</button>
                </>
              ) : confirm === 'approve' ? (
                <>
                  <span>Appliquer ce geste maintenant, sous votre nom ?</span>
                  <button type="button" className="fst-btn is-dark" disabled={busy} data-busy={busy || undefined} onClick={() => onAct('approve')}>
                    <Check size={14} /> {busy ? 'Validation…' : 'Confirmer la validation'}
                  </button>
                  <button type="button" className="fst-btn fup-quiet" disabled={busy} onClick={() => onConfirm(null)}>Pas maintenant</button>
                </>
              ) : (
                <>
                  <button type="button" className="fst-btn is-dark" disabled={busy || !!req.drift} onClick={() => onConfirm('approve')}
                    title={req.drift ? 'Les chiffres ont bougé : à revoir avec l’auteur' : 'Rejouer le geste, tracé « demande de …, validée »'}
                    {...(readOnly ? READ_ONLY_PROPS : {})}>
                    <Check size={14} /> Valider
                  </button>
                  <button type="button" className="fst-btn" disabled={busy} onClick={() => onConfirm('reject')} {...(readOnly ? READ_ONLY_PROPS : {})}>
                    <X size={14} /> Refuser
                  </button>
                </>
              )}
            </Motion.div>
          </AnimatePresence>
        </div>
      )}
    </Motion.article>
  );
}
