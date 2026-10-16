import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import apiClient from '../../../services/apiClient';
import { CountUp, EASE } from '../motion';
import { fr } from './model';
import LeadHistoryPanel from './LeadHistory';
import { agendaPeople, agendaRows } from './agendaData';

// Agenda des RDV comptés (dev 16/10/2026 : « certains sales disent qu'ils n'ont pas fait autant de rendez-vous ; nous on
// leur montre une data, il faut qu'elle soit transparente » ; « un R2 placé directement compte un R1 : à titre
// indicatif, montrer que ce R2 est un R2 direct »). Les RDV viennent des mêmes listes que les cartes R1 et R2 (dossiers
// r1p, r2p, r1_phone) : l'agenda recompte exactement ce que la page compte. Rien n'est modifié dans le CRM.

const KIND = {
  r1: { label: 'R1', long: 'R1 posé dans le CRM', color: '#2f4f9e', bg: '#e9eef6' },
  r2: { label: 'R2', long: 'R2 après un R1', color: '#2c6448', bg: '#e8f1ec' },
  direct: { label: 'R2 direct', long: 'R2 direct · R1 au téléphone compté', color: '#2c6448', bg: '#ffffff' },
};
const STATUS = {
  'Effectué': { icon: '✓', color: '#2c6448' }, 'Absent': { icon: '✕', color: '#c2410c' }, 'Annulé': { icon: '–', color: '#a08452' },
  'À venir': { icon: '•', color: '#6f86c2' }, 'Pas qualifié': { icon: '?', color: '#8b95a7' }, 'Reporté': { icon: '↻', color: '#8b95a7' },
  'À reporter': { icon: '↻', color: '#8b95a7' }, 'Au téléphone': { icon: '✓', color: '#2c6448' },
};
const WEEK = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
// Heures murales de Paris du CRM : lues telles quelles dans la chaîne, jamais converties.
const hour = (at) => at.slice(11, 16).replace(':', ' h ');

function bounds(period) {
  if (/^\d{4}-\d{2}$/.test(period)) {
    const start = utc(`${period}-01`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    return [iso(start), iso(end), `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`];
  }
  const [a, b] = String(period).split('..');
  return [a, b, `du ${a.slice(8, 10)}/${a.slice(5, 7)} au ${b.slice(8, 10)}/${b.slice(5, 7)}`];
}

const fetchRows = (period, metric) => apiClient.get(`/api/v1/monitoring/performance/v2/dossiers?period=${encodeURIComponent(period)}&metric=${metric}`)
  .then((d) => d.rows || []);

export default function RdvAgenda({ open, period, source, dark, onClose }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);
  const [sales, setSales] = useState(null);
  const [kinds, setKinds] = useState({ r1: true, r2: true, direct: true });
  const [day, setDay] = useState(null);
  const [hist, setHist] = useState(null);
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setRows(null); setError(false); setSales(null); setDay(null); setHist(null); setKinds({ r1: true, r2: true, direct: true });
    Promise.all([fetchRows(period, 'r1p'), fetchRows(period, 'r2p'), fetchRows(period, 'r1_phone')]).then(([r1, r2, phone]) => {
      if (!alive) return;
      const all = agendaRows(r1, r2, phone, source);
      setRows(all);
    }).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [open, period, source]);
  useEffect(() => {
    if (!open || hist) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { if (day) setDay(null); else onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, hist, day]);
  const closeHist = useCallback(() => setHist(null), []);

  const people = useMemo(() => agendaPeople(rows || []), [rows]);
  const shown = (rows || []).filter((r) => kinds[r.kind] && (!sales || r.sales === sales));
  const byDay = useMemo(() => {
    const m = new Map();
    shown.forEach((r) => { const d = String(r.date).slice(0, 10); if (!m.has(d)) m.set(d, []); m.get(d).push(r); });
    return m;
  }, [shown]);
  const [from, to, label] = bounds(period);
  const weeks = useMemo(() => {
    const start = utc(from);
    const first = new Date(start); first.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    const out = [];
    for (let d = new Date(first); iso(d) <= to || out.length % 7; d.setUTCDate(d.getUTCDate() + 1)) out.push(iso(d));
    return out;
  }, [from, to]);
  const total = (k) => (rows || []).filter((r) => r.kind === k && (!sales || r.sales === sales)).length;
  const person = people.find((p) => p.name === sales);
  const today = new Date().toISOString().slice(0, 10);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={`ps2${dark ? ' is-dark' : ''}`} style={{ display: 'contents' }}>
          <Motion.div className="ps2-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />
          <div className="ps2-agenda-wrap">
          <Motion.section className="ps2-agenda" role="dialog" aria-modal="true" aria-label="Agenda des RDV comptés"
            initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 8 }} transition={{ duration: 0.4, ease: EASE }}>
            <header className="ps2-agenda-head">
              <div>
                <span className="ps2-mono">Agenda des RDV comptés</span>
                <h2>{sales || 'Tous les sales'} · {label}</h2>
              </div>
              <div className="ps2-agenda-kinds" role="group" aria-label="Types de RDV">
                {Object.entries(KIND).map(([k, v]) => (
                  <button type="button" key={k} aria-pressed={kinds[k]} className={`ps2-agenda-kind is-${k}${kinds[k] ? ' is-on' : ''}`}
                    onClick={() => setKinds((s) => ({ ...s, [k]: !s[k] }))}>
                    <i />{v.long}<b className="ps2-num">{rows ? fr(total(k)) : '…'}</b>
                  </button>
                ))}
              </div>
              <button type="button" className="ps2-icon-btn" aria-label="Fermer" onClick={onClose}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </header>
            {error && <p className="ps2-note" role="alert" style={{ padding: 20 }}>RDV non chargés.</p>}
            {!rows && !error && <div className="ps2-loading" aria-label="Chargement"><i /><i /><i /><i /></div>}
            {rows && (
              <div className="ps2-agenda-body">
                <aside className="ps2-agenda-side">
                  <div className="ps2-agenda-count">
                    <div><span>R1 comptés</span><b className="ps2-num"><CountUp value={total('r1') + total('direct')} duration={600} /></b>
                      <small>{fr(total('r1'))} dans le CRM + {fr(total('direct'))} au téléphone</small></div>
                    <div><span>R2</span><b className="ps2-num"><CountUp value={total('r2') + total('direct')} duration={600} /></b>
                      <small>{fr(total('r2'))} après un R1 + {fr(total('direct'))} directs</small></div>
                    {person && <div className="is-wide"><span>Résultat</span><small>{fr(person.done)} effectués · {fr(person.noshow)} absents</small></div>}
                  </div>
                  <ul className="ps2-agenda-people">
                    <li><button type="button" className={!sales ? 'is-on' : ''} onClick={() => setSales(null)}>
                      <span>Tous les sales</span><span className="ps2-num">{fr((rows || []).filter((r) => r.kind !== 'r2').length)} R1 · {fr((rows || []).filter((r) => r.kind !== 'r1').length)} R2</span></button></li>
                    {people.map((p, i) => (
                      <Motion.li key={p.name} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: EASE, delay: Math.min(i, 16) * 0.025 }}>
                        <button type="button" className={sales === p.name ? 'is-on' : ''} onClick={() => setSales(sales === p.name ? null : p.name)}>
                          <span>{p.name}</span>
                          <span className="ps2-num"><b>{fr(p.r1 + p.direct)}</b> R1{p.direct ? <em> dont {fr(p.direct)} tél.</em> : null} · <b>{fr(p.r2 + p.direct)}</b> R2{p.direct ? <em> dont {fr(p.direct)} directs</em> : null}</span>
                        </button>
                      </Motion.li>
                    ))}
                  </ul>
                </aside>
                <div className="ps2-agenda-main">
                  <div className="ps2-agenda-grid ps2-agenda-dow">{WEEK.map((w) => <span key={w}>{w}</span>)}</div>
                  <div className="ps2-agenda-grid">
                    {weeks.map((d, i) => {
                      const inside = d >= from && d <= to;
                      const list = inside ? byDay.get(d) || [] : [];
                      const counts = { r1: 0, r2: 0, direct: 0 };
                      list.forEach((r) => { counts[r.kind] += 1; });
                      return (
                        <Motion.button type="button" key={d} className={`ps2-agenda-day${inside ? '' : ' is-out'}${d === today ? ' is-today' : ''}${day === d ? ' is-on' : ''}`}
                          disabled={!inside || !list.length} onClick={() => setDay(d)}
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE, delay: Math.min(i, 41) * 0.008 }}>
                          <span className="ps2-agenda-date">{Number(d.slice(8, 10))}</span>
                          {sales ? (
                            <span className="ps2-agenda-chips">
                              {list.slice(0, 4).map((r, k) => <Chip key={`${r.lead_id}-${k}`} r={r} />)}
                              {list.length > 4 && <span className="ps2-agenda-more">+{list.length - 4}</span>}
                            </span>
                          ) : list.length > 0 && (
                            <span className="ps2-agenda-sum">
                              {counts.r1 > 0 && <span className="is-r1"><b className="ps2-num">{counts.r1}</b> R1</span>}
                              {counts.r2 + counts.direct > 0 && <span className="is-r2"><b className="ps2-num">{counts.r2 + counts.direct}</b> R2{counts.direct ? <em> · {counts.direct} dir.</em> : null}</span>}
                            </span>
                          )}
                        </Motion.button>
                      );
                    })}
                  </div>
                </div>
                <AnimatePresence>
                  {day && (
                    <Motion.aside key={day} className="ps2-agenda-dayview" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ duration: 0.35, ease: EASE }}>
                      <div className="ps2-agenda-dayhead">
                        <b>{new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}</b>
                        <button type="button" className="ps2-icon-btn" aria-label="Fermer le jour" onClick={() => setDay(null)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                      </div>
                      <ol className="ps2-agenda-daylist">
                        {(byDay.get(day) || []).map((r, i) => (
                          <Motion.li key={`${r.lead_id}-${r.kind}-${i}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: EASE, delay: Math.min(i, 20) * 0.02 }}>
                            <button type="button" onClick={() => setHist({ id: r.lead_id, name: r.name, now: r.sales })}>
                              <span className="ps2-num ps2-agenda-hour">{hour(String(r.date))}</span>
                              <span className={`ps2-agenda-tag is-${r.kind}`}>{KIND[r.kind].label}</span>
                              <span className="ps2-agenda-who"><b>{r.name || r.ref}</b><small>{r.sales}{r.setter ? ' · posé par un setter' : ''}{r.kind === 'direct' ? ' · R1 au téléphone compté' : ''}</small></span>
                              <span className="ps2-agenda-status" style={{ color: STATUS[r.status]?.color }}>{STATUS[r.status]?.icon || '•'} {r.status}</span>
                            </button>
                          </Motion.li>
                        ))}
                      </ol>
                    </Motion.aside>
                  )}
                </AnimatePresence>
              </div>
            )}
          </Motion.section>
          </div>
          <LeadHistoryPanel lead={hist} dark={dark} onClose={closeHist} depth={1} />
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Chip({ r }) {
  const s = STATUS[r.status] || {};
  return (
    <span className={`ps2-agenda-chip is-${r.kind}`} title={`${hour(String(r.date))} · ${KIND[r.kind].long} · ${r.name || r.ref} · ${r.status}`}>
      <span className="ps2-num">{String(r.date).slice(11, 16)}</span>
      <span className="ps2-agenda-chip-name">{r.name || r.ref}</span>
      <i style={{ color: s.color }}>{s.icon}</i>
    </span>
  );
}
