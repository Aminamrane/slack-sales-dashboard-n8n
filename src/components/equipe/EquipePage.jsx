import React, { memo, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarPlus, CalendarX2, CheckCheck, Headset, Star, TrendingUp, Users } from 'lucide-react';
import { fmtEuro } from '../../pages/SettersStats/settersStats.js';
import {
  absentees, countPeople, fmtDay, groupSales, initialsOf, legibleOnWhite, listSetters, MODE_LABELS, salesSheetPath, setterSheetPath, withSales,
} from './equipeData';
import useEquipeData, { prefetchEquipe } from './useEquipeData';
import './equipe.css';

// ÉQUIPE : qui est dans l'équipe commerciale, ce qu'elle fait ce mois-ci, et un clic pour ouvrir un compte en lecture seule (mode « ghost »).
// Page /ceo/sales-team et onglet « Équipe Sales » du /ceo : c'est le même composant. Base visuelle des statistiques de Tracking Finance (fond grège chaud, cartes
// blanches fines, étiquettes pastel), avec une touche « carnet » : un bilan en haut, washi tape sur les cartes d'équipe, avatars en autocollants, onglets pastel.
//   · Sales    : une carte par équipe (capitaine en tête, « Sans équipe » en dernier) ; chaque personne = photo, nom, capitaine / rôle / absence, ventes du mois en jauge ;
//   · Setters  : à plat, en tableau (il n'y a plus d'équipes côté setters) : sales suivis, arrivée des leads, RDV posés / honorés / ventes du mois.
// Les chiffres viennent des routes existantes (classements du Suivi des ventes) ; inconnu = « — », jamais 0 inventé. Lecture seule.

const num = (n) => (n == null ? '—' : Number(n).toLocaleString('fr-FR'));
const plural = (n, one, many) => `${num(n)} ${n > 1 ? many : one}`;

function Avatar({ src, name, small }) {
  const [failed, setFailed] = useState(false);
  const cls = `eq-ava${small ? ' is-sm' : ''}`;
  if (src && !failed) {
    const px = small ? 26 : 48;
    return <img className={cls} src={src} alt="" width={px} height={px} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
  }
  return <span className={cls} aria-hidden="true">{initialsOf(name)}</span>;
}

// ── Sales ───────────────────────────────────────────────────────────────────────────────────────────────────
const Person = memo(function Person({ m, max }) {
  const pct = m.sales != null && max > 0 ? Math.max(m.sales > 0 ? 4 : 0, Math.round((m.sales / max) * 100)) : 0;
  const body = (
    <>
      <span className="eq-cover" aria-hidden="true" />
      <span className="eq-sticker">
        <Avatar key={m.avatar || m.key} src={m.avatar} name={m.name} />
        {m.isCaptain && <Star className="eq-star" size={16} strokeWidth={1.6} aria-hidden="true" />}
      </span>
      <b className="eq-person-name">{m.name}</b>
      {(m.isCaptain || m.roleLabel || m.until) && (
        <span className="eq-tags">
          {m.isCaptain && <span className="eq-tag is-team">Capitaine</span>}
          {m.roleLabel && <span className="eq-tag">{m.roleLabel}</span>}
          {m.until && <span className="eq-tag is-amber">Absent jusqu’au {fmtDay(m.until)}</span>}
        </span>
      )}
      <span className="eq-meter">
        <span className="eq-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
        <span className="eq-person-n">{m.sales == null ? '—' : plural(m.sales, 'vente', 'ventes')}</span>
      </span>
      {m.email && <ArrowUpRight className="eq-open" size={15} strokeWidth={2} aria-hidden="true" />}
    </>
  );
  const cls = `eq-person${m.until ? ' is-away' : ''}`;
  if (!m.email) return <div className={cls}>{body}</div>;
  return <Link className={cls} to={salesSheetPath(m.email)} title={m.email}>{body}</Link>;
});

const Team = memo(function Team({ group, max }) {
  const style = group.neutral ? undefined : { '--t': group.color, '--tl': legibleOnWhite(group.color) || undefined };
  const titleId = `eq-team-${group.key}`;
  const n = group.members.length;
  return (
    <section className={`eq-card${group.neutral ? ' is-none' : ''}`} style={style} aria-labelledby={titleId}>
      <header className="eq-card-head">
        <h2 id={titleId}>{group.label}</h2>
        <span className="eq-card-meta">{plural(n, 'personne', 'personnes')}{group.sales != null ? ` · ${plural(group.sales, 'vente', 'ventes')}` : ''}</span>
      </header>
      <ul className="eq-people">
        {group.members.map((m) => <li key={m.key}><Person m={m} max={max} /></li>)}
      </ul>
    </section>
  );
});

// ── Setters ─────────────────────────────────────────────────────────────────────────────────────────────────
const MAX_STACK = 4;
const SetterRow = memo(function SetterRow({ s }) {
  const shown = s.served.slice(0, MAX_STACK);
  const rest = s.served.length - shown.length;
  const name = s.email
    ? <Link className="eq-srow-link" to={setterSheetPath(s.email)} title={s.email}><b>{s.name}</b></Link>
    : <b>{s.name}</b>;
  return (
    <div className="eq-srow">
      <div className="eq-scell eq-scell-who">
        <span className="eq-sticker"><Avatar key={s.avatar || s.key} src={s.avatar} name={s.name} /></span>
        {name}
        {s.email && <ArrowUpRight className="eq-open" size={15} strokeWidth={2} aria-hidden="true" />}
      </div>
      <div className="eq-scell">
        <span className="eq-lab">Sales suivis</span>
        {s.served.length === 0 ? <span className="eq-nil">—</span> : (
          <span className="eq-stack" title={s.served.map((p) => p.name).join(', ')}>
            {shown.map((p) => <Avatar key={p.key} src={p.avatar} name={p.name} small />)}
            {rest > 0 && <span className="eq-ava is-sm is-more">+{rest}</span>}
            <span className="eq-stack-n">{s.served.length}</span>
          </span>
        )}
      </div>
      <div className="eq-scell">
        <span className="eq-lab">Arrivée des leads</span>
        {s.modes.length === 0 ? <span className="eq-nil">—</span> : (
          <span className="eq-tags">{s.modes.map((k) => <span key={k} className={`eq-tag is-${k}`}>{MODE_LABELS[k]}</span>)}</span>
        )}
      </div>
      <div className="eq-scell eq-scell-n"><span className="eq-lab">RDV posés</span><b>{num(s.rdv)}</b></div>
      <div className="eq-scell eq-scell-n"><span className="eq-lab">RDV honorés</span><b>{num(s.qualified)}</b></div>
      <div className="eq-scell eq-scell-n"><span className="eq-lab">Ventes</span><b>{num(s.sales)}</b></div>
    </div>
  );
});

// ── États ───────────────────────────────────────────────────────────────────────────────────────────────────
function Skeleton({ flat }) {
  return (
    <div className={flat ? 'eq-card' : 'eq-teams'} role="status" aria-label="Chargement">
      {flat
        ? Array.from({ length: 6 }, (_, i) => <i className="eq-skel eq-skel-row" key={i} />)
        : [0, 1].map((p) => (
          <div className="eq-card" key={p}>
            <i className="eq-skel eq-skel-title" />
            <div className="eq-people">{Array.from({ length: 4 }, (_, i) => <i className="eq-skel eq-skel-person" key={i} />)}</div>
          </div>
        ))}
    </div>
  );
}

const Empty = ({ children }) => <div className="eq-state">{children}</div>;
const Failed = ({ onRetry }) => (
  <div className="eq-state" role="alert">
    <span>Données indisponibles</span>
    <button type="button" className="eq-retry" onClick={onRetry}>Réessayer</button>
  </div>
);

// Le bilan : une feuille, quelques chiffres séparés par un trait pointillé, chacun avec sa pastille d'icône.
const Figure = ({ icon, tone, label, value, note }) => {
  const Glyph = icon;
  return (
    <div className="eq-fig">
      <span className="eq-fig-label"><span className={`eq-chip is-${tone}`} aria-hidden="true"><Glyph size={15} strokeWidth={2} /></span>{label}</span>
      <span className="eq-fig-value">{value}</span>
      {note ? <span className="eq-fig-note">{note}</span> : null}
    </div>
  );
};

// `view` : « sales » ou « setters » ; `onView` le change ; `inline` : intégré à un écran qui a déjà ses marges et son fond (onglet du /ceo).
export default function EquipePage({ darkMode = false, view, onView, inline = false }) {
  const sales = useEquipeData('sales', true);
  const perf = useEquipeData('perf', view === 'sales');
  const setters = useEquipeData('setters', view === 'setters');
  const setterPerf = useEquipeData('setterPerf', view === 'setters');

  const base = useMemo(() => (sales.data ? groupSales(sales.data.users, sales.data.teams) : null), [sales.data]);
  const salesIndex = perf.data ? perf.data.index : null;
  const filled = useMemo(() => (base ? withSales(base, salesIndex) : null), [base, salesIndex]);
  const people = useMemo(() => (base ? base.flatMap((g) => g.members) : []), [base]);
  const setterRows = useMemo(
    () => (setters.data ? listSetters(setters.data, { people, teams: sales.data ? sales.data.teams : [], perf: setterPerf.data ? setterPerf.data.index : null }) : null),
    [setters.data, people, sales.data, setterPerf.data],
  );

  const onSales = view === 'sales';
  const current = onSales ? sales : setters;
  const ready = onSales ? !!filled : !!setterRows && !sales.loading;
  const warm = () => prefetchEquipe(onSales ? 'setters' : 'sales');

  // Chiffres du haut de page.
  let facts;
  if (onSales) {
    const away = base ? absentees(base) : null;
    const teamCount = base ? base.filter((g) => !g.neutral).length : 0;
    facts = [
      [Users, 'blue', 'Commerciaux', base ? num(countPeople(base)) : '—', teamCount > 0 ? plural(teamCount, 'équipe', 'équipes') : null],
      [TrendingUp, 'green', 'Ventes du mois', salesIndex?.totals ? num(salesIndex.totals.sales) : '—', salesIndex?.totals ? fmtEuro(salesIndex.totals.revenue) : null],
      [CalendarX2, 'amber', 'Absents aujourd’hui', away ? num(away.length) : '—', away && away.length > 0 ? away.slice(0, 3).map((m) => m.name.split(' ')[0]).join(', ') + (away.length > 3 ? '…' : '') : null],
    ];
  } else {
    const t = setterPerf.data?.index?.totals;
    facts = [
      [Headset, 'blue', 'Setters', setterRows ? num(setterRows.length) : '—', null],
      [CalendarPlus, 'amber', 'RDV posés du mois', t ? num(t.rdv) : '—', null],
      [CheckCheck, 'green', 'RDV honorés', t ? num(t.qualified) : '—', null],
      [TrendingUp, 'peach', 'Ventes', t ? num(t.sales) : '—', null],
    ];
  }

  let body;
  if (current.error) body = <Failed onRetry={current.reload} />;
  else if (!ready) body = <Skeleton flat={!onSales} />;
  else if (onSales) {
    body = filled.groups.length === 0
      ? <Empty>Aucun commercial trouvé.</Empty>
      : <div className="eq-teams">{filled.groups.map((g) => <Team key={g.key} group={g} max={filled.max} />)}</div>;
  } else {
    body = setterRows.length === 0
      ? <Empty>Aucun setter trouvé.</Empty>
      : (
        <section className="eq-card eq-table" aria-label="Setters">
          <div className="eq-thead" aria-hidden="true"><span>Setter</span><span>Sales suivis</span><span>Arrivée des leads</span><span>RDV posés</span><span>RDV honorés</span><span>Ventes</span></div>
          {setterRows.map((s) => <SetterRow key={s.key} s={s} />)}
        </section>
      );
  }

  return (
    <div className={`eq-page${inline ? ' is-inline' : ''}`}>
      <div className={`eq-root${darkMode ? ' is-dark' : ''}`}>
        <header className="eq-head">
          <h1><span>Équipe</span></h1>
          <div className="eq-tabs" role="group" aria-label="Vue de l'équipe" onPointerEnter={warm} onFocus={warm} onTouchStart={warm}>
            <button type="button" className="eq-tab is-blue" aria-pressed={onSales} onClick={() => onView('sales')}><Users size={15} strokeWidth={2} aria-hidden="true" />Sales</button>
            <button type="button" className="eq-tab is-green" aria-pressed={!onSales} onClick={() => onView('setters')}><Headset size={15} strokeWidth={2} aria-hidden="true" />Setters</button>
          </div>
        </header>
        <section className="eq-summary" aria-label="Bilan du mois">
          {facts.map(([icon, tone, label, value, note]) => <Figure key={label} icon={icon} tone={tone} label={label} value={value} note={note} />)}
        </section>
        <div aria-busy={!ready && !current.error}>{body}</div>
      </div>
    </div>
  );
}
