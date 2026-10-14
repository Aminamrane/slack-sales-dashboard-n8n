import React, { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { CountUp, EASE, EASE_CSS, useDrawn } from '../motion';
import { FUNNEL, METRICS, SOURCES, fr, signedNum, sourceOf } from './model';
import { Detail, usePop } from './Pop';

// Graphiques SVG de la Performance Sales v2 (dev 14/10/2026 : « meilleur SVG, beau schéma qui représente »). Chacun se
// dessine à l'entrée de sa section dans l'écran (useDrawn), puis glisse vers les nouvelles valeurs.

// Entonnoir : une bande dont l'épaisseur est proportionnelle au volume de chaque étape (dev 14/10/2026 : « faut qu'il se
// mette à jour par rapport au volume qu'on a, pas un dessin toujours comme ça »), le taux de passage entre deux étapes,
// l'écart à l'attendu sous chaque chiffre. Un canal se choisit au-dessus (« uniquement les ADS, les CC, les CCS…, au
// global, qu'on ait vraiment le choix ») : sa bande, à sa couleur, se dessine dans la silhouette du global, à la même
// échelle, pour voir sa part réelle. La forme se déforme en douceur à chaque changement (canal, mois, données).
const W = 1000, H = 250, BAND = 220;

function bandPath(heights) {
  const n = heights.length, col = W / n, mid = H / 2, ease = 34;
  const yt = (i) => mid - heights[i] / 2, yb = (i) => mid + heights[i] / 2;
  let path = `M0,${yt(0)}`;
  for (let i = 0; i < n; i++) {
    const x1 = (i + 1) * col;
    if (i < n - 1) path += ` L${x1 - ease},${yt(i)} C${x1},${yt(i)} ${x1},${yt(i + 1)} ${x1 + ease},${yt(i + 1)}`;
    else path += ` L${W},${yt(i)}`;
  }
  path += ` L${W},${yb(n - 1)}`;
  for (let i = n - 1; i >= 0; i--) {
    const x0 = i * col;
    if (i > 0) path += ` L${x0 + ease},${yb(i)} C${x0},${yb(i)} ${x0},${yb(i - 1)} ${x0 - ease},${yb(i - 1)}`;
    else path += ` L0,${yb(0)}`;
  }
  return `${path} Z`;
}

// Puce « ADS reçus en <mois> » (dev 14/10/2026 : « tous les ADS, les gens pensent aux ADS reçues en octobre, pas au pool
// commun ») : les leads ADS REÇUS dans le mois (affectés ou repris du pool), suivis jusqu'à aujourd'hui ; son premier
// chiffre s'ouvre sur le pont avec le « Clean (tél FR) » de Funnel Leads.
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const monthName = (model) => MONTHS[Number(String(model.period?.start || '').slice(5, 7)) - 1] || 'ce mois';
const COHORT_KEY = 'ads_received';
const isCohort = (key) => key === COHORT_KEY;
export const channelColor = (key) => (isCohort(key) ? '#1e3a7b' : sourceOf(key).color);
export const channelLabel = (key, model) => (isCohort(key) ? `ADS reçus en ${model ? monthName(model) : 'ce mois'}` : sourceOf(key).label);

// Parcours d'un canal (dev 14/10/2026 : « regarde l'incohérence ») : les MÊMES leads d'un bout à l'autre, ceux qui ont
// bougé dans le mois, et jusqu'où chacun est allé. Chaque étape inclut les suivantes ; les canaux font le global.
const JOURNEY = ['active', 'r1', 'r2', 'signed', 'sales'];
export const JOURNEY_LABELS = ['Leads actifs', 'Ont fait un R1', 'Ont fait un R2', 'Ont signé', 'Vendus'];
const COHORT_STEPS = ['j_active', 'j_r1', 'j_r2', 'j_signed', 'j_sales'];
function channelJourney(model, key) {
  if (isCohort(key)) return COHORT_STEPS.map((k) => model.cohort?.by_family?.ads?.[k] || 0);
  const j = model.journeys || {};
  return JOURNEY.map((step) => j[key]?.[step] || 0);
}
// Silhouette de fond : tous les leads reçus du mois pour la puce cohorte, tous les leads actifs sinon.
function ghostJourney(model, key) {
  if (isCohort(key)) return COHORT_STEPS.map((k) => Object.values(model.cohort?.by_family || {}).reduce((a, f) => a + (f[k] || 0), 0));
  return JOURNEY.map((step) => model.journeys?.global?.[step] || 0);
}

export function FunnelPicker({ model, value, onChange }) {
  const j = model.journeys || {};
  const present = SOURCES.filter((s) => (j[s.key]?.active || 0) > 0);
  if (!present.length) return null;
  const cohortAds = model.cohort?.by_family?.ads?.j_active ? [{ key: COHORT_KEY, label: channelLabel(COHORT_KEY, model), color: '#1e3a7b', group: true }] : [];
  const chips = [{ key: null, label: 'Global' }, ...cohortAds, ...present];
  return (
    <div className="ps2-picker" role="radiogroup" aria-label="Canal de l’entonnoir">
      {chips.map((s) => {
        const on = value === s.key;
        return (
          <button type="button" key={s.key || 'global'} role="radio" aria-checked={on} className={`ps2-pick${s.group ? ' is-group' : ''}`} onClick={() => onChange(s.key)}>
            {on && <Motion.span layoutId="ps2-pick-pill" className="ps2-pick-pill" transition={{ duration: 0.4, ease: EASE }} />}
            <span className="ps2-pick-label">{s.color && <i style={{ background: s.color }} />}{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function FunnelFlow({ model, onOpen, source = null }) {
  const drawn = useDrawn();
  const openPop = usePop();
  const [hover, setHover] = useState(null);
  const journey = source ? channelJourney(model, source) : null;
  const cohortMode = isCohort(source);
  const total = source ? ghostJourney(model, source) : FUNNEL.map((k) => model.value[k] || 0);
  const labels = cohortMode ? [`Reçus en ${monthName(model)}`, ...JOURNEY_LABELS.slice(1)] : JOURNEY_LABELS;
  const values = journey || total;
  const color = source ? channelColor(source) : null;
  const scale = Math.max(1, ...total);
  const height = (v) => (v ? Math.max(4, BAND * (v / scale)) : 2);
  const path = bandPath(values.map(height));
  const ghost = bandPath(total.map(height));
  const col = W / FUNNEL.length, mid = H / 2;
  const conversions = values.slice(1).map((v, i) => (values[i] ? Math.round((v / values[i]) * 100) : null));
  const label = FUNNEL.map((k, i) => `${journey ? labels[i] : METRICS[k].label} ${values[i]}`).join(', ');
  return (
    <div className="ps2-funnel">
      <div className="ps2-stages">
        {FUNNEL.map((k, i) => {
          const m = model.metrics[k];
          const share = journey ? (cohortMode ? (values[0] ? Math.round((values[i] / values[0]) * 100) : null) : total[i] ? Math.round((values[i] / total[i]) * 100) : null) : null;
          const name = journey ? labels[i] : m.label;
          return (
            <button type="button" key={k} className="ps2-stage"
              onClick={(e) => (journey ? openPop(e.currentTarget, cohortMode && i === 0 ? <IntakeBridge model={model} /> : (
                <Detail kicker={`${channelLabel(source, model)} · parcours`} title={labels[i]} value={fr(values[i])}
                  rows={labels.map((l, k2) => [l, `${fr(values[k2])}${k2 && values[k2 - 1] ? ` · ${Math.round((values[k2] / values[k2 - 1]) * 100)} %` : ''}`, k2 === i ? 'ps2-strong' : ''])}
                  lines={cohortMode
                    ? ['Les leads ADS reçus dans le mois (affectés par le moteur ou repris du pool), suivis jusqu’à aujourd’hui.', 'Chaque étape inclut les suivantes. R1 : effectué ou fait au téléphone.']
                    : ['Leads actifs : reçus, attribués ou réattribués dans le mois, ou avec un RDV, une signature ou une vente dans le mois.',
                      'Chaque lead compte une fois, dans le canal de son résultat, et chaque étape inclut les suivantes. R1 : effectué ou fait au téléphone.']} />
              )) : onOpen(k))}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} aria-label={`${name} : ${values[i]}, vérifier`}>
              <div className="ps2-mono">{name}</div>
              <div className="ps2-stage-value ps2-num"><CountUp value={values[i]} delay={150 + i * 90} duration={700} /></div>
              {journey ? (
                <div className="ps2-stage-note ps2-soft">{i === 0 && !cohortMode && model.journeys?.[source]
                  ? `dont ${fr(model.journeys[source].received || 0)} reçus en ${monthName(model)}`
                  : share == null ? ' ' : cohortMode ? `${share} % des reçus` : `${share} % du global`}</div>
              ) : (
                <>
                  <div className={`ps2-stage-note ${m.gap == null ? 'ps2-soft' : m.gap >= 0 ? 'ps2-good' : 'ps2-low'}`}>
                    {m.gap == null ? (k === 'signed' ? 'sur Yousign' : ' ') : `${signedNum(m.gap)} sur l'attendu (${fr(m.expected)})`}
                  </div>
                  {k === 'leads' && model.bridge?.given > 0 && (
                    <div className="ps2-stage-note ps2-soft ps2-num ps2-stage-bridge">{fr(model.bridge.given)} affectés{model.bridge.pool ? ` · ${fr(model.bridge.pool)} au pool` : ''}</div>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Entonnoir${source ? ` ${channelLabel(source, model)}` : ''} : ${label}`}>
        <defs>
          <linearGradient id="ps2-band" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#cfdaf0" /><stop offset="0.5" stopColor="#7f9ad9" /><stop offset="1" stopColor="#1e3a7b" />
          </linearGradient>
          {color && <linearGradient id="ps2-band-channel" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={color} stopOpacity="0.55" /><stop offset="1" stopColor={color} />
          </linearGradient>}
          <clipPath id="ps2-funnel-clip">
            <rect x="0" y="0" height={H} width={W} style={{ transform: `scaleX(${drawn ? 1 : 0})`, transformOrigin: 'left',
              transition: `transform 1400ms ${EASE_CSS} 150ms` }} />
          </clipPath>
        </defs>
        {FUNNEL.slice(1).map((k, i) => <line key={k} x1={(i + 1) * col} x2={(i + 1) * col} y1="0" y2={H} stroke="var(--line-2)" />)}
        <g clipPath="url(#ps2-funnel-clip)">
          <Motion.path initial={false} animate={{ d: ghost, opacity: source ? 1 : 0 }} transition={{ duration: 0.6, ease: EASE }} fill="var(--line-2)" />
          <Motion.path initial={false} animate={{ d: path }} transition={{ duration: 0.9, ease: EASE }} fill={color ? 'url(#ps2-band-channel)' : 'url(#ps2-band)'} />
          {FUNNEL.map((k, i) => (
            <rect key={k} x={i * col} y="0" width={col} height={H} fill="var(--card)"
              style={{ opacity: hover != null && hover !== i ? 0.45 : 0, transition: 'opacity .25s ease' }} />
          ))}
        </g>
        {conversions.map((c, i) => (
          <g key={i} style={{ opacity: drawn ? 1 : 0, transition: `opacity 500ms ease ${900 + i * 120}ms` }}>
            <rect x={(i + 1) * col - 38} y={mid - 14} width="76" height="28" rx="14" fill="var(--card)" stroke="var(--line)" />
            <text x={(i + 1) * col - 6} y={mid + 5} textAnchor="middle" className="ps2-chip" fill="var(--ink)">{c == null ? '–' : `${Math.min(c, 100)} %`}</text>
            <path d={`M${(i + 1) * col + 16},${mid - 4} l6,4 l-6,4`} fill="none" stroke="var(--soft)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
      </svg>
    </div>
  );
}

// Anneau des canaux : un arc par source, survol = la source au centre.
export function Donut({ counts, total, label, onPick }) {
  const drawn = useDrawn();
  const [hover, setHover] = useState(null);
  const parts = SOURCES.map((s) => ({ ...s, value: counts[s.key] || 0 })).filter((s) => s.value > 0);
  const sum = Math.max(1, parts.reduce((a, p) => a + p.value, 0));
  let offset = 0;
  const shown = hover ? parts.find((p) => p.key === hover) : null;
  return (
    <div style={{ position: 'relative', width: 240, height: 240, margin: '0 auto' }}>
      <svg viewBox="0 0 240 240" width="240" height="240" role="img"
        aria-label={`${total} ${label} : ${parts.map((p) => `${p.label} ${p.value}`).join(', ')}`}>
        <circle cx="120" cy="120" r="92" fill="none" stroke="var(--line-2)" strokeWidth="26" />
        {parts.map((p, i) => {
          const len = (p.value / sum) * 100;
          const gap = parts.length > 1 ? Math.min(0.6, len / 3) : 0;
          const el = (
            <circle key={p.key} cx="120" cy="120" r="92" fill="none" stroke={p.color} pathLength="100"
              strokeWidth={hover === p.key ? 32 : 26} transform="rotate(-90 120 120)"
              strokeDasharray={drawn ? `${Math.max(0.01, len - gap)} ${100 - len + gap}` : `0 100`} strokeDashoffset={-offset}
              style={{ transition: `stroke-dasharray 1100ms ${EASE_CSS} ${200 + i * 70}ms, stroke-width .2s ease`, cursor: onPick ? 'pointer' : 'default' }}
              onMouseEnter={() => setHover(p.key)} onMouseLeave={() => setHover(null)} onClick={() => onPick?.(p.key)} />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', textAlign: 'center' }}>
        <span className="ps2-num" style={{ fontSize: 34, fontWeight: 600 }}>{shown ? shown.value : <CountUp value={total} />}</span>
        <span style={{ fontSize: 12, color: 'var(--soft)', maxWidth: 130 }}>{shown ? shown.label : label}</span>
      </div>
    </div>
  );
}

// Cohorte : les leads reçus dans le mois et ce qu'ils sont devenus, chaque barre en part des leads reçus.
export function CohortBars({ steps }) {
  const drawn = useDrawn();
  const base = Math.max(1, steps[0]?.value || 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
      {steps.map((s, i) => (
        <div key={s.key} style={{ display: 'grid', gridTemplateColumns: '170px minmax(0, 1fr) 120px', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</span>
          <div style={{ height: 22, borderRadius: 7, background: 'var(--line-2)', overflow: 'hidden' }}>
            <Motion.div initial={{ width: 0 }} animate={{ width: drawn ? `${Math.max(1.5, (s.value / base) * 100)}%` : 0 }}
              transition={{ duration: 1.1, ease: EASE, delay: 0.2 + i * 0.09 }}
              style={{ height: '100%', borderRadius: 7, background: s.color }} />
          </div>
          <span className="ps2-num" style={{ fontSize: 13, textAlign: 'right' }}>
            <b style={{ fontSize: 16 }}><CountUp value={s.value} delay={200 + i * 90} /></b>
            <span style={{ color: 'var(--soft)' }}> · {i === 0 ? '100' : fr((s.value / base) * 100, 0)} %</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// Pont entre le « Clean (tél FR) » de Funnel Leads et les leads ADS reçus de la page (calculé par le backend, à l'unité).
function IntakeBridge({ model }) {
  const b = model.pilot?.intake?.bridge;
  if (!b) return <Detail kicker="ADS reçus" title="Pont non disponible" />;
  const ng = b.clean_not_given || {}, oc = b.clean_other_channel || {};
  const others = Object.values(oc).reduce((a, v) => a + v, 0);
  const otherLabel = Object.entries(oc).map(([k, v]) => `${{ linkedin: 'LinkedIn', referral: 'parrainage', webinar: 'webinaire', cold_call: 'cold call', ccs: 'CCS' }[k] || k} ${v}`).join(', ');
  const rows = [
    ['« Clean (tél FR) » de Funnel Leads', fr(b.clean), 'ps2-strong'],
    ng.duplicate && ['− doublons écartés par le moteur', fr(ng.duplicate)],
    ng.webinar && ['− inscrits webinaire pris par les setters', fr(ng.webinar)],
    ng.unclassifiable && ['− fiches non classables (tests)', fr(ng.unclassifiable)],
    ng.waiting && ['− pas encore attribués', fr(ng.waiting)],
    others && [`− autres canaux (${otherLabel})`, fr(others)],
    b.clean_same_contact && ['− même contact déjà reçu par le même sales', fr(b.clean_same_contact)],
    ['= leads ADS clean donnés aux sales', fr(b.ads_clean), 'ps2-strong'],
    b.ads_non_fr && ['+ téléphone non français (retirés par Funnel)', fr(b.ads_non_fr)],
    b.ads_small && ['+ moins de 100 k€ donnés quand même', fr(b.ads_small)],
    b.ads_received_outside && ['+ reçus dans le mois, fiche créée juste avant', fr(b.ads_received_outside)],
    [`= ADS reçus en ${monthName(model)} ici`, fr(b.cohort_ads), 'ps2-strong'],
  ];
  return <Detail kicker={`ADS reçus en ${monthName(model)}`} title="Du « Clean » de Funnel Leads aux leads de la page" rows={rows}
    source="Funnel Leads compte les fiches ; la page compte les leads donnés aux sales, une fois par sales et par contact" />;
}
