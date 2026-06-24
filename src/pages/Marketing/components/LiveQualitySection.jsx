import React, { useCallback, useMemo, useRef, useState } from 'react';
// eslint-disable-next-line no-unused-vars -- motion used via JSX (false positive)
import { motion, AnimatePresence } from 'framer-motion';
import { Line } from 'react-chartjs-2';
// `chart.js/auto` enregistre tous les contrôleurs/échelles — même import
// que TrafficChart/BudgetByDayChart (cohérence + pas de tree-shake cassé).
import Chart from 'chart.js/auto';
import { fmtInt, fmtPct } from '../theme';

/**
 * Section « Qualité du live » — cartes KPI tirées du rapport Zoom.
 *
 * Source : `realtimeLeads.live_quality` (champ additif renvoyé par
 * `/api/v1/marketing/webinars/{id}/realtime-leads`). Forme attendue :
 *   { available, attendees_analyzed, avg_minutes, median_minutes,
 *     retention_to_end_pct, bounce_under_15_pct, watched_90plus_pct,
 *     watched_full_pct, peak_concurrent, peak_time, reconnect_pct,
 *     qa_questions, live_duration_min, effective_window_min,
 *     retention_curve: {30,60,90,120} }
 *
 * GARDE D'AFFICHAGE : le composant ne rend RIEN si
 * `liveQuality?.available` est falsy (cohortes sans données → pas de
 * cartes vides). Le parent peut le rendre inconditionnellement.
 *
 * INTERACTION : chaque carte est cliquable/tapable (mobile-friendly) et
 * révèle son explication en expand inline animé (popover textuel). Le
 * mécanisme s'ouvre au CLIC (pas au survol seul), un seul détail ouvert
 * à la fois pour garder la lecture claire.
 *
 * Style aligné sur les tiles de HeroKpiStrip (mêmes tokens de thème,
 * radius, ombre, typographie tabulaire) et sur la carte blanche du donut
 * RdvBySourceDonut.
 */

// Définition déclarative des 9 cartes. `value(q)` renvoie déjà la chaîne
// formatée (gère les champs absents en tombant sur '—'). `explain` est le
// texte affiché au clic. L'ordre = ordre d'affichage dans la grille.
const buildCards = (q) => [
  {
    key: 'avg_minutes',
    label: 'Temps de présence moyen',
    value: q.avg_minutes != null ? `${fmtInt(q.avg_minutes)} min` : '—',
    explain:
      "Durée moyenne passée en live par participant (toutes ses connexions cumulées). Le live a duré ~123 min côté audience (137 min avec l'ouverture), soit ~67 % suivi en moyenne.",
  },
  {
    key: 'median_minutes',
    label: 'Temps de présence médian',
    value: q.median_minutes != null ? `${fmtInt(q.median_minutes)} min` : '—',
    explain:
      'La moitié des participants est restée plus de 90 min. La médiane est moins sensible aux départs très précoces que la moyenne.',
  },
  {
    key: 'retention_to_end_pct',
    label: "Restés jusqu'à la fin",
    value: q.retention_to_end_pct != null ? fmtPct(q.retention_to_end_pct) : '—',
    tone: 'emerald',
    explain:
      'Part des participants encore présents dans les 5 dernières minutes (≥ 22:00). Indicateur fort de l’intérêt tenu jusqu’au bout.',
  },
  {
    key: 'bounce_under_15_pct',
    label: 'Bounce précoce',
    value: q.bounce_under_15_pct != null ? fmtPct(q.bounce_under_15_pct) : '—',
    tone: 'rose',
    explain:
      "Part partie en moins de 15 min. Plus c'est bas, mieux l'accroche du début a fonctionné.",
  },
  {
    key: 'watched_90plus_pct',
    label: 'Ont suivi 90 min +',
    value: q.watched_90plus_pct != null ? fmtPct(q.watched_90plus_pct) : '—',
    explain: 'Part ayant suivi au moins 90 min sur les ~123 min de live.',
  },
  {
    key: 'watched_full_pct',
    label: "Ont suivi l'intégralité",
    value: q.watched_full_pct != null ? fmtPct(q.watched_full_pct) : '—',
    explain:
      'Part ayant suivi 120 min +, soit la quasi-totalité du live.',
  },
  {
    key: 'peak_concurrent',
    label: 'Pic de présence simultanée',
    value:
      q.peak_concurrent != null
        ? q.peak_time
          ? `${fmtInt(q.peak_concurrent)} · à ${q.peak_time}`
          : fmtInt(q.peak_concurrent)
        : '—',
    explain:
      'Nombre maximal de spectateurs connectés en même temps, atteint ~20 min après le début. Ensuite, érosion lente et régulière, sans chute brutale.',
  },
  {
    key: 'reconnect_pct',
    label: 'Taux de reconnexion',
    value: q.reconnect_pct != null ? fmtPct(q.reconnect_pct) : '—',
    explain:
      'Part des participants ayant eu au moins 2 connexions (déconnexion puis retour). Indicateur de stabilité technique / réseau.',
  },
  {
    key: 'qa_questions',
    label: 'Questions posées (Q&R)',
    value: q.qa_questions != null ? fmtInt(q.qa_questions) : '—',
    explain:
      "Nombre de questions posées par l'audience pendant le live. Signal d'interactivité.",
  },
];

// Cartes du sous-bloc « Engagement Q&R ». Même contrat que buildCards
// (label / value déjà formatée / explain) → réutilise <QualityCard>.
const buildQaCards = (q) => [
  {
    key: 'qa_questions_eng',
    label: 'Questions posées',
    value: q.qa_questions != null ? fmtInt(q.qa_questions) : '—',
    explain:
      "Nombre de questions posées par l'audience dans le module Q&R pendant le live.",
  },
  {
    key: 'qa_unique_askers',
    label: 'Demandeurs uniques',
    value: q.qa_unique_askers != null ? fmtInt(q.qa_unique_askers) : '—',
    explain:
      'Nombre de personnes différentes ayant posé au moins une question.',
  },
  {
    key: 'qa_answered_live_pct',
    label: 'Traitées en direct',
    value: q.qa_answered_live_pct != null ? fmtPct(q.qa_answered_live_pct) : '—',
    tone: 'emerald',
    explain: 'Part des questions répondues en direct pendant le live.',
  },
  {
    key: 'qa_avg_response_min',
    label: 'Délai moyen de réponse',
    value: q.qa_avg_response_min != null ? `~${fmtInt(q.qa_avg_response_min)} min` : '—',
    explain:
      'Temps moyen entre une question et sa première réponse en live (min 3, max 29).',
  },
];

export default function LiveQualitySection({ realtimeLeads, C }) {
  const q = realtimeLeads?.live_quality;
  // Une seule carte « ouverte » (explication visible) à la fois.
  const [openKey, setOpenKey] = useState(null);

  const cards = useMemo(() => (q ? buildCards(q) : []), [q]);
  const qaCards = useMemo(() => (q ? buildQaCards(q) : []), [q]);

  // GARDE D'AFFICHAGE — invisible tant que la cohorte n'a pas de données
  // Zoom. `live_quality` peut être `undefined` (ancien backend) ou `{}`
  // (cohorte sans rapport) → `available` falsy dans les deux cas.
  if (!q?.available) return null;

  const toggle = (key) => setOpenKey((cur) => (cur === key ? null : key));

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: C.surface,
        borderRadius: 20,
        border: `1px solid ${C.hairline}`,
        boxShadow: C.shadow,
        padding: '22px 24px',
      }}
    >
      {/* ── En-tête ── */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 18,
      }}>
        <div>
          <h3 style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: C.text,
            letterSpacing: '-0.015em',
          }}>
            Qualité du live
          </h3>
          <p style={{
            margin: '4px 0 0',
            fontSize: 12,
            color: C.faded,
            fontWeight: 500,
          }}>
            source&nbsp;: rapport Zoom
            {q.attendees_analyzed != null && (
              <span> · {fmtInt(q.attendees_analyzed)} participants analysés</span>
            )}
          </p>
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          background: C.subtle,
          border: `1px solid ${C.hairline}`,
          borderRadius: 50,
          fontSize: 10,
          fontWeight: 600,
          color: C.muted,
          letterSpacing: '0.04em',
        }}>
          Cliquez une carte pour le détail
        </div>
      </div>

      {/* ── Grille des 9 cartes — auto-fit pour rester propre du mobile au
          desktop (cartes ~210px mini, 1 à 4 colonnes selon la largeur). ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: 12,
      }}>
        {cards.map((card, i) => (
          <QualityCard
            key={card.key}
            card={card}
            open={openKey === card.key}
            onToggle={() => toggle(card.key)}
            C={C}
            delay={i * 0.035}
          />
        ))}
      </div>

      {/* ── Sous-bloc « Engagement Q&R » ── */}
      <QaEngagement
        q={q}
        qaCards={qaCards}
        openKey={openKey}
        toggle={toggle}
        C={C}
      />

      {/* ── Courbe de présence pendant le live ──
          Si `presence_curve` est fournie → courbe ligne/aire (Chart.js) avec
          pic marqué. Fallback sur l'ancien rendu en barres de rétention si
          la cohorte n'expose que `retention_curve`. */}
      {Array.isArray(q.presence_curve) && q.presence_curve.length > 0 ? (
        <PresenceCurve q={q} C={C} />
      ) : (
        <RetentionCurve curve={q.retention_curve} C={C} />
      )}
    </motion.section>
  );
}

/** Sous-bloc « Engagement Q&R » : 4 cartes (réutilisant <QualityCard>),
 *  un bouton "Voir les N questions" qui déplie la liste, et une ligne
 *  insight pour la note de conversion. Partage l'état `openKey` parent
 *  (un seul détail ouvert à la fois sur toute la section). */
function QaEngagement({ q, qaCards, openKey, toggle, C }) {
  const list = Array.isArray(q.qa_list) ? q.qa_list : [];
  const hasList = list.length > 0;
  const listOpen = openKey === 'qa_list';

  return (
    <div style={{
      marginTop: 22,
      paddingTop: 22,
      borderTop: `1px solid ${C.hairline}`,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        marginBottom: 14,
      }}>
        Engagement Q&amp;R
      </div>

      {/* 4 cartes — même grille auto-fit que le bloc principal. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: 12,
      }}>
        {qaCards.map((card, i) => (
          <QualityCard
            key={card.key}
            card={card}
            open={openKey === card.key}
            onToggle={() => toggle(card.key)}
            C={C}
            delay={i * 0.035}
          />
        ))}
      </div>

      {/* Bouton dépliable « Voir les N questions » → liste qa_list. */}
      {hasList && (
        <div style={{ marginTop: 12 }}>
          <motion.button
            type="button"
            onClick={() => toggle('qa_list')}
            aria-expanded={listOpen}
            whileHover={{ y: -1 }}
            style={{
              width: '100%',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: '12px 16px',
              borderRadius: 14,
              background: C.subtle,
              border: `1px solid ${listOpen ? C.accent : C.hairline}`,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'border-color 0.18s ease',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
              {listOpen ? 'Masquer les questions' : `Voir les ${fmtInt(list.length)} questions`}
            </span>
            <motion.span
              aria-hidden="true"
              animate={{ rotate: listOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              style={{ color: C.muted, fontSize: 12, lineHeight: 1, flexShrink: 0 }}
            >
              ▾
            </motion.span>
          </motion.button>

          <AnimatePresence initial={false}>
            {listOpen && (
              <motion.div
                key="qa-list"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <ol style={{
                  margin: '10px 0 0',
                  padding: 0,
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}>
                  {list.map((item, i) => (
                    <QaListRow key={i} index={i} item={item} C={C} />
                  ))}
                </ol>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Ligne insight — note de conversion, mise en valeur (fond violet
          uni, sans accent de bord gauche). Rendue seulement si présente. */}
      {q.qa_conversion_note && (
        <div style={{
          marginTop: 14,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '12px 14px',
          borderRadius: 12,
          background: C.violet.bg,
          border: `1px solid ${C.violet.bg}`,
        }}>
          <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1.4, flexShrink: 0 }}>✦</span>
          <p style={{
            margin: 0,
            fontSize: 12.5,
            lineHeight: 1.45,
            fontWeight: 600,
            color: C.violet.fg,
          }}>
            {q.qa_conversion_note}
          </p>
        </div>
      )}
    </div>
  );
}

/** Une question de la liste Q&R : la question + le demandeur en petit. */
function QaListRow({ index, item, C }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'flex',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 12,
        background: C.surface,
        border: `1px solid ${C.hairline}`,
      }}
    >
      <span style={{
        flexShrink: 0,
        fontSize: 11,
        fontWeight: 700,
        color: C.faded,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.5,
        minWidth: 16,
      }}>
        {index + 1}.
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.4,
          fontWeight: 500,
          color: C.text,
        }}>
          {item.q}
        </p>
        {item.asker && (
          <p style={{
            margin: '4px 0 0',
            fontSize: 11,
            fontWeight: 600,
            color: C.muted,
          }}>
            {item.asker}
          </p>
        )}
      </div>
    </motion.li>
  );
}

/** Carte KPI cliquable avec explication révélée en expand inline. */
function QualityCard({ card, open, onToggle, C, delay }) {
  const valueColor = card.tone === 'emerald' ? C.emerald.fg
    : card.tone === 'rose' ? C.rose.fg
    : card.tone === 'amber' ? C.amber.fg
    : C.text;
  const borderColor = open
    ? C.accent
    : card.tone === 'emerald' ? C.emerald.bg
    : card.tone === 'rose' ? C.rose.bg
    : C.hairline;

  return (
    <motion.button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      style={{
        textAlign: 'left',
        width: '100%',
        background: C.surface,
        borderRadius: 16,
        padding: '16px 18px',
        boxShadow: C.shadow,
        border: `1px solid ${borderColor}`,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'border-color 0.18s ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: C.faded,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          lineHeight: 1.25,
        }}>
          {card.label}
        </div>
        {/* Indicateur d'affordance « i » — pivote en croix quand ouvert. */}
        <motion.span
          aria-hidden="true"
          animate={{ rotate: open ? 45 : 0, color: open ? C.accent : C.faded }}
          transition={{ duration: 0.2 }}
          style={{
            flexShrink: 0,
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: `1.4px solid currentColor`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {open ? '+' : 'i'}
        </motion.span>
      </div>

      <div style={{
        marginTop: 8,
        fontSize: 24,
        fontWeight: 700,
        color: valueColor,
        letterSpacing: '-0.02em',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}>
        {card.value}
      </div>

      {/* Explication révélée au clic — hauteur animée pour un expand fluide. */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="explain"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: `1px solid ${C.hairline}`,
              fontSize: 12,
              lineHeight: 1.45,
              color: C.muted,
              fontWeight: 500,
            }}>
              {card.explain}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/** Courbe de présence pendant le live — spectateurs simultanés dans le
 *  temps (montée → pic → érosion). Aire remplie sous une ligne, Chart.js
 *  via react-chartjs-2 (même lib/approche que TrafficChart : gradient
 *  vertical + tooltip HTML flottant custom). Marque le pic, légende
 *  rétention 30/60/90/120 min en petit dessous.
 *
 *  Le mode sombre est dérivé de `C.surface` (le thème renvoie '#1b1c25'
 *  en dark, '#ffffff' en light) pour ne pas modifier la signature du
 *  composant parent. */
function PresenceCurve({ q, C }) {
  const containerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const points = useMemo(
    () => (Array.isArray(q.presence_curve) ? q.presence_curve : []),
    [q.presence_curve]
  );

  const isDark = C.surface !== '#ffffff';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,18,30,0.06)';

  // Index du pic (max `n`). Préfère `peak_time`/`peak_concurrent` si fournis
  // et qu'ils tombent sur un point existant, sinon calcule le max local.
  const peakIndex = useMemo(() => {
    if (points.length === 0) return -1;
    if (q.peak_time) {
      const byClock = points.findIndex((p) => p.clock === q.peak_time);
      if (byClock !== -1) return byClock;
    }
    let idx = 0;
    for (let i = 1; i < points.length; i += 1) {
      if (points[i].n > points[idx].n) idx = i;
    }
    return idx;
  }, [points, q.peak_time]);

  const peakValue = q.peak_concurrent ?? (peakIndex >= 0 ? points[peakIndex].n : null);
  const peakClock = q.peak_time ?? (peakIndex >= 0 ? points[peakIndex].clock : null);

  // Phases CTA (bandes verticales). Absent/vide → pas de bande, pas d'erreur.
  const ctaPhases = useMemo(
    () => (Array.isArray(q.cta_phases) ? q.cta_phases.filter((p) => p && p.t_start != null && p.t_end != null) : []),
    [q.cta_phases]
  );

  // Ticks horaires "ronds" à afficher sur l'axe X linéaire (minutes depuis
  // 19:47). 20:00 → 13 min, 20:30 → 43, 21:00 → 73, 21:30 → 103, 22:00 → 133.
  const TICK_TS = useMemo(() => ([
    { t: 13, label: '20:00' },
    { t: 43, label: '20:30' },
    { t: 73, label: '21:00' },
    { t: 103, label: '21:30' },
    { t: 133, label: '22:00' },
  ]), []);

  // Tooltip HTML flottant — même handler externe que TrafficChart.
  const externalTooltipHandler = useCallback((context) => {
    const tt = context.tooltip;
    if (!tt || tt.opacity === 0) { setTooltip(null); return; }
    const dataIndex = tt.dataPoints?.[0]?.dataIndex;
    if (dataIndex === undefined) return;
    const row = points[dataIndex];
    if (!row) return;
    const canvasRect = context.chart.canvas.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    setTooltip({
      x: canvasRect.left - containerRect.left + tt.caretX,
      y: canvasRect.top - containerRect.top + tt.caretY,
      row,
    });
  }, [points]);

  // Axe X linéaire (valeur = `t` minutes) → positionnement précis des
  // bandes CTA. Les datasets passent en {x: t, y: n}.
  const data = useMemo(() => ({
    datasets: [
      {
        label: 'Spectateurs simultanés',
        data: points.map((p) => ({ x: p.t, y: p.n })),
        borderColor: C.violet.strong,
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return C.violet.bg;
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, C.violet.strong + '55');
          gradient.addColorStop(1, C.violet.strong + '00');
          return gradient;
        },
        borderWidth: 2.5,
        tension: 0.4,
        fill: true,
        // Point unique mis en évidence sur le pic ; les autres masqués
        // (révélés au hover comme TrafficChart).
        pointRadius: points.map((_, i) => (i === peakIndex ? 4.5 : 0)),
        pointBackgroundColor: C.surface,
        pointBorderColor: C.violet.strong,
        pointBorderWidth: 2.5,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: C.surface,
        pointHoverBorderColor: C.violet.strong,
        pointHoverBorderWidth: 2.5,
      },
    ],
  }), [points, C, peakIndex]);

  const options = useMemo(() => {
    const xMin = points.length ? points[0].t : 0;
    const xMax = points.length ? points[points.length - 1].t : 1;
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      // Marge haute pour laisser respirer les labels des bandes CTA.
      layout: { padding: { top: 18 } },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false, external: externalTooltipHandler },
        datalabels: { display: false },
      },
      scales: {
        x: {
          type: 'linear',
          min: xMin,
          max: xMax,
          grid: { display: false },
          ticks: {
            color: C.muted,
            font: { size: 11, weight: 500 },
            maxRotation: 0,
            autoSkip: false,
            // Ticks uniquement aux heures rondes (mapping t → clock).
            includeBounds: false,
            callback: (val) => {
              const hit = TICK_TS.find((tk) => tk.t === val);
              return hit ? hit.label : '';
            },
          },
          afterBuildTicks: (axis) => {
            // Force les ticks sur les minutes rondes choisies.
            axis.ticks = TICK_TS.map((tk) => ({ value: tk.t }));
          },
          border: { display: false },
        },
        y: {
          grid: { color: gridColor, drawBorder: false },
          ticks: { color: C.muted, font: { size: 11, weight: 500 }, precision: 0 },
          border: { display: false },
          beginAtZero: true,
        },
      },
    };
  }, [points, C.muted, gridColor, externalTooltipHandler, TICK_TS]);

  // Plugin Chart.js custom — dessine les bandes CTA + labels DERRIÈRE la
  // courbe (`beforeDatasetsDraw`). Robuste au resize : recalcule les
  // positions pixel via l'échelle X à chaque frame. Pas de dépendance
  // externe (chartjs-plugin-annotation non installé, et on évite d'en
  // ajouter une pour 2 rectangles).
  const ctaBandsPlugin = useMemo(() => ({
    id: 'ctaBands',
    beforeDatasetsDraw(chart) {
      if (ctaPhases.length === 0) return;
      const { ctx, chartArea, scales } = chart;
      const xScale = scales.x;
      if (!xScale || !chartArea) return;
      const bandColor = isDark ? 'rgba(245,158,11,0.16)' : 'rgba(245,158,11,0.14)'; // amber
      const labelColor = isDark ? '#fbbf24' : '#b45309';

      ctx.save();
      for (const phase of ctaPhases) {
        const xStart = Math.max(chartArea.left, xScale.getPixelForValue(phase.t_start));
        const xEnd = Math.min(chartArea.right, xScale.getPixelForValue(phase.t_end));
        if (!(xEnd > xStart)) continue;
        // Rectangle de la bande.
        ctx.fillStyle = bandColor;
        ctx.fillRect(xStart, chartArea.top, xEnd - xStart, chartArea.bottom - chartArea.top);
        // Liseré gauche/droit discret.
        ctx.fillStyle = isDark ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.30)';
        ctx.fillRect(xStart, chartArea.top, 1, chartArea.bottom - chartArea.top);
        ctx.fillRect(xEnd - 1, chartArea.top, 1, chartArea.bottom - chartArea.top);
        // Label "CTA · N RDV" centré en haut de la bande.
        const label = phase.rdv != null ? `CTA · ${phase.rdv} RDV` : 'CTA';
        ctx.font = '600 10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = labelColor;
        ctx.fillText(label, (xStart + xEnd) / 2, chartArea.top - 4);
      }
      ctx.restore();
    },
  }), [ctaPhases, isDark]);

  return (
    <div style={{
      marginTop: 18,
      paddingTop: 18,
      borderTop: `1px solid ${C.hairline}`,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 6,
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: C.faded,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
        }}>
          Présence pendant le live · spectateurs simultanés
        </div>
        {peakValue != null && peakClock && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
            color: C.violet.fg,
          }}>
            <span aria-hidden="true" style={{
              width: 7, height: 7, borderRadius: '50%',
              background: C.violet.strong, flexShrink: 0,
            }} />
            pic {fmtInt(peakValue)} à {peakClock}
          </div>
        )}
      </div>

      <div ref={containerRef} style={{ position: 'relative', height: 200 }}>
        <Line data={data} options={options} plugins={[ctaBandsPlugin]} />
        {tooltip && (
          <PresenceTooltip
            x={tooltip.x}
            y={tooltip.y}
            clock={tooltip.row.clock}
            n={tooltip.row.n}
            C={C}
          />
        )}
      </div>

      {/* Légende courte des bandes CTA — rendue seulement si présentes. */}
      {ctaPhases.length > 0 && (
        <div style={{
          marginTop: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          color: C.faded,
          fontWeight: 500,
          lineHeight: 1.4,
        }}>
          <span aria-hidden="true" style={{
            width: 22,
            height: 10,
            borderRadius: 3,
            background: isDark ? 'rgba(245,158,11,0.16)' : 'rgba(245,158,11,0.14)',
            border: `1px solid ${isDark ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.30)'}`,
            flexShrink: 0,
          }} />
          Phases CTA estimées d’après les pics de prises de RDV pendant le live (hors RDV post-webinaire)
        </div>
      )}

      {/* Légende rétention 30/60/90/120 min — secondaire, sous la courbe. */}
      <RetentionLegend curve={q.retention_curve} C={C} />
    </div>
  );
}

/** Tooltip flottant de la courbe de présence — pill blanc, ombre douce
 *  (même style que le FloatingTooltip de TrafficChart). */
function PresenceTooltip({ x, y, clock, n, C }) {
  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: 'translate(-50%, calc(-100% - 16px))',
      background: C.surface,
      borderRadius: 10,
      padding: '8px 12px',
      boxShadow: C.shadowFloat,
      border: `1px solid ${C.hairline}`,
      pointerEvents: 'none',
      zIndex: 5,
      fontFamily: 'inherit',
      whiteSpace: 'nowrap',
      animation: 'mktNumberTick 0.18s ease-out both',
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.muted,
        marginBottom: 2,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {clock}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: 50,
          background: C.violet.strong, flexShrink: 0,
        }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
          {fmtInt(n)}
        </span>
        <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>spectateurs</span>
      </div>
    </div>
  );
}

/** Légende compacte des % de rétention 30/60/90/120 min (sous la courbe). */
function RetentionLegend({ curve, C }) {
  const steps = useMemo(() => {
    if (!curve || typeof curve !== 'object') return [];
    return [30, 60, 90, 120]
      .map((min) => ({ min, pct: curve[min] ?? curve[String(min)] }))
      .filter((s) => s.pct != null && !Number.isNaN(Number(s.pct)));
  }, [curve]);

  if (steps.length === 0) return null;

  return (
    <div style={{
      marginTop: 12,
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px 14px',
      alignItems: 'center',
    }}>
      <span style={{
        fontSize: 10,
        fontWeight: 700,
        color: C.faded,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        Rétention
      </span>
      {steps.map((s) => (
        <span key={s.min} style={{
          fontSize: 12,
          fontWeight: 600,
          color: C.muted,
          fontVariantNumeric: 'tabular-nums',
        }}>
          <strong style={{ color: C.text, fontWeight: 700 }}>{fmtPct(s.pct)}</strong> à {s.min}min
        </span>
      ))}
    </div>
  );
}

/** Mini-courbe de rétention 30/60/90/120 min (% encore présents).
 *  Barres horizontales sobres alignées sur la palette du thème. Rendue
 *  uniquement si `curve` contient des valeurs exploitables. FALLBACK
 *  quand `presence_curve` est absente. */
function RetentionCurve({ curve, C }) {
  const steps = useMemo(() => {
    if (!curve || typeof curve !== 'object') return [];
    return [30, 60, 90, 120]
      .map((min) => ({ min, pct: curve[min] ?? curve[String(min)] }))
      .filter((s) => s.pct != null && !Number.isNaN(Number(s.pct)));
  }, [curve]);

  if (steps.length === 0) return null;

  return (
    <div style={{
      marginTop: 18,
      paddingTop: 18,
      borderTop: `1px solid ${C.hairline}`,
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: C.faded,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        marginBottom: 12,
      }}>
        Courbe de rétention · % encore présents
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {steps.map((s, i) => (
          <div key={s.min} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              width: 56,
              flexShrink: 0,
              fontSize: 12,
              fontWeight: 600,
              color: C.muted,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {s.min} min
            </span>
            <div style={{
              flex: 1,
              height: 8,
              borderRadius: 50,
              background: C.subtle,
              overflow: 'hidden',
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, Number(s.pct)))}%` }}
                transition={{ duration: 0.6, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  height: '100%',
                  borderRadius: 50,
                  background: C.violet.strong,
                }}
              />
            </div>
            <span style={{
              width: 44,
              flexShrink: 0,
              textAlign: 'right',
              fontSize: 12.5,
              fontWeight: 700,
              color: C.text,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {fmtPct(s.pct)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
