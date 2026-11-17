// Commentaires facturation d'un lead signé, au bas de sa fiche dans la Tracking Sheet (dev 17/11/2026).
// Le sales transmet à la finance et aux CSM ce qui concerne la facturation de son client, dans le fil de ce client (le
// même que le board et les Échanges de la fiche Finance), en messages « Sales » : Owner les lit, jamais le cabinet. Les
// réponses de la finance et des CSM à ses messages lui reviennent ici. Le serveur fait foi (services/client_comments) :
//   GET/POST /api/v1/tracking/leads/{id}/client-comments, POST …/attachments, GET …/attachments/{id}/file|email.
// Pas de client encore (vente non déclarée) : le fil n'existe pas, on le dit. Un sales mentionné dans le fil d'un autre
// client lit les fils où il intervient et y répond, sans en ouvrir de nouveau.
// Lien direct d'une notification (« ?lead=<id>&focus=comments&comment=<id> ») : LeadCommentLink ouvre la fiche du lead,
// puis ce fil défile jusqu'au commentaire et le met en évidence.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { AtSign, CornerUpLeft, MessagesSquare, Paperclip, SendHorizontal, X } from 'lucide-react';
import apiClient from '../../services/apiClient.js';
import MentionTextarea, { MentionedText } from '../MentionTextarea.jsx';
import { ComposerFiles, MessageFiles, MESSAGE_FILE_ACCEPT, MESSAGE_FILE_MAX, uploadMessageFile } from '../BoardClientFiles.jsx';
import { leadCommentLink, threadOf } from '../../utils/commentVisibility.js';
import { mentionedIds, notifiedSummary } from '../../utils/mentions.js';
import { fullDate, timeAgo } from '../../utils/timeAgo.js';
import '../../pages/TrackingSheetFinance/components/ExchangeThread.css';
import './SalesClientThread.css';

const STEP = 5;
const EASE = [0.22, 1, 0.36, 1];
const CARD_MOTION = { initial: { opacity: 0, y: -6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, transition: { duration: 0.14 } }, transition: { duration: 0.22, ease: EASE } };
const AVATARS = [['#e2f6ea', '#0b7a4b'], ['#fde9da', '#c2500e'], ['#e4f0fd', '#1b6fd0'], ['#eae9fb', '#4a3fc4'], ['#d9f3f7', '#0f7286'], ['#e5f5d3', '#3f6b12'], ['#fbf1c2', '#7a5a05']];
// Qui répond au sales : il voit d'un coup d'œil si c'est la finance, un CSM ou la direction.
const ROLE_TAGS = { finance_team: 'Finance', finance_director: 'Finance', customer_success_manager: 'CSM', ceo: 'Direction' };
const authorOf = (c) => c.author_name || c.author_email || 'Inconnu';
const firstName = (name) => String(name).split(/[\s@]/)[0];

function Avatar({ name, size = 30 }) {
  const label = String(name || '?').trim() || '?';
  const [bg, fg] = AVATARS[[...label].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATARS.length];
  return <span aria-hidden="true" className="fx-av" style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.42) }}>{label[0].toUpperCase()}</span>;
}

function Head({ c, size = 30, small = false }) {
  const tag = ROLE_TAGS[c.author_role];
  return (
    <header className="fx-head">
      <Avatar name={authorOf(c)} size={size} />
      <span className={`fx-author${small ? ' is-small' : ''}`}>{authorOf(c)}</span>
      <i className="fx-dot" /><span className="fx-time"><time dateTime={c.created_at} title={fullDate(c.created_at)}>{timeAgo(c.created_at)}</time>{c.updated_at ? ' · modifié' : ''}</span>
      {tag && <span className="sct-role">{tag}</span>}
    </header>
  );
}

function Body({ c, base }) {
  return (
    <>
      {c.body && <div className="fx-text"><MentionedText text={c.body} mentions={c.mentions} /></div>}
      <MessageFiles files={c.attachments} base={`${base}/attachments`} />
    </>
  );
}

// Réponse sous un message : l'auteur du message est prévenu (le serveur l'ajoute aussi), ⌘ Entrée envoie, Échap ferme.
function InlineReply({ people, myName, placeholder, onSend, onCancel }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const ok = await onSend(body);
    setBusy(false);
    if (ok) setText('');
  };
  return (
    <Motion.div className="fx-reply" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.24, ease: EASE }}>
      <div className="fx-reply-box">
        <Avatar name={myName} size={22} />
        <MentionTextarea value={text} onChange={setText} people={people} rows={1} autoFocus className="fx-reply-ta" placeholder={placeholder}
          aria-label="Votre réponse" maxLength={4000}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
            if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
          }} />
        <button type="button" className="fx-reply-send" disabled={!text.trim() || busy} onClick={send} aria-label="Envoyer la réponse" title="Envoyer (⌘ Entrée)"><SendHorizontal size={15} /></button>
      </div>
    </Motion.div>
  );
}

function Card({ c, t }) {
  return (
    <Motion.article id={`sct-c-${c.id}`} className={`fx-card${t.focusId === c.id ? ' is-target' : ''}`} {...CARD_MOTION}>
      <Head c={c} />
      <div className="fx-in">
        <Body c={c} base={t.base} />
        {c.replies.map((r) => (
          <div key={r.id} id={`sct-c-${r.id}`} className={`fx-sub${r.fresh ? ' is-fresh' : ''}${t.focusId === r.id ? ' is-target' : ''}`}>
            <Head c={r} size={22} small />
            <div className="fx-sub-in"><Body c={r} base={t.base} /></div>
          </div>
        ))}
        <footer className="fx-foot">
          <span className="sct-foot-space" />
          <button type="button" className="fx-answer" aria-expanded={t.replying === c.id} onClick={() => t.toggleReply(c.id)}><CornerUpLeft size={14} />Répondre</button>
        </footer>
        <AnimatePresence initial={false}>
          {t.replying === c.id && <InlineReply key="reply" people={t.people} myName={t.myName} placeholder={`Répondre à ${firstName(authorOf(c))}…`}
            onSend={(body) => t.sendReply(c, body)} onCancel={() => t.toggleReply(null)} />}
        </AnimatePresence>
      </div>
    </Motion.article>
  );
}

export default function SalesClientThread({ leadId, dark = false }) {
  const base = `/api/v1/tracking/leads/${leadId}/client-comments`;
  const me = useMemo(() => apiClient.getUser() || {}, []);
  const myName = me.full_name || me.name || me.email || 'Moi';
  // loading | ready | none (pas encore de client) | denied (ni son lead, ni un de ses fils) | error
  const [state, setState] = useState('loading');
  const [data, setData] = useState({ comments: [], people: [], numero_client: null, scope: 'all', billing: null });
  const [refresh, setRefresh] = useState(0);
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [replying, setReplying] = useState(null);
  const [limit, setLimit] = useState(STEP);
  const [focusId, setFocusId] = useState(null);
  const fileInput = useRef(null);
  const rootRef = useRef(null);
  const composerId = `sct-composer-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const location = useLocation();

  useEffect(() => {
    let alive = true;
    setState('loading');
    apiClient.get(base)
      .then((r) => { if (alive) { setData({ comments: r.comments || [], people: r.people || [], numero_client: r.numero_client, scope: r.scope || 'all', billing: r.billing_contact || null }); setState(r.available ? 'ready' : 'none'); } })
      .catch((e) => { if (alive) setState(e?.status === 403 ? 'denied' : 'error'); });
    return () => { alive = false; };
  }, [base, refresh]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 8000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => () => { setFiles((list) => { list.forEach((f) => f.thumb && URL.revokeObjectURL(f.thumb)); return list; }); }, []);

  // Lien direct : le fil s'affiche en entier, défile jusqu'au commentaire (ou au fil) et le met en évidence un instant.
  const link = leadCommentLink(location.search);
  const focusTarget = link && link.leadId === Number(leadId) && link.focus ? (link.commentId || 'thread') : null;
  useEffect(() => {
    if (!focusTarget || state === 'loading') return undefined;
    setLimit(Infinity);
    if (focusTarget !== 'thread') setFocusId(focusTarget);
    const scroll = setTimeout(() => {
      const el = (focusTarget !== 'thread' && document.getElementById(`sct-c-${focusTarget}`)) || rootRef.current;
      el?.scrollIntoView({ behavior: 'smooth', block: focusTarget !== 'thread' ? 'center' : 'start' });
    }, 650);
    const clear = setTimeout(() => setFocusId(null), 3400);
    return () => { clearTimeout(scroll); clearTimeout(clear); };
  }, [focusTarget, state, location.key]);

  const thread = useMemo(() => threadOf(data.comments), [data.comments]);
  const shown = thread.slice(0, limit);
  const older = thread.slice(limit);
  const canStart = state === 'ready' && data.scope === 'all';

  const addFiles = (list) => {
    if (!canStart) return;
    const next = [...(list || [])];
    const big = next.find((f) => f.size > MESSAGE_FILE_MAX);
    setError(big ? `« ${big.name} » dépasse 20 Mo.` : '');
    setFiles((prev) => [...prev, ...next.filter((f) => f.size <= MESSAGE_FILE_MAX).map((f) => ({ key: `${f.name}-${f.size}-${f.lastModified}`, file: f,
      thumb: f.type.startsWith('image/') ? URL.createObjectURL(f) : null }))]
      .filter((f, i, all) => all.findIndex((o) => o.key === f.key) === i).slice(0, 10));
  };
  const dropFile = (key) => setFiles((list) => list.filter((f) => { if (f.key === key && f.thumb) URL.revokeObjectURL(f.thumb); return f.key !== key; }));

  const submit = async () => {
    const body = draft.trim();
    if (!canStart || posting || (!body && !files.length)) return;
    setPosting(true); setError('');
    try {
      // Les pièces partent d'abord (en attente côté serveur), puis le message les rattache.
      const uploaded = [];
      for (const f of files) uploaded.push(await uploadMessageFile(data.numero_client, f.file, `${base}/attachments`));
      const created = await apiClient.post(base, { body, mentions: mentionedIds(body, data.people), attachment_ids: uploaded.map((u) => u.id) });
      setData((d) => ({ ...d, comments: [{ ...created, attachments: created.attachments?.length ? created.attachments : uploaded }, ...d.comments] }));
      setDraft('');
      setFiles((list) => { list.forEach((f) => f.thumb && URL.revokeObjectURL(f.thumb)); return []; });
      setNotice(notifiedSummary(created.notified) || 'Commentaire envoyé : la finance et les CSM le voient dans la fiche du client.');
    } catch (e) {
      setError(typeof e?.data?.detail === 'string' && e.status < 500 ? e.data.detail : 'Le commentaire n’a pas pu être envoyé. Votre texte et vos fichiers sont conservés.');
    } finally { setPosting(false); }
  };
  // Répondre sous un message : son auteur est prévenu (comme une mention), la réponse s'ouvre dans le fil.
  const sendReply = async (parent, body) => {
    setError('');
    try {
      const mail = (parent.author_email || '').toLowerCase();
      const author = data.people.find((p) => mail && (p.email || '').toLowerCase() === mail);
      const ids = [...new Set([...mentionedIds(body, data.people), ...(author ? [author.id] : [])])];
      const created = await apiClient.post(base, { body, parent_id: parent.id, mentions: ids });
      setData((d) => ({ ...d, comments: [{ ...created, parent_id: parent.id, fresh: true }, ...d.comments] }));
      setReplying(null);
      setNotice(notifiedSummary(created.notified));
      return true;
    } catch (e) {
      setError(typeof e?.data?.detail === 'string' && e.status < 500 ? e.data.detail : 'La réponse n’a pas pu être envoyée. Votre texte est conservé.');
      return false;
    }
  };
  const insertAt = () => {
    const el = document.getElementById(composerId);
    const pos = el ? (el.selectionStart ?? draft.length) : draft.length;
    const before = draft.slice(0, pos);
    const sep = before && !/\s$/.test(before) ? ' ' : '';
    setDraft(`${before}${sep}@${draft.slice(pos)}`);
    requestAnimationFrame(() => { if (!el) return; el.focus(); const caret = pos + sep.length + 1; el.setSelectionRange(caret, caret); });
  };
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
  const t = { base, people: data.people, myName, replying, focusId, sendReply, toggleReply: (id) => setReplying((r) => (r === id || id === null ? null : id)) };

  return (
    <section ref={rootRef} className={`sct${dark ? ' is-dark' : ''}`} aria-live="polite">
      <header className="sct-head">
        <span className="sct-title"><MessagesSquare size={12} />Commentaires facturation{thread.length > 0 && <b>{thread.length}</b>}</span>
      </header>
      <p className="sct-hint">Pour transmettre à la finance et aux CSM ce qui concerne la facturation du client.</p>

      {state === 'loading' && <p className="sct-empty">Chargement des commentaires…</p>}
      {state === 'none' && <p className="sct-empty">Le fil s’ouvre quand le client est créé.</p>}
      {state === 'denied' && <p className="sct-empty">Ce fil est réservé au sales du lead ; la finance et les CSM le lisent dans le board.</p>}
      {state === 'error' && <p role="alert" className="sct-error">Les commentaires n’ont pas pu être chargés. <button type="button" onClick={() => setRefresh((v) => v + 1)}>Réessayer</button></p>}

      {state === 'ready' && (
        <div className="fx sct-fx">
          {canStart ? (
            <>
              <div className={`fx-composer${dragging ? ' is-drag' : ''}`}
                onDragEnter={(e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDragging(true); } }}
                onDragOver={(e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
                onDrop={(e) => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}>
                <MentionTextarea id={composerId} value={draft} onChange={setDraft} people={data.people} rows={2} className="fx-ta" maxLength={4000}
                  aria-label="Commentaire facturation"
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
                  placeholder={data.billing ? `Pour ${data.billing.name} (facturation du client) : échéancier, RIB, remise, demande du client…` : 'Échéancier, RIB, remise, demande du client… @ pour prévenir la finance ou le CSM'} />
                <ComposerFiles files={files} disabled={posting} onRemove={dropFile} />
                <div className="fx-bar">
                  <button type="button" className="fx-tool" onClick={insertAt} aria-label="Mentionner quelqu’un" title="Mentionner la finance, un CSM ou la direction : la personne reçoit un e-mail et une notification"><AtSign size={16} /></button>
                  <button type="button" className="fx-tool" onClick={() => fileInput.current?.click()} disabled={posting} aria-label="Joindre des fichiers"
                    title="Joindre des fichiers (PDF, image, e-mail, audio · 20 Mo au plus) ou les glisser ici"><Paperclip size={16} /></button>
                  <input ref={fileInput} type="file" hidden multiple accept={MESSAGE_FILE_ACCEPT} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
                  <span className="fx-hint" aria-hidden="true">{isMac ? '⌘' : 'Ctrl'} Entrée</span>
                  <button type="button" className="fx-send" onClick={submit} disabled={posting || (!draft.trim() && !files.length)}>{posting ? 'Envoi…' : 'Envoyer'}</button>
                </div>
              </div>
              <p className="fx-scope">{data.billing
                ? `Chaque message prévient ${data.billing.name}, à la facturation de ce client. Lu par Owner (finance, CSM, direction), jamais par le cabinet ; @ prévient une autre personne.`
                : 'Lu par Owner (finance, CSM, direction), jamais par le cabinet. @ prévient par e-mail et notification.'}</p>
            </>
          ) : <p className="sct-empty">Vous êtes mentionné dans ce fil : répondez sous le message qui vous concerne.</p>}
          <AnimatePresence>
            {notice && <Motion.p key="notice" role="status" className="fx-notice" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{notice}</Motion.p>}
          </AnimatePresence>
          {error && <p role="alert" className="fx-error">{error}</p>}
          {!thread.length
            ? <p className="fx-empty">Aucun commentaire pour le moment.</p>
            : (
              <div className="fx-list">
                <AnimatePresence initial={false}>
                  {shown.map((c) => <Card key={c.id} c={c} t={t} />)}
                </AnimatePresence>
              </div>
            )}
          {older.length > 0 && (
            <button type="button" className="fx-more" onClick={() => setLimit((l) => l + STEP)}>
              Voir {Math.min(STEP, older.length) > 1 ? `les ${Math.min(STEP, older.length)} précédents` : 'le précédent'}
              {older.length > STEP && <span className="fx-more-n">sur {older.length}</span>}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// Lien direct « ?lead=<id> » d'une notification de commentaire facturation : ouvre la fiche du lead dans la sheet
// (`onOpen(lead)`), une fois par navigation. Si le lead n'est pas dans la sheet (un sales mentionné dans le fil du client
// d'un autre sales), le fil s'ouvre dans une fenêtre, sur ce lead.
export function LeadCommentLink({ leads, ready, onOpen, dark = false }) {
  const location = useLocation();
  const link = leadCommentLink(location.search);
  const handled = useRef(null);
  const [orphan, setOrphan] = useState(null);
  useEffect(() => {
    if (!ready || !link || handled.current === location.key) return;
    handled.current = location.key;
    const lead = (leads || []).find((l) => String(l.id) === String(link.leadId));
    if (lead) { setOrphan(null); onOpen(lead); } else setOrphan(link.leadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, location.key, link?.leadId, leads]);
  useEffect(() => {
    if (!orphan) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOrphan(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [orphan]);
  if (!orphan) return null;
  return createPortal(
    <div className={`sct-veil${dark ? ' is-dark' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) setOrphan(null); }}>
      <div className="sct-sheet" role="dialog" aria-modal="true" aria-label="Commentaires facturation">
        <button type="button" className="sct-close" aria-label="Fermer" onClick={() => setOrphan(null)}><X size={15} /></button>
        <SalesClientThread leadId={orphan} dark={dark} />
      </div>
    </div>,
    document.body,
  );
}
