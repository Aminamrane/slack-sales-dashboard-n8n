// src/pages/MetaAds/KpiBar.jsx — bandeau de synthèse en tête de /meta-ads.
//
// Six indicateurs, chacun comparé à la période précédente de même durée, pour
// qu'on sache en un regard si le compte se tient. Les pictogrammes sont
// dessinés ici, dans un trait unique (1.6 px, extrémités rondes), plutôt que
// pris dans une librairie : ils doivent parler du métier acquisition, pas
// ressembler à une barre d'outils générique.

import React from 'react';
import { motion } from 'framer-motion';

const nf = new Intl.NumberFormat('fr-FR');
const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

// ── Pictogrammes ───────────────────────────────────────────────────────────
// Tous sur une grille 24, trait 1.6, sans remplissage : la couleur est donnée
// par `stroke` pour suivre le thème et l'état de la variation.
const Ico = {
  // Dépense : un billet vu de trois quarts.
  spend: (
    <>
      <rect x="2.8" y="6.4" width="18.4" height="11.2" rx="2.4" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6.2 9.6v4.8M17.8 9.6v4.8" />
    </>
  ),
  // Leads : une fiche contact.
  leads: (
    <>
      <rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2.6" />
      <circle cx="9.4" cy="10.4" r="2.2" />
      <path d="M5.9 16.2c.7-1.7 2-2.6 3.5-2.6s2.8.9 3.5 2.6" />
      <path d="M15.4 9.6h3.2M15.4 13h3.2" />
    </>
  ),
  // Coût par lead : une étiquette de prix.
  cpl: (
    <>
      <path d="M11.2 3.6H19a1.4 1.4 0 011.4 1.4v7.8a1.4 1.4 0 01-.41.99l-7.2 7.2a1.4 1.4 0 01-1.98 0l-7.8-7.8a1.4 1.4 0 010-1.98l7.2-7.2a1.4 1.4 0 01.99-.41z" />
      <circle cx="16.4" cy="7.6" r="1.5" />
    </>
  ),
  // Rendez-vous tenus : un agenda validé.
  rdv: (
    <>
      <rect x="3.4" y="5.2" width="17.2" height="15" rx="2.6" />
      <path d="M3.4 9.8h17.2M8.2 3.2v4M15.8 3.2v4" />
      <path d="M9 14.6l2.2 2.2 4-4.2" />
    </>
  ),
  // Ventes : un trophée.
  ventes: (
    <>
      <path d="M8 4.2h8v4.2a4 4 0 01-8 0z" />
      <path d="M8 5.4H5.4a2.4 2.4 0 002.4 2.4M16 5.4h2.6a2.4 2.4 0 01-2.4 2.4" />
      <path d="M12 12.4v3.4M9 19.4h6M9.8 15.8h4.4l.6 3.6H9.2z" />
    </>
  ),
  // Retour sur investissement : une courbe qui monte.
  roas: (
    <>
      <path d="M3.4 17.6l5-5.2 3.4 3.2 4.2-5.4 4.6 4" />
      <path d="M20.6 8.4v4.2h-4.2" />
      <path d="M3.4 20.4h17.2" />
    </>
  ),
};

function Glyph({ shape, color, size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {Ico[shape]}
    </svg>
  );
}

// ── Variation ──────────────────────────────────────────────────────────────
// `goodWhenDown` : pour un coût, baisser est une bonne nouvelle.
function Delta({ current, previous, goodWhenDown = false, T }) {
  if (previous == null || current == null || !previous) {
    return <span style={{ fontSize: 11.5, color: T.textFaint, fontWeight: 600 }}>pas de comparable</span>;
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (!Number.isFinite(pct)) {
    return <span style={{ fontSize: 11.5, color: T.textFaint, fontWeight: 600 }}>pas de comparable</span>;
  }
  const flat = Math.abs(pct) < 1;
  const up = pct > 0;
  const good = flat ? null : (goodWhenDown ? !up : up);
  const color = flat ? T.textFaint : good ? T.green : T.red;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color }}>
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke={color}
        strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        style={{ transform: flat ? 'none' : up ? 'none' : 'rotate(180deg)' }}>
        {flat ? <path d="M2.5 6h7" /> : <><path d="M6 9.5v-7" /><path d="M2.9 5.6L6 2.5l3.1 3.1" /></>}
      </svg>
      {flat ? 'stable' : `${Math.abs(pct).toFixed(0)} %`}
    </span>
  );
}

function Tile({ shape, label, value, hint, current, previous, goodWhenDown, T, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: 0.04 * index, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'relative', padding: '14px 16px 13px', borderRadius: 14,
        background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow,
        minWidth: 0, overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
        <Glyph shape={shape} color={T.textMuted} />
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em',
          textTransform: 'uppercase', color: T.textFaint, whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 750, letterSpacing: '-0.02em', color: T.text,
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7, minHeight: 16 }}>
        <Delta current={current} previous={previous} goodWhenDown={goodWhenDown} T={T} />
        {hint && <span style={{ fontSize: 11.5, color: T.textFaint }}>{hint}</span>}
      </div>
    </motion.div>
  );
}

/**
 * @param totals    totaux de la période affichée
 * @param previous  totaux de la période précédente de même durée (ou null)
 * @param loading   la comparaison est encore en vol
 */
export default function KpiBar({ totals, previous, T, loading = false }) {
  if (!totals) return null;
  const p = previous || {};
  const fmtI = (n) => (n == null ? '—' : nf.format(Math.round(n)));
  const fmtE = (n) => (n == null ? '—' : eur.format(n));
  const fmtE2 = (n) => (n == null ? '—' : eur2.format(n));

  const tiles = [
    { shape: 'spend', label: 'Dépense', value: fmtE(totals.spend), current: totals.spend, previous: p.spend },
    { shape: 'leads', label: 'Leads', value: fmtI(totals.leads), current: totals.leads, previous: p.leads },
    { shape: 'cpl', label: 'Coût par lead', value: fmtE2(totals.cpl), current: totals.cpl, previous: p.cpl, goodWhenDown: true },
    { shape: 'rdv', label: 'Leads retrouvés au CRM', value: fmtI(totals.match), current: totals.match, previous: p.match,
      hint: totals.leads ? `${Math.round((totals.match / totals.leads) * 100)} % des leads` : null },
    { shape: 'ventes', label: 'Ventes', value: fmtI(totals.ventes), current: totals.ventes, previous: p.ventes },
    { shape: 'roas', label: 'Retour sur dépense', value: totals.roas == null ? '—' : `${Number(totals.roas).toFixed(2)}x`,
      current: totals.roas, previous: p.roas, hint: totals.ca ? fmtE(totals.ca) + ' de CA' : null },
  ];

  return (
    <div style={{ position: 'relative', marginBottom: 18 }}>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(178px, 1fr))' }}>
        {tiles.map((t, i) => <Tile key={t.label} {...t} T={T} index={i} />)}
      </div>
      {loading && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: T.textFaint }}>
          Comparaison avec la période précédente en cours…
        </div>
      )}
    </div>
  );
}
