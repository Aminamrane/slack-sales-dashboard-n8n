// LossesView.jsx — onglet « Pertes » : quantifier ce qui a été abandonné.
//
// Demande dev 2026-09-01 : « un onglet pour quantifier la perte, avec les
// chiffres des pertes actées, sur les résiliations et la liquidation. »
//
// Deux montants, jamais mélangés — ce sont deux réalités comptables :
//   · CRÉANCE ABANDONNÉE : dû, facturé, jamais encaissé. Un vrai write-off.
//   · ATTENDU FUTUR ANNULÉ : du chiffre d'affaires qui ne rentrera pas.
//     Ce n'est pas une créance, ça n'a jamais été facturé.
//
// L'état affiché vient de `displayEtat` du board — la même fonction que
// partout ailleurs, qui tient compte de la date d'effet. On ne redéfinit pas
// la règle ici : c'est cette duplication qui avait fait diverger le tableau et
// la fiche (incident n°454).
//
// Rendu (dev 10/11/2026) : le langage des Statistiques. Une page (titre, phrase,
// actualisation à droite), les chiffres clés, deux lectures (par état du client ;
// ARR perdu et mois où les pertes ont été actées), puis le détail. Les tuiles et
// les barres filtrent le détail ; les deux montants gardent chacun leur colonne.

import React, { useEffect, useId, useMemo, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  Building2, CalendarCheck, CalendarX, Eraser, FileX, ListX, MessageSquareText, PenLine, Search, Split, Tags,
  TrendingDown, TriangleAlert, Undo2, UserX, X,
} from 'lucide-react';

import apiClient from '../../../services/apiClient.js';
import { useDrawn } from '../../../components/perfSales/motion.jsx';
import { displayEtat } from '../../OptilexBoard.jsx';
import { formatEUR, formatDateFR, formatMonthLabel } from '../constants.js';
import {
  Card, Empty, Num, OpenCue, Page, RefreshButton, Reveal, Stat, Stats, TableBox, Tag, Th, Who,
} from './PageKit.jsx';
import './ReceiptsLosses.css';

// Regroupement métier demandé : on veut lire « combien nous coûtent les
// résiliations » et « combien les liquidations ». Les états proches sont
// rassemblés sous le mot que la finance emploie. `tone` : étiquette pastel de la famille.
const FAMILLES = [
  { key: 'resiliation',  label: 'Résiliations',  tone: 'red',   etats: ['Résiliation', 'Self-Résiliation'] },
  { key: 'liquidation',  label: 'Liquidations',  tone: 'lilac', etats: ['Liquidation', 'En cours de liquidation'] },
  { key: 'retractation', label: 'Rétractations', tone: 'peach', etats: ['Rétractation'] },
];
const AUTRES = { key: 'autres', label: 'Autres', etats: [] };
const TOUTES_FAMILLES = [...FAMILLES, AUTRES];

// ARR perdu, part Owner seule (demande dev 2026-09-30 : « l'ARR des résiliations et des rétractations,
// les pertes d'Owner uniquement ») : l'attendu Owner HT de la Finance, annualisé, chaque client compté une fois.
const ARR_FAMILLES = [
  { key: 'resiliation', label: 'ARR des résiliations', tone: 'red' },
  { key: 'retractation', label: 'ARR des rétractations', tone: 'amber' },
];

// Les trois natures d'une perte : trois décisions distinctes, donc trois lectures.
const NATURES = [
  { key: 'declared', label: 'Clients mis en perte' },
  { key: 'correction', label: 'Attendus supprimés' },
  { key: 'withdrawal', label: 'Rétractations' },
];
const natureOf = (l) => (l.correction ? 'correction' : l.withdrawal ? 'withdrawal' : 'declared');

// Part de chaque montant dans les barres.
const COLOR = { creance: '#ee8f8a', futur: '#dedad3' };
const PAGE = 25;
const SPRING = { type: 'spring', stiffness: 520, damping: 40 };
const NO_FILTER = { nature: 'all', famille: null, month: null, query: '' };
const plural = (n, one, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
const monthOf = (l) => (l.declared_at ? String(l.declared_at).slice(0, 7) : '');

const familleOf = (etat) =>
  FAMILLES.find((f) => f.etats.includes(etat))?.key || AUTRES.key;

const scoped = (l, scope, champ) => {
  const o = Number(l[`${champ}_owner`] || 0);
  const p = Number(l[`${champ}_optilex_ttc`] || 0);
  if (scope === 'owner') return o;
  if (scope === 'optilex') return p;
  return o + p;
};

export default function LossesView({ boardMap, scope, onOpenClient }) {
  const [losses, setLosses] = useState(null);
  const [error, setError] = useState(null);
  const [reloading, setReloading] = useState(false);
  // Filtres du détail : locaux, ils ne relancent aucun chargement.
  const [filter, setFilter] = useState(NO_FILTER);

  const load = React.useCallback(() => {
    setReloading(true);
    apiClient.get('/api/v1/finance-periods/losses')
      .then((d) => { setLosses(d?.items || []); setError(null); })
      .catch((e) => setError(e?.message || 'Chargement impossible'))
      .finally(() => setReloading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const enriched = useMemo(() => (losses || []).map((l) => {
    const br = (l.numero_client && boardMap) ? boardMap.get(l.numero_client) : null;
    const etat = br ? displayEtat(br) : null;
    return {
      ...l,
      etat,
      famille: familleOf(etat),
      // 'declared' = client mis en perte ; 'correction' = attendu supprimé
      // parce qu'il n'aurait pas dû être facturé. Ce ne sont pas les mêmes
      // décisions, et on ne les lit pas de la même façon.
      correction: l.kind === 'correction',
      // 'withdrawal' = rétractation actée : une « fausse vente », comptée à
      // part des clients mis en perte (demande dev 2026-09-18).
      withdrawal: l.kind === 'withdrawal',
      creance: scoped(l, scope, 'amount'),
      futur: scoped(l, scope, 'future'),
    };
  }), [losses, boardMap, scope]);

  const totaux = useMemo(() => {
    const acc = {};
    for (const f of TOUTES_FAMILLES) acc[f.key] = { creance: 0, futur: 0, n: 0 };
    let creance = 0; let futur = 0;
    for (const l of enriched) {
      creance += l.creance;
      futur += l.futur;
      // La ventilation par état répond à « combien coûtent les résiliations ».
      // Une correction n'est pas liée à un état — l'y ranger fausserait la
      // lecture, on la laisse hors de ce découpage.
      if (l.correction) continue;
      acc[l.famille].creance += l.creance;
      acc[l.famille].futur += l.futur;
      acc[l.famille].n += 1;
    }
    const parNature = { declared: { creance: 0, futur: 0, n: 0 },
                        correction: { creance: 0, futur: 0, n: 0 },
                        withdrawal: { creance: 0, futur: 0, n: 0 } };
    for (const l of enriched) {
      const k = natureOf(l);
      parNature[k].creance += l.creance;
      parNature[k].futur += l.futur;
      parNature[k].n += 1;
    }
    const arr = {};
    for (const { key } of ARR_FAMILLES) {
      const clients = new Map();
      for (const l of enriched) {
        if (l.correction || l.famille !== key || clients.has(l.client_id)) continue;
        clients.set(l.client_id, l.arr_owner);
      }
      const values = [...clients.values()];
      arr[key] = {
        total: values.reduce((s, v) => s + (v || 0), 0),
        n: values.length,
        sansMontant: values.filter((v) => v == null).length,
      };
    }
    // Mois où les pertes ont été actées, du plus récent au plus ancien : les deux montants restent côte à côte.
    const mois = new Map();
    for (const l of enriched) {
      const key = monthOf(l);
      const m = mois.get(key) || { key, creance: 0, futur: 0, n: 0 };
      m.creance += l.creance;
      m.futur += l.futur;
      m.n += 1;
      mois.set(key, m);
    }
    const parMois = [...mois.values()].sort((a, b) => b.key.localeCompare(a.key));
    return { acc, creance, futur, n: enriched.length, parNature, arr, parMois };
  }, [enriched]);

  // Le détail, du plus coûteux au moins coûteux.
  const sorted = useMemo(() => [...enriched].sort((a, b) => b.creance - a.creance), [enriched]);

  const toggle = (key, value) => setFilter((f) => ({ ...f, [key]: f[key] === value ? NO_FILTER[key] : value }));

  const loading = losses === null && !error;
  const known = losses !== null && !error;
  const amount = (value) => (known ? value : null);
  const n = totaux.parNature;

  return (
    <Page
      title="Pertes"
      sub="Ce qui a été abandonné : la créance facturée et jamais encaissée d’un côté, l’attendu futur annulé de l’autre. Deux montants qui ne s’additionnent pas."
      actions={<RefreshButton onClick={load} busy={reloading} />}
    >
      {/* Les deux totaux, séparés — ne jamais les additionner. */}
      <Stats>
        <Stat
          label="Créance abandonnée" Icon={FileX} tone="red" value={amount(totaux.creance)} format={formatEUR}
          note={known ? `${plural(totaux.n, 'dossier')} · facturé et jamais encaissé` : 'facturé et jamais encaissé'}
        />
        <Stat
          label="Attendu futur annulé" Icon={CalendarX} value={amount(totaux.futur)} format={formatEUR}
          note="Chiffre qui ne rentrera pas · jamais facturé"
        />
        {/* Deux décisions distinctes, donc deux lectures. Un client mis en
            perte, c'est une relation qui s'arrête ; un attendu supprimé, c'est
            une facturation corrigée. Les additionner sans le dire donnerait un
            chiffre que personne ne saurait interpréter. */}
        <Stat
          label="Clients mis en perte" Icon={UserX} tone="red" value={amount(n.declared.creance)} format={formatEUR}
          note={`${plural(n.declared.n, 'client')} · créance abandonnée`}
          onClick={() => toggle('nature', 'declared')} pressed={filter.nature === 'declared'} title="Ne voir que les clients mis en perte"
        />
        <Stat
          label="Attendus supprimés" Icon={Eraser} value={amount(n.correction.creance)} format={formatEUR}
          note={`${plural(n.correction.n, 'correction')} · facturé à tort`}
          onClick={() => toggle('nature', 'correction')} pressed={filter.nature === 'correction'} title="Ne voir que les attendus supprimés"
        />
        {/* Les rétractations actées : le chiffre signé qui ne rentrera pas.
            Comptées à part pour être rapportées aux signatures. */}
        <Stat
          label="Rétractations" Icon={Undo2} tone="amber" value={amount(n.withdrawal.creance + n.withdrawal.futur)} format={formatEUR}
          note={`${n.withdrawal.n} fausse${n.withdrawal.n > 1 ? 's' : ''} vente${n.withdrawal.n > 1 ? 's' : ''} · signé puis rétracté`}
          onClick={() => toggle('nature', 'withdrawal')} pressed={filter.nature === 'withdrawal'} title="Ne voir que les rétractations actées"
        />
      </Stats>

      {error ? (
        <div className="fst-error" role="alert">
          Pertes indisponibles — {error}
          <button type="button" onClick={load}>Réessayer</button>
        </div>
      ) : known && !losses.length ? (
        <Empty boxed>Aucune perte actée. Rien n’a été abandonné à ce jour.</Empty>
      ) : (
        <>
          <Reveal className="fst-grid is-even" amount={0.05}>
            <FamiliesCard totals={totaux.acc} loading={loading} selected={filter.famille} onSelect={(key) => toggle('famille', key)} />
            <ArrCard arr={totaux.arr} months={totaux.parMois} loading={loading} month={filter.month} onMonth={(key) => toggle('month', key)} />
          </Reveal>
          <Reveal amount={0.03}>
            <Detail rows={sorted} loading={loading} scope={scope} filter={filter} setFilter={setFilter} onOpenClient={onOpenClient} />
          </Reveal>
        </>
      )}
    </Page>
  );
}

const cardState = (loading) => ({ data: loading ? null : true, loading });

// Ventilation : c'est la réponse à « combien coûtent les résiliations ».
function FamiliesCard({ totals, loading, selected, onSelect }) {
  const drawn = useDrawn();
  const families = TOUTES_FAMILLES.filter((f) => totals[f.key].n > 0);
  const largest = Math.max(1, ...families.map((f) => totals[f.key].creance + totals[f.key].futur));
  return (
    <Card title="Par état du client" Icon={Split} state={cardState(loading)} skeleton={260}
      hint="Ce que coûtent les résiliations, les liquidations, les rétractations. Un attendu supprimé ne tient à aucun état : il n’y figure pas. Un clic filtre le détail.">
      {families.length === 0 ? <Empty>Aucune perte rattachée à un état.</Empty> : (
        <>
          {families.map((f) => {
            const t = totals[f.key];
            const sum = t.creance + t.futur;
            return (
              <button key={f.key} type="button" className="fst-hbar rl-money" data-on={selected === f.key || undefined} aria-pressed={selected === f.key}
                onClick={() => onSelect(f.key)}>
                <span className="fst-tip" role="presentation">
                  <b>{f.label}</b> <span>· {plural(t.n, 'dossier')}</span><br />
                  Créance abandonnée <span>· {formatEUR(t.creance)}</span><br />
                  Futur annulé <span>· {formatEUR(t.futur)}</span>
                </span>
                <span className="fst-hbar-name">{f.label}<span className="rl-name-sub">{plural(t.n, 'dossier')}</span></span>
                <span className="fst-hbar-track rl-track" style={{ width: `${Math.max(0, sum / largest) * 100}%` }}>
                  {['creance', 'futur'].filter((key) => t[key] > 0).map((key) => (
                    <i key={key} style={{ width: `${drawn ? (t[key] / sum) * 100 : 0}%`, background: COLOR[key] }} />
                  ))}
                </span>
                <span className="fst-hbar-num fst-num">
                  <span className="rl-tone-red">{formatEUR(t.creance)}</span>
                  <span className="rl-num-sub">+ {formatEUR(t.futur)} de futur annulé</span>
                </span>
              </button>
            );
          })}
          <div className="fst-keys">
            <span><span className="fst-dot" style={{ background: COLOR.creance }} />Créance abandonnée</span>
            <span><span className="fst-dot" style={{ background: COLOR.futur }} />Futur annulé</span>
          </div>
        </>
      )}
    </Card>
  );
}

// ARR perdu : l'attendu Owner HT des clients sortis, annualisé, quel que soit le périmètre.
// En dessous, les mois où les pertes ont été actées.
function ArrCard({ arr, months, loading, month, onMonth }) {
  const drawn = useDrawn();
  const largest = Math.max(1, ...months.map((m) => m.creance + m.futur));
  return (
    <Card title="ARR perdu, part Owner" Icon={TrendingDown} state={cardState(loading)} skeleton={260}
      hint="L’attendu Owner HT des clients sortis, annualisé, chaque client compté une fois, quel que soit le périmètre.">
      <div className="fst-facts" style={{ marginTop: 0, borderTop: 0 }}>
        {ARR_FAMILLES.map((f) => {
          const a = arr[f.key];
          return (
            <div key={f.key} className="fst-fact">
              <span className="fst-fact-label">{f.label} · {a.n}</span>
              <span className={`fst-fact-value rl-fact-value ${a.n ? `rl-tone-${f.tone}` : 'rl-tone-zero'}`}>
                <Num value={a.total} format={formatEUR} />
              </span>
              <div className="fst-cell-sub">
                attendu Owner HT annualisé
                {a.sansMontant > 0 && ` · ${a.sansMontant} sans montant`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="fst-chart">
        <div className="fst-chart-title"><span>Actées par mois</span><span>créance abandonnée, puis futur annulé</span></div>
        <div className="fst-legend">
          {months.map((m) => (
            <button key={m.key || 'none'} type="button" className="fst-legend-row rl-month" aria-pressed={month === m.key} onClick={() => onMonth(m.key)}
              title={`${plural(m.n, 'perte actée', 'pertes actées')} · + ${formatEUR(m.futur)} de futur annulé. Un clic filtre le détail.`}>
              <span>{m.key ? formatMonthLabel(m.key) : 'Sans date'}</span>
              <span className="fst-hbar-track">
                {['creance', 'futur'].filter((key) => m[key] > 0).map((key) => (
                  <i key={key} style={{ width: `${drawn ? (m[key] / largest) * 100 : 0}%`, background: COLOR[key] }} />
                ))}
              </span>
              <b className="fst-num rl-tone-red">{formatEUR(m.creance)}</b>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

const matches = (l, f) => (f.nature === 'all' || natureOf(l) === f.nature)
  // Comme la ventilation : une correction ne tient à aucun état.
  && (!f.famille || (!l.correction && l.famille === f.famille))
  && (f.month == null || monthOf(l) === f.month);

function Detail({ rows, loading, scope, filter, setFilter, onOpenClient }) {
  const tabId = useId();
  const query = filter.query.trim().toLowerCase();
  // Les compteurs des onglets suivent les autres filtres, pas la nature elle-même.
  const scopedRows = useMemo(() => rows.filter((l) => matches(l, { ...filter, nature: 'all' })
    && (!query || `${l.societe || ''} ${l.numero_client || ''} ${l.reason || ''} ${l.etat || ''} ${l.declared_by_name || ''}`.toLowerCase().includes(query))), [rows, filter, query]);
  const shownRows = useMemo(() => (filter.nature === 'all' ? scopedRows : scopedRows.filter((l) => natureOf(l) === filter.nature)), [scopedRows, filter.nature]);
  const counts = useMemo(() => scopedRows.reduce((acc, l) => { const k = natureOf(l); acc[k] = (acc[k] || 0) + 1; return acc; }, {}), [scopedRows]);
  const totals = useMemo(() => shownRows.reduce((acc, l) => ({ creance: acc.creance + l.creance, futur: acc.futur + l.futur }), { creance: 0, futur: 0 }), [shownRows]);

  const signature = `${JSON.stringify(filter)}|${scope}`;
  const [page, setPage] = useState({ signature: '', shown: PAGE });
  const shown = page.signature === signature ? page.shown : PAGE;

  const tabs = [
    { key: 'all', label: 'Toutes', n: scopedRows.length },
    ...NATURES.filter(({ key }) => counts[key] > 0 || filter.nature === key).map(({ key, label }) => ({ key, label, n: counts[key] || 0 })),
  ];
  const chips = [
    filter.famille && { key: 'famille', label: TOUTES_FAMILLES.find((f) => f.key === filter.famille)?.label || filter.famille },
    filter.month != null && { key: 'month', label: filter.month ? `Actées en ${formatMonthLabel(filter.month).toLowerCase()}` : 'Sans date' },
  ].filter(Boolean);
  const clear = (key) => setFilter((f) => ({ ...f, [key]: NO_FILTER[key] }));
  const openable = Boolean(onOpenClient);

  return (
    <Card title="Détail des pertes" Icon={ListX} state={cardState(loading)} skeleton={340}
      hint="Chaque perte actée, de la plus coûteuse à la moins coûteuse. Un clic sur une ligne ouvre la fiche du client.">
      <div className="fst-tools">
        <div className="fst-tabs" role="group" aria-label="Nature de la perte">
          {tabs.map((tab) => (
            <button key={tab.key} type="button" className="fst-tab" aria-pressed={filter.nature === tab.key} onClick={() => setFilter((f) => ({ ...f, nature: tab.key }))}>
              {filter.nature === tab.key && <Motion.span layoutId={`rl-losses-tab-${tabId}`} className="fst-tab-bg" transition={SPRING} />}
              <span>{tab.label}</span><span className="fst-tab-count fst-num">{tab.n}</span>
            </button>
          ))}
        </div>
        <AnimatePresence initial={false}>
          {chips.map((chip) => (
            <Motion.button key={chip.key} type="button" className="fst-chip" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }} onClick={() => clear(chip.key)} title="Retirer ce filtre">
              {chip.label}<X size={13} />
            </Motion.button>
          ))}
        </AnimatePresence>
        <label className="fst-search">
          <Search size={14} />
          <input type="search" placeholder="Client, n°, motif, état…" value={filter.query}
            onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))} aria-label="Chercher une perte" />
        </label>
      </div>

      <TableBox minWidth={1040} after={(
        <>
          {shownRows.length === 0 && <Empty>Aucune perte ne correspond à ces filtres.</Empty>}
          {shownRows.length > shown && (
            <div className="fst-more">
              <button type="button" onClick={() => setPage({ signature, shown: shown + PAGE * 2 })}>
                Afficher les {Math.min(PAGE * 2, shownRows.length - shown)} suivantes
              </button>
            </div>
          )}
        </>
      )}>
        <thead>
          <tr>
            <Th Icon={Building2}>Client</Th>
            <Th Icon={Tags}>État</Th>
            <Th Icon={FileX} num title="Dû, facturé, jamais encaissé">Créance abandonnée</Th>
            <Th Icon={CalendarX} num title="Chiffre d’affaires qui ne rentrera pas, jamais facturé">Futur annulé</Th>
            <Th Icon={MessageSquareText}>Motif</Th>
            <Th Icon={CalendarCheck}>Actée le</Th>
            <Th Icon={PenLine}>Actée par</Th>
          </tr>
        </thead>
        <tbody key={signature}>
          {shownRows.slice(0, shown).map((l, i) => (
            <tr key={l.id} style={{ '--i': i % PAGE }} data-open={openable || undefined}
              onClick={() => onOpenClient?.(l.client_id)} title={openable ? 'Ouvrir la fiche du client' : undefined}>
              <td>
                <div className="fst-cell-main">{l.societe || '—'}{openable && <OpenCue />}</div>
                <div className="fst-cell-sub fst-num">{l.numero_client ? `n° ${l.numero_client}` : '—'}</div>
              </td>
              <td>
                {l.correction ? <Tag title="Attendu supprimé parce qu’il n’aurait pas dû être facturé">Attendu supprimé</Tag>
                  : l.withdrawal ? <Tag tone="peach" title="Signé puis rétracté : une fausse vente">Rétractation actée</Tag>
                    : l.etat ? <Tag tone={FAMILLES.find((f) => f.key === l.famille)?.tone}>{l.etat}</Tag>
                      : <span className="fst-cell-muted">—</span>}
              </td>
              <td className={`is-num fst-num ${l.creance > 0 ? 'rl-tone-red' : 'rl-tone-zero'}`} style={{ fontWeight: l.creance > 0 ? 500 : 400 }}>{formatEUR(l.creance)}</td>
              <td className="is-num fst-num fst-cell-muted">{formatEUR(l.futur)}</td>
              <td className="is-wrap">{l.reason ? <span className="rl-clip" title={l.reason}>{l.reason}</span> : <span className="fst-cell-muted">—</span>}</td>
              <td className="fst-num fst-cell-muted">{l.declared_at ? formatDateFR(l.declared_at) : '—'}</td>
              <td><Who name={l.declared_by_name} /></td>
            </tr>
          ))}
        </tbody>
        {shownRows.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={2}>{plural(shownRows.length, 'dossier')}{shownRows.length !== rows.length ? ` sur ${rows.length}` : ''}</td>
              <td className="is-num fst-num rl-tone-red">{formatEUR(totals.creance)}</td>
              <td className="is-num fst-num">{formatEUR(totals.futur)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        )}
      </TableBox>

      <p className="fst-note rl-note">
        <TriangleAlert size={14} />
        <span>
          Ces montants sont <strong>sortis des totaux</strong> de la page : ils ne
          comptent plus ni dans l’attendu, ni dans les retards, ni dans les créances
          antérieures. Une perte reste annulable depuis la fiche du client, ce qui
          restaure l’attendu au centime.
        </span>
      </p>
    </Card>
  );
}
