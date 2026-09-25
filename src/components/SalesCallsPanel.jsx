// src/components/SalesCallsPanel.jsx
//
// Appels Allo d'un sales, dans sa fiche « Enregistrements sales » (onglet Appels).
// Même lecture que le tracking des appels de la page Finance (période, liste,
// détail avec résumé, transcription et enregistrement), branchée sur
// /api/v1/sales-calls, dont le périmètre est celui de la page Enregistrements.
import { useEffect, useRef, useState } from 'react';
import { Phone, ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, RefreshCw, X, Headphones, Unlink } from 'lucide-react';
import apiClient from '../services/apiClient';
import { monthRange } from '../utils/callsPeriod.js';
import '../pages/TrackingSheetFinance/components/CallsView.css';

const ROOT = '/api/v1/sales-calls';
const dateLabel = (value) => value ? new Date(value).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Non renseignée';
const duration = (value) => value == null ? 'Non renseignée' : `${Math.floor(value / 60)} min ${Math.floor(value % 60).toString().padStart(2, '0')} s`;
const resultLabel = (value) => ({ ANSWERED: 'Répondu', CLOSED: 'Non abouti', MISSED: 'Manqué', NO_ANSWER: 'Sans réponse', BUSY: 'Occupé', FAILED: 'Échoué', VOICEMAIL: 'Messagerie', TRANSFERRED: 'Transféré' })[value] || value || 'Non renseigné';

export default function SalesCallsPanel({ email, name, linked = true }) {
  const [draft, setDraft] = useState(monthRange);
  const [dates, setDates] = useState(monthRange);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const query = new URLSearchParams({ ...dates, email, page }).toString();

  useEffect(() => {
    if (!linked) return undefined;
    let live = true;
    setList(null); setError(''); setSelected(null);
    apiClient.get(`${ROOT}/calls?${query}`).then((data) => { if (live) setList(data); }).catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [query, revision, linked]);

  if (!linked) {
    return <div className="fc-empty sales-calls-unlinked"><Unlink size={26} /><p>{name} n’est relié à aucun utilisateur Allo : les prénoms et noms ne correspondent pas. À rapprocher dans Allo.</p></div>;
  }
  const total = list?.pagination?.total_count;
  return <section className="finance-calls sales-calls" aria-label={`Appels de ${name}`}>
    <div className="fc-heading">
      <div><h2>Appels de {name}</h2><p>Appels entrants et sortants tracés par Allo · heures de Paris</p></div>
      <button type="button" onClick={() => setRevision((v) => v + 1)} title="Actualiser les appels"><RefreshCw size={15} /> Actualiser</button>
    </div>
    <form className="fc-filters" onSubmit={(e) => { e.preventDefault(); setPage(1); setDates({ ...draft }); }}>
      <label>Du <input type="date" required value={draft.start} max={draft.end} onChange={(e) => setDraft((v) => ({ ...v, start: e.target.value }))} /></label>
      <label>Au <input type="date" required value={draft.end} min={draft.start} onChange={(e) => setDraft((v) => ({ ...v, end: e.target.value }))} /></label>
      <button type="submit">Afficher la période</button>
      <span>{total == null ? '' : `${new Intl.NumberFormat('fr-FR').format(total)} appel${total > 1 ? 's' : ''} sur la période`}</span>
    </form>
    {error ? <p className="fc-error" role="alert">{error}</p>
      : !list ? <p role="status">Chargement des appels…</p>
      : !list.calls.length ? <div className="fc-empty"><Phone size={26} /><p>Aucun appel sur cette période.</p></div>
      : <div className="fc-table-wrap"><table className="fc-table">
        <thead><tr><th>Date et heure</th><th>Contact</th><th>Sens</th><th>Résultat</th><th>Durée</th><th>Enregistrement</th><th><span className="sr-only">Détails</span></th></tr></thead>
        <tbody>{list.calls.map((call) => <tr key={call.id}>
          <td>{dateLabel(call.date)}</td>
          <td><strong>{call.contacts?.join(', ') || call.contact_number || 'Contact non renseigné'}</strong>{call.contacts?.length > 0 && <small>{call.contact_number}</small>}</td>
          <td><span className="fc-inline">{call.direction === 'INBOUND' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{call.direction === 'INBOUND' ? 'Entrant' : 'Sortant'}</span></td>
          <td><span className={`fc-result ${call.result === 'ANSWERED' ? 'fc-answered' : ''}`}>{resultLabel(call.result)}</span></td>
          <td>{duration(call.duration)}</td>
          <td>{call.has_recording ? <span className="fc-inline"><Headphones size={14} /> Disponible</span> : <span className="fc-muted">Indisponible</span>}</td>
          <td><button type="button" onClick={() => setSelected(call.id)}>Voir l’appel</button></td>
        </tr>)}</tbody>
      </table></div>}
    {list && list.pagination.total_count > list.pagination.size && <div className="fc-pagination">
      <span>Page {page} sur {Math.max(1, Math.ceil(list.pagination.total_count / list.pagination.size))}</span>
      <button type="button" disabled={page <= 1} onClick={() => setPage((v) => v - 1)}><ChevronLeft size={14} /> Précédente</button>
      <button type="button" disabled={!list.pagination.has_more} onClick={() => setPage((v) => v + 1)}>Suivante <ChevronRight size={14} /></button>
    </div>}
    {selected && <CallDetail key={selected} id={selected} onClose={() => setSelected(null)} />}
  </section>;
}

function CallDetail({ id, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const dialog = useRef(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current.showModal();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    let live = true;
    apiClient.get(`${ROOT}/calls/${encodeURIComponent(id)}`).then((data) => { if (live) setDetail(data); }).catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [id]);
  return <dialog ref={dialog} className="fc-dialog" aria-labelledby="sc-detail-title" onCancel={(e) => { e.preventDefault(); close.current(); }}>
    <header><div><h2 id="sc-detail-title">Détail de l’appel</h2><p>{detail ? `${detail.operator_name} · ${dateLabel(detail.date)}` : 'Chargement…'}</p></div><button type="button" autoFocus aria-label="Fermer le détail de l’appel" onClick={onClose}><X size={20} /></button></header>
    {error && <p className="fc-error" role="alert">{error}</p>}
    {detail && <>
      <dl className="fc-detail-grid">
        <div><dt>Contact</dt><dd>{detail.contacts?.join(', ') || 'Non renseigné'}<small>{detail.contact_number}</small></dd></div>
        <div><dt>Ligne</dt><dd>{detail.allo_number || 'Non renseignée'}</dd></div>
        <div><dt>Appel</dt><dd>{detail.direction === 'INBOUND' ? 'Entrant' : 'Sortant'} · {resultLabel(detail.result)}</dd></div>
        <div><dt>Durée</dt><dd>{duration(detail.duration)}</dd></div>
      </dl>
      <h3>Enregistrement</h3>{detail.has_recording ? <Recording id={id} /> : <p className="fc-muted">Allo ne fournit pas d’enregistrement pour cet appel.</p>}
      <h3>Résumé Allo</h3><p className="fc-summary">{detail.summary || 'Aucun résumé disponible pour cet appel.'}</p>
      <h3>Transcription</h3>{detail.transcript?.length ? <div className="fc-transcript">{detail.transcript.map((line, i) => <div key={i} className={`fc-utterance ${line.source === 'USER' ? 'fc-team' : ''}`}><div><strong>{line.source === 'USER' ? detail.operator_name : 'Contact'}</strong>{line.time != null && <small>{duration(line.time)}</small>}</div><p>{line.text}</p></div>)}</div> : <p className="fc-muted">Aucune transcription disponible pour cet appel.</p>}
    </>}
  </dialog>;
}

function Recording({ id }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const life = useRef({ alive: true, url: '', controller: null });
  useEffect(() => {
    const state = life.current; state.alive = true;
    return () => { state.alive = false; state.controller?.abort(); if (state.url) URL.revokeObjectURL(state.url); };
  }, []);
  async function load() {
    setLoading(true); setError('');
    const state = life.current;
    state.controller = new AbortController();
    try {
      const response = await apiClient._authenticatedFetch(`${apiClient.baseUrl}${ROOT}/calls/${encodeURIComponent(id)}/recording`, { signal: state.controller.signal, cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || 'Enregistrement indisponible');
      }
      const blob = await response.blob();
      if (state.alive) { state.url = URL.createObjectURL(blob); setUrl(state.url); }
    } catch (e) { if (state.alive && e.name !== 'AbortError') setError(e.message); }
    finally { if (state.alive) setLoading(false); }
  }
  return <div className="fc-recording">{url ? <audio controls src={url} preload="metadata" aria-label="Enregistrement de l’appel" onError={() => setError('Lecture audio impossible. Fermez puis rouvrez cet appel pour réessayer.')} /> : <button type="button" disabled={loading} onClick={load}><Headphones size={15} /> {loading ? 'Chargement de l’audio…' : 'Écouter l’enregistrement'}</button>}{error && <p className="fc-error" role="alert">{error}</p>}</div>;
}
