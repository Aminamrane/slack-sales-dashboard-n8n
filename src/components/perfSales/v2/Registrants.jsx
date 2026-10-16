import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { CountUp, EASE, useDrawn } from '../motion';
import { Detail, usePop } from './Pop';
import { dm, fr } from './model';
import { loadIntake } from './intakeApi';
import LeadHistoryPanel from './LeadHistory';

// Inscrits aux webinaires (dev 16/10/2026 : « les webinaires et la cohorte du 22, ces leads-là n'apparaissent pas ; il
// faut qu'on voie qu'ils sont détachés, parce qu'ils ne sont pas affectés avant le webinaire, mais ils existent »). Ils
// vivent dans la base de la landing, pas dans le CRM : un bloc à part sous le schéma, rapproché du CRM par l'e-mail ou le
// téléphone (`intake.registrants`, calculé par le serveur).

const YELLOW = '#e6b45a';
const todayIso = () => new Date().toISOString().slice(0, 10);
const liveLabel = (c) => (c.date ? `Live du ${dm(c.date)}` : c.title);
const VIA = { lamia: 'via le lien Lamia', aurelie: 'via le lien Aurélie', setter: 'via le CRM setter', live: 'via le live' };

export function RegistrantsBlock({ registrants, onOpen }) {
  const drawn = useDrawn();
  const open = usePop();
  const clip = `ps2-regs-${useId().replace(/:/g, '')}`;
  if (!registrants) return null;
  if (registrants.status !== 'ok') return <p className="ps2-note">Inscrits webinaire non lus (landing indisponible).</p>;
  if (!registrants.total) return null;
  const max = Math.max(1, ...registrants.cohorts.map((c) => c.n));
  return (
    <div className="ps2-regs" aria-label="Inscrits aux webinaires, hors fiches affectées">
      <div className="ps2-regs-head ps2-mono">Inscrits webinaire · détachés</div>
      <div className="ps2-regs-row">
        <Motion.button type="button" className="ps2-regs-root" initial={{ opacity: 0, x: -8 }} animate={drawn ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.5, ease: EASE, delay: 0.2 }}
          onClick={(e) => open(e.currentTarget, (close) => <Detail kicker="Inscrits webinaire" value={fr(registrants.total)}
            rows={registrants.cohorts.map((c) => [liveLabel(c), fr(c.n)])}
            lines={['Base de la landing, hors fiches du CRM : pas affectés avant le live.',
              'Au CRM : via un lien webinaire de la cohorte (Lamia, Aurélie, CRM setter, live), sinon doublon interne (la même personne déjà là par un autre canal).']}
            action={<button type="button" className="ps2-link" onClick={() => { close(); onOpen({ cohort: null }); }}>Voir les {fr(registrants.total)} inscrits</button>} />)}>
          <b className="ps2-num"><CountUp value={registrants.total} delay={300} /></b><span>inscrits</span>
        </Motion.button>
        <span className="ps2-regs-links-wrap"><svg className="ps2-regs-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs><clipPath id={clip}><Motion.rect x="0" y="-5" height="110" initial={{ width: 0 }} animate={{ width: drawn ? 100 : 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.35 }} /></clipPath></defs>
          <g clipPath={`url(#${clip})`}>
            {registrants.cohorts.map((c, i) => {
              const y = ((i + 0.5) / registrants.cohorts.length) * 100;
              return <path key={c.id} d={`M0 50 C 50 50, 50 ${y}, 100 ${y}`} fill="none" stroke={YELLOW} strokeWidth="1.4" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />;
            })}
          </g>
        </svg></span>
        <ul className="ps2-regs-cohorts">
          {registrants.cohorts.map((c, i) => {
            const upcoming = c.date && c.date >= todayIso();
            const via = Object.values(c.via || {}).reduce((x, y) => x + y, 0);
            const out = c.n - c.in_crm;
            const seg = (v, cls, k) => (
              <Motion.i key={cls} className={cls} initial={{ flexGrow: 0 }} animate={{ flexGrow: drawn ? v : 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.5 + i * 0.1 + k * 0.08 }} />);
            return (
              <Motion.li key={c.id} initial={{ opacity: 0, y: 6 }} animate={drawn ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.45, ease: EASE, delay: 0.45 + i * 0.1 }}>
                <button type="button" className="ps2-regs-cohort" onClick={() => onOpen({ cohort: c.id })} aria-label={`${liveLabel(c)} : ${c.n} inscrits, voir la liste`}>
                  <span className="ps2-regs-title"><b className="ps2-num">{fr(c.n)}</b>{liveLabel(c)}{upcoming && <span className="ps2-regs-soon">live à venir</span>}</span>
                  <span className="ps2-regs-bar" style={{ width: `${Math.max(8, (c.n / max) * 100)}%` }}>
                    {seg(via, 'is-via', 0)}{seg(c.dup || 0, 'is-dup', 1)}{seg(out, 'is-out', 2)}
                  </span>
                  <span className="ps2-regs-stats">
                    <span><i className="is-via" />via un lien webinaire <b className="ps2-num">{fr(via)}</b>{c.via_rdv ? <em> · {fr(c.via_rdv)} en RDV</em> : null}</span>
                    <span><i className="is-dup" />doublons internes <b className="ps2-num">{fr(c.dup || 0)}</b>{c.dup_rdv ? <em> · {fr(c.dup_rdv)} en RDV</em> : null}</span>
                    <span><i className="is-out" />pas au CRM <b className="ps2-num">{fr(out)}</b></span>
                  </span>
                </button>
              </Motion.li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// Les inscrits, un par un ; un inscrit déjà au CRM ouvre l'historique de son lead.
export function RegistrantsTable({ rows, cohorts, onHistory, limit = Infinity }) {
  const title = (id) => { const c = cohorts?.find((x) => x.id === id); return c ? liveLabel(c) : id; };
  return (
    <table className="ps2-dossiers ps2-intake-table">
      <thead><tr><th>Inscrit</th><th>Inscrit le</th><th>Cohorte</th><th>Source</th><th>Au CRM</th><th>RDV</th></tr></thead>
      <tbody>
        {rows.slice(0, limit).map((r, i) => (
          <Motion.tr key={r.id} className={r.crm_id ? 'ps2-intake-row' : undefined} tabIndex={r.crm_id ? 0 : undefined}
            onClick={() => r.crm_id && onHistory(r)} onKeyDown={(e) => e.key === 'Enter' && r.crm_id && onHistory(r)}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE, delay: Math.min(i, 20) * 0.015 }}>
            <td><span className="ps2-intake-name">{r.name || '–'}</span>{r.company && <span className="ps2-soft ps2-intake-co">{r.company}</span>}</td>
            <td className="ps2-num">{dm(r.received)}</td>
            <td>{title(r.cohort)}</td>
            <td>{r.source === 'meta' ? 'Meta' : r.source || '–'}</td>
            <td>{r.via ? <span className="ps2-regs-tag is-via">{VIA[r.via] || r.via}</span>
              : r.dup ? <span className="ps2-regs-tag is-dup">doublon interne · {r.dup.family}{r.dup.at ? ` · depuis le ${dm(r.dup.at)}` : ''}</span>
                : <span className="ps2-muted">pas au CRM</span>}
              {r.crm_id && <span className="ps2-intake-ref" style={{ marginTop: 3 }}>#{r.crm_id}{r.crm_now ? ` · ${r.crm_now}` : ''}</span>}</td>
            <td>{r.rdv ? <span className="ps2-intake-stage is-r2_set">RDV</span> : <span className="ps2-muted">–</span>}</td>
          </Motion.tr>
        ))}
      </tbody>
    </table>
  );
}

export function RegistrantsPanel({ open, period, dark, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [crm, setCrm] = useState(null);
  const [hist, setHist] = useState(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    setCrm(null); setHist(null); setAll(false);
    if (!open) return undefined;
    let alive = true;
    loadIntake(period).then((d) => alive && setData(d.registrants)).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [open, period]);
  useEffect(() => {
    if (!open || hist) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, hist]);
  const closeHist = useCallback(() => setHist(null), []);
  const base = useMemo(() => (data?.rows || []).filter((r) => !open?.cohort || r.cohort === open.cohort), [data, open]);
  const rows = base.filter((r) => !crm || (crm === 'via' ? r.via : crm === 'dup' ? r.dup && !r.via : crm === 'rdv' ? r.rdv : !r.crm_id));
  const cohort = data?.cohorts?.find((c) => c.id === open?.cohort);
  const expected = cohort ? cohort.n : data?.total;
  const chips = [['via', 'Via un lien webinaire', base.filter((r) => r.via).length], ['dup', 'Doublons internes', base.filter((r) => r.dup && !r.via).length],
    ['out', 'Pas au CRM', base.filter((r) => !r.crm_id).length], ['rdv', 'Avec RDV', base.filter((r) => r.rdv).length]];
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={`ps2${dark ? ' is-dark' : ''}`} style={{ display: 'contents' }}>
          <Motion.div className="ps2-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />
          <Motion.aside className="ps2-panel ps2-intake-panel" role="dialog" aria-modal="true" aria-label="Inscrits webinaire"
            initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }}>
            <div className="ps2-panel-head">
              <span className="ps2-mono">Inscrits webinaire · détachés</span>
              <button type="button" className="ps2-icon-btn" aria-label="Fermer" onClick={onClose}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="ps2-panel-body">
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--soft)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="ps2-swatch" style={{ background: YELLOW }} />{cohort ? liveLabel(cohort) : 'Toutes les cohortes'}</h2>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
                  <span className="ps2-num" style={{ fontSize: 52, fontWeight: 600, letterSpacing: '-.03em' }}>{data ? <CountUp value={rows.length} duration={600} /> : '…'}</span>
                  {data && !crm && <span className={`ps2-intake-check ${base.length === expected ? 'is-ok' : 'is-ko'}`}>
                    {base.length === expected ? `✓ recomptés un par un : ${fr(base.length)}` : `! ${fr(base.length)} pour ${fr(expected)} affichés`}</span>}
                </div>
              </div>
              {error && <p className="ps2-note" role="alert">Inscrits non chargés.</p>}
              {!data && !error && <div className="ps2-loading" aria-label="Chargement"><i /><i /><i /><i /></div>}
              {data && (
                <>
                  <div className="ps2-hist-filters" role="tablist" aria-label="Filtre">
                    <button type="button" role="tab" aria-selected={!crm} className={!crm ? 'is-on' : ''} onClick={() => setCrm(null)}>Tous {fr(base.length)}</button>
                    {chips.map(([k, l, n]) => <button type="button" key={k} role="tab" aria-selected={crm === k} className={crm === k ? 'is-on' : ''} onClick={() => setCrm(crm === k ? null : k)}>{l} {fr(n)}</button>)}
                  </div>
                  <RegistrantsTable rows={rows} cohorts={data.cohorts} onHistory={(r) => setHist({ id: r.crm_id, name: r.name, company: r.company, now: r.crm_now })} limit={all ? Infinity : 40} />
                  {rows.length > 40 && <button type="button" className="ps2-link" onClick={() => setAll((v) => !v)}>{all ? 'Réduire' : `Afficher les ${fr(rows.length)} inscrits`}</button>}
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
