// Messages facturation d'un lead signé, au bas de sa fiche dans la Tracking Sheet (dev 17/11/2026).
// La finance ou le CSM écrit au sales depuis la fiche Finance ou le board (message « Sales » : Owner le lit, jamais le
// cabinet) ; le sales le lit ici et RÉPOND, il n'ouvre pas de fil : ses informations de vente sont déjà dans la fiche
// d'intégration, les échanges sont brefs (dev 17/11/2026). Chaque réponse prévient l'auteur du message et la personne
// de la facturation du client. Le serveur fait foi (services/client_comments) :
//   GET/POST /api/v1/tracking/leads/{id}/client-comments, POST …/attachments, GET …/attachments/{id}/file|email.
// Présentation compacte, au micro-libellé des sections de la fiche : rien de plus qu'une ligne tant qu'aucun message.
// Lien direct d'une notification (« ?lead=<id>&focus=comments&comment=<id> ») : LeadCommentLink ouvre la fiche du lead,
// puis ce fil défile jusqu'au commentaire et le met en évidence.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { CornerUpLeft, MessagesSquare, Paperclip, SendHorizontal, X } from 'lucide-react';
import apiClient from '../../services/apiClient.js';
import MentionTextarea, { MentionedText } from '../MentionTextarea.jsx';
import { ComposerFiles, MessageFiles, MESSAGE_FILE_ACCEPT, MESSAGE_FILE_MAX, uploadMessageFile } from '../BoardClientFiles.jsx';
import { leadCommentLink, threadOf } from '../../utils/commentVisibility.js';
import { mentionedIds, notifiedSummary } from '../../utils/mentions.js';
import { fullDate, timeAgo } from '../../utils/timeAgo.js';
import '../../pages/TrackingSheetFinance/components/ExchangeThread.css';
import './SalesClientThread.css';

const STEP = 3;
const EASE = [0.22, 1, 0.36, 1];
const CARD_MOTION = { initial: { opacity: 0, y: -6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, transition: { duration: 0.14 } }, transition: { duration: 0.22, ease: EASE } };
const AVATARS = [['#e2f6ea', '#0b7a4b'], ['#fde9da', '#c2500e'], ['#e4f0fd', '#1b6fd0'], ['#eae9fb', '#4a3fc4'], ['#d9f3f7', '#0f7286'], ['#e5f5d3', '#3f6b12'], ['#fbf1c2', '#7a5a05']];
// Qui écrit au sales : il voit d'un coup d'œil si c'est la finance, un CSM ou la direction.
const ROLE_TAGS = { finance_team: 'Finance', finance_director: 'Finance', customer_success_manager: 'CSM', ceo: 'Direction' };
const authorOf = (c) => c.author_name || c.author_email || 'Inconnu';
const firstName = (name) => String(name).split(/[\s@]/)[0];
const errorOf = (e, fallback) => (typeof e?.data?.detail === 'string' && e.status < 500 ? e.data.detail : fallback);

function Avatar({ name, size = 22 }) {
  const label = String(name || '?').trim() || '?';
  const [bg, fg] = AVATARS[[...label].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATARS.length];
  return <span aria-hidden="true" className="fx-av" style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.45) }}>{label[0].toUpperCase()}</span>;
}

function Head({ c, size = 22 }) {
  const tag = ROLE_TAGS[c.author_role];
  return (
    <header className="fx-head sct-row-head">
      <Avatar name={authorOf(c)} size={size} />
      <span className="fx-author is-small">{authorOf(c)}</span>
      {tag && <span className="sct-role">{tag}</span>}
      <span className="fx-time sct-time"><time dateTime={c.created_at} title={fullDate(c.created_at)}>{timeAgo(c.created_at)}</time></span>
    </header>
  );
}

function Body({ c, base }) {
  return (
    <>
      {c.body && <div className="fx-text sct-text"><MentionedText text={c.body} mentions={c.mentions} /></div>}
      <MessageFiles files={c.attachments} base={`${base}/attachments`} />
    </>
  );
}

// Réponse sous un message : texte et, au besoin, un document (RIB, échéancier…). ⌘ Entrée envoie, Échap ferme.
function InlineReply({ t, parent }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);
  useEffect(() => () => { setFiles((list) => { list.forEach((f) => f.thumb && URL.revokeObjectURL(f.thumb)); return list; }); }, []);
  const addFiles = (list) => {
    const next = [...(list || [])];
    const big = next.find((f) => f.size > MESSAGE_FILE_MAX);
    t.setError(big ? `« ${big.name} » dépasse 20 Mo.` : '');
    setFiles((prev) => [...prev, ...next.filter((f) => f.size <= MESSAGE_FILE_MAX).map((f) => ({ key: `${f.name}-${f.size}-${f.lastModified}`, file: f,
      thumb: f.type.startsWith('image/') ? URL.createObjectURL(f) : null }))]
      .filter((f, i, all) => all.findIndex((o) => o.key === f.key) === i).slice(0, 10));
  };
  const dropFile = (key) => setFiles((list) => list.filter((f) => { if (f.key === key && f.thumb) URL.revokeObjectURL(f.thumb); return f.key !== key; }));
  const send = async () => {
    const body = text.trim();
    if ((!body && !files.length) || busy) return;
    setBusy(true);
    const ok = await t.sendReply(parent, body, files.map((f) => f.file));
    setBusy(false);
    if (ok) { setText(''); setFiles((list) => { list.forEach((f) => f.thumb && URL.revokeObjectURL(f.thumb)); return []; }); }
  };
  return (
    <Motion.div className="fx-reply" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.24, ease: EASE }}>
      <div className="fx-reply-box">
        <MentionTextarea value={text} onChange={setText} people={t.people} rows={1} autoFocus className="fx-reply-ta"
          placeholder={`Répondre à ${firstName(authorOf(parent))}…`} aria-label="Votre réponse" maxLength={4000}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
            if (e.key === 'Escape') { e.stopPropagation(); t.toggleReply(null); }
          }} />
        <button type="button" className="sct-attach" onClick={() => fileInput.current?.click()} disabled={busy} aria-label="Joindre un document"
          title="Joindre un document (PDF, image, e-mail · 20 Mo au plus)"><Paperclip size={14} /></button>
        <input ref={fileInput} type="file" hidden multiple accept={MESSAGE_FILE_ACCEPT} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        <button type="button" className="fx-reply-send" disabled={(!text.trim() && !files.length) || busy} onClick={send} aria-label="Envoyer la réponse" title="Envoyer (⌘ Entrée)"><SendHorizontal size={14} /></button>
      </div>
      <ComposerFiles files={files} disabled={busy} onRemove={dropFile} />
    </Motion.div>
  );
}

function Card({ c, t }) {
  return (
    <Motion.article id={`sct-c-${c.id}`} className={`sct-card${t.focusId === c.id ? ' is-target' : ''}`} {...CARD_MOTION}>
      <Head c={c} />
      <div className="sct-in">
        <Body c={c} base={t.base} />
        {c.replies.map((r) => (
          <div key={r.id} id={`sct-c-${r.id}`} className={`sct-sub${r.fresh ? ' is-fresh' : ''}${t.focusId === r.id ? ' is-target' : ''}`}>
            <Head c={r} size={18} />
            <div className="sct-sub-in"><Body c={r} base={t.base} /></div>
          </div>
        ))}
        {t.replying !== c.id && (
          <button type="button" className="sct-answer" onClick={() => t.toggleReply(c.id)}><CornerUpLeft size={12} />Répondre</button>
        )}
        <AnimatePresence initial={false}>
          {t.replying === c.id && <InlineReply key="reply" t={t} parent={c} />}
        </AnimatePresence>
      </div>
    </Motion.article>
  );
}

export default function SalesClientThread({ leadId, dark = false }) {
  const base = `/api/v1/tracking/leads/${leadId}/client-comments`;
  // loading | ready | none (pas encore de client) | denied (ni son lead, ni un de ses fils) | error
  const [state, setState] = useState('loading');
  const [data, setData] = useState({ comments: [], people: [], numero_client: null, billing: null });
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [replying, setReplying] = useState(null);
  const [limit, setLimit] = useState(STEP);
  const [focusId, setFocusId] = useState(null);
  const rootRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    let alive = true;
    setState('loading');
    apiClient.get(base)
      .then((r) => { if (alive) { setData({ comments: r.comments || [], people: r.people || [], numero_client: r.numero_client, billing: r.billing_contact || null }); setState(r.available ? 'ready' : 'none'); } })
      .catch((e) => { if (alive) setState(e?.status === 403 ? 'denied' : 'error'); });
    return () => { alive = false; };
  }, [base, refresh]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 8000);
    return () => clearTimeout(timer);
  }, [notice]);

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

  // Répondre sous un message : son auteur est prévenu (comme une mention), les documents partent d'abord.
  const sendReply = async (parent, body, files = []) => {
    setError('');
    try {
      const uploaded = [];
      for (const file of files) uploaded.push(await uploadMessageFile(data.numero_client, file, `${base}/attachments`));
      const mail = (parent.author_email || '').toLowerCase();
      const author = data.people.find((p) => mail && (p.email || '').toLowerCase() === mail);
      const ids = [...new Set([...mentionedIds(body, data.people), ...(author ? [author.id] : [])])];
      const created = await apiClient.post(base, { body, parent_id: parent.id, mentions: ids, attachment_ids: uploaded.map((u) => u.id) });
      setData((d) => ({ ...d, comments: [{ ...created, parent_id: parent.id, fresh: true, attachments: created.attachments?.length ? created.attachments : uploaded }, ...d.comments] }));
      setReplying(null);
      setNotice(notifiedSummary(created.notified));
      return true;
    } catch (e) {
      setError(errorOf(e, 'La réponse n’a pas pu être envoyée. Votre texte et vos documents sont conservés.'));
      return false;
    }
  };
  const t = { base, people: data.people, replying, focusId, sendReply, setError, toggleReply: (id) => setReplying((r) => (r === id || id === null ? null : id)) };

  return (
    <section ref={rootRef} className={`sct${dark ? ' is-dark' : ''}`} aria-live="polite">
      <header className="sct-head">
        <span className="sct-title"><MessagesSquare size={12} />Messages facturation{thread.length > 0 && <b>{thread.length}</b>}</span>
        {data.billing && <span className="sct-billing" title="Reçoit chacune de vos réponses">Facturation : {data.billing.name}</span>}
      </header>

      {state === 'loading' && <p className="sct-empty">Chargement…</p>}
      {state === 'none' && <p className="sct-empty">Les messages de la finance arrivent ici une fois le client créé.</p>}
      {state === 'denied' && <p className="sct-empty">Ces messages sont réservés au sales du lead.</p>}
      {state === 'error' && <p role="alert" className="sct-error">Les messages n’ont pas pu être chargés. <button type="button" onClick={() => setRefresh((v) => v + 1)}>Réessayer</button></p>}

      {state === 'ready' && (
        <div className="fx sct-fx">
          {!thread.length && <p className="sct-empty">Aucun message. La finance ou le CSM vous écrit ici si une information manque ; vous répondez sous leur message.</p>}
          <AnimatePresence>
            {notice && <Motion.p key="notice" role="status" className="fx-notice" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{notice}</Motion.p>}
          </AnimatePresence>
          {error && <p role="alert" className="fx-error">{error}</p>}
          {thread.length > 0 && (
            <div className="sct-list">
              <AnimatePresence initial={false}>
                {shown.map((c) => <Card key={c.id} c={c} t={t} />)}
              </AnimatePresence>
            </div>
          )}
          {older.length > 0 && (
            <button type="button" className="sct-more" onClick={() => setLimit((l) => l + STEP)}>
              {older.length > 1 ? `${older.length} messages plus anciens` : '1 message plus ancien'}
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
