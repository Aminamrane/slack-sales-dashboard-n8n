import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import apiClient from '../../../services/apiClient';
import { EASE } from '../motion';
import { fr, signedNum, sourceOf } from './model';

// Panneau « Vérifier un chiffre » (dev 14/10/2026 : « aucun détail, aucune vérif ») : définition, période, périmètre,
// source, attendu, calcul étape par étape, répartitions par canal et par sales, puis les dossiers eux-mêmes, recomptés
// un par un face au chiffre affiché.
const DOSSIER_METRIC = { leads: 'leads', r1e: 'r1e', r2e: 'r2e', signed: 'signed', sales: 'sales' };
const PAGE = 14;

function Bars({ items, total, onPick }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="ps2-rows">
      {items.map((it) => (
        <div key={it.key} className="ps2-row-line">
          {onPick ? <button type="button" className="ps2-link" style={{ color: 'var(--ink)', fontWeight: 500, textAlign: 'left' }} onClick={() => onPick(it.key)}>{it.label}</button>
            : <span>{it.label}</span>}
          <b className="ps2-num">{fr(it.value)}<span className="ps2-soft" style={{ fontWeight: 400 }}> · {fr((it.value / Math.max(1, total)) * 100, 0)} %</span></b>
          <span className="ps2-bar"><Motion.i initial={{ width: 0 }} animate={{ width: `${(it.value / max) * 100}%` }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.15 }} style={{ background: it.color || 'var(--navy)' }} /></span>
        </div>
      ))}
    </div>
  );
}

// Une publicité = son libellé d'origine aux majuscules et espaces près (même clé que le serveur, perf_partition.ad_key).
const adKey = (origin) => String(origin || '').split(/\s+/).filter(Boolean).join(' ').toLowerCase() || 'sans libellé';

export default function VerifyPanel({ open, model: pageModel, period: pagePeriod, dark, onClose }) {
  // L'onglet Sales peut ouvrir un chiffre sur sa propre période (son modèle et sa période accompagnent la demande).
  const model = open?.model || pageModel;
  const period = open?.period || pagePeriod;
  const metric = open ? model?.metrics?.[open.metric] : null;
  const [state, setState] = useState({ loading: false, rows: null, error: false });
  const [person, setPerson] = useState(open?.person || null);
  const [source, setSource] = useState(open?.source || null);
  const [all, setAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const dossierMetric = open?.dossiers || DOSSIER_METRIC[open?.metric];

  useEffect(() => {
    setPerson(open?.person || null); setSource(open?.source || null); setAll(false); setCopied(false);
    if (!open || !dossierMetric) return undefined;
    let alive = true;
    setState({ loading: true, rows: null, error: false });
    apiClient.get(`/api/v1/monitoring/performance/v2/dossiers?period=${encodeURIComponent(period)}&metric=${dossierMetric}`)
      .then((data) => alive && setState({ loading: false, rows: data.rows || [], error: false }))
      .catch(() => alive && setState({ loading: false, rows: null, error: true }));
    return () => { alive = false; };
  }, [open, period, dossierMetric]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const rows = useMemo(() => (state.rows || []).filter((r) => (!person || r.sales === person) && (!source || r.source === source)
    && (!open?.ad || adKey(r.origin) === open.ad)), [state.rows, person, source, open?.ad]);
  const channelItems = metric ? Object.entries(metric.byChannel || {}).filter(([, v]) => v > 0)
    .map(([k, v]) => ({ key: k, label: sourceOf(k).label, color: sourceOf(k).color, value: v })).sort((a, b) => b.value - a.value) : [];
  const salesItems = metric ? metric.bySales.map((s) => ({ key: s.name, label: s.name, value: s.value })) : [];
  const recount = state.rows ? state.rows.length : null;
  const listMatches = recount != null && metric && (open?.dossiers ? true : recount === metric.value);

  const copyTrail = () => {
    const text = (metric?.trail || []).map((l) => `${'  '.repeat(l.indent || 0)}${l.text}`).join('\n');
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {});
  };
  const exportCsv = () => {
    const head = ['dossier', 'sales', 'date', 'canal', 'origine', 'statut'];
    const lines = rows.map((r) => [r.ref, r.sales, r.date, sourceOf(r.source).label, r.origin || '', r.status].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'));
    const blob = new Blob(['﻿' + [head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `perf-sales-${open.metric}-${period}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return createPortal(
    <AnimatePresence>
      {open && metric && (
        <div className={`ps2${dark ? ' is-dark' : ''}`} style={{ display: 'contents' }}>
          <Motion.div className="ps2-overlay" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} />
          <Motion.aside className="ps2-panel" role="dialog" aria-modal="true" aria-label={`Vérifier : ${metric.label}`}
            initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }}>
            <div className="ps2-panel-head">
              <span className="ps2-mono">Vérifier un chiffre</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="ps2-ghost-btn" onClick={exportCsv} disabled={!rows.length}>EXPORTER</button>
                <button type="button" className="ps2-icon-btn" aria-label="Fermer" onClick={onClose}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="ps2-panel-body">
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--soft)' }}>{open.dossiers === 'r1p' ? 'R1 posés' : open.dossiers === 'r2p' ? 'R2 posés' : metric.label}{person ? ` · ${person}` : ''}{source ? ` · ${sourceOf(source).label}` : ''}</h2>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
                  <span className="ps2-num" style={{ fontSize: 52, fontWeight: 600, letterSpacing: '-.03em' }}>{fr(person || source || open?.ad ? rows.length : metric.value)}</span>
                  {!person && !source && metric.gap != null && (
                    <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
                      background: metric.gap >= 0 ? 'var(--good-bg)' : 'var(--low-bg)', color: metric.gap >= 0 ? 'var(--good)' : 'var(--low)' }}>
                      {signedNum(metric.gap)} sur l'attendu à date ({fr(metric.expected)})</span>
                  )}
                </div>
              </div>

              <dl className="ps2-dl">
                <dt>Définition</dt><dd>{metric.definition}</dd>
                <dt>Période</dt><dd>{metric.period}</dd>
                <dt>Périmètre</dt><dd>{fr(model.rows.length)} sales · comptes de test et de démo exclus</dd>
                <dt>Source</dt><dd style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{metric.source}</dd>
                {metric.expectedText && <><dt>Attendu</dt><dd>{metric.expectedText}</dd></>}
              </dl>

              <div>
                <div className="ps2-card-head"><h3>Le calcul, étape par étape</h3>
                  <button type="button" className="ps2-ghost-btn" onClick={copyTrail}>{copied ? 'COPIÉ' : 'COPIER'}</button></div>
                <div className="ps2-trail">
                  {metric.trail.map((l, i) => (
                    <Motion.div key={i} className={l.tone ? `is-${l.tone}` : undefined} style={{ paddingLeft: (l.indent || 0) * 20 }}
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: EASE, delay: 0.2 + i * 0.07 }}>{l.text}</Motion.div>
                  ))}
                </div>
              </div>

              <div className="ps2-split">
                <div className="ps2-box"><h3>Par canal</h3><Bars items={channelItems} total={metric.value} onPick={(k) => setSource(source === k ? null : k)} /></div>
                <div className="ps2-box"><h3>Par sales</h3><Bars items={salesItems.slice(0, 8)} total={metric.value} onPick={(k) => setPerson(person === k ? null : k)} />
                  {salesItems.length > 8 && <p className="ps2-note">et {salesItems.length - 8} autres</p>}</div>
              </div>

              <div>
                <div className="ps2-card-head">
                  <h3>Les dossiers{person || source ? ' filtrés' : ''}</h3>
                  {(person || source) && <button type="button" className="ps2-link" onClick={() => { setPerson(null); setSource(null); }}>Retirer le filtre</button>}
                </div>
                {state.loading && <p className="ps2-note">Chargement des dossiers…</p>}
                {state.error && <p className="ps2-note" role="alert">Les dossiers n’ont pas pu être chargés.</p>}
                {state.rows && (
                  <>
                    <table className="ps2-dossiers">
                      <thead><tr><th>Dossier</th><th>Sales</th><th>Date</th><th>Canal</th><th>Statut</th></tr></thead>
                      <tbody>
                        {(all ? rows : rows.slice(0, PAGE)).map((r) => (
                          <tr key={`${r.ref}-${r.date}`}>
                            <td>{r.ref}</td>
                            <td>{r.sales}</td>
                            <td className="ps2-num">{r.date ? `${r.date.slice(8, 10)}/${r.date.slice(5, 7)}${r.date.length > 10 ? ` ${r.date.slice(11, 16)}` : ''}` : '–'}</td>
                            <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="ps2-swatch" style={{ background: sourceOf(r.source).color }} />{sourceOf(r.source).label}</span></td>
                            <td>{r.status}{r.setter && <span className="ps2-tag">setter</span>}{r.early && <span className="ps2-tag is-warn">avant sa date</span>}
                              {r.amount != null && <span className="ps2-soft"> · {fr(r.amount)} €</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rows.length > PAGE && <button type="button" className="ps2-link" style={{ marginTop: 10 }} onClick={() => setAll((v) => !v)}>
                      {all ? 'Réduire' : `Afficher les ${fr(rows.length)} dossiers`}</button>}
                  </>
                )}
              </div>

              {recount != null && !open.dossiers && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12.5 }}>
                  <span className={`ps2-check-icon ${listMatches ? 'is-ok' : 'is-ko'}`}>{listMatches ? '✓' : '!'}</span>
                  {listMatches ? `Recompté dossier par dossier : ${fr(recount)}, identique au chiffre affiché`
                    : `Recompté dossier par dossier : ${fr(recount)} au lieu de ${fr(metric.value)}`}
                </div>
              )}
            </div>
          </Motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
