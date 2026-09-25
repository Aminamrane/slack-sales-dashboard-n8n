import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import apiClient from '../services/apiClient';
import './OptilexClientDetail.css';

const labels = { total: 'Au total', completed: 'Terminées', in_progress: 'En cours', paused: 'En pause', waiting: 'En attente', upcoming: 'À venir', cancelled: 'Annulées', other: 'Autres statuts' };
const date = value => value ? new Date(value).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: 'short', year: 'numeric' }) : null;
function MissionIcon() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M9 5V3h6v2M8 11l2 2 5-5M8 17h8"/></svg>;
}

export function DetailFold({ title, children }) {
  return <details className="ob-detail-fold"><summary>{title}<span aria-hidden="true">⌄</span></summary><div className="ob-detail-fold-body">{children}</div></details>;
}

// `measureKey` : quand `text` est un nœud React reconstruit à chaque rendu (mentions surlignées),
// la mesure du débordement se cale sur la chaîne d'origine, pas sur l'identité du nœud.
export function DetailText({ text, measureKey }) {
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const ref = useRef(null);
  const id = useId();
  const contentKey = measureKey ?? text;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setOverflow(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure); observer.observe(el);
    return () => observer.disconnect();
  }, [contentKey, expanded]);
  return <div className="ob-detail-text-wrap"><div id={id} ref={ref} className={`ob-detail-text ${expanded ? '' : 'is-collapsed'}`}>{text}</div>
    {(expanded || overflow) && <button type="button" className="ob-detail-link" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(v => !v)}>{expanded ? 'Voir moins' : 'Voir plus'}</button>}
  </div>;
}

// `hideWhenEmpty` (onglet Détails, dev 25/09) : rien à afficher tant qu'il n'y a pas de mission.
export function ClientMissions({ numero, hideWhenEmpty = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState('total');
  const [limit, setLimit] = useState(4);
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!numero) { setLoading(false); return; }
    setLoading(true); setError(false);
    apiClient.get(`/api/v1/optilex/client-missions?numero_client=${encodeURIComponent(numero)}`)
      .then(result => { if (alive) setData(result); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [numero, retry]);
  const select = key => { setFilter(key); setLimit(4); setHistoryOpen(true); };
  const items = data?.missions?.filter(m => filter === 'total' || m.category === filter) || [];
  if (hideWhenEmpty && (loading || error || data?.status !== 'available' || !data?.counts?.total)) return null;
  return <section className="ob-client-missions" aria-label="Missions Opti’Lex">
    <div className="ob-mission-heading"><span className="ob-mission-icon"><MissionIcon /></span><div><h3>Missions Opti’Lex</h3><p>Activité du cabinet</p></div>{numero && <button type="button" className="ob-mission-refresh" disabled={loading} aria-label="Actualiser les missions" title="Actualiser les missions" onClick={() => setRetry(v => v + 1)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/></svg></button>}</div>
    {loading ? <div role="status" className="ob-missions-loading"><span/>Chargement des missions…</div> : error ? <div role="alert" className="ob-mission-message">Les missions sont momentanément indisponibles. <button type="button" className="ob-detail-link" onClick={() => setRetry(v => v + 1)}>Réessayer</button></div>
    : !numero || data?.status === 'pending' ? <p className="ob-mission-message">Rapprochement Opti’Lex en attente de confirmation. Les missions seront disponibles une fois le dossier relié.</p>
    : data?.status === 'available' && <>
      <div className="ob-mission-kpis">{['total', 'completed', 'in_progress', 'paused'].map(key => <button type="button" key={key} aria-pressed={filter === key} onClick={() => select(key)}><strong>{data.counts[key]}</strong><span>{labels[key]}</span></button>)}</div>
      <div className="ob-mission-filters">{['waiting', 'upcoming', 'cancelled', 'other'].filter(key => data.counts[key] > 0).map(key => <button type="button" key={key} aria-pressed={filter === key} onClick={() => select(key)}>{labels[key]} <strong>{data.counts[key]}</strong></button>)}</div>
      {data.counts.total > 0 && <button type="button" className="ob-detail-link" aria-expanded={historyOpen} onClick={() => setHistoryOpen(v => !v)}>{historyOpen ? "Masquer les missions" : `Voir les missions (${items.length})`}</button>}
      {historyOpen && <>
      <div className="ob-mission-history-heading"><strong>{filter === 'total' ? 'Dernières missions' : labels[filter]}</strong><span>{items.length}</span></div>
      {!items.length && <p className="ob-mission-message">{data.counts.total === 0 ? 'Aucune mission rattachée à ce dossier Opti’Lex.' : 'Aucune mission dans ce statut.'}</p>}
      <ul className="ob-mission-history">{items.slice(0, limit).map(m => <li key={m.id}><div className="ob-mission-title"><strong>{m.title}</strong><span className={`ob-mission-status is-${m.category}`}>{m.statusLabel || 'Statut non renseigné'}</span></div>
        {(m.companyName || m.departmentLabel) && <p>{[m.companyName, m.departmentLabel].filter(Boolean).join(' · ')}</p>}
        <p>{m.category === 'completed' && m.completedAt ? `Terminée le ${date(m.completedAt)}` : m.deadline ? `Échéance : ${date(m.deadline)}` : m.createdAt ? `Créée le ${date(m.createdAt)}` : ''}</p>
      </li>)}</ul>
      {items.length > limit && <button type="button" className="ob-detail-link" onClick={() => setLimit(v => v + 20)}>Voir plus de missions ({items.length - limit})</button>}
      {limit > 4 && <button type="button" className="ob-detail-link" onClick={() => setLimit(4)}>Réduire l’historique</button>}
      </>}
      {data.counts.total === 0 && !historyOpen && <p className="ob-mission-message">Aucune mission rattachée à ce dossier Opti’Lex.</p>}
      <p className={`ob-mission-sync ${data.stale ? 'is-stale' : ''}`}>{data.stale ? 'Dernières données disponibles · ' : `Dossier ${data.client_code || ''} · Synchronisé · `}{date(data.checked_at)} à {new Date(data.checked_at).toLocaleTimeString('fr-FR', {timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit'})}{data.stale && ' · Actualisation temporairement indisponible'}</p>
    </>}
  </section>;
}
