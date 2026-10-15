import React, { useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { EASE, useDrawn } from '../motion';
import { usePop, Detail } from './Pop';
import { fr, sourceOf } from './model';

// Des fiches de Funnel Leads aux colonnes de l'onglet Canaux (dev 15/10/2026 : « ADS affectés 255, comment c'est
// possible quand Funnel Leads nous dit 444 ? »). Chaque fiche entrante du mois est dans UNE bande, calculée à l'unité
// par le serveur (`intake.flow`) : jamais donnée (motif du moteur), ou donnée et aujourd'hui chez le sales affecté, reprise
// du pool par un autre sales, au pool sans repreneur, dans un autre canal. Les bandes « chez le sales affecté » et
// « repris du pool » sont les colonnes ADS du tableau ci-dessous.
const OTHER = { linkedin: 'LinkedIn', referral: 'parrainage', webinar: 'webinaire', cold_call: 'cold call', ccs: 'CCS', setter_rdv: 'setter', second_chance: 'seconde chance' };

export function flowNodes(intake) {
  const f = intake?.flow;
  if (!f || !intake.created) return null;
  const others = Object.entries(f).filter(([k, v]) => k.startsWith('other_') && v);
  const given = [
    { key: 'ads_affectation', label: `Chez le sales affecté${f.outside_affectation ? ` · colonne ${fr((f.ads_affectation || 0) + f.outside_affectation)}` : ''}`, value: f.ads_affectation || 0, color: sourceOf('affectation').color,
      lines: ['Le sales que le moteur a choisi l’a toujours (ou l’a reçu après un raté des 6 minutes d’un collègue).',
        `Colonne « ADS affectés » : ${fr((f.ads_affectation || 0) + (f.outside_affectation || 0))}${f.outside_affectation ? ` (dont ${fr(f.outside_affectation)} reçu par la date du formulaire, fiche créée avant le mois)` : ''}.`] },
    { key: 'ads_pool', label: `Repris du pool par un autre sales${f.outside_pool ? ` · colonne ${fr((f.ads_pool || 0) + f.outside_pool)}` : ''}`, value: f.ads_pool || 0, color: sourceOf('pool').color,
      lines: ['Reparti au pool commun, puis repris par un autre sales.', `Colonne « ADS repris du pool » : ${fr((f.ads_pool || 0) + (f.outside_pool || 0))}.`] },
    { key: 'pool_waiting', label: 'Au pool, personne ne l’a repris', value: f.pool_waiting || 0, color: '#c9cfda',
      lines: ['Donné à un sales, reparti au pool commun, et pas encore repris : il ne compte pour aucun sales.'] },
    { key: 'others', label: `Autres canaux (${others.map(([k, v]) => `${OTHER[k.slice(6)] || k.slice(6)} ${v}`).join(', ')})`,
      value: others.reduce((a, [, v]) => a + v, 0), color: '#d4834a', lines: ['Fiches entrantes de LinkedIn, parrainage ou webinaire : dans leur canal, pas dans les ADS.'] },
    { key: 'same_contact', label: 'Même contact déjà chez ce sales', value: f.same_contact || 0, color: '#aeb6c6', lines: ['Compté une fois par sales et par contact.'] },
    { key: 'demo', label: 'Comptes de test ou de démo', value: f.demo || 0, color: '#e2e6ee', lines: ['Hors statistiques.'] },
  ].filter((n) => n.value > 0);
  const notGiven = [
    { key: 'not_given_small', label: 'Moins de 100 k€, écartées', value: f.not_given_small || 0 },
    { key: 'not_given_duplicate', label: 'Doublons d’un contact déjà reçu', value: f.not_given_duplicate || 0 },
    { key: 'not_given_webinar', label: 'Inscrits webinaire pris par les setters', value: f.not_given_webinar || 0 },
    { key: 'not_given_unclassifiable', label: 'Non classables (tests)', value: f.not_given_unclassifiable || 0 },
    { key: 'not_given_waiting', label: 'Pas encore attribuées', value: f.not_given_waiting || 0 },
  ].filter((n) => n.value > 0).map((n) => ({ ...n, color: '#e6b45a', lines: ['Jamais données à un sales : motif du moteur d’affectation (dernier passage).'] }));
  const sum = (list) => list.reduce((a, n) => a + n.value, 0);
  return { total: intake.created, given, notGiven, givenTotal: sum(given), notGivenTotal: sum(notGiven), small: f.small_segment || 0, smallGiven: f.small_given || 0 };
}

const W = 1000, H = 330, NW = 14, GAP = 7, X = [0, 300, 640];

export default function AdsFlow({ intake, month }) {
  const data = useMemo(() => flowNodes(intake), [intake]);
  const drawn = useDrawn();
  const open = usePop();
  const [hover, setHover] = useState(null);
  if (!data) return null;
  const leaves = [...data.given, ...data.notGiven];
  const k = (H - GAP * (leaves.length - 1)) / data.total;
  // Colonne 3 : chaque bande à l'échelle ; colonne 2 : donnés / pas donnés, alignés sur leurs bandes.
  let y = 0;
  const pos = leaves.map((n) => { const h = Math.max(2, n.value * k); const p = { ...n, y, h }; y += h + GAP; return p; });
  const givenH = data.givenTotal * k, notH = data.notGivenTotal * k;
  const mid = [
    { key: 'given', label: 'Données à un sales', value: data.givenTotal, color: '#1e3a7b', y: 0, h: givenH },
    { key: 'not', label: 'Jamais données', value: data.notGivenTotal, color: '#e6b45a', y: H - notH, h: notH },
  ];
  const root = { y: 0, h: H };
  const band = (x0, x1, y0a, y0b, y1a, y1b) => {
    const c = (x0 + x1) / 2;
    return `M${x0},${y0a} C${c},${y0a} ${c},${y1a} ${x1},${y1a} L${x1},${y1b} C${c},${y1b} ${c},${y0b} ${x0},${y0b} Z`;
  };
  // Ruban racine → colonne 2 (une bande par groupe), puis colonne 2 → feuilles (dans l'ordre, empilées).
  const ribbons = [];
  let rootY = 0;
  for (const m of mid) {
    const h = m.value * k;
    ribbons.push({ key: `r-${m.key}`, d: band(X[0] + NW, X[1], rootY, rootY + h, m.y, m.y + h), color: m.color, group: m.key, delay: 0.1 });
    rootY += h;
  }
  const stack = { given: 0, not: 0 };
  pos.forEach((n, i) => {
    const group = i < data.given.length ? 'given' : 'not';
    const m = mid.find((x) => x.key === group);
    const h = n.value * k;
    const y0 = m.y + stack[group];
    stack[group] += h;
    ribbons.push({ key: `l-${n.key}`, d: band(X[1] + NW, X[2], y0, y0 + h, n.y, n.y + Math.max(h, 2)), color: n.color, leaf: n.key, group, delay: 0.45 + i * 0.05 });
  });
  // Survol : une feuille éclaire sa bande et le chemin de son groupe ; un groupe éclaire toutes ses bandes.
  const groupOf = (key) => (data.given.some((g) => g.key === key) ? 'given' : data.notGiven.some((g) => g.key === key) ? 'not' : key);
  const active = hover ? groupOf(hover) : null;
  const dim = (r) => hover && !(r.leaf ? r.leaf === hover || hover === r.group : r.group === active);
  // Étiquettes des feuilles : à hauteur de leur bande, écartées d'au moins MIN pour ne jamais se chevaucher.
  const MIN = 24;
  const labelY = pos.map((n) => n.y + n.h / 2);
  for (let i = 1; i < labelY.length; i += 1) labelY[i] = Math.max(labelY[i], labelY[i - 1] + MIN);
  if (labelY.length && labelY[labelY.length - 1] > H - 6) {
    labelY[labelY.length - 1] = H - 6;
    for (let i = labelY.length - 2; i >= 0; i -= 1) labelY[i] = Math.min(labelY[i], labelY[i + 1] - MIN);
  }
  const openNode = (e, n, kicker) => open(e.currentTarget, <Detail kicker={kicker} title={n.label} value={fr(n.value)}
    rows={[['Part des fiches reçues', `${fr((n.value / data.total) * 100, 1)} %`]]} lines={n.lines || []} />);
  return (
    <div className="ps2-flow">
      <svg viewBox={`-2 -6 ${W + 4} ${H + 12}`} role="img" aria-label={`Fiches reçues en ${month} : ${leaves.map((n) => `${n.label} ${n.value}`).join(', ')}`}
        onMouseLeave={() => setHover(null)}>
        <defs>
          <clipPath id="ps2-flow-reveal"><Motion.rect x="-2" y="-6" height={H + 12} initial={{ width: 0 }} animate={{ width: drawn ? W + 4 : 0 }} transition={{ duration: 1.3, ease: EASE }} /></clipPath>
        </defs>
        <g clipPath="url(#ps2-flow-reveal)">
          {ribbons.map((r) => (
            <path key={r.key} d={r.d} fill={r.color} opacity={dim(r) ? 0.08 : 0.28} style={{ transition: 'opacity .25s' }} />
          ))}
          <rect x={X[0]} y={root.y} width={NW} height={root.h} rx="3" fill="#121b35" />
          {mid.map((m) => <rect key={m.key} x={X[1]} y={m.y} width={NW} height={Math.max(2, m.h)} rx="3" fill={m.color} opacity={hover && active !== m.key ? 0.35 : 1} />)}
          {pos.map((n, i) => (
            <g key={n.key} opacity={hover && hover !== n.key && hover !== groupOf(n.key) ? 0.35 : 1}>
              <rect x={X[2]} y={n.y} width={NW} height={n.h} rx="2" fill={n.color} />
              <path d={`M${X[2] + NW + 2},${n.y + n.h / 2} L${X[2] + NW + 8},${labelY[i]}`} stroke={n.color} strokeWidth="1" fill="none" />
            </g>
          ))}
        </g>
      </svg>
      {/* Étiquettes en HTML (lisibles, cliquables) posées sur le schéma */}
      <button type="button" className="ps2-flow-label is-root" style={{ left: `${((NW + 8) / W) * 100}%`, top: '50%' }} onClick={(e) => open(e.currentTarget, <Detail kicker="Funnel Leads" title={`Fiches reçues en ${month}`} value={fr(data.total)}
        rows={[['Données à un sales', fr(data.givenTotal)], ['Jamais données', fr(data.notGivenTotal)], ['dont « 1 à 2 / moins de 100 k€ » de Funnel Leads', fr(data.small)], ['… données quand même', fr(data.smallGiven)]]}
        lines={['Mêmes filtres et mêmes bornes que Funnel Leads : fiches entrantes créées dans le mois, hors cold call et setters.']} />)}>
        <b className="ps2-num">{fr(data.total)}</b><span>reçues</span>
      </button>
      {mid.map((m) => (
        <button type="button" key={m.key} className="ps2-flow-label is-mid" style={{ left: `${((X[1] + NW + 8) / W) * 100}%`, top: `${((m.y + m.h / 2 + 6) / (H + 12)) * 100}%` }}
          onMouseEnter={() => setHover(m.key)} onMouseLeave={() => setHover(null)}
          onClick={(e) => openNode(e, m, 'Fiches reçues')}><b className="ps2-num">{fr(m.value)}</b><span>{m.label}</span></button>
      ))}
      {pos.map((n) => (
        <button type="button" key={n.key} className="ps2-flow-label is-leaf" style={{ left: `${((X[2] + NW + 10) / W) * 100}%`, top: `${((labelY[pos.indexOf(n)] + 6) / (H + 12)) * 100}%` }}
          onMouseEnter={() => setHover(n.key)} onMouseLeave={() => setHover(null)}
          onClick={(e) => openNode(e, n, data.given.some((g) => g.key === n.key) ? 'Données à un sales' : 'Jamais données')}>
          <i style={{ background: n.color }} /><b className="ps2-num">{fr(n.value)}</b><span>{n.label}</span>
        </button>
      ))}
      {/* Téléphone : la même répartition en liste (le schéma n'y est pas lisible). */}
      <div className="ps2-flow-list" role="list">
        {[{ key: 'total', label: 'Reçues', value: data.total, color: '#121b35', strong: true },
          { key: 'given', label: 'Données à un sales', value: data.givenTotal, color: '#1e3a7b', strong: true }, ...data.given,
          { key: 'not', label: 'Jamais données', value: data.notGivenTotal, color: '#e6b45a', strong: true }, ...data.notGiven].map((n, i) => (
          <div key={n.key} role="listitem" className={`ps2-flow-row${n.strong ? ' is-strong' : ''}`}>
            <span>{n.label}</span><b className="ps2-num">{fr(n.value)}</b>
            <span className="ps2-flow-bar"><Motion.i style={{ background: n.color }} initial={{ width: 0 }}
              animate={{ width: drawn ? `${(n.value / data.total) * 100}%` : 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.1 + i * 0.04 }} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}
