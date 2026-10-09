import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Paperclip, Phone, Mail, Download, X } from 'lucide-react';
import apiClient from '../services/apiClient.js';
import './ClientHistoryAttachments.css';

const roles = ['admin', 'ceo', 'finance_director', 'finance_team', 'customer_success_manager'];
const dateLabel = value => value ? new Date(value).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : '';
async function binary(path, options = {}) {
  const response = await apiClient._authenticatedFetch(apiClient.baseUrl + path, options);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || 'Le fichier n’a pas pu être chargé.');
  }
  return response;
}

export default function ClientHistoryAttachments({ clientId: providedId, numero }) {
  const role = apiClient.getUser()?.role;
  if (!roles.includes(role)) return null;
  return <History key={providedId || numero} providedId={providedId} numero={numero}/>;
}

function History({ providedId, numero }) {
  const [clientId, setClientId] = useState(providedId);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [canBrowseCalls, setCanBrowseCalls] = useState(false);
  const [calls, setCalls] = useState(null);
  const [callPage, setCallPage] = useState(1);
  const [callMore, setCallMore] = useState(false);
  const [preview, setPreview] = useState(null);
  const [removeId, setRemoveId] = useState(null);
  const dialog = useRef(null);
  useEffect(() => {
    if (!preview) return;
    const previous = document.activeElement;
    const onKey = event => {
      if (event.key === 'Escape') { event.stopPropagation(); setPreview(null); }
      if (event.key === 'Tab') {
        const controls = [...(dialog.current?.querySelectorAll('button:not(:disabled),audio,iframe,[tabindex="0"]') || [])];
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    dialog.current?.querySelector('button')?.focus();
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); previous?.focus(); };
  }, [preview?.item.id]);
  const alive = useRef(true);
  const urls = useRef(new Set());
  useEffect(() => { alive.current = true; return () => { alive.current = false; for (const url of urls.current) URL.revokeObjectURL(url); }; }, []);
  useEffect(() => {
    let active = true;
    if (!providedId && numero) apiClient.get(`/api/v1/client-history/resolve?numero_client=${encodeURIComponent(numero)}`)
      .then(result => { if (active) setClientId(result.client_id); })
      .catch(() => { if (active) { setLoading(false); setError('Historique indisponible : le dossier client doit être rattaché.'); } });
    apiClient.get('/api/v1/finance-calls/access').then(result => { if (active) setCanBrowseCalls(!!result.allowed); }).catch(() => {});
    return () => { active = false; };
  }, [providedId, numero]);
  const base = clientId ? `/api/v1/client-history/${clientId}` : null;
  useEffect(() => {
    if (!base) return;
    let active = true;
    setLoading(true); setError('');
    apiClient.get(base).then(result => { if (active) setItems(result.items || []); })
      .catch(e => { if (active) setError(e.message || 'Historique indisponible.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [base, version]);
  async function run(action) {
    if (busy || !base) return;
    setBusy(true); setError('');
    try { await action(); }
    catch (e) { if (alive.current) setError(e.message || 'L’action n’a pas été enregistrée.'); }
    finally { if (alive.current) setBusy(false); }
  }
  function objectUrl(blob) { const url = URL.createObjectURL(blob); urls.current.add(url); return url; }
  async function upload(file) {
    if (file.size > 20 * 1024 * 1024) throw new Error('Le fichier dépasse 20 Mo.');
    const form = new FormData(); form.append('file', file); form.append('note', note);
    await binary(base + '/files', { method: 'POST', body: form });
    if (alive.current) { setNote(''); setVersion(v => v + 1); }
  }
  async function listCalls(page = 1) {
    const result = await apiClient.get(`${base}/calls?page=${page}`);
    if (!alive.current) return;
    setCalls(previous => page === 1 ? result.calls : [...(previous || []), ...result.calls].filter((c, i, all) => all.findIndex(other => other.id === c.id) === i));
    setCallPage(page); setCallMore(result.has_more);
  }
  async function open(item, download = false) {
    if (item.kind === 'email' && !download) {
      const data = await apiClient.get(`${base}/${item.id}/email`);
      if (alive.current) setPreview({ item, ...data });
      return;
    }
    if (item.kind === 'call' && !download) { setPreview({ item }); return; }
    const response = await binary(`${base}/${item.id}/file`);
    const url = objectUrl(await response.blob());
    if (!alive.current) { URL.revokeObjectURL(url); return; }
    if (download) { const a = document.createElement('a'); a.href = url; a.download = item.file_name; a.click(); }
    else setPreview({ item, url });
  }
  async function listen(item) {
    const response = await binary(`${base}/${item.id}/recording`);
    const url = objectUrl(await response.blob());
    if (alive.current) setPreview(previous => previous?.item.id === item.id ? { ...previous, url } : previous);
    else URL.revokeObjectURL(url);
  }
  return <section className="client-history" aria-label="Documents et appels partagés avec le CSM">
    <h3><Paperclip size={17}/> Documents et appels partagés</h3>
    <p className="history-hint">Consultables par Vincent, l’équipe CSM et la Finance Owner. Ajoutez une copie d’email EML ou HTML pour conserver sa présentation.</p>
    {error && <p role="alert" className="history-error">{error} <button type="button" disabled={busy} onClick={() => setVersion(v => v + 1)}>Actualiser</button></p>}
    <textarea aria-label="Contexte de la pièce jointe" placeholder="Un contexte pour Vincent… (facultatif)" maxLength={2000} rows={2} value={note} disabled={busy} onChange={e => setNote(e.target.value)}/>
    <div className="history-actions">
      <label className={`history-button ${busy || !base || loading ? 'is-disabled' : ''}`}><Paperclip size={15}/> Joindre un document ou un email
        <input type="file" aria-label="Joindre un document ou un email" accept=".pdf,.png,.jpg,.jpeg,.eml,.html,.htm,.mp3,.wav,.m4a" disabled={busy || !base || loading}
          onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) run(() => upload(file)); }}/></label>
      {canBrowseCalls && <button type="button" disabled={busy || !base || loading} onClick={() => run(() => listCalls())}><Phone size={15}/> Joindre un appel</button>}
    </div>
    <small>PDF, images, email EML/HTML ou audio · 20 Mo maximum. Aucun email n’est envoyé.</small>
    {calls && <div className="history-call-picker"><div className="history-actions"><strong>Choisir un appel du client</strong><button type="button" onClick={() => setCalls(null)} aria-label="Fermer le choix d’appel"><X size={15}/></button></div>
      {!calls.length && <p>Aucun appel trouvé sur les numéros de ce client.</p>}
      {calls.map(call => <div key={call.id} className="history-call"><span><strong>{dateLabel(call.date)}</strong><br/>{call.operator_name} · {call.contact_number} · {call.result || call.direction}</span>
        <button type="button" disabled={busy || items.some(i => i.kind === 'call' && i.metadata?.id === call.id)} onClick={() => run(async () => {
          await apiClient.post(base + '/calls', { call_id: call.id, note });
          if (alive.current) { setNote(''); setCalls(null); setVersion(v => v + 1); }
        })}>Partager dans l’historique</button></div>)}
      {callMore && <button type="button" disabled={busy} onClick={() => run(() => listCalls(callPage + 1))}>Voir les appels précédents</button>}
    </div>}
    {loading ? <p role="status">Chargement…</p> : !items.length && <p className="history-hint">Aucune pièce jointe pour le moment.</p>}
    <ul>{items.map(item => <li key={item.id}>
      <div className="history-item-head">{item.kind === 'call' ? <Phone size={17}/> : item.kind === 'email' ? <Mail size={17}/> : <Paperclip size={17}/>}
        <button type="button" className="history-title" disabled={busy} onClick={() => run(() => open(item))}>{item.kind === 'call' ? `Appel · ${dateLabel(item.metadata?.date)}` : item.metadata?.subject || item.file_name}</button></div>
      <p className="history-hint">{item.author_name} · {dateLabel(item.created_at)}</p>
      {item.note && <p className="history-note">{item.note}</p>}
      <div className="history-actions">{item.kind !== 'call' && <button type="button" disabled={busy} onClick={() => run(() => open(item, true))}><Download size={13}/> Télécharger l’original</button>}
        {item.can_remove && (removeId === item.id ? <><button type="button" disabled={busy} onClick={() => run(async () => { await apiClient.delete(`${base}/${item.id}`); if (alive.current) { setRemoveId(null); setVersion(v => v + 1); } })}>Confirmer le retrait</button><button type="button" onClick={() => setRemoveId(null)}>Annuler</button></> : <button type="button" disabled={busy} onClick={() => setRemoveId(item.id)}>Retirer</button>)}
      </div></li>)}</ul>
    {preview && createPortal(<div ref={dialog} className="history-preview client-history" role="dialog" aria-modal="true" aria-label="Consulter la pièce jointe">
      <div className="history-preview-card"><div className="history-actions"><strong>{preview.item.file_name}</strong><button type="button" aria-label="Fermer la pièce jointe" onClick={() => setPreview(null)}><X size={20}/></button></div>
        {error && <p role="alert" className="history-error">{error}</p>}
        {preview.headers && <dl>{Object.entries(preview.headers).filter(([,v]) => v).map(([key,value]) => <React.Fragment key={key}><dt>{({from:'De',to:'À',subject:'Objet',date:'Date'})[key]}</dt><dd>{value}</dd></React.Fragment>)}</dl>}
        {preview.html && <iframe title="Email avec sa mise en forme" sandbox="" srcDoc={preview.html}/>}
        {preview.item.kind === 'call' && <div><p>{preview.item.metadata?.operator_name} · {preview.item.metadata?.contact_number}</p>
          {preview.item.metadata?.has_recording && !preview.url && <button type="button" disabled={busy} onClick={() => run(() => listen(preview.item))}>Écouter l’appel partagé</button>}
          {preview.item.metadata?.summary && <p className="history-note">{preview.item.metadata.summary}</p>}
          {preview.item.metadata?.transcript?.length > 0 && <details><summary>Transcription de l’appel</summary>{preview.item.metadata.transcript.map((line,i) => <p key={i}><strong>{line.source}</strong> {line.text}</p>)}</details>}
        </div>}
        {preview.url && (preview.item.kind === 'call' || preview.item.mime_type?.startsWith('audio/') ? <audio controls src={preview.url}/> : preview.item.mime_type === 'application/pdf' ? <iframe title="Document PDF" src={preview.url}/> : <img alt={preview.item.file_name} src={preview.url}/>)}
      </div></div>, document.body)}
  </section>;
}
