import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, CircleAlert, Clock3, CloudUpload, LoaderCircle, RefreshCw, Trash2, X } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { FileTypeIcon } from '../BoardClientFiles';
import { useDialogFocus } from './QualificationDialog';
import useFoldClose from './useFoldClose';
import { DOCUMENT_LABELS, documentOwner, documentStatus, validateIntakeFile } from '../../utils/intakeDocuments';
import './leadDocuments.css';

// Dépôt des pièces du client depuis la fiche du lead (12/11/2026, d'après la référence « Drag & drop files » du dev) :
// une petite fenêtre au lieu du grand formulaire de la déclaration. Même circuit, mêmes règles et mêmes routes
// (`/owner-integration/leads/{id}/sale-documents`) : seul l'écran change.
// Le geste : on glisse les fichiers dans la carte, on dit ce que c'est (et pour qui, s'il y a le choix), on dépose.
// Rien ne part tant que « Déposer » n'est pas cliqué ; la carte redit où la pièce va être rangée.
const NATURES = ['tax_notice', 'balance_sheet', 'payslip', 'dsn', 'employment_contract', 'duerp', 'other'];
const MAX_FILES = 5;
const ICONS = { sent: Check, sending: LoaderCircle, rejected: CircleAlert };
const sizeOf = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`);
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

export default function LeadDocumentDrop({ leadId, lead, dark = false, initialFiles = null, onClose }) {
  const ref = useRef(null), input = useRef(null), depth = useRef(0);
  const { closing, close, style } = useFoldClose(ref, onClose);
  const [state, setState] = useState(null);           // réponse du serveur : pièces, périmètre, compte
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState([]);              // fichiers choisis, pas encore déposés
  const [nature, setNature] = useState('');
  const [owner, setOwner] = useState('');
  const [drag, setDrag] = useState(false);
  const [sending, setSending] = useState(null);        // { index, total, name }
  const [error, setError] = useState('');
  const [done, setDone] = useState(0);                 // nombre de fichiers du dernier dépôt réussi
  const [listOpen, setListOpen] = useState(false);     // les pièces déjà déposées : repliées, la fiche les liste déjà
  const busy = !!sending;
  useDialogFocus(ref, close, busy || closing);
  const root = `/api/v1/owner-integration/leads/${leadId}/sale-documents`;

  const read = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get(`${root}?remote=true`);
      setState(result);
      if (result.available === false) setError(result.reason || 'Le dépôt n’est pas encore ouvert pour ce dossier.');
    } catch (e) { setError(e.message || 'Les pièces n’ont pas pu être chargées.'); }
    finally { setLoading(false); }
  }, [root]);
  useEffect(() => { read(); }, [read]);

  const add = useCallback((list) => {
    const incoming = Array.from(list || []);
    if (!incoming.length) return;
    setError(''); setDone(0);
    const accepted = [];
    let refused = '';
    for (const file of incoming) {
      try { validateIntakeFile(file); accepted.push(file); } catch (e) { refused = `« ${file.name} » : ${e.message}`; }
    }
    setQueue((current) => {
      const next = [...current];
      for (const file of accepted) if (!next.some((f) => f.name === file.name && f.size === file.size)) next.push(file);
      if (next.length > MAX_FILES) { refused = `${MAX_FILES} fichiers au plus à la fois : les suivants n’ont pas été ajoutés.`; return next.slice(0, MAX_FILES); }
      return next;
    });
    if (refused) setError(refused);
  }, []);
  useEffect(() => { if (initialFiles?.length) add(initialFiles); }, [initialFiles, add]);

  // Pour qui : un avis d'imposition appartient à un dirigeant, toute autre pièce à une société. S'il n'y a qu'un
  // titulaire possible, il est retenu d'office et la question n'est pas posée.
  const draft = state?.draft;
  const companies = (draft?.companies || []).filter((c) => c.selected);
  const directors = (draft?.directors || []).filter((d) => d.companies?.some((id) => companies.some((c) => c.id === id)));
  const owners = nature === 'tax_notice' ? directors : nature ? companies : [];
  const chosen = owners.length === 1 ? owners[0] : owners.find((o) => o.id === owner) || null;
  useEffect(() => { setOwner(''); }, [nature]);
  const ready = queue.length > 0 && !!nature && (owners.length === 0 || !!chosen) && state?.available !== false;
  const why = !queue.length ? 'Ajoutez un fichier' : !nature ? 'Dites quelle pièce c’est' : owners.length > 1 && !chosen ? (nature === 'tax_notice' ? 'Choisissez le dirigeant' : 'Choisissez la société') : '';

  const send = async () => {
    if (!ready || busy) return;
    setError(''); setDone(0);
    const meta = nature === 'tax_notice' ? { document_type: nature, director_id: chosen?.id || '' } : { document_type: nature, company_id: chosen?.id || '' };
    const files = [...queue];
    let sent = 0;
    try {
      for (const file of files) {
        setSending({ index: sent + 1, total: files.length, name: file.name });
        const result = await apiClient.uploadFile(root, file, 'file', meta);
        sent += 1;
        setState((current) => ({ ...(current || {}), documents: result.documents }));
        setQueue((current) => current.filter((f) => f !== file));
      }
      setDone(sent);
    } catch (e) {
      setError(e.message || 'Le fichier n’a pas pu être déposé.');
      if (sent) setDone(sent);
    } finally { setSending(null); }
  };
  const remove = async (id) => {
    if (busy) return;
    setError('');
    try { const result = await apiClient.delete(`${root}/${id}`); setState((current) => ({ ...(current || {}), documents: result.documents })); }
    catch (e) { setError(e.message || 'Le fichier n’a pas pu être retiré.'); }
  };

  const files = [...(state?.documents || [])].reverse();
  const platform = state?.platform;
  // Où la pièce sera rangée, redit dans la carte comme un chemin.
  const path = ['Compte du client', chosen?.name || (nature ? (nature === 'tax_notice' ? 'Dirigeant' : 'Société') : null), nature ? DOCUMENT_LABELS[nature] : null].filter(Boolean);
  const after = state?.phase === 'declared' ? 'Elles partent tout de suite dans le compte du client.' : 'Elles partiront dans le compte du client dès son ouverture.';

  return createPortal(
    <div className={`sj-overlay ${dark ? 'sj-dark' : ''} ${closing ? 'is-closing' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy && !closing) close(); }}>
      <section ref={ref} tabIndex={-1} className="sj-dialog ldd" role="dialog" aria-modal="true" aria-labelledby="ldd-title" style={style}>
        <header className="ldd-head">
          <div><h2 id="ldd-title">Déposer des documents</h2><p>{[lead?.full_name, lead?.company_name].filter(Boolean).join(' · ') || 'Pièces du client'}</p></div>
          <button type="button" className="sj-comments-close" aria-label="Fermer" disabled={busy || closing} onClick={close}><X size={18} /></button>
        </header>

        {/* La carte : on y glisse les fichiers, ou on clique pour les choisir. */}
        <div className={`ldd-card${drag ? ' is-drag' : ''}${queue.length ? ' has-files' : ''}${busy ? ' is-busy' : ''}`}
          onDragEnter={(e) => { e.preventDefault(); depth.current += 1; setDrag(true); }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDrag(false); }}
          onDrop={(e) => { e.preventDefault(); depth.current = 0; setDrag(false); if (!busy) add(e.dataTransfer.files); }}>
          <div className="ldd-card-in">
            {queue.length > 0 && (
              <ul className="ldd-queue">
                {queue.map((file, i) => (
                  <li key={`${file.name}-${file.size}`} style={{ '--i': i }} className={sending?.name === file.name ? 'is-sending' : ''}>
                    <FileTypeIcon name={file.name} mime={file.type} size={22} />
                    <span><strong title={file.name}>{file.name}</strong><small>{sizeOf(file.size)}</small></span>
                    {sending?.name === file.name
                      ? <LoaderCircle size={15} className="lead-docs__spin" />
                      : <button type="button" aria-label={`Retirer ${file.name}`} title="Retirer" disabled={busy} onClick={() => setQueue((current) => current.filter((f) => f !== file))}><X size={14} /></button>}
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="ldd-pick" disabled={busy || queue.length >= MAX_FILES} onClick={() => input.current?.click()}>
              <CloudUpload size={queue.length ? 18 : 30} strokeWidth={1.6} />
              <span>{drag ? 'Lâchez pour ajouter' : queue.length ? <>Ajouter d’autres fichiers ou <u>parcourir</u></> : <>Glissez vos fichiers ici<br />ou <u>parcourir</u></>}</span>
            </button>
            {!queue.length && <small className="ldd-format">PDF, JPG ou PNG · 20 Mo par fichier · {MAX_FILES} à la fois</small>}
            <div className="ldd-path" aria-live="polite">
              <span>Dépôt dans</span>
              <p>{path.map((part, i) => <React.Fragment key={part}>{i > 0 && <i>/</i>}<b className={i === path.length - 1 ? 'is-last' : ''}>{part}</b></React.Fragment>)}</p>
            </div>
          </div>
          <input ref={input} type="file" hidden multiple accept="application/pdf,image/png,image/jpeg" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
        </div>

        {/* Ce que c'est, et pour qui s'il y a le choix. */}
        <div className="ldd-ask">
          <span className="ldd-label">Quelle pièce ?</span>
          <div className="ldd-chips" role="radiogroup" aria-label="Nature de la pièce">
            {NATURES.map((key) => <button key={key} type="button" role="radio" aria-checked={nature === key} disabled={busy} onClick={() => setNature(key)}>{DOCUMENT_LABELS[key]}</button>)}
          </div>
        </div>
        {owners.length > 1 && (
          <div className="ldd-ask ldd-owner">
            <span className="ldd-label">{nature === 'tax_notice' ? 'Pour quel dirigeant ?' : 'Pour quelle société ?'}</span>
            <div className="ldd-chips" role="radiogroup" aria-label="Titulaire de la pièce">
              {owners.map((o) => <button key={o.id} type="button" role="radio" aria-checked={chosen?.id === o.id} disabled={busy} onClick={() => setOwner(o.id)}>{o.name}</button>)}
            </div>
          </div>
        )}

        {error && <p role="alert" className="ldd-error"><CircleAlert size={14} />{error}</p>}
        {done > 0 && !error && <p role="status" className="ldd-done"><Check size={14} />{plural(done, 'pièce')} déposée{done > 1 ? 's' : ''}. {after}</p>}

        <div className="ldd-actions">
          <span>{busy ? `Envoi ${sending.index} sur ${sending.total}…` : ready ? after : why}</span>
          <button type="button" className="ldd-send" disabled={!ready || busy} onClick={send}>
            {busy ? <LoaderCircle size={15} className="lead-docs__spin" /> : <CloudUpload size={15} />}
            {busy ? 'Dépôt en cours' : queue.length > 1 ? `Déposer ${queue.length} fichiers` : 'Déposer'}
          </button>
        </div>

        {/* Ce qui est déjà dans le dossier : une ligne, qui se déplie (la fiche les liste déjà). */}
        {(files.length > 0 || loading) && (
          <section className="ldd-files">
            <header>
              <button type="button" className="ldd-fold" aria-expanded={listOpen} disabled={!files.length} onClick={() => setListOpen((v) => !v)}>
                <span className="ldd-label">Déjà déposés{files.length > 0 && <b>{files.length}</b>}</span>
                {files.length > 0 && <ChevronDown size={13} style={{ transform: listOpen ? 'rotate(180deg)' : 'none', transition: 'transform .3s cubic-bezier(.34,1.56,.64,1)' }} />}
              </button>
              {loading ? <span className="ldd-muted">Chargement…</span>
                : listOpen && <button type="button" disabled={busy} onClick={read} title="Relire l’état des pièces"><RefreshCw size={12} />Actualiser</button>}
            </header>
            <div className="ldd-fold-body" style={{ gridTemplateRows: listOpen ? '1fr' : '0fr' }}>
              <div>
                <ul>
                  {files.map((file) => {
                    const Icon = ICONS[file.status] || Clock3;
                    const remote = platform?.items?.find((item) => item.id === file.document_id);
                    return (
                      <li key={file.id} title={file.last_error || file.file_name}>
                        <FileTypeIcon name={file.file_name || ''} mime={file.mime_type || ''} size={22} />
                        <span><strong>{DOCUMENT_LABELS[file.document_type] || 'Document'}</strong><small>{[documentOwner(file, draft), file.file_name].filter(Boolean).join(' · ')}</small>
                          {file.last_error && <em>{file.last_error}</em>}</span>
                        <span className={`lead-docs__status is-${file.status}`} title={documentStatus(file, remote)}><Icon size={11} className={file.status === 'sending' ? 'lead-docs__spin' : ''} />{documentStatus(file, remote).split(' · ')[0]}</span>
                        {!['sent', 'sending'].includes(file.status) && <button type="button" aria-label={`Retirer ${file.file_name}`} title="Retirer" disabled={busy} onClick={() => remove(file.id)}><Trash2 size={14} /></button>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </section>
        )}
        {(state?.account?.label || platform?.reason) && <p className="ldd-muted ldd-account">{[state?.account?.label, state?.account?.detail, platform?.reason].filter(Boolean).join(' · ')}</p>}
        {platform?.available && platform.expected?.length > 0 && (
          <details className="ldd-platform">
            <summary>État dans l’espace client · {plural(platform.documents?.total || 0, 'document')}</summary>
            {platform.expected.map((piece, i) => (
              <div key={`${piece.key}-${i}`}><span>{piece.label}{piece.company?.name ? ` · ${piece.company.name}` : ''}</span><small>{piece.status === 'received' ? 'Analysé' : 'À compléter / analyse en attente'}</small></div>
            ))}
          </details>
        )}
      </section>
    </div>, document.body);
}
