import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { CountUp, EASE, ITEM, Reveal, useRevealed } from '../motion';
import { Detail, Info } from './Pop';
import { dm, fr } from './model';
import { AFFECTED_FATES, GROUP, REASON_ORDER, REASONS, affectedLeads, monthOf, reasonOf } from './intakeData';
import { loadIntake } from './intakeApi';
import LeadHistoryPanel from './LeadHistory';

// Le détail du schéma « Fiches reçues » (dev 16/10/2026 : « il nous faut le détail des leads qui ont été affectés le mois
// en cours, même s'ils ne sont plus dans les tracking sheets » ; « faire la diff entre les leads repris du pool qui
// viennent du mois en cours et les leads repris du pool anciens »). Les fiches viennent du serveur, classées par le même
// calcul que le schéma (/monitoring/performance/v2/intake/leads) : la liste d'une case a toujours le chiffre de la case.

const STAGE = { none: 'Aucun RDV', r1_set: 'R1 posé', r1_done: 'R1 effectué', r2_set: 'R2 posé', r2_done: 'R2 effectué', signed: 'Signé' };
const CLAIM = { barrier: 'barrage, R1 posé', callback: 'barrage, rappel', reactivity: 'pool réactivité', other: 'réaffecté ensuite' };
const POOL = { traitement: '3 jours sans RDV', reactivite: '6 min ratées' };
// Teintes Owner : le mois en cours reprend la couleur de sa case du schéma, les mois anciens du marine au plus clair.
export const RECLAIM_MONTH = '#7f9ad9';
const OLDER = ['#1e3a7b', '#3a5598', '#5f6f92', '#8b95a7', '#b9c0cc'];
const olderColor = (i) => OLDER[Math.min(i, OLDER.length - 1)];

// Horodatage réel (journal de réactivité, timestamptz) : affiché à l'heure de Paris.
const hm = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).replace(' ', ' ') : '');

// Le chemin d'une fiche, du moteur à aujourd'hui, en étapes courtes.
function steps(r) {
  const out = [];
  if (r.engine) out.push({ text: `Moteur → ${r.engine}` });
  (r.missed || []).forEach((name, i) => out.push({ text: `6 min ratées · ${name}${r.missed_at?.[i] ? ` · ${hm(r.missed_at[i])}` : ''}`, tone: 'low' }));
  const holder = r.now || r.previous;
  // Une reprise du pool s'affiche toujours, même par le sales que le moteur avait choisi.
  if (holder && (holder !== r.engine || ['barrier', 'callback', 'reactivity', 'manual'].includes(r.how))) {
    const how = r.how === 'barrier' ? 'repris au barrage' : r.how === 'callback' ? 'repris pour un rappel' : r.how === 'reactivity' ? 'repris au pool réactivité'
      : r.how === 'sla' ? 'redonné après les 6 min' : r.how === 'manual' ? 'réaffecté à la main' : 'donné';
    out.push({ text: `${how} · ${holder}${r.moved_at ? ` · ${dm(r.moved_at)}` : ''}` });
  }
  if (!r.now && r.pool) out.push({ text: `au pool · ${POOL[r.pool] || r.pool}${r.pool_since ? ` · ${dm(r.pool_since)}` : ''}`, tone: 'warn' });
  return out;
}

function Bars({ items, active, onPick }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="ps2-rows">
      {items.map((it) => (
        <div key={it.key} className={`ps2-row-line${active && active !== it.key ? ' is-dim' : ''}`}>
          <button type="button" className="ps2-link" style={{ color: 'var(--ink)', fontWeight: 500, textAlign: 'left' }} onClick={() => onPick(it.key)}>{it.label}</button>
          <b className="ps2-num">{fr(it.value)}</b>
          <span className="ps2-bar"><Motion.i initial={{ width: 0 }} animate={{ width: `${(it.value / max) * 100}%` }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.15 }} style={{ background: it.color || 'var(--navy)' }} /></span>
        </div>
      ))}
    </div>
  );
}

const count = (rows, key) => {
  const m = new Map();
  rows.forEach((r) => { const k = key(r); if (k) m.set(k, (m.get(k) || 0) + 1); });
  return [...m.entries()].map(([k, v]) => ({ key: k, label: k, value: v })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
};
const PAGE = 30;
const plural = (n) => (n > 1 ? `Voir les ${fr(n)} leads` : 'Voir le lead');

// Panneau latéral : les fiches d'une case du schéma, d'une raison ou d'une barre des reprises du pool. Chaque encadré
// filtre la liste ; les autres encadrés se recomptent sur ce qui reste.
export function IntakePanel({ open, period, dark, onClose }) {
  const [state, setState] = useState({ loading: false, data: null, error: false });
  const [sel, setSel] = useState({});
  const [all, setAll] = useState(false);
  const [hist, setHist] = useState(null);
  useEffect(() => {
    setSel({}); setAll(false); setHist(null);
    if (!open) return undefined;
    let alive = true;
    setState((s) => ({ ...s, loading: !s.data, error: false }));
    loadIntake(period).then((data) => alive && setState({ loading: false, data, error: false }))
      .catch(() => alive && setState({ loading: false, data: null, error: true }));
    return () => { alive = false; };
  }, [open, period]);
  useEffect(() => {
    if (!open || hist) return undefined;   // l'historique ouvert par-dessus garde Échap pour lui
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, hist]);
  const closeHist = useCallback(() => setHist(null), []);

  const base = useMemo(() => (state.data && open ? open.pick(state.data) : []), [state.data, open]);
  const groups = open?.groups || [];
  const keep = (r, except) => groups.every((g, i) => i === except || !sel[i] || g.key(r) === sel[i]);
  const rows = base.filter((r) => keep(r, -1));
  const filtered = Object.values(sel).some(Boolean);
  const matches = state.data && open?.expected != null ? base.length === open.expected : null;

  const exportCsv = () => {
    const head = ['lead', 'nom', 'entreprise', 'reçu le', 'affecté à', 'pourquoi parti', 'précision', 'parcours', 'aujourd’hui', 'étape'];
    const lines = rows.map((r) => { const why = reasonOf(r); return [`#${r.id}`, r.name, r.company, r.received, r.engine, why.label, why.notes.join(' / '),
      steps(r).map((s) => s.text).join(' / '), r.now || (r.opt_out ? 'retiré du pool' : 'au pool'), STAGE[r.stage]]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'); });
    const blob = new Blob(['﻿' + [head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fiches-${period}-${open.file || 'detail'}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={`ps2${dark ? ' is-dark' : ''}`} style={{ display: 'contents' }}>
          <Motion.div className="ps2-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />
          <Motion.aside className="ps2-panel ps2-intake-panel" role="dialog" aria-modal="true" aria-label={open.title}
            initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }}>
            <div className="ps2-panel-head">
              <span className="ps2-mono">{open.kicker}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="ps2-ghost-btn" onClick={exportCsv} disabled={!rows.length}>EXPORTER</button>
                <button type="button" className="ps2-icon-btn" aria-label="Fermer" onClick={onClose}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="ps2-panel-body">
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--soft)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {open.color && <span className="ps2-swatch" style={{ background: open.color }} />}{[open.title, ...groups.map((g, i) => sel[i]).filter(Boolean)].join(' · ')}</h2>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
                  <span className="ps2-num" style={{ fontSize: 52, fontWeight: 600, letterSpacing: '-.03em' }}>
                    {state.data ? <CountUp value={rows.length} duration={600} /> : fr(open.expected)}</span>
                  {matches != null && !filtered && (
                    <span className={`ps2-intake-check ${matches ? 'is-ok' : 'is-ko'}`}>
                      {matches ? `✓ recomptées une par une : ${fr(base.length)}` : `! ${fr(base.length)} fiches pour ${fr(open.expected)} affichées`}</span>
                  )}
                </div>
              </div>

              {state.loading && <div className="ps2-loading" aria-label="Chargement"><i /><i /><i /><i /></div>}
              {state.error && <p className="ps2-note" role="alert">Les fiches n’ont pas pu être chargées.</p>}
              {state.data && (
                <>
                  {groups.length > 0 && (
                    <div className="ps2-intake-groups">
                      {groups.map((g, i) => {
                        const items = count(base.filter((r) => keep(r, i)), g.key).map((it) => ({ ...it, color: g.color?.(it.key) }));
                        if (items.length < 2 && !sel[i]) return null;   // une seule valeur : rien à départager
                        return (
                          <div key={g.title} className="ps2-box"><h3>{g.title}</h3>
                            <Bars items={items.slice(0, 10)} active={sel[i]} onPick={(k) => setSel((s) => ({ ...s, [i]: s[i] === k ? null : k }))} />
                            {items.length > 10 && <p className="ps2-note">et {items.length - 10} autres</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div>
                    <div className="ps2-card-head">
                      <h3>Les fiches{filtered ? ' filtrées' : ''}</h3>
                      {filtered && <button type="button" className="ps2-link" onClick={() => setSel({})}>Retirer le filtre</button>}
                    </div>
                    <table className="ps2-dossiers ps2-intake-table">
                      <thead><tr><th>Lead</th><th>Reçu</th><th>Pourquoi parti</th><th>Parcours</th><th>Aujourd’hui</th><th>Étape</th></tr></thead>
                      <tbody>
                        {(all ? rows : rows.slice(0, PAGE)).map((r, i) => {
                          const why = reasonOf(r);
                          return (
                            <Motion.tr key={r.id} className="ps2-intake-row" tabIndex={0} onClick={() => setHist(r)} onKeyDown={(e) => e.key === 'Enter' && setHist(r)}
                              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE, delay: Math.min(i, 14) * 0.02 }}>
                              <td><span className="ps2-intake-ref">#{r.id}</span><span className="ps2-intake-name">{r.name || '–'}</span>
                                {r.company && <span className="ps2-soft ps2-intake-co">{r.company}</span>}</td>
                              <td className="ps2-num">{r.received ? dm(r.received) : '–'}</td>
                              <td>{r.engine || r.departure !== 'other' ? (
                                <div className="ps2-intake-why"><span className="ps2-intake-why-tag" style={{ '--c': why.color }}><ReasonIcon kind={why.icon} />{why.label}</span>
                                  {why.notes.map((n) => <span key={n} className="ps2-intake-why-note">{n}</span>)}</div>
                              ) : <span className="ps2-soft">jamais donnée</span>}</td>
                              <td><div className="ps2-intake-steps">{steps(r).map((s, k) => <span key={k} className={s.tone ? `is-${s.tone}` : ''}>{s.text}</span>)}</div></td>
                              <td>{r.now ? <b style={{ fontWeight: 600 }}>{r.now}</b>
                                : <span className="ps2-tag is-warn" style={{ marginLeft: 0 }}>{r.opt_out ? 'retiré du pool' : r.engine || r.previous ? 'au pool' : 'personne'}</span>}</td>
                              <td><span className={`ps2-intake-stage is-${r.stage}`}>{STAGE[r.stage] || r.stage}</span></td>
                            </Motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {rows.length > PAGE && <button type="button" className="ps2-link" style={{ marginTop: 10 }} onClick={() => setAll((v) => !v)}>
                      {all ? 'Réduire' : `Afficher les ${fr(rows.length)} fiches`}</button>}
                    {!rows.length && <p className="ps2-note">Aucune fiche.</p>}
                  </div>
                </>
              )}
            </div>
          </Motion.aside>
          <LeadHistoryPanel lead={hist} dark={dark} onClose={closeHist} depth={1} />
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// Icônes des raisons, tracées à l'apparition.
export function ReasonIcon({ kind, size = 13 }) {
  const draw = { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 0.6, ease: EASE, delay: 0.1 } };
  const paths = {
    check: ['M5 12.5l4.2 4.2L19 7'],
    clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3.2 2'],
    calendar: ['M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z', 'M4 10h16', 'M8 3.5v4M16 3.5v4', 'M10 14l4 4M14 14l-4 4'],
    hand: ['M7 12V6.5a1.5 1.5 0 0 1 3 0V11', 'M10 10.5V5a1.5 1.5 0 0 1 3 0v5.5', 'M13 10.5V6.5a1.5 1.5 0 0 1 3 0V13a7 7 0 0 1-7 7h-.5A5.5 5.5 0 0 1 4 15.2L3 12.8a1.5 1.5 0 0 1 2.6-1.5L7 13'],
    dot: ['M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'],
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {(paths[kind] || paths.dot).map((d) => <Motion.path key={d} d={d} {...draw} />)}
    </svg>
  );
}

// Carte « Repris du pool » : les fiches du mois (case du schéma) et les leads plus anciens repris dans le mois.
export function PoolReclaims({ reclaims, month, onLeads }) {
  const on = useRevealed();
  if (!reclaims) return null;
  const total = reclaims.month + reclaims.older;
  const months = Object.entries(reclaims.older_by_month || {});
  const max = Math.max(1, reclaims.month, reclaims.older);
  const people = reclaims.by_sales || [];
  const peopleMax = Math.max(1, ...people.map((p) => p.month + p.older));
  const kinds = (part) => Object.entries(reclaims.by_kind?.[part] || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => [CLAIM[k] || k, fr(v)]);
  const reclaimed = (d) => [
    ...d.leads.filter((r) => r.channel === 'ads' && r.fate === 'ads_pool'),
    ...d.older,
  ];
  const openMonth = () => onLeads({ kicker: `Repris du pool en ${month}`, title: `Leads reçus en ${month}`, color: RECLAIM_MONTH, expected: reclaims.month, file: 'repris-du-mois',
    pick: (d) => d.leads.filter((r) => r.channel === 'ads' && r.fate === 'ads_pool'), groups: [GROUP.now, GROUP.engine] });
  const openOlder = (ym) => onLeads({ kicker: `Repris du pool en ${month}`, title: ym ? `Leads reçus en ${monthOf(ym)}` : 'Leads plus anciens',
    color: ym ? olderColor(months.findIndex(([k]) => k === ym)) : OLDER[0], expected: ym ? reclaims.older_by_month[ym] : reclaims.older, file: `repris-anciens${ym ? `-${ym}` : ''}`,
    pick: (d) => d.older.filter((r) => !ym || r.received?.slice(0, 7) === ym), groups: [GROUP.now, GROUP.received] });
  const openSales = (name) => onLeads({ kicker: `Repris du pool en ${month}`, title: name, expected: null, file: `repris-${name}`,
    pick: (d) => reclaimed(d).filter((r) => r.now === name), groups: [GROUP.received] });
  const bar = (value, delay) => ({ initial: { width: 0 }, animate: { width: on ? `${(value / max) * 100}%` : 0 }, transition: { duration: 0.9, ease: EASE, delay } });
  return (
    <Reveal as="section" className="ps2-card ps2-span-12" aria-labelledby="ps2-reclaims-title">
      <Motion.div className="ps2-card-head" variants={ITEM}>
        <h2 id="ps2-reclaims-title">Repris du pool en {month}</h2>
        <Info className="ps2-chip-soft" label="Reprises du pool" detail={<Detail kicker={`Repris du pool en ${month}`} value={fr(total)}
          rows={[[`Leads reçus en ${month}`, fr(reclaims.month)], ['Leads plus anciens', fr(reclaims.older)]]}
          lines={['Lead chez le sales qui l’a repris, dernière reprise connue.']} />}>{fr(total)} reprises</Info>
      </Motion.div>
      <div className="ps2-reclaims">
        <div className="ps2-reclaims-split">
          <Motion.div variants={ITEM} className="ps2-reclaims-row">
            <Info className="ps2-reclaims-label" label={`Leads reçus en ${month}`} detail={(close) => (
              <Detail kicker={`Reçus en ${month}`} title="Case « Repris du pool » du schéma" value={fr(reclaims.month)} rows={kinds('month')}
                action={<button type="button" className="ps2-link" onClick={() => { close(); openMonth(); }}>{plural(reclaims.month)}</button>} />)}>
              <span className="ps2-swatch" style={{ background: RECLAIM_MONTH }} />Reçus en {month}</Info>
            <button type="button" className="ps2-reclaims-track" onClick={openMonth} aria-label={`${plural(reclaims.month)} reçu${reclaims.month > 1 ? 's' : ''} en ${month}`}>
              <Motion.span className="ps2-reclaims-seg" style={{ background: RECLAIM_MONTH }} {...bar(reclaims.month, 0.2)} />
            </button>
            <b className="ps2-num ps2-reclaims-n"><CountUp value={reclaims.month} delay={200} /></b>
          </Motion.div>
          <Motion.div variants={ITEM} className="ps2-reclaims-row">
            <Info className="ps2-reclaims-label" label="Leads plus anciens" detail={(close) => (
              <Detail kicker="Reçus avant le mois" title={`Repris en ${month}`} value={fr(reclaims.older)}
                rows={[...months.map(([ym, v]) => [`Reçus en ${monthOf(ym)}`, fr(v)]), ...kinds('older')]}
                action={<button type="button" className="ps2-link" onClick={() => { close(); openOlder(null); }}>{plural(reclaims.older)}</button>} />)}>
              <span className="ps2-swatch" style={{ background: OLDER[0] }} />Plus anciens</Info>
            <div className="ps2-reclaims-track is-stack">
              <Motion.span className="ps2-reclaims-stack" {...bar(reclaims.older, 0.35)}>
                {months.map(([ym, v], i) => (
                  <button type="button" key={ym} className="ps2-reclaims-seg" style={{ background: olderColor(i), flexGrow: v }}
                    title={`${monthOf(ym)} : ${v}`} aria-label={`${plural(v)} reçu${v > 1 ? 's' : ''} en ${monthOf(ym)}`} onClick={() => openOlder(ym)} />
                ))}
              </Motion.span>
            </div>
            <b className="ps2-num ps2-reclaims-n"><CountUp value={reclaims.older} delay={350} /></b>
          </Motion.div>
          {months.length > 0 && (
            <Motion.div variants={ITEM} className="ps2-reclaims-months">
              {months.map(([ym, v], i) => (
                <button type="button" key={ym} onClick={() => openOlder(ym)}><span className="ps2-swatch" style={{ background: olderColor(i) }} />{monthOf(ym)}<b className="ps2-num">{fr(v)}</b></button>
              ))}
            </Motion.div>
          )}
        </div>
        <Motion.ul variants={ITEM} className="ps2-reclaims-people">
          {people.map((p, i) => (
            <li key={p.name}>
              <button type="button" onClick={() => openSales(p.name)} aria-label={`${p.name} : ${p.month} reçus en ${month}, ${p.older} plus anciens`}>
                <span className="ps2-reclaims-who">{p.name}</span>
                <span className="ps2-reclaims-mini">
                  <Motion.i style={{ background: RECLAIM_MONTH }} initial={{ width: 0 }} animate={{ width: on ? `${(p.month / peopleMax) * 100}%` : 0 }}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.3 + i * 0.04 }} />
                  <Motion.i style={{ background: OLDER[0] }} initial={{ width: 0 }} animate={{ width: on ? `${(p.older / peopleMax) * 100}%` : 0 }}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.38 + i * 0.04 }} />
                </span>
                <span className="ps2-num ps2-reclaims-pair"><b>{fr(p.month)}</b><span className="ps2-soft"> + </span><b style={{ color: 'var(--navy)' }}>{fr(p.older)}</b></span>
              </button>
            </li>
          ))}
        </Motion.ul>
      </div>
    </Reveal>
  );
}

// Carte « Affectés » (dev 16/10/2026 : « il faut qu'on sache exactement les leads qui ont été affectés dans une première
// intention… après il s'est passé des trucs… on veut le détail : pourquoi ils sont repartis dans le pool ») : les fiches
// ADS du mois données à un sales (les trois cases du schéma), ce qu'elles sont devenues et pourquoi, par sales.
const FATE_BAR = [['ads_affectation', 'Chez le sales affecté', '#1e3a7b'], ['ads_pool', 'Repris du pool', '#7f9ad9'], ['pool_waiting', 'Au pool', '#c3cde3']];

export function AffectedCard({ period, month, intake, onLeads }) {
  const on = useRevealed();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    setData(null); setError(false);
    loadIntake(period).then((d) => alive && setData(d)).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [period]);
  const a = data?.affected;
  // Les trois cases du schéma, lues dans la page : la carte ne remplace aucun chiffre, elle les détaille.
  const schema = Object.fromEntries((intake?.links || []).filter((l) => l.channel === 'ads' && AFFECTED_FATES.includes(l.fate))
    .reduce((m, l) => m.set(l.fate, (m.get(l.fate) || 0) + l.n), new Map()));
  const total = a?.total ?? Object.values(schema).reduce((x, y) => x + y, 0);
  const reasons = a ? REASON_ORDER.filter((k) => a.by_reason[k]).map((k) => ({ key: k, ...REASONS[k], value: a.by_reason[k], answering: a.answering?.[k] || 0 })) : [];
  const max = Math.max(1, ...reasons.map((r) => r.value));
  const cols = REASON_ORDER.filter((k) => k !== 'other' && reasons.some((r) => r.key === k));
  return (
    <Reveal as="section" className="ps2-card ps2-span-12" aria-labelledby="ps2-affected-title">
      <Motion.div className="ps2-card-head" variants={ITEM}>
        <h2 id="ps2-affected-title">Leads affectés en {month}</h2>
        <Info className="ps2-chip-soft" label="Leads affectés" detail={<Detail kicker={`Affectés en ${month}`} value={fr(total)}
          rows={FATE_BAR.map(([f, l]) => [l, fr(a?.by_fate?.[f] ?? schema[f] ?? 0)])}
          lines={['Fiches ADS du mois données à un sales par le moteur, où qu’elles soient aujourd’hui.']} />}>première intention</Info>
      </Motion.div>
      {error && <p className="ps2-note" role="alert">Détail non chargé.</p>}
      <div className="ps2-affected">
        <Motion.div variants={ITEM} className="ps2-affected-total">
          <button type="button" className="ps2-affected-big" onClick={() => onLeads(affectedLeads(month, { expected: total }))} aria-label={`Voir les ${total} leads affectés`}>
            <b className="ps2-num"><CountUp value={total} /></b><span>affectés par le moteur</span>
          </button>
          <div className="ps2-affected-fates" role="img" aria-label={FATE_BAR.map(([f, l]) => `${l} ${a?.by_fate?.[f] ?? schema[f] ?? 0}`).join(', ')}>
            {FATE_BAR.map(([f, , c], i) => {
              const v = a?.by_fate?.[f] ?? schema[f] ?? 0;
              return <Motion.span key={f} style={{ background: c }} initial={{ flexGrow: 0 }} animate={{ flexGrow: on ? v : 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.2 + i * 0.1 }} />;
            })}
          </div>
          <ul className="ps2-affected-legend">
            {FATE_BAR.map(([f, l, c]) => <li key={f}><span className="ps2-swatch" style={{ background: c }} />{l}<b className="ps2-num">{fr(a?.by_fate?.[f] ?? schema[f] ?? 0)}</b></li>)}
          </ul>
        </Motion.div>

        <Motion.div variants={ITEM} className="ps2-affected-why">
          <div className="ps2-mono ps2-affected-sub">Pourquoi ils sont partis</div>
          {!a && !error && <div className="ps2-loading" aria-label="Chargement"><i /><i /><i /><i /></div>}
          {reasons.map((r, i) => (
            <button type="button" key={r.key} className="ps2-affected-reason" onClick={() => onLeads(affectedLeads(month, { reason: r.key, expected: r.value }))}>
              <span className="ps2-affected-icon" style={{ color: r.color }}><ReasonIcon kind={r.icon} size={15} /></span>
              <span className="ps2-affected-label">{r.label}
                {r.key === 'barrier' && (r.answering > 0 || a.opt_out > 0) && (
                  <small>{[r.answering ? `${fr(r.answering)} répondeurs` : null, a.opt_out ? `${fr(a.opt_out)} retirés du pool` : null].filter(Boolean).join(' · ')}</small>)}</span>
              <span className="ps2-affected-track">
                <Motion.i style={{ background: r.color }} initial={{ width: 0 }} animate={{ width: on ? `${(r.value / max) * 100}%` : 0 }}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.25 + i * 0.07 }} />
                {r.key === 'barrier' && r.answering > 0 && (
                  <Motion.i className="is-sub" initial={{ width: 0 }} animate={{ width: on ? `${(r.answering / max) * 100}%` : 0 }}
                    transition={{ duration: 0.8, ease: EASE, delay: 0.45 + i * 0.07 }} />)}
              </span>
              <b className="ps2-num">{fr(r.value)}</b>
            </button>
          ))}
        </Motion.div>

        <Motion.div variants={ITEM} className="ps2-affected-people">
          {a && (
            <table className="ps2-affected-table">
              <thead><tr><th style={{ textAlign: 'left' }}>Affectés à</th><th>Total</th>
                {cols.map((k) => <th key={k} title={REASONS[k].label}><span style={{ color: REASONS[k].color }}><ReasonIcon kind={REASONS[k].icon} size={12} /></span> {REASONS[k].short}</th>)}</tr></thead>
              <tbody>
                {a.by_sales.map((p, i) => (
                  <Motion.tr key={p.name} initial={{ opacity: 0, y: 4 }} animate={on ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.35, ease: EASE, delay: 0.2 + i * 0.03 }}>
                    <td style={{ textAlign: 'left' }}><button type="button" className="ps2-affected-cell is-name" onClick={() => onLeads(affectedLeads(month, { sales: p.name, expected: p.affected }))}>{p.name}</button>
                      <span className="ps2-affected-mini">{cols.map((k) => (p[k] ? <i key={k} style={{ background: REASONS[k].color, flexGrow: p[k] }} /> : null))}</span></td>
                    <td><button type="button" className="ps2-affected-cell" onClick={() => onLeads(affectedLeads(month, { sales: p.name, expected: p.affected }))}><b>{fr(p.affected)}</b></button></td>
                    {cols.map((k) => (
                      <td key={k}>{p[k] ? <button type="button" className="ps2-affected-cell" onClick={() => onLeads(affectedLeads(month, { sales: p.name, reason: k, expected: p[k] }))}>{fr(p[k])}</button>
                        : <span className="ps2-muted">0</span>}</td>
                    ))}
                  </Motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </Motion.div>
      </div>
    </Reveal>
  );
}
