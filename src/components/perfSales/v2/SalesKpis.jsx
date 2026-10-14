import React from 'react';
import { motion as Motion } from 'framer-motion';
import { CountUp, EASE, useDrawn } from '../motion';
import { Detail, Info } from './Pop';
import { fr } from './model';

// KPI de l'onglet Sales (dev 15/10/2026 : « R1 posés, R1 effectués, R2 posés, R2 effectués, le total qu'on peut changer
// selon la période » ; « un R2 posé directement veut dire que le R1 s'est fait au téléphone : dans le R1 total, les R1
// du CRM plus les R1 faits au téléphone »). Mêmes chiffres que la ligne Total du tableau, pour la période et le canal
// choisis. Chaque tuile se lit seule : le nombre, et sa part sur une jauge ; le calcul est dans la bulle.
const R1 = '#1e3a7b';
const PHONE = '#4f9a72';
const R2 = '#2f7fb8';
const pct = (a, b) => (b ? (a / b) * 100 : null);

function Gauge({ parts, delay }) {
  const drawn = useDrawn();
  return (
    <span className="ps2-skpi-gauge" aria-hidden="true">
      {parts.map((p, i) => (
        <Motion.i key={i} style={{ background: p.color }} initial={{ width: 0 }}
          animate={{ width: drawn ? `${Math.max(0, Math.min(100, p.value ?? 0))}%` : 0 }} transition={{ duration: 0.9, ease: EASE, delay: delay + i * 0.12 }} />
      ))}
    </span>
  );
}

export default function SalesKpis({ f, periodLabel, onDossiers }) {
  if (!f) return null;
  const total = f.r1p + f.r1_phone;
  const r1Upcoming = Math.max(0, f.r1p - f.r1_due), r2Upcoming = Math.max(0, f.r2p - f.r2_due);
  const tiles = [
    { key: 'r1p', group: 'r1', label: 'R1 posés', value: f.r1p, color: R1, parts: [{ value: pct(f.r1p, total), color: R1 }], share: pct(f.r1p, total), of: 'du R1 total',
      detail: { rows: [['À venir', fr(r1Upcoming)], ['Passés', fr(f.r1_due)], ['dont effectués', fr(f.r1_done_due), 'ps2-strong'], ['dont absents', fr(f.r1_noshow)], ['dont pas qualifiés', fr(f.r1_open)]],
        lines: ['R1 dont la date tombe dans la période, posés par le sales ou par un setter'], metric: 'r1e', dossiers: 'r1p' } },
    { key: 'r1_phone', group: 'r1', label: 'R1 au téléphone', value: f.r1_phone, color: PHONE, parts: [{ value: pct(f.r1_phone, total), color: PHONE }], share: pct(f.r1_phone, total), of: 'du R1 total',
      detail: { rows: [['R2 posés sans R1 dans le CRM', fr(f.r1_phone), 'ps2-strong']], lines: ['Un R2 posé directement : le R1 s’est fait au téléphone. Il est daté par son R2.'], metric: 'r1e', dossiers: 'r1_phone' } },
    { key: 'r1_total', group: 'r1', label: 'R1 total', value: total, color: R1, total: true, parts: [{ value: pct(f.r1p, total), color: R1 }, { value: pct(f.r1_phone, total), color: PHONE }],
      detail: { rows: [['R1 posés dans le CRM', fr(f.r1p)], ['R1 au téléphone', fr(f.r1_phone)], ['R1 total', fr(total), 'ps2-strong']], lines: [`${fr(f.r1p)} + ${fr(f.r1_phone)} = ${fr(total)}`] } },
    { key: 'r1r', group: 'r1', label: 'R1 effectués', value: f.r1r, color: R1, parts: [{ value: pct(f.r1r, f.r1p), color: R1 }], share: pct(f.r1r, f.r1p), of: 'des R1 posés',
      detail: { rows: [['R1 effectués dans le CRM', fr(f.r1r), 'ps2-strong'], ['R1 au téléphone', fr(f.r1_phone)], ['R1 faits au total', fr(f.r1r + f.r1_phone)]],
        lines: [`${fr(f.r1r)} ÷ ${fr(f.r1p)} R1 posés = ${pct(f.r1r, f.r1p) == null ? '–' : `${fr(pct(f.r1r, f.r1p), 0)} %`}`], metric: 'r1e', dossiers: 'r1e' } },
    { key: 'r2p', group: 'r2', label: 'R2 posés', value: f.r2p, color: R2, parts: [{ value: pct(f.r2p, total), color: R2 }], share: pct(f.r2p, total), of: 'du R1 total',
      detail: { rows: [['À venir', fr(r2Upcoming)], ['Passés', fr(f.r2_due)], ['dont effectués', fr(f.r2_done_due), 'ps2-strong'], ['dont absents', fr(f.r2_noshow)], ['dont pas qualifiés', fr(f.r2_open)]],
        lines: [`${fr(f.r2p)} ÷ ${fr(total)} R1 total = ${pct(f.r2p, total) == null ? '–' : `${fr(pct(f.r2p, total), 0)} %`}`], metric: 'r2e', dossiers: 'r2p' } },
    { key: 'r2r', group: 'r2', label: 'R2 effectués', value: f.r2r, color: R2, parts: [{ value: pct(f.r2r, f.r2p), color: R2 }], share: pct(f.r2r, f.r2p), of: 'des R2 posés',
      detail: { rows: [['R2 effectués', fr(f.r2r), 'ps2-strong'], ['R2 posés', fr(f.r2p)]],
        lines: [`${fr(f.r2r)} ÷ ${fr(f.r2p)} = ${pct(f.r2r, f.r2p) == null ? '–' : `${fr(pct(f.r2r, f.r2p), 0)} %`}`], metric: 'r2e', dossiers: 'r2e' } },
  ];
  return (
    <div className="ps2-skpi" role="list" aria-label={`Rendez-vous, ${periodLabel || 'période'}`}>
      {tiles.map((t, i) => (
        <Motion.div key={t.key} role="listitem" className={`ps2-skpi-cell is-${t.group}${t.total ? ' is-total' : ''}`}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE, delay: 0.04 + i * 0.05 }}>
          <Info className="ps2-skpi-tile" label={`${t.label}, détail`}
            detail={(dismiss) => (
              <Detail kicker={periodLabel} title={t.label} value={fr(t.value)} rows={t.detail.rows} lines={t.detail.lines}
                action={t.detail.dossiers && onDossiers && (
                  <button type="button" className="ps2-link" onClick={() => { dismiss(); onDossiers(t.detail.metric, t.detail.dossiers); }}>Dossiers</button>
                )} />
            )}>
            <span className="ps2-skpi-label"><i style={{ background: t.color }} />{t.label}</span>
            <b className="ps2-skpi-value ps2-num"><CountUp value={t.value} /></b>
            <Gauge parts={t.parts} delay={0.25 + i * 0.06} />
            <small className="ps2-skpi-share ps2-num">
              {t.total ? <><span style={{ color: R1 }}>■</span> {fr(f.r1p)} CRM · <span style={{ color: PHONE }}>■</span> {fr(f.r1_phone)} tél.</>
                : t.share == null ? '–' : <>{fr(t.share, 0)} % <span>{t.of}</span></>}
            </small>
          </Info>
        </Motion.div>
      ))}
    </div>
  );
}
