// Les panneaux de « Analyse financière » (refonte du 18/11/2026). La page répond, dans l'ordre, aux questions de la
// direction : combien de clients, combien de temps ils restent (la LTV, avec sa division écrite), combien partent ce
// mois et depuis le début ; puis la rétention mois après mois, au bout de quand on résilie, les résiliations mois par
// mois, et de quoi le parc est fait (niches, formes juridiques, gains). Chaque chiffre dit d'où il vient.
// Mise en page d'après la référence donnée par le dev (grands panneaux en verre, cartes blanches, une tuile noire),
// avec nos couleurs ; mouvement : chiffres qui défilent, courbe qui se trace, barres qui montent, une seule cascade.
import { useId, useRef, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { ChevronLeft, ChevronRight, CircleHelp, LayoutGrid } from "lucide-react";
import { Num } from "../../pages/TrackingSheetFinance/statistics/parts.jsx";
import { MONTH_DAYS, lifetimeLabel, monthLabel } from "../../utils/financialAnalysis.js";
import { compactEuros, number, percent } from "./format.js";

const EASE = [0.22, 1, 0.36, 1];
const SPRING = { type: "spring", stiffness: 520, damping: 40 };
const shortMonth = (key) => new Date(`${key}-15T12:00:00`).toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
const frenchDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

// Un panneau : titre, une phrase qui dit ce qu'on regarde, puis le contenu. Il arrive avec la cascade de la page.
export function Panel({ title, sub, aside, className = "", children, index = 0 }) {
  return (
    <Motion.section className={`fa-panel ${className}`.trim()} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE, delay: 0.06 * index }}>
      {title && (
        <header className="fa-panel-head">
          <div style={{ minWidth: 0 }}>
            <h3 className="fa-panel-title">{title}</h3>
            {sub && <p className="fa-panel-sub">{sub}</p>}
          </div>
          {aside}
        </header>
      )}
      {children}
    </Motion.section>
  );
}

// ── Le mois regardé ────────────────────────────────────────────────────────────────────────────────────────────────
// Une pastille : le mois en toutes lettres, deux flèches, et « Aujourd'hui » pour revenir au mois en cours.
export function MonthPicker({ value, bounds, onChange }) {
  const shift = (by) => {
    const d = new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1 + by, 1));
    return d.toISOString().slice(0, 7);
  };
  const previous = shift(-1);
  const next = shift(1);
  return (
    <div className="fa-month" role="group" aria-label="Mois regardé">
      <button type="button" className="fa-month-arrow" disabled={previous < bounds.first} onClick={() => onChange(previous)} aria-label="Mois précédent"><ChevronLeft size={16} /></button>
      <AnimatePresence mode="popLayout" initial={false}>
        <Motion.span key={value} className="fa-month-label" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: EASE }}>
          {monthLabel(value)}
        </Motion.span>
      </AnimatePresence>
      <button type="button" className="fa-month-arrow" disabled={next > bounds.last} onClick={() => onChange(next)} aria-label="Mois suivant"><ChevronRight size={16} /></button>
      {value !== bounds.last && <button type="button" className="fa-month-today" onClick={() => onChange(bounds.last)}>Aujourd’hui</button>}
    </div>
  );
}

// ── Les niches ─────────────────────────────────────────────────────────────────────────────────────────────────────
// En toutes lettres, avec leur nombre de clients en cours ; le fond blanc glisse sur la niche choisie.
export function NicheBar({ sectors, total, value, onChange }) {
  const id = useId();
  const items = [{ key: null, label: "Tout le parc", open: total }, ...sectors.filter((item) => item.key !== "others")];
  return (
    <div className="fa-niches" role="group" aria-label="Niche regardée">
      {items.map((item) => {
        const on = value === item.key;
        return (
          <button key={item.key ?? "all"} type="button" className="fa-niche" aria-pressed={on} onClick={() => onChange(on ? null : item.key)}
            title={`${item.label} : ${number(item.open)} client${item.open > 1 ? "s" : ""} en cours`}>
            {on && <Motion.span layoutId={`fa-niche-${id}`} className="fa-niche-thumb" transition={SPRING} />}
            {item.key == null && <LayoutGrid size={14} strokeWidth={1.9} />}
            <span>{item.label}</span><em className="fst-num">{number(item.open)}</em>
          </button>
        );
      })}
    </div>
  );
}

// ── La réponse ─────────────────────────────────────────────────────────────────────────────────────────────────────
// La réponse en une phrase, puis les trois chiffres demandés, chacun avec son calcul écrit.
export function Answer({ stats, scopeName, today }) {
  const { ltv, lifetime, resiliationMonth: month, resiliationPreviousMonth: previous, resiliationGlobal: global, afterFirstYear: year, departures } = stats;
  const current = stats.asOf === today;
  return (
    <Panel className="fa-answer" title={null} index={0}>
      <div className="fa-answer-grid">
        <div className="fa-sentence">
          <p className="fa-kicker">{scopeName} · {current ? "aujourd’hui" : `au ${frenchDay(stats.asOf)}`}</p>
          <p className="fa-lead">
            <b className="fst-num"><Num value={stats.inCourse} /></b> clients en cours. Un client reste en moyenne <b>{lifetimeLabel(ltv.averageDays)}</b>.
          </p>
          <p className="fa-follow">
            {year.passed > 0 && <>Ceux qui passent leur première année restent encore <b>{lifetimeLabel(year.extraDays)}</b> en moyenne ({number(year.stillHere)} sur {number(year.passed)} sont toujours là). </>}
            {departures.count > 0 && <>Ceux qui résilient partent au bout de <b>{lifetimeLabel(departures.averageDays)}</b> en moyenne.</>}
          </p>
        </div>

        <div className="fa-kpis">
          <article className="fa-kpi is-main">
            <span className="fa-kpi-label">Durée de vie moyenne (LTV)</span>
            <b className="fa-kpi-value">{lifetimeLabel(ltv.averageDays)}</b>
            <p className="fa-kpi-formula">
              <span className="fst-num">{number(ltv.totalMonths)}</span> mois de présence ÷ <span className="fst-num">{number(ltv.clients)}</span> clients
            </p>
            {/* La règle tient dans une bulle au survol : elle ne coupe pas la page (dev 18/11/2026). */}
            <span className="fa-kpi-how" tabIndex={0} aria-describedby="fa-ltv-rule">
              <CircleHelp size={14} />Comment c’est calculé
              <span className="fa-rule" role="tooltip" id="fa-ltv-rule">
                <b>De la signature à la sortie</b>, ou jusqu’à {current ? "aujourd’hui" : "la fin du mois"} pour un client encore là.
                <span>Médiane : {lifetimeLabel(lifetime.medianDays)} · {number(lifetime.open)} encore là, {number(lifetime.closed)} partis · {number(stats.retracted)} rétractés hors calcul.</span>
              </span>
            </span>
          </article>
          <article className="fa-kpi" title="Résiliations datées dans le mois ÷ clients en cours la veille du 1er.">
            <span className="fa-kpi-label">Résiliation {current ? "du mois" : `de ${monthLabel(month.key)}`}</span>
            <b className="fa-kpi-value fst-num"><Num value={month.rate == null ? null : month.rate * 100} format={(v) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`} /></b>
            <p className="fa-kpi-formula"><span className="fst-num">{number(month.count)}</span> résiliation{month.count > 1 ? "s" : ""} ÷ <span className="fst-num">{number(month.base)}</span> clients au 1er</p>
            <p className="fa-kpi-note">{previous.rate == null ? "" : `${percent(previous.rate)} le mois d’avant`}</p>
          </article>
          <article className="fa-kpi" title="Toutes les résiliations jusqu’à cette date ÷ clients en cours à cette date (définition de la feuille de la Finance).">
            <span className="fa-kpi-label">Résiliation depuis le début</span>
            <b className="fa-kpi-value fst-num"><Num value={global.rate == null ? null : global.rate * 100} format={(v) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`} /></b>
            <p className="fa-kpi-formula"><span className="fst-num">{number(global.count)}</span> résiliations ÷ <span className="fst-num">{number(global.base)}</span> clients en cours</p>
            <p className="fa-kpi-note">{number(stats.gone)} clients partis au total</p>
          </article>
        </div>
      </div>

    </Panel>
  );
}

// ── Combien de temps ils restent ───────────────────────────────────────────────────────────────────────────────────
// La courbe de rétention : pour chaque durée, la part des clients encore là, parmi ceux qui ont assez d'ancienneté pour
// le dire. Les jalons (3, 6, 12, 18, 24 mois) sont marqués ; le survol donne le détail mois par mois.
const W = 640;
const H = 250;
const PAD = { l: 44, r: 16, t: 26, b: 30 };
const MILESTONES = [3, 6, 12, 18, 24];
export function RetentionCurve({ curve }) {
  const [hover, setHover] = useState(null);
  const box = useRef(null);
  const max = Math.max(12, curve.at(-1)?.month || 0);
  const lowest = Math.min(...curve.map((point) => point.rate ?? 1));
  const floor = Math.max(0, Math.min(0.5, Math.floor((lowest - 0.05) * 10) / 10));
  const x = (month) => PAD.l + (month / max) * (W - PAD.l - PAD.r);
  const y = (rate) => PAD.t + (1 - (rate - floor) / (1 - floor)) * (H - PAD.t - PAD.b);
  const line = curve.map((point, i) => `${i ? "L" : "M"}${x(point.month).toFixed(1)} ${y(point.rate).toFixed(1)}`).join(" ");
  const area = `${line} L${x(curve.at(-1).month).toFixed(1)} ${H - PAD.b} L${x(0)} ${H - PAD.b} Z`;
  const ticks = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0].filter((tick) => tick >= floor);
  const shown = hover != null ? curve[hover] : null;
  const onMove = (e) => {
    const rect = box.current.getBoundingClientRect();
    const month = Math.round(((e.clientX - rect.left) / rect.width * W - PAD.l) / (W - PAD.l - PAD.r) * max);
    setHover(Math.max(0, Math.min(curve.length - 1, month)));
  };
  if (curve.length < 2) return <p className="fa-empty">Pas encore assez d’ancienneté pour tracer la courbe.</p>;
  return (
    <div className="fa-curve" ref={box} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Part des clients encore là, mois après mois">
        <defs>
          <linearGradient id="fa-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--charcoal)" stopOpacity=".12" /><stop offset="1" stopColor="var(--charcoal)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick} className="fa-grid">
            <line x1={PAD.l} x2={W - PAD.r} y1={y(tick)} y2={y(tick)} />
            <text x={PAD.l - 10} y={y(tick) + 4} textAnchor="end">{Math.round(tick * 100)} %</text>
          </g>
        ))}
        {[0, ...MILESTONES.filter((m) => m <= max), ...(max > 24 ? [max] : [])].map((m) => (
          <text key={m} className="fa-axis" x={x(m)} y={H - 8} textAnchor="middle">{m === 0 ? "signature" : m % 12 === 0 ? `${m / 12} an${m > 12 ? "s" : ""}` : `${m} mois`}</text>
        ))}
        <Motion.path d={area} fill="url(#fa-area)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.5 }} />
        <Motion.path d={line} className="fa-line" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: EASE, delay: 0.15 }} />
        {MILESTONES.map((m) => curve[m]).filter(Boolean).map((point, i) => (
          <Motion.g key={point.month} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 + i * 0.12, ...SPRING }}
            style={{ transformOrigin: `${x(point.month)}px ${y(point.rate)}px` }}>
            <circle className="fa-mark" cx={x(point.month)} cy={y(point.rate)} r={4.5} />
            <text className="fa-mark-label" x={x(point.month)} y={y(point.rate) - 11} textAnchor="middle">{percent(point.rate, 0)}</text>
          </Motion.g>
        ))}
        {shown && (
          <g className="fa-cursor">
            <line x1={x(shown.month)} x2={x(shown.month)} y1={PAD.t - 8} y2={H - PAD.b} />
            <circle cx={x(shown.month)} cy={y(shown.rate)} r={5} />
          </g>
        )}
      </svg>
      {shown && (
        <div className="fa-tip" style={{ left: `${(x(shown.month) / W) * 100}%`, top: `${(y(shown.rate) / H) * 100}%` }}>
          <b>{shown.month === 0 ? "À la signature" : `Au bout de ${lifetimeLabel(shown.month * MONTH_DAYS)}`}</b>
          <span><em className="fst-num">{percent(shown.rate)}</em> encore là</span>
          <small>{number(shown.kept)} sur {number(shown.eligible)} clients signés depuis au moins {shown.month || 0} mois</small>
        </div>
      )}
    </div>
  );
}

// ── Au bout de quand ils partent ───────────────────────────────────────────────────────────────────────────────────
export function Departures({ departures }) {
  const top = Math.max(1, ...departures.buckets.map((bucket) => bucket.count));
  if (!departures.count) return <p className="fa-empty">Aucune résiliation à cette date.</p>;
  return (
    <div className="fa-departures">
      <div className="fa-dep-figures">
        <div><b>{lifetimeLabel(departures.averageDays)}</b><span>en moyenne</span></div>
        <div><b>{lifetimeLabel(departures.medianDays)}</b><span>médiane</span></div>
        <div><b className="fst-num">{number(departures.afterOneYear)}</b><span>après un an</span></div>
      </div>
      <ul className="fa-bars">
        {departures.buckets.map((bucket, i) => (
          <li key={bucket.label} title={`${number(bucket.count)} résiliation${bucket.count > 1 ? "s" : ""} au bout de ${bucket.label.toLowerCase()}`}>
            <span className="fa-bars-label">{bucket.label}</span>
            <span className="fa-bars-track">
              <Motion.i initial={{ width: 0 }} animate={{ width: `${(bucket.count / top) * 100}%` }} transition={{ duration: 0.8, ease: EASE, delay: 0.2 + i * 0.06 }} />
            </span>
            <span className="fa-bars-value fst-num">{number(bucket.count)}</span>
          </li>
        ))}
      </ul>
      <p className="fa-note">Sur les {number(departures.count)} clients partis par résiliation. Les liquidations et les rétractations n’y sont pas.</p>
    </div>
  );
}

// ── Les résiliations, mois par mois ────────────────────────────────────────────────────────────────────────────────
// Douze barres : le taux de chaque mois. Le mois regardé est en noir ; un clic sur une barre le choisit.
export function MonthlyResiliations({ months, worst, value, onPick }) {
  const [hover, setHover] = useState(null);
  // L'échelle se prend sur les mois comparables : un mois de dix clients ne doit pas écraser les autres.
  const top = Math.max(0.005, ...months.filter((month) => month.comparable).map((month) => month.rate || 0));
  const shown = months.find((month) => month.key === (hover ?? value));
  return (
    <div className="fa-months">
      <div className="fa-months-bars" style={{ "--n": months.length }} onMouseLeave={() => setHover(null)}>
        {months.map((month, i) => {
          const year = i === 0 || month.key.endsWith("-01") ? month.key.slice(0, 4) : null;
          const peak = worst?.key === month.key;
          return (
            <button key={month.key} type="button" className="fa-mbar" aria-pressed={month.key === value} data-thin={month.comparable ? undefined : ""}
              data-peak={peak ? "" : undefined} onMouseEnter={() => setHover(month.key)} onFocus={() => setHover(month.key)}
              onClick={() => onPick(month.key)} title={`${month.label} : ${percent(month.rate)}`}>
              <span className="fa-mbar-track">
                <Motion.i initial={{ height: 0 }} animate={{ height: `${Math.min(100, Math.max(month.count ? 4 : 1.5, ((month.rate || 0) / top) * 100))}%` }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.1 + Math.min(i, 36) * 0.02 }}>
                  {peak && <em className="fa-mbar-peak fst-num">{percent(month.rate)}</em>}
                </Motion.i>
              </span>
              <span className="fa-mbar-label">{shortMonth(month.key)}</span>
              <span className="fa-mbar-year" data-first={i === 0 && !month.key.endsWith("-01") ? "" : undefined}>{year}</span>
            </button>
          );
        })}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {shown && (
          <Motion.p key={shown.key} className="fa-months-detail" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <b>{shown.label}</b> · {number(shown.count)} résiliation{shown.count > 1 ? "s" : ""} pour {number(shown.base)} clients en cours au 1er · <b className="fst-num">{percent(shown.rate)}</b>
            {!shown.comparable && <span className="fa-months-note"> · trop peu de clients pour comparer</span>}
          </Motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── De quoi le parc est fait ───────────────────────────────────────────────────────────────────────────────────────
export function Niches({ sectors, value, onPick }) {
  const top = Math.max(1, ...sectors.map((item) => item.open));
  return (
    <div className="fa-niche-list" role="list">
      <div className="fa-nl-head" aria-hidden="true"><span>Niche</span><span>En cours</span><span>Durée de vie</span><span>Résiliés</span></div>
      {sectors.map((item, i) => {
        const pickable = item.key !== "others";
        const Row = pickable ? "button" : "div";
        return (
          <Row key={item.key || "none"} role="listitem" className="fa-nl-row" style={{ "--i": i }} aria-pressed={pickable ? value === item.key : undefined}
            {...(pickable ? { type: "button", onClick: () => onPick(value === item.key ? null : item.key), title: "Regarder cette niche" } : {})}>
            <span className="fa-nl-name">{item.label}</span>
            <span className="fa-nl-open">
              <span className="fa-nl-track"><Motion.i initial={{ width: 0 }} animate={{ width: `${(item.open / top) * 100}%` }} transition={{ duration: 0.8, ease: EASE, delay: 0.15 + Math.min(i, 12) * 0.03 }} /></span>
              <em className="fst-num">{number(item.open)}</em>
            </span>
            <span className="fst-num fa-nl-num">{lifetimeLabel(item.averageDays)}</span>
            <span className="fst-num fa-nl-num">{item.resiliationRate ? percent(item.resiliationRate, 0) : "–"}</span>
          </Row>
        );
      })}
    </div>
  );
}

const FORM_SHADES = ["var(--charcoal)", "#6f6a63", "#a8a39b", "#cfcac2", "#e7e3dc"];
export function LegalForms({ forms }) {
  if (!forms.known) return <p className="fa-empty">Aucune forme juridique connue : ni dans les NDA, ni au registre des entreprises.</p>;
  return (
    <div className="fa-forms">
      <div className="fa-forms-bar" role="img" aria-label={forms.forms.map((f) => `${f.label} ${percent(f.share, 0)}`).join(", ")}>
        {forms.forms.map((form, i) => (
          <Motion.i key={form.label} style={{ background: FORM_SHADES[i] }} initial={{ flexGrow: 0 }} animate={{ flexGrow: form.count }} transition={{ duration: 0.9, ease: EASE, delay: 0.1 + i * 0.05 }} />
        ))}
      </div>
      <ul className="fa-forms-legend">
        {forms.forms.map((form, i) => (
          <li key={form.label}><i style={{ background: FORM_SHADES[i] }} /><span>{form.label}</span><b className="fst-num">{number(form.count)}</b><em className="fst-num">{percent(form.share, 0)}</em></li>
        ))}
      </ul>
      <p className="fa-note">Forme juridique connue pour {number(forms.known)} clients en cours sur {number(forms.known + forms.unknown)} : celle de leur NDA, sinon celle du registre des entreprises.</p>
    </div>
  );
}

export function Gains({ product, inCourse, scoped }) {
  const perClient = product?.savings != null && inCourse ? product.savings / inCourse : null;
  return (
    <div className="fa-gains">
      <div className="fa-gain is-main"><span>Économies réalisées</span><b>{compactEuros(product?.savings)}</b><small>par les clients, au total</small></div>
      <div className="fa-gain"><span>Par client</span><b>{compactEuros(perClient)}</b><small>{product?.savings != null ? `${compactEuros(product.savings)} ÷ ${number(inCourse)} clients` : "portail indisponible"}</small></div>
      <div className="fa-gain"><span>Sociétés accompagnées</span><b className="fst-num">{number(product?.companies)}</b><small>{product?.companies != null && inCourse ? `${(product.companies / inCourse).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} par client` : "portail indisponible"}</small></div>
      <p className="fa-note">{scoped ? "Chiffres du parc entier : le portail ne les donne pas par niche. " : ""}Les gains par secteur viendront d’Opti’Lex.</p>
    </div>
  );
}

// ── Le squelette ───────────────────────────────────────────────────────────────────────────────────────────────────
// La forme de la page, tout de suite, pendant la toute première lecture.
export function Skeleton() {
  return (
    <div className="fa-skeleton" aria-busy="true" aria-label="Chargement de l’analyse">
      <i className="is-bar" />
      <i className="is-answer" />
      <div className="fa-sk-row"><i /><i /></div>
      <i className="is-months" />
    </div>
  );
}
