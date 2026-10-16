import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { EASE } from '../motion';
import { fr } from './model';
import { loadHistory } from './intakeApi';

// Historique d'un lead (dev 16/10/2026 : « un endroit où on peut vraiment checker cet historique : pour chaque lead
// arrivé dans le pipe »). La frise vient du serveur (/monitoring/performance/v2/leads/{id}/history), reconstituée à
// partir des journaux existants ; elle s'affiche tout de suite, puis les appels Allo s'y ajoutent.

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
// `at` porte l'heure de Paris et son décalage (« 2026-10-01T13:46+02:00 ») : on lit la date et l'heure telles quelles.
const dayOf = (at) => at.slice(0, 10);
const hourOf = (at) => at.slice(11, 16).replace(':', ' h ');
const dayLabel = (d) => {
  const [y, m, j] = d.split('-').map(Number);
  const w = new Date(Date.UTC(y, m - 1, j)).getUTCDay();
  return `${DAYS[w]} ${j === 1 ? '1er' : j} ${MONTHS[m - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ''}`;
};

const ICON = {
  received: ['M4 13h4l2 3h4l2-3h4', 'M4 13V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z'],
  engine: ['M9 9h6v6H9z', 'M5 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z', 'M9 2.5v2.5M15 2.5v2.5M9 19v2.5M15 19v2.5M2.5 9H5M2.5 15H5M19 9h2.5M19 15h2.5'],
  excluded: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M9 9l6 6M15 9l-6 6'],
  treated: ['M5 12.5l4.2 4.2L19 7'],
  missed: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3.2 2'],
  call: ['M5.5 3.5h3l1.6 4.2-2.1 1.5a11 11 0 0 0 6.8 6.8l1.5-2.1 4.2 1.6v3a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 3.5 5.6a2 2 0 0 1 2-2.1z'],
  sms: ['M4 5h16v11H9l-5 4z'],
  mail: ['M4 6h16v12H4z', 'M4 7l8 6 8-6'],
  pool_action: ['M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M3 20a6 6 0 0 1 12 0', 'M16 11a3 3 0 1 0 0-6', 'M18 20a6 6 0 0 0-3-5.2'],
  pool_claim: ['M12 3v12', 'M7 10l5 5 5-5', 'M5 20h14'],
  pool_in: ['M12 21V9', 'M7 14l5-5 5 5', 'M5 4h14'],
  redistributed: ['M4 7h11l-3-3M20 17H9l3 3', 'M15 7l-3 3M9 17l3-3'],
  manual: ['M7 12V6.5a1.5 1.5 0 0 1 3 0V11', 'M10 10.5V5a1.5 1.5 0 0 1 3 0v5.5', 'M13 10.5V6.5a1.5 1.5 0 0 1 3 0V13a7 7 0 0 1-7 7h-.5A5.5 5.5 0 0 1 4 15.2L3 12.8a1.5 1.5 0 0 1 2.6-1.5L7 13'],
  comment: ['M5 5h14v10H10l-5 4z', 'M8.5 9h7M8.5 12h4'],
  not_relevant: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M5.6 5.6l12.8 12.8'],
  rdv_set: ['M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z', 'M4 10h16', 'M8 3.5v4M16 3.5v4', 'M12 13v5M9.5 15.5h5'],
  rdv: ['M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z', 'M4 10h16', 'M8 3.5v4M16 3.5v4'],
  noshow: ['M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M3 20a6 6 0 0 1 12 0', 'M17 8l4 4M21 8l-4 4'],
  booked: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'],
  second_chance: ['M4 12a8 8 0 1 0 2.3-5.6', 'M4 4v4h4'],
  contract: ['M7 3h7l4 4v14H7z', 'M14 3v4h4', 'M10 12h5M10 15h5'],
  signed: ['M4 20c3-1 4-5 6-5s1 3 3 3 3-4 7-6', 'M15 4l5 5'],
  sale: ['M19 6.64a7 7 0 1 0 0 10.72', 'M5 10.2h9.5', 'M5 13.8h9.5'],
};
const TONE = { good: 'var(--good-strong)', low: 'var(--low-strong)', warn: 'var(--warn)' };
const SOURCE_LABEL = { 'Allo': 'Allo', leads_realtime: 'fiche du lead' };

function Icon({ kind, color, delay }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {(ICON[kind] || ICON.received).map((d) => (
        <Motion.path key={d} d={d} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease: EASE, delay }} />
      ))}
    </svg>
  );
}

// Filtres de la frise : tout, ou une famille d'étapes.
const FAMILIES = [
  ['all', 'Tout', null],
  ['owner', 'Affectations', ['engine', 'excluded', 'missed', 'treated', 'redistributed', 'manual', 'pool_in', 'pool_claim', 'pool_action', 'not_relevant']],
  ['calls', 'Appels et messages', ['call', 'sms', 'mail', 'comment']],
  ['rdv', 'RDV et vente', ['rdv_set', 'rdv', 'noshow', 'booked', 'second_chance', 'contract', 'signed', 'sale']],
];

export function LeadTimeline({ id }) {
  const [base, setBase] = useState(null);
  const [full, setFull] = useState(null);
  const [error, setError] = useState(false);
  const [family, setFamily] = useState('all');
  useEffect(() => {
    let alive = true;
    setBase(null); setFull(null); setError(false); setFamily('all');
    loadHistory(id, false).then((d) => alive && setBase(d)).catch(() => alive && setError(true));
    loadHistory(id, true).then((d) => alive && setFull(d)).catch(() => {});
    return () => { alive = false; };
  }, [id]);
  const data = full || base;
  const events = useMemo(() => {
    const keep = FAMILIES.find(([k]) => k === family)?.[2];
    return (data?.events || []).filter((e) => !keep || keep.includes(e.kind));
  }, [data, family]);
  const days = useMemo(() => {
    const m = new Map();
    events.forEach((e) => { const d = dayOf(e.at); if (!m.has(d)) m.set(d, []); m.get(d).push(e); });
    return [...m.entries()];
  }, [events]);
  if (error) return <p className="ps2-note" role="alert">Historique non chargé.</p>;
  if (!data) return <div className="ps2-loading" aria-label="Chargement"><i /><i /><i /><i /></div>;
  const all = data.events || [];
  const count = (kinds) => all.filter((e) => kinds.includes(e.kind)).length;
  const callsN = count(['call']);
  return (
    <div className="ps2-hist">
      <div className="ps2-hist-facts">
        {[['Appels', full ? fr(callsN) : '…'], ['Messages', fr(count(['sms', 'mail']))], ['Au pool', fr(count(['pool_in', 'pool_claim', 'pool_action']))],
          ['RDV', fr(count(['rdv']))]].map(([l, v]) => <span key={l}><b className="ps2-num">{v}</b>{l}</span>)}
      </div>
      <div className="ps2-hist-filters" role="tablist" aria-label="Étapes affichées">
        {FAMILIES.map(([k, l]) => (
          <button type="button" key={k} role="tab" aria-selected={family === k} className={family === k ? 'is-on' : ''} onClick={() => setFamily(k)}>{l}</button>
        ))}
        {!full && <span className="ps2-hist-wait">appels Allo en cours de lecture…</span>}
      </div>
      <ol className="ps2-hist-days">
        {days.map(([d, list], di) => (
          <li key={d}>
            <div className="ps2-hist-day">{dayLabel(d)}</div>
            <ol className="ps2-hist-list">
              {list.map((e, i) => {
                const color = TONE[e.tone] || 'var(--navy)';
                const delay = Math.min(di * 0.05 + i * 0.03, 0.8);
                return (
                  <Motion.li key={`${e.at}-${e.kind}-${i}`} className={`ps2-hist-ev${e.tone ? ` is-${e.tone}` : ''}`}
                    initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: EASE, delay }}>
                    <span className="ps2-hist-time ps2-num">{hourOf(e.at)}</span>
                    <span className="ps2-hist-dot" style={{ color }}><Icon kind={e.kind} color={color} delay={delay + 0.05} /></span>
                    <span className="ps2-hist-body">
                      <b>{e.title}</b>{e.who && <span className="ps2-hist-who">{e.who}</span>}
                      {e.detail && <span className="ps2-hist-detail">{e.detail}</span>}
                    </span>
                    <span className="ps2-hist-src" title={`Source : ${e.source}`}>{SOURCE_LABEL[e.source] || e.source}</span>
                  </Motion.li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
      {full && full.calls_read === false && <p className="ps2-note">Appels Allo non lus pour ce lead.</p>}
    </div>
  );
}

// Panneau latéral d'un lead : en-tête (qui l'a, où il en est) puis sa frise.
export default function LeadHistoryPanel({ lead, dark, onClose, depth = 0 }) {
  useEffect(() => {
    if (!lead) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [lead, onClose]);
  return createPortal(
    <AnimatePresence>
      {lead && (
        <div className={`ps2${dark ? ' is-dark' : ''}`} style={{ display: 'contents' }}>
          <Motion.div className="ps2-overlay" style={{ zIndex: 62 + depth * 2 }} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />
          <Motion.aside className="ps2-panel ps2-hist-panel" style={{ zIndex: 63 + depth * 2 }} role="dialog" aria-modal="true" aria-label={`Historique de ${lead.name || `#${lead.id}`}`}
            initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }}>
            <div className="ps2-panel-head">
              <span className="ps2-mono">Historique du lead #{lead.id}</span>
              <button type="button" className="ps2-icon-btn" aria-label="Fermer" onClick={onClose}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="ps2-panel-body">
              <div className="ps2-hist-head">
                <h2>{lead.name || 'Sans nom'}</h2>
                <div className="ps2-hist-sub">{[lead.company, lead.origin].filter(Boolean).join(' · ')}</div>
                <div className="ps2-hist-chips">
                  {lead.engine && <span>Affecté à <b>{lead.engine}</b></span>}
                  <span>Aujourd’hui <b>{lead.now || (lead.opt_out ? 'retiré du pool' : 'au pool')}</b></span>
                  {lead.status && <span>Statut <b>{lead.status}</b></span>}
                </div>
              </div>
              <LeadTimeline id={lead.id} />
            </div>
          </Motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
