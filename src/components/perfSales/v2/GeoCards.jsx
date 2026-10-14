import React, { useEffect, useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import apiClient from '../../../services/apiClient';
import { CountUp, EASE, ITEM, Reveal, useRevealed } from '../motion';
import { Detail, Info, usePop } from './Pop';
import { fr } from './model';
import { FRANCE_REGIONS, FRANCE_VIEWBOX } from './franceRegions';

// Carte des clients et âge des prospects (dev 14/10/2026 : « une carte de la France et les régions où on a le plus de
// clients, par personne ; la tranche d'âge avec la connexion Meta, c'est juste des stats en plus »). Région = code postal
// de l'entreprise cliente ; âge = ventilation Meta des leads des publicités (agrégée par Meta, en parts).
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const AGE_COLORS = { female: '#3e7d5a', male: '#1e3a7b' };
const pct = (v, t) => (t ? (v / t) * 100 : 0);
const LOW = [226, 232, 243], HIGH = [30, 58, 123];   // bleu Owner très clair -> marine
const shade = (t) => `rgb(${LOW.map((c, i) => Math.round(c + (HIGH[i] - c) * t)).join(', ')})`;

export default function GeoCards({ period, teams }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(period || '')) return undefined;
    let alive = true;
    setError(false);
    apiClient.get(`/api/v1/monitoring/performance/v2/geo?period=${period}`).then((d) => alive && setData(d)).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [period]);
  if (error) return <div className="ps2-span-12 ps2-empty" role="alert">Carte non chargée</div>;
  if (!data) return null;
  return (
    <>
      <ClientsMap data={data.clients} teams={teams} month={MONTHS[Number(period.slice(5, 7)) - 1]} />
      <AgePyramid ages={data.ages} month={MONTHS[Number(period.slice(5, 7)) - 1]} />
    </>
  );
}

function ClientsMap({ data, teams, month }) {
  const [scope, setScope] = useState('total');         // total (depuis le début) | period (signés dans le mois)
  const [who, setWho] = useState('global');            // global | team:<label> | <sales>
  const [hover, setHover] = useState(null);
  const open = usePop();
  const team = who.startsWith('team:') ? teams.find((t) => t.team === who.slice(5)) : null;
  const members = useMemo(() => teams.flatMap((t) => t.members || []), [teams]);
  const sellers = data.people.filter((p) => members.includes(p.name) && p.total);
  const values = useMemo(() => {
    const out = {};
    const add = (code, n) => { out[code] = (out[code] || 0) + n; };
    if (who === 'global') data.regions.forEach((r) => add(r.code, r[scope]));
    else data.people.filter((p) => (team ? team.members?.includes(p.name) : p.name === who))
      .forEach((p) => Object.entries(p.regions).forEach(([code, v]) => add(code, v[scope])));
    return out;
  }, [data, scope, who, team]);
  const total = Object.values(values).reduce((a, n) => a + n, 0);
  const metro = FRANCE_REGIONS.map((r) => ({ ...r, value: values[r.code] || 0 }));
  const max = Math.max(1, ...metro.map((r) => r.value));
  const ranked = [...metro].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  const rank = Object.fromEntries(ranked.map((r, i) => [r.code, i]));
  const tint = (v) => (v ? 0.14 + 0.86 * Math.sqrt(v / max) : 0);   // racine : 9 et 129 restent lisibles
  const label = who === 'global' ? 'Toute l’équipe' : team ? team.team : who;
  const regionTotal = (code) => data.regions.find((r) => r.code === code)?.[scope] || 0;
  const detail = (r) => {
    const people = data.people.filter((p) => p.regions[r.code]?.[scope] && (who === 'global' || (team ? team.members?.includes(p.name) : p.name === who)))
      .sort((a, b) => b.regions[r.code][scope] - a.regions[r.code][scope]).slice(0, 5);
    return (
      <Detail kicker={r.name} title={`${label} · ${scope === 'total' ? 'depuis le début' : `signés en ${month}`}`} value={fr(r.value)}
        rows={[[`Part de ${fr(total)} clients`, `${fr(pct(r.value, total), 0)} %`], ['Rang', `${rank[r.code] + 1} / 13`],
          who !== 'global' ? ['Tous les sales dans la région', fr(regionTotal(r.code))] : null,
          ...people.map((p) => [p.name, fr(p.regions[r.code][scope])])]} />
    );
  };
  const om = values.OM || 0;
  const coverage = scope === 'total' ? [data.known, data.total] : [data.period_known, data.period_total];
  return (
    <Reveal as="section" className="ps2-card ps2-span-8" aria-labelledby="ps2-geo-title">
      <Motion.div className="ps2-card-head" variants={ITEM}>
        <h2 id="ps2-geo-title">Où sont nos clients</h2>
        <span className="ps2-geo-tools">
          <span className="ps2-switch" role="tablist" aria-label="Période">
            {[['total', 'Depuis le début'], ['period', `Signés en ${month}`]].map(([k, l]) => (
              <button type="button" key={k} role="tab" aria-selected={scope === k} className="ps2-switch-btn is-small" onClick={() => setScope(k)}>
                {scope === k && <Motion.span layoutId="ps2-geo-scope" className="ps2-switch-pill" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                <span>{l}</span>
              </button>
            ))}
          </span>
          <label className="ps2-month is-small"><span>{label}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            <select aria-label="Équipe ou sales" value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="global">Toute l’équipe</option>
              {teams.length > 0 && <optgroup label="Équipes">{teams.map((t) => <option key={t.team} value={`team:${t.team}`}>{t.team}</option>)}</optgroup>}
              <optgroup label="Sales">{sellers.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}</optgroup>
            </select>
          </label>
        </span>
      </Motion.div>
      <Motion.div className="ps2-geo" variants={ITEM}>
        <div className="ps2-geo-map">
          <svg viewBox={FRANCE_VIEWBOX} role="img" aria-label={`Clients par région, ${label}`}>
            <defs>
              <filter id="ps2-geo-lift" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#121b35" floodOpacity=".22" /></filter>
            </defs>
            {metro.map((r) => (
              <Motion.path key={r.code} d={r.d} className={`ps2-geo-region${hover === r.code ? ' is-on' : ''}`} tabIndex={0} role="button"
                aria-label={`${r.name} : ${r.value} clients`}
                initial={{ opacity: 0, scale: 0.94, fill: shade(0) }} animate={{ opacity: 1, scale: hover === r.code ? 1.015 : 1, fill: shade(tint(r.value)) }}
                transition={{ duration: 0.6, ease: EASE, delay: hover ? 0 : 0.1 + rank[r.code] * 0.045, fill: { duration: 0.7, ease: EASE } }}
                onMouseEnter={() => setHover(r.code)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(r.code)} onBlur={() => setHover(null)}
                onClick={(e) => open(e.currentTarget, detail(r))} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e.currentTarget, detail(r)); } }} />
            ))}
            {metro.filter((r) => r.value).map((r) => (
              <Motion.g key={`l-${r.code}`} className="ps2-geo-label" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE, delay: 0.55 + rank[r.code] * 0.045 }} style={{ pointerEvents: 'none' }}>
                <text x={r.cx} y={r.cy + 5} textAnchor="middle" className={tint(r.value) > 0.58 ? 'is-light' : ''}>{r.value}</text>
              </Motion.g>
            ))}
          </svg>
          {om > 0 && <span className="ps2-geo-om">Outre-mer <b className="ps2-num">{om}</b></span>}
        </div>
        <div className="ps2-geo-rank">
          <Info className="ps2-geo-total" label="Couverture, détail"
            detail={<Detail kicker={scope === 'total' ? 'Clients localisés' : `Signés en ${month}, localisés`} value={`${fr(coverage[0])} / ${fr(coverage[1])}`}
              rows={scope === 'total'
                ? [['Adresse de l’entreprise (API recherche-entreprises)', 'en priorité'], ['Sinon, fiche d’intégration', 'code postal']]
                : [[`Signés en ${month} (date de signature)`, fr(data.period_total)], [`Ventes déclarées en ${month} (en-tête)`, fr(data.declared)],
                  data.declared_signed_before ? ['dont signées le mois d’avant', fr(data.declared_signed_before)] : null,
                  data.declared_signed_after ? ['dont signées après', fr(data.declared_signed_after)] : null]}
              source="La région est celle du siège de l’entreprise cliente" />}>
            <b className="ps2-num"><CountUp value={total} /></b><span>clients</span>
          </Info>
          <ol>
            {ranked.filter((r) => r.value).map((r, i) => (
              <RankRow key={r.code} r={r} i={i} total={total} max={max} color={shade(tint(r.value))} on={hover === r.code}
                onHover={setHover} onOpen={(el) => open(el, detail(r))} />
            ))}
          </ol>
        </div>
      </Motion.div>
    </Reveal>
  );
}

function RankRow({ r, i, total, max, color, on, onHover, onOpen }) {
  const shown = useRevealed();
  return (
    <li>
      <button type="button" className={`ps2-geo-row${on ? ' is-on' : ''}`} onMouseEnter={() => onHover(r.code)} onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(r.code)} onBlur={() => onHover(null)} onClick={(e) => onOpen(e.currentTarget)} aria-haspopup="dialog">
        <span className="ps2-geo-rank-n ps2-num">{i + 1}</span>
        <span className="ps2-geo-name"><i style={{ background: color }} />{r.name}</span>
        <span className="ps2-geo-bar"><Motion.i initial={{ width: 0 }} animate={{ width: shown ? `${(r.value / max) * 100}%` : 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.25 + i * 0.05 }} style={{ background: color }} /></span>
        <b className="ps2-num">{fr(r.value)}</b>
        <small className="ps2-num">{fr(pct(r.value, total), 0)} %</small>
      </button>
    </li>
  );
}

// Pyramide des âges des leads Meta : femmes à gauche, hommes à droite, en part de tous les leads de la période.
function AgePyramid({ ages, month }) {
  const on = useRevealed();
  const total = ages.leads || 0;
  const rows = [...(ages.ages || [])].reverse();
  const side = Math.max(1, ...rows.flatMap((r) => [r.female, r.male]));
  const women = rows.reduce((a, r) => a + r.female, 0), men = rows.reduce((a, r) => a + r.male, 0);
  const top = rows.reduce((a, r) => (r.leads > (a?.leads || 0) ? r : a), null);
  return (
    <Reveal as="section" className="ps2-card ps2-span-4" aria-labelledby="ps2-age-title">
      <Motion.div className="ps2-card-head" variants={ITEM}>
        <h2 id="ps2-age-title">Âge des prospects ADS</h2>
        <Info className="ps2-chip-soft" label="Source, détail"
          detail={<Detail kicker={`Meta · ${month}`} title="Leads des publicités, par âge et sexe" value={fr(total)}
            rows={[['Femmes', `${fr(pct(women, total), 0)} %`], ['Hommes', `${fr(pct(men, total), 0)} %`], ['Non précisé', `${fr(pct(total - women - men, total), 0)} %`]]}
            lines={['Compté par Meta (formulaires envoyés, 4 comptes publicitaires). Funnel Leads compte les fiches reçues dans le CRM.', 'Meta ne donne l’âge que par tranche, jamais lead par lead.']} />}>Meta</Info>
      </Motion.div>
      {!total ? <div className="ps2-empty">Pas de leads Meta sur la période</div> : (
        <Motion.div variants={ITEM} className="ps2-pyr">
          <div className="ps2-pyr-head"><span style={{ color: AGE_COLORS.female }}>Femmes</span><span /><span style={{ color: AGE_COLORS.male }}>Hommes</span></div>
          {rows.map((r, i) => (
            <Info key={r.age} className={`ps2-pyr-row${top?.age === r.age ? ' is-top' : ''}`} label={`${r.age} ans, détail`}
              detail={<Detail kicker={`${r.age} ans`} title={`${fr(pct(r.leads, total), 0)} % des leads`} value={fr(r.leads)}
                rows={[['Femmes', fr(r.female)], ['Hommes', fr(r.male)], r.unknown ? ['Non précisé', fr(r.unknown)] : null,
                  ['Dépense', `${fr(r.spend)} €`], ['Coût par lead', r.cpl == null ? '–' : `${fr(r.cpl, 0)} €`]]} />}>
              <span className="ps2-pyr-side is-left">
                <small className="ps2-num">{fr(pct(r.female, total), 0)} %</small>
                <Motion.i style={{ background: AGE_COLORS.female }} initial={{ width: 0 }} animate={{ width: on ? `${(r.female / side) * 100}%` : 0 }}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.2 + i * 0.07 }} />
              </span>
              <span className="ps2-pyr-age">{r.age}</span>
              <span className="ps2-pyr-side">
                <Motion.i style={{ background: AGE_COLORS.male }} initial={{ width: 0 }} animate={{ width: on ? `${(r.male / side) * 100}%` : 0 }}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.2 + i * 0.07 }} />
                <small className="ps2-num">{fr(pct(r.male, total), 0)} %</small>
              </span>
            </Info>
          ))}
          <div className="ps2-pyr-foot">
            <span><i style={{ background: AGE_COLORS.female }} />Femmes <b className="ps2-num">{fr(pct(women, total), 0)} %</b></span>
            <span><i style={{ background: AGE_COLORS.male }} />Hommes <b className="ps2-num">{fr(pct(men, total), 0)} %</b></span>
          </div>
          <CostPerLead ages={ages.ages || []} />
        </Motion.div>
      )}
    </Reveal>
  );
}

// Coût par lead de chaque tranche (dépense Meta ÷ leads Meta) ; la tranche la moins chère en vert.
function CostPerLead({ ages }) {
  const on = useRevealed();
  const rows = ages.filter((r) => r.cpl != null);
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.cpl));
  const best = rows.reduce((a, r) => (r.cpl < a.cpl ? r : a), rows[0]);
  return (
    <div className="ps2-cpl">
      <h3>Coût par lead</h3>
      <div className="ps2-cpl-cols">
        {rows.map((r, i) => (
          <Info key={r.age} className={`ps2-cpl-col${r === best ? ' is-best' : ''}`} label={`${r.age} ans : ${fr(r.cpl, 0)} € par lead`}
            detail={<Detail kicker={`${r.age} ans`} title="Coût par lead" value={`${fr(r.cpl, 0)} €`} lines={[`${fr(r.spend)} € ÷ ${fr(r.leads)} leads`]} />}>
            <span className="ps2-cpl-plot">
              <Motion.span className="ps2-cpl-stem" initial={{ height: 0 }} animate={{ height: on ? `${(r.cpl / max) * 100}%` : 0 }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.3 + i * 0.06 }}>
                <b className="ps2-num">{fr(r.cpl, 0)} €</b>
              </Motion.span>
            </span>
            <span className="ps2-cpl-age">{r.age}</span>
          </Info>
        ))}
      </div>
    </div>
  );
}
