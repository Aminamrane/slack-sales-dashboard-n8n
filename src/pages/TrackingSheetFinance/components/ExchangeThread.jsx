// ExchangeThread.jsx : tous les échanges d'un client au même endroit, dans la fiche Finance (dev 10/11/2026 :
// « centraliser la communication, @ n'importe qui et n'importe quelle pièce jointe, comme dans le board »).
//
// Un seul fil, une seule saisie, trois sources :
//   - l'espace commun du board (/api/v1/optilex/comments) : messages, réponses, mentions, pièces jointes,
//     réactions ; visible par Owner, le cabinet et la finance ;
//   - les notations météo du board (/api/v1/optilex/meteo-history) : lues ici, on y répond et on y réagit ;
//     noter ou corriger une météo reste dans le board ;
//   - les notes internes finance (/api/v1/finance-periods/client/{id}/comments) : jamais montrées au cabinet,
//     épinglables, et l'on y répond comme à un message (11/11/2026 : « pourquoi ils ne peuvent pas répondre à
//     l'interne ? »). Une réponse est une note dont `parent_id` désigne la note. On y mentionne un collègue de la
//     finance ou de la direction (annuaire /notes/mentionables, jamais le cabinet) : il reçoit un e-mail et une
//     notification dans le CRM. On y réagit par emoji comme sur un message. Pas de pièce jointe.
// Dans un fil, on répond depuis le bas (« Répondre » sous la dernière réponse) ou depuis une réponse précise
// (la flèche de sa ligne, qui prépare « @Auteur »).
// La saisie dit toujours à qui l'on écrit. Rôles en lecture seule : tout se lit, rien ne s'écrit.
import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { ArrowUpRight, AtSign, ChevronDown, CornerUpLeft, Lock, MoreHorizontal, Paperclip, Pencil, Pin, PinOff, SendHorizontal, Smile, Trash2, Users } from 'lucide-react';
import apiClient from '../../../services/apiClient.js';
import MentionTextarea, { MentionedText } from '../../../components/MentionTextarea.jsx';
import { EmojiPalette, Reactions, toggledReactions } from '../../../components/BoardReactions.jsx';
import { ComposerFiles, MessageFiles, MESSAGE_FILE_ACCEPT, MESSAGE_FILE_MAX, uploadMessageFile } from '../../../components/BoardClientFiles.jsx';
import { MeteoIcon } from '../../../components/meteo.jsx';
import { WeatherQualification } from '../../../components/WeatherCaseComposer.jsx';
import { weatherPresentation, weatherRatingLabel } from '../../../utils/weatherCase.js';
import { mentionedIds, notifiedSummary } from '../../../utils/mentions.js';
import { isReadOnlyViewer, READ_ONLY_PROPS } from '../../../utils/readOnlyRoles.js';
import './ExchangeThread.css';

const STEP = 5;
const SHARED = '/api/v1/optilex/comments';
const SPRING = { type: 'spring', stiffness: 520, damping: 40 };
const EASE = [0.22, 1, 0.36, 1];
const AVATARS = [['#e2f6ea', '#0b7a4b'], ['#fde9da', '#c2500e'], ['#e4f0fd', '#1b6fd0'], ['#eae9fb', '#4a3fc4'], ['#d9f3f7', '#0f7286'], ['#e5f5d3', '#3f6b12'], ['#fbf1c2', '#7a5a05']];

// Les dates sans fuseau du serveur sont en UTC.
const asDate = (iso) => {
  if (!iso) return null;
  const d = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(String(iso)) ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};
const stamp = (iso) => asDate(iso)?.getTime() || 0;
export function timeAgo(iso, now = Date.now()) {
  const d = asDate(iso);
  if (!d) return '';
  const minutes = Math.round((now - d.getTime()) / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' });
}
const fullDate = (iso) => asDate(iso)?.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) || '';
const authorOf = (e) => e.author_name || e.author_email || 'Inconnu';
const firstName = (name) => String(name).split(/[\s@]/)[0];
// « A et B », « A, B et C », « A, B, C et d'autres ».
const whoReplied = (names) => {
  const u = [...new Set(names.map(firstName))];
  if (u.length <= 2) return u.join(' et ');
  return u.length === 3 ? `${u[0]}, ${u[1]} et ${u[2]}` : `${u.slice(0, 3).join(', ')} et d’autres`;
};
// Notes internes : épinglées d'abord, puis de la plus récente à la plus ancienne (l'ordre du serveur).
const sortNotes = (list) => [...list].sort((a, b) => (!!b.pinned - !!a.pinned) || String(b.created_at || '').localeCompare(String(a.created_at || '')));

function Avatar({ name, size = 30 }) {
  const label = String(name || '?').trim() || '?';
  const [bg, fg] = AVATARS[[...label].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATARS.length];
  return <span aria-hidden="true" className="fx-av" style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.42) }}>{label[0].toUpperCase()}</span>;
}
const AvatarStack = ({ names, size = 22, max = 4 }) => (
  <span className="fx-stack">{[...new Set(names)].slice(0, max).map((n) => <span key={n}><Avatar name={n} size={size} /></span>)}</span>
);
const Time = ({ iso }) => <time dateTime={iso} title={fullDate(iso)}>{timeAgo(iso)}</time>;

// Menu « ⋯ » d'un message : se ferme au clic dehors et à Échap (sans fermer la fiche).
function ItemMenu({ items, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey, true); };
  }, [open]);
  const list = items.filter(Boolean);
  if (!list.length) return null;
  return (
    <span ref={ref} className="fx-menu">
      <button type="button" className="fx-menu-btn" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}><MoreHorizontal size={16} /></button>
      <AnimatePresence>
        {open && (
          <Motion.div role="menu" className="fx-menu-pop" initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.1 } }} transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}>
            {list.map((it) => (
              <button key={it.label} type="button" role="menuitem" className={`fx-menu-item${it.danger ? ' is-danger' : ''}`} onClick={() => { setOpen(false); it.onClick(); }}>
                <it.Icon size={14} />{it.label}
              </button>
            ))}
          </Motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

// Texte replié : hauteur bornée et fondu, « Voir plus » seulement si le texte dépasse vraiment (hauteur mesurée,
// remesurée quand la fiche change de largeur).
function Clamp({ max, measureKey, labels = ['Voir plus', 'Voir moins'], children }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setFull(el.scrollHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measureKey]);
  const over = full > max + 4;
  return (
    <div className={`fx-clamp${over && !open ? ' is-clamped' : ''}`}>
      <div ref={ref} className="fx-clamp-in" style={over ? { maxHeight: open ? full : max } : undefined}>{children}</div>
      {over && <button type="button" className="fx-clamp-more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? labels[1] : labels[0]}<ChevronDown size={13} strokeWidth={2.4} /></button>}
    </div>
  );
}

function Head({ author, size = 30, small = false, iso, extra, tags, menu }) {
  return (
    <header className="fx-head">
      <Avatar name={author} size={size} />
      <span className={`fx-author${small ? ' is-small' : ''}`}>{author}</span>
      <i className="fx-dot" /><span className="fx-time"><Time iso={iso} />{extra}</span>
      {tags}
      {menu && <span className="fx-head-end">{menu}</span>}
    </header>
  );
}

// Modifier un message ou une note : la même zone que la saisie ; ⌘/Ctrl + Entrée enregistre, Échap annule.
function EditBox({ t, mentions }) {
  return (
    <div className="fx-edit">
      <MentionTextarea value={t.edit.draft} onChange={t.setEditDraft} people={mentions ? t.people : []} rows={2} autoFocus maxLength={4000} className="fx-ta"
        aria-label="Modifier le texte"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); t.saveEdit(); }
          if (e.key === 'Escape') { e.stopPropagation(); t.cancelEdit(); }
        }} />
      {t.edit.error && <p role="alert" className="fx-error" style={{ margin: '0 12px 8px' }}>{t.edit.error}</p>}
      <div className="fx-edit-bar">
        <button type="button" className="fx-ghost" onClick={t.cancelEdit}>Annuler</button>
        <button type="button" className="fx-send" disabled={!t.edit.draft.trim() || t.edit.saving} onClick={t.saveEdit}>{t.edit.saving ? '…' : 'Enregistrer'}</button>
      </div>
    </div>
  );
}
function DeleteConfirm({ t, entryKey, what }) {
  return (
    <Motion.div className="fx-confirm" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: EASE }}>
      <span>Supprimer {what} ?</span>
      <button type="button" className="fx-ghost" onClick={t.cancelDelete}>Annuler</button>
      <button type="button" className="fx-danger" disabled={t.deleting === entryKey} onClick={() => t.remove(entryKey)}>{t.deleting === entryKey ? '…' : 'Supprimer'}</button>
    </Motion.div>
  );
}
const editItems = (t, key, body) => [
  { label: 'Modifier', Icon: Pencil, onClick: () => t.startEdit(key, body) },
  { label: 'Supprimer', Icon: Trash2, danger: true, onClick: () => t.askDelete(key) },
];

// Réponse sous le message : une ligne de saisie dans la carte ; l'auteur du message est prévenu comme une mention.
function InlineReply({ t, placeholder, onSend, people = t.people, initial = '' }) {
  const [text, setText] = useState(initial);
  const placed = useRef(false);
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
        <Avatar name={t.myName} size={22} />
        <MentionTextarea value={text} onChange={setText} people={people} rows={1} autoFocus className="fx-reply-ta" placeholder={placeholder}
          onFocus={(e) => { if (placed.current) return; placed.current = true; const end = e.target.value.length; e.target.setSelectionRange(end, end); }}
          aria-label="Votre réponse" maxLength={4000}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
            if (e.key === 'Escape') { e.stopPropagation(); t.cancelReply(); }
          }} />
        <button type="button" className="fx-reply-send" disabled={!text.trim() || busy} onClick={send} aria-label="Envoyer la réponse" title="Envoyer (⌘ Entrée)"><SendHorizontal size={15} /></button>
      </div>
    </Motion.div>
  );
}

// Flèche d'une réponse : rouvre la saisie du fil en préparant « @Auteur » quand il est dans l'annuaire.
const AnswerTo = ({ t, threadKey, author, people }) => (!t.readOnly && threadKey ? (
  <button type="button" className="fx-sub-answer" aria-label={`Répondre à ${firstName(author)}`} title={`Répondre à ${firstName(author)}`}
    onClick={() => t.replyTo(threadKey, author, people)}><CornerUpLeft size={14} /></button>
) : null);

function Reply({ c, t, threadKey }) {
  const key = `c:${c.id}`;
  const list = t.reactionsOf('comment', c.id);
  return (
    <div className={`fx-sub${c.fresh ? ' is-fresh' : ''}`}>
      <Head author={authorOf(c)} size={22} small iso={c.created_at} extra={c.updated_at ? ' · modifié' : ''}
        menu={!t.readOnly && <><AnswerTo t={t} threadKey={threadKey} author={authorOf(c)} people={t.people} /><EmojiPalette onPick={(e) => t.react('comment', c.id, e)} />{t.canEdit(c) && t.edit.key !== key && <ItemMenu label="Actions de la réponse" items={editItems(t, key, c.body)} />}</>} />
      <div className="fx-sub-in">
        {t.edit.key === key ? <EditBox t={t} mentions />
          : c.body && <Clamp max={88} measureKey={c.body}><div className="fx-text"><MentionedText text={c.body} mentions={c.mentions} /></div></Clamp>}
        <MessageFiles files={c.attachments} />
        {t.confirming === key && <DeleteConfirm t={t} entryKey={key} what="cette réponse" />}
        {list.length > 0 && <Reactions list={list} onToggle={(e) => t.react('comment', c.id, e)} />}
      </div>
    </div>
  );
}
// Réponse à une note interne : texte et réactions. Modifier et supprimer viennent du serveur (`can_moderate`).
function NoteReply({ n, t, threadKey }) {
  const key = `n:${n.id}`;
  const edited = n.updated_at && n.updated_at !== n.created_at;
  const list = n.reactions || [];
  return (
    <div className={`fx-sub${n.fresh ? ' is-fresh' : ''}`}>
      <Head author={authorOf(n)} size={22} small iso={n.created_at} extra={edited ? ' · modifiée' : ''}
        menu={!t.readOnly && <><AnswerTo t={t} threadKey={threadKey} author={authorOf(n)} people={t.notePeople} /><EmojiPalette onPick={(e) => t.reactNote(n, e)} />{n.can_moderate && t.edit.key !== key && <ItemMenu label="Actions de la réponse" items={editItems(t, key, n.body)} />}</>} />
      <div className="fx-sub-in">
        {t.edit.key === key ? <EditBox t={t} />
          : <Clamp max={88} measureKey={n.body}><div className="fx-text"><MentionedText text={n.body} mentions={t.noteMentions} /></div></Clamp>}
        {t.confirming === key && <DeleteConfirm t={t} entryKey={key} what="cette réponse" />}
        {list.length > 0 && <Reactions list={list} onToggle={(e) => t.reactNote(n, e)} />}
      </div>
    </div>
  );
}
// Réponses d'un message, d'une météo ou d'une note : ouvertes jusqu'à deux, sinon regroupées derrière leurs
// auteurs ; le fil s'ouvre de lui-même quand une réponse vient d'y être publiée.
function Replies({ replies, t, openSignal, note = false, threadKey }) {
  const [open, setOpen] = useState(replies.length <= 2);
  // Rognée seulement pendant qu'elle se déplie : au repos, le menu « ⋯ » de la dernière réponse doit dépasser.
  const [moving, setMoving] = useState(false);
  useEffect(() => { if (openSignal) setOpen(true); }, [openSignal]);
  const names = replies.map(authorOf);
  return (
    <div className="fx-replies">
      <button type="button" className="fx-replies-sum" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <AvatarStack names={names} />
        <span><b>{replies.length} réponse{replies.length > 1 ? 's' : ''}</b> de {whoReplied(names)}</span>
        <ChevronDown size={13} strokeWidth={2.4} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <Motion.div className={`fx-replies-list${moving ? ' is-moving' : ''}`} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}
            onAnimationStart={() => setMoving(true)} onAnimationComplete={() => setMoving(false)}>
            {replies.map((reply) => (note ? <NoteReply key={reply.id} n={reply} t={t} threadKey={threadKey} /> : <Reply key={reply.id} c={reply} t={t} threadKey={threadKey} />))}
            {!t.readOnly && threadKey && t.replying !== threadKey && (
              <button type="button" className="fx-thread-answer" onClick={() => t.toggleReply(threadKey)}><CornerUpLeft size={14} />Répondre</button>
            )}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Pied d'une carte partagée : réactions, « Répondre », réponses et saisie de réponse.
function SharedFoot({ kind, entry, t }) {
  const key = `${kind === 'rating' ? 'r' : 'c'}:${entry.id}`;
  const author = authorOf(entry);
  return (
    <>
      <footer className="fx-foot">
        <Reactions list={t.reactionsOf(kind, entry.id)} onToggle={(e) => t.react(kind, entry.id, e)} />
        <button type="button" className="fx-answer" aria-expanded={t.replying === key} onClick={() => t.toggleReply(key)} {...t.ro}><CornerUpLeft size={14} />Répondre</button>
      </footer>
      {entry.replies.length > 0 && <Replies replies={entry.replies} t={t} threadKey={key} openSignal={t.bump.key === key ? t.bump.n : 0} />}
      <AnimatePresence initial={false}>
        {t.replying === key && <InlineReply key={`reply-${t.replySeed.n}`} t={t} initial={t.replySeed.text} placeholder={`Répondre à ${firstName(author)}…`} onSend={(body) => t.sendReply(kind, entry, body)} />}
      </AnimatePresence>
    </>
  );
}

const CARD_MOTION = { initial: { opacity: 0, y: -6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, transition: { duration: 0.14 } }, transition: { duration: 0.22, ease: EASE } };

function MessageCard({ e, t }) {
  return (
    <Motion.article id={`fx-${e.key}`} className="fx-card" {...CARD_MOTION}>
      <Head author={authorOf(e)} iso={e.created_at} extra={e.updated_at ? ' · modifié' : ''}
        menu={t.canEdit(e) && t.edit.key !== e.key && <ItemMenu label="Actions du message" items={editItems(t, e.key, e.body)} />} />
      <div className="fx-in">
        {t.edit.key === e.key ? <EditBox t={t} mentions />
          : e.body && <Clamp max={88} measureKey={e.body}><div className="fx-text"><MentionedText text={e.body} mentions={e.mentions} /></div></Clamp>}
        <MessageFiles files={e.attachments} />
        {t.confirming === e.key && <DeleteConfirm t={t} entryKey={e.key} what="ce message" />}
        <SharedFoot kind="comment" entry={e} t={t} />
      </div>
    </Motion.article>
  );
}
// Notation météo du board : lue ici, avec ses réponses et ses réactions.
function WeatherCard({ e, t }) {
  const w = weatherPresentation(e.score, e.weather_context);
  const qualification = e.weather_context?.qualification;
  return (
    <Motion.article id={`fx-${e.key}`} className="fx-card" {...CARD_MOTION}>
      <Head author={authorOf(e)} iso={e.created_at}
        extra={e.note_updated_at ? <span title={fullDate(e.note_updated_at)}> · commentaire modifié{e.note_updated_by_name ? ` par ${e.note_updated_by_name}` : ''}</span> : null} />
      <div className="fx-in">
        <span className="fx-chip" style={{ color: w?.color, background: w?.bg }}><MeteoIcon score={e.score} size={14} color={w?.color} />{weatherRatingLabel(e.score, e.weather_context)}</span>
        {qualification
          ? <Clamp max={124} measureKey={JSON.stringify(qualification)} labels={['Voir le détail', 'Réduire']}><div className="fx-qual"><WeatherQualification context={e.weather_context} /></div></Clamp>
          : e.note && <Clamp max={88} measureKey={e.note}><div className="fx-text">{e.note}</div></Clamp>}
        <SharedFoot kind="rating" entry={e} t={t} />
      </div>
    </Motion.article>
  );
}
// Note interne finance : jamais visible du cabinet. Les actions viennent du serveur (`can_moderate`).
function NoteCard({ e, t }) {
  const edited = e.updated_at && e.updated_at !== e.created_at;
  return (
    <Motion.article id={`fx-${e.key}`} className={`fx-card is-note${e.pinned ? ' is-pinned' : ''}`} {...CARD_MOTION} animate={{ opacity: e._pending ? 0.6 : 1, y: 0 }}>
      <Head author={authorOf(e)} iso={e.created_at} extra={edited ? ' · modifiée' : ''}
        tags={<>
          <span className="fx-tag" title="Note interne : le cabinet ne la voit pas"><Lock size={11} strokeWidth={2.2} />Interne</span>
          {e.pinned && <span className="fx-tag is-pin"><Pin size={11} strokeWidth={2.2} />Épinglée</span>}
        </>}
        menu={!t.readOnly && e.can_moderate && !e._pending && t.edit.key !== e.key && <ItemMenu label="Actions de la note" items={[
          { label: 'Modifier', Icon: Pencil, onClick: () => t.startEdit(e.key, e.body) },
          t.canPin && { label: e.pinned ? 'Désépingler' : 'Épingler en tête', Icon: e.pinned ? PinOff : Pin, onClick: () => t.togglePin(e) },
          { label: 'Supprimer', Icon: Trash2, danger: true, onClick: () => t.askDelete(e.key) },
        ]} />} />
      <div className="fx-in">
        {t.edit.key === e.key ? <EditBox t={t} />
          : <Clamp max={88} measureKey={e.body}><div className="fx-text"><MentionedText text={e.body} mentions={t.noteMentions} /></div></Clamp>}
        {t.confirming === e.key && <DeleteConfirm t={t} entryKey={e.key} what={e.replies.length ? 'cette note et ses réponses' : 'cette note'} />}
        {!e._pending && (
          <footer className="fx-foot">
            <Reactions list={e.reactions || []} onToggle={(emoji) => t.reactNote(e, emoji)} />
            <button type="button" className="fx-answer" aria-expanded={t.replying === e.key} onClick={() => t.toggleReply(e.key)}
              title="Répondre en interne : le cabinet ne voit pas la réponse, l’auteur de la note est prévenu" {...t.ro}><CornerUpLeft size={14} />Répondre</button>
          </footer>
        )}
        {e.replies.length > 0 && <Replies note replies={e.replies} t={t} threadKey={e.key} openSignal={t.bump.key === e.key ? t.bump.n : 0} />}
        <AnimatePresence initial={false}>
          {t.replying === e.key && <InlineReply key={`reply-${t.replySeed.n}`} t={t} people={t.notePeople} initial={t.replySeed.text} placeholder={`Répondre en interne à ${firstName(authorOf(e))}…`} onSend={(body) => t.sendNoteReply(e, body)} />}
        </AnimatePresence>
      </div>
    </Motion.article>
  );
}

// Rappel des derniers échanges, hors de l'onglet (rubrique « Paiements ») : la finance lit le dernier mot, ou la
// note épinglée, sans changer de rubrique ; un clic ouvre le fil. `summary` vient de `onSummary`.
export function LastExchange({ summary, onOpen }) {
  if (!summary) return null;
  const { count, recent } = summary;
  return (
    <button type="button" className="fx fx-last" onClick={onOpen}>
      <span className="fx-last-top">
        <span className="fx-last-label">{recent[0]?.pinned ? 'Note épinglée' : count > 1 ? 'Derniers échanges' : 'Dernier échange'}</span>
        <span className="fx-last-go">{count ? `Voir ${count > 1 ? `les ${count} échanges` : 'l’échange'}` : 'Écrire'}<ArrowUpRight size={13} strokeWidth={2.2} /></span>
      </span>
      {recent.length ? recent.map((e, i) => (
        <span key={`${e.at}-${i}`} className="fx-last-row">
          <Avatar name={e.author} size={26} />
          <span className="fx-last-main">
            <span className="fx-last-who"><b>{e.author}</b><i className="fx-dot" /><span>{timeAgo(e.at)}</span>
              {e.internal && <span className="fx-tag"><Lock size={10} strokeWidth={2.2} />Interne</span>}</span>
            <span className="fx-last-text">{e.text}</span>
          </span>
        </span>
      )) : <span className="fx-last-none">Aucun échange pour ce client. Écrivez à Owner, au cabinet ou laissez une note interne.</span>}
    </button>
  );
}

const KINDS = [['all', 'Tout', 'échange'], ['comment', 'Messages', 'message'], ['rating', 'Météo', 'notation'], ['note', 'Interne', 'note interne']];
const plural = (n, unit) => `${n} ${unit.split(' ').map((w) => (n > 1 ? `${w}s` : w)).join(' ')}`;

export default function ExchangeThread({ numero, internal = null, onShowToast, onSummary }) {
  const me = useMemo(() => apiClient.getUser() || {}, []);
  const myName = me.full_name || me.email || 'Moi';
  const readOnly = isReadOnlyViewer(me.role);
  const ro = readOnly ? READ_ONLY_PROPS : {};
  const notesBase = internal?.clientId ? `/api/v1/finance-periods/client/${internal.clientId}/comments` : null;

  const [comments, setComments] = useState([]);
  const [reactions, setReactions] = useState({});
  const [ratings, setRatings] = useState([]);
  const [notes, setNotes] = useState([]);
  const [people, setPeople] = useState([]);
  // Annuaire des notes internes : la finance et la direction seulement. Vide si le serveur ne le sert pas encore.
  const [notePeople, setNotePeople] = useState([]);
  // État de chaque source : loading | ready | error | off (pas de numéro client ou pas de fil interne).
  const [shared, setShared] = useState(numero ? 'loading' : 'off');
  const [notesState, setNotesState] = useState(notesBase ? 'loading' : 'off');
  const [refresh, setRefresh] = useState(0);

  const [audience, setAudience] = useState('shared');
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [kind, setKind] = useState('all');
  const [limit, setLimit] = useState(STEP);
  const [replying, setReplying] = useState(null);
  // Texte de départ de la saisie de réponse (« @Auteur » quand on répond à une réponse précise) ; `n` la remonte.
  const [replySeed, setReplySeed] = useState({ text: '', n: 0 });
  const [bump, setBump] = useState({ key: null, n: 0 });
  const [edit, setEdit] = useState({ key: null, draft: '', saving: false, error: '' });
  const [confirming, setConfirming] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const fileInput = useRef(null);
  const rootRef = useRef(null);
  const sameId = (a, b) => String(a) === String(b);
  const composerId = `fx-composer-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  useEffect(() => {
    if (!numero) { setShared('off'); return undefined; }
    let alive = true;
    setShared('loading');
    const q = `numero_client=${encodeURIComponent(numero)}`;
    apiClient.get(`${SHARED}?${q}`)
      .then((r) => { if (alive) { setComments(r.comments || []); setReactions(r.reactions || {}); setShared('ready'); } })
      .catch(() => { if (alive) { setComments([]); setShared('error'); } });
    apiClient.get(`/api/v1/optilex/meteo-history?${q}`)
      .then((r) => { if (alive) setRatings(r.history || []); })
      .catch(() => { if (alive) setRatings([]); });
    return () => { alive = false; };
  }, [numero, refresh]);
  useEffect(() => {
    if (!notesBase) { setNotesState('off'); return undefined; }
    let alive = true;
    setNotesState('loading');
    apiClient.get(notesBase)
      .then((data) => { if (alive) { setNotes(sortNotes(Array.isArray(data?.comments) ? data.comments : Array.isArray(data) ? data : [])); setNotesState('ready'); } })
      .catch(() => { if (alive) { setNotes([]); setNotesState('error'); } });
    return () => { alive = false; };
  }, [notesBase, refresh]);
  useEffect(() => {
    let alive = true;
    apiClient.get(`${SHARED}/mentionables`)
      .then((r) => { if (alive) setPeople(r.people || []); })
      .catch(() => { /* sans annuaire, le fil reste utilisable sans complétion */ });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!notesBase) return undefined;
    let alive = true;
    apiClient.get('/api/v1/finance-periods/client/notes/mentionables')
      .then((r) => { if (alive) setNotePeople(Array.isArray(r?.people) ? r.people : []); })
      .catch(() => { /* sans annuaire, une note reste du texte simple */ });
    return () => { alive = false; };
  }, [notesBase]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 8000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => () => { setFiles((list) => { list.forEach((f) => f.thumb && URL.revokeObjectURL(f.thumb)); return list; }); }, []);

  // Sans espace commun (client hors board, fil indisponible), on n'écrit que des notes internes ; et l'inverse.
  const canShare = shared === 'ready';
  const canNote = notesState === 'ready';
  const mode = audience === 'shared' ? (canShare || !canNote ? 'shared' : 'note') : (canNote ? 'note' : 'shared');
  const loading = shared === 'loading' || notesState === 'loading';
  const canWrite = !readOnly && !loading && (mode === 'shared' ? canShare : canNote);

  const isRatingReply = (c) => c.rating_id && ratings.some((r) => r.id === c.rating_id);
  // Réponse à une note : seulement si sa note est encore là (sinon elle reste lisible comme une note).
  const isNoteReply = (n) => n.parent_id && notes.some((p) => sameId(p.id, n.parent_id) && !p.parent_id);
  const entries = useMemo(() => {
    const repliesOf = (field, id) => comments.filter((c) => c[field] === id).sort((a, b) => stamp(a.created_at) - stamp(b.created_at));
    const withActivity = (e) => ({ ...e, at: Math.max(stamp(e.created_at), ...e.replies.map((r) => stamp(r.created_at))) });
    return [
      ...comments.filter((c) => !c.parent_id && !isRatingReply(c)).map((c) => withActivity({ ...c, kind: 'comment', key: `c:${c.id}`, replies: repliesOf('parent_id', c.id) })),
      ...ratings.map((r) => withActivity({ ...r, kind: 'rating', key: `r:${r.id}`, replies: repliesOf('rating_id', r.id) })),
      ...notes.filter((n) => !isNoteReply(n)).map((n) => withActivity({ ...n, kind: 'note', key: `n:${n.id}`,
        replies: notes.filter((r) => sameId(r.parent_id, n.id)).sort((a, b) => stamp(a.created_at) - stamp(b.created_at)) })),
    ].sort((a, b) => (!!b.pinned - !!a.pinned) || b.at - a.at || a.key.localeCompare(b.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, ratings, notes]);

  // Résumé pour la fiche : nombre d'échanges (pastille de l'onglet) et le dernier, rappelé dans « Paiements ».
  const latest = useMemo(() => {
    if (loading) return null;
    const all = [
      ...comments.map((c) => ({ author: authorOf(c), at: c.created_at, text: c.body || (c.attachments?.length ? plural(c.attachments.length, 'pièce jointe') : ''), internal: false })),
      ...ratings.map((r) => ({ author: authorOf(r), at: r.created_at, text: [weatherRatingLabel(r.score, r.weather_context), r.note].filter(Boolean).join(' · '), internal: false })),
      ...notes.map((n) => ({ author: authorOf(n), at: n.created_at, text: n.body, internal: true, pinned: !!n.pinned })),
    ];
    return all.sort((a, b) => (!!b.pinned - !!a.pinned) || stamp(b.at) - stamp(a.at)).slice(0, 3);
  }, [loading, comments, ratings, notes]);
  const summaryKey = loading ? 'loading' : `${entries.length}|${(latest || []).map((e) => `${e.at}${e.text}${e.pinned ? 1 : 0}`).join('|')}`;
  useEffect(() => {
    onSummary?.(loading ? null : { count: entries.length, recent: latest });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryKey, onSummary]);

  const addFiles = (list) => {
    if (!canWrite || mode !== 'shared') return;
    const next = [...(list || [])];
    const big = next.find((f) => f.size > MESSAGE_FILE_MAX);
    setError(big ? `« ${big.name} » dépasse 20 Mo.` : '');
    setFiles((prev) => [...prev, ...next.filter((f) => f.size <= MESSAGE_FILE_MAX).map((f) => ({ key: `${f.name}-${f.size}-${f.lastModified}`, file: f,
      thumb: f.type.startsWith('image/') ? URL.createObjectURL(f) : null }))]
      .filter((f, i, all) => all.findIndex((o) => o.key === f.key) === i).slice(0, 10));
  };
  // Une capture d'écran collée devient une pièce jointe nommée avec la date ; le texte collé reste du texte.
  const pasteFiles = (e) => {
    const items = [...(e.clipboardData?.items || [])].filter((it) => it.kind === 'file');
    if (!items.length || mode !== 'shared') return;
    const when = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      .replace(/\//g, '-').replace(' ', ' à ').replace(':', ' h ');
    const pasted = items.map((it, i) => {
      const f = it.getAsFile();
      if (!f) return null;
      if (f.name && !/^image\.(png|jpe?g|gif|webp)$/i.test(f.name)) return f;
      const ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      return new File([f], `Capture du ${when}${i ? ` (${i + 1})` : ''}.${ext}`, { type: f.type, lastModified: Date.now() + i });
    }).filter(Boolean);
    if (!e.clipboardData.types.includes('text/plain')) e.preventDefault();
    addFiles(pasted);
  };
  const dropFile = (key) => setFiles((list) => list.filter((f) => { if (f.key === key && f.thumb) URL.revokeObjectURL(f.thumb); return f.key !== key; }));

  const submit = async () => {
    const body = draft.trim();
    if (!canWrite || posting) return;
    if (mode === 'note') {
      if (!body) return;
      setPosting(true); setError('');
      try {
        const created = await apiClient.post(notesBase, { body, mentions: mentionedIds(body, notePeople) });
        if (!created?.id || !created?.body) throw new Error('Réponse incomplète');
        setNotes((prev) => sortNotes([created, ...prev.filter((n) => n.id !== created.id)]));
        setDraft('');
        setNotice(notifiedSummary(created.notified));
      } catch { setError('La note n’a pas été confirmée. Votre texte est conservé.'); }
      finally { setPosting(false); }
      return;
    }
    if (!body && !files.length) return;
    setPosting(true); setError('');
    try {
      // Les pièces partent d'abord (en attente côté serveur), puis le message les rattache.
      const uploaded = [];
      for (const f of files) uploaded.push(await uploadMessageFile(numero, f.file));
      const created = await apiClient.post(SHARED, { numero_client: numero, body, mentions: mentionedIds(body, people), attachment_ids: uploaded.map((u) => u.id) });
      setComments((prev) => [{ ...created, attachments: created.attachments?.length ? created.attachments : uploaded }, ...prev]);
      setDraft('');
      setFiles((list) => { list.forEach((f) => f.thumb && URL.revokeObjectURL(f.thumb)); return []; });
      setNotice(notifiedSummary(created.notified));
    } catch { setError('Le message n’a pas pu être publié. Votre texte et vos fichiers sont conservés.'); }
    finally { setPosting(false); }
  };

  // Réaction : affichée tout de suite, puis remplacée par la réponse du serveur (ou annulée s'il refuse).
  const react = async (target, id, emoji) => {
    if (readOnly) return;
    const key = `${target}:${id}`;
    const before = reactions[key] || [];
    setReactions((all) => ({ ...all, [key]: toggledReactions(all[key], emoji, myName) }));
    try {
      const r = await apiClient.post(`${SHARED}/reactions`, { target, target_id: id, emoji });
      if (Array.isArray(r?.reactions)) setReactions((all) => ({ ...all, [key]: r.reactions }));
    } catch {
      setReactions((all) => ({ ...all, [key]: before }));
      setError('La réaction n’a pas pu être enregistrée.');
    }
  };
  // Réaction sur une note interne ou sa réponse : même geste, sa propre route.
  const reactNote = async (note, emoji) => {
    if (readOnly || !notesBase) return;
    const before = note.reactions || [];
    const swap = (list) => setNotes((prev) => prev.map((n) => (sameId(n.id, note.id) ? { ...n, reactions: list } : n)));
    swap(toggledReactions(before, emoji, myName));
    try {
      const r = await apiClient.post(`${notesBase}/${note.id}/reactions`, { emoji });
      if (Array.isArray(r?.reactions)) swap(r.reactions);
    } catch {
      swap(before);
      setError('La réaction n’a pas pu être enregistrée.');
    }
  };
  // Répondre sous un message ou une météo : son auteur est prévenu comme une mention, le fil s'ouvre et remonte.
  const sendReply = async (target, parent, body) => {
    if (readOnly) return false;
    setError('');
    try {
      const mail = (parent.author_email || '').toLowerCase();
      const author = people.find((p) => mail && (p.email || '').toLowerCase() === mail);
      const ids = [...new Set([...mentionedIds(body, people), ...(author && mail !== (me.email || '').toLowerCase() ? [author.id] : [])])];
      const link = target === 'rating' ? { rating_id: parent.id } : { parent_id: parent.id };
      const created = await apiClient.post(SHARED, { numero_client: numero, body, mentions: ids, ...link });
      setComments((prev) => [{ ...created, ...link, fresh: true }, ...prev]);
      setReplying(null);
      setBump((b) => ({ key: parent.key, n: b.n + 1 }));
      setNotice(notifiedSummary(created.notified));
      return true;
    } catch {
      setError('La réponse n’a pas pu être publiée. Votre texte est conservé.');
      return false;
    }
  };
  // Répondre sous une note interne : la réponse reste interne, le fil s'ouvre et remonte. L'auteur de la note et
  // les collègues mentionnés sont prévenus (e-mail et CRM).
  const sendNoteReply = async (parent, body) => {
    if (readOnly || !notesBase) return false;
    setError('');
    try {
      const mail = (parent.author_email || '').toLowerCase();
      const author = notePeople.find((p) => mail && (p.email || '').toLowerCase() === mail);
      const ids = [...new Set([...mentionedIds(body, notePeople), ...(author ? [author.id] : [])])];
      const created = await apiClient.post(notesBase, { body, parent_id: parent.id, mentions: ids });
      if (!created?.id || !created?.body) throw new Error('Réponse incomplète');
      setNotice(notifiedSummary(created.notified));
      setNotes((prev) => sortNotes([{ ...created, fresh: true }, ...prev.filter((n) => !sameId(n.id, created.id))]));
      setReplying(null);
      setBump((b) => ({ key: parent.key, n: b.n + 1 }));
      return true;
    } catch (e) {
      setError(e?.data?.detail || 'La réponse n’a pas été confirmée. Votre texte est conservé.');
      return false;
    }
  };
  // Le fil qui vient de remonter reste sous les yeux.
  useEffect(() => {
    if (!bump.n) return undefined;
    const timer = setTimeout(() => document.getElementById(`fx-${bump.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 320);
    return () => clearTimeout(timer);
  }, [bump]);

  const idOf = (key) => { const raw = key.slice(2); return /^\d+$/.test(raw) ? Number(raw) : raw; };
  const saveEdit = async () => {
    const body = edit.draft.trim();
    if (!body || edit.saving) return;
    const id = idOf(edit.key);
    setEdit((s) => ({ ...s, saving: true, error: '' }));
    try {
      if (edit.key.startsWith('n:')) {
        const updated = await apiClient.patch(`${notesBase}/${id}`, { body });
        if (!updated?.id || !updated?.body) throw new Error('Réponse incomplète');
        setNotes((prev) => sortNotes(prev.map((n) => (sameId(n.id, updated.id) ? updated : n))));
      } else {
        const updated = await apiClient.patch(`${SHARED}/${id}`, { body, mentions: mentionedIds(body, people) });
        setComments((prev) => prev.map((c) => (sameId(c.id, updated.id) ? { ...c, ...updated } : c)));
        setNotice(notifiedSummary(updated.notified));
      }
      setEdit({ key: null, draft: '', saving: false, error: '' });
    } catch (e) {
      setEdit((s) => ({ ...s, saving: false, error: e?.data?.detail || 'La modification n’a pas été enregistrée. Votre texte est conservé.' }));
    }
  };
  const remove = async (key) => {
    if (deleting) return;
    const id = idOf(key);
    setDeleting(key);
    try {
      if (key.startsWith('n:')) {
        await apiClient.delete(`${notesBase}/${id}`);
        setNotes((prev) => prev.filter((n) => !sameId(n.id, id) && !sameId(n.parent_id, id)));
      } else {
        await apiClient.delete(`${SHARED}/${id}`);
        setComments((prev) => prev.filter((c) => !sameId(c.id, id) && !sameId(c.parent_id, id)));
      }
      setConfirming(null);
    } catch { onShowToast?.(key.startsWith('n:') ? 'Erreur lors de la suppression' : 'Le commentaire n’a pas pu être supprimé.', 'error'); }
    finally { setDeleting(null); }
  };
  // Épinglage : affiché tout de suite, annulé si le serveur refuse.
  const togglePin = async (note) => {
    const next = !note.pinned;
    setNotes((prev) => sortNotes(prev.map((n) => (n.id === note.id ? { ...n, pinned: next, _pending: true } : n))));
    try {
      const updated = await apiClient.patch(`${notesBase}/${note.id}`, { pinned: next });
      setNotes((prev) => sortNotes(prev.map((n) => (n.id === note.id ? (updated?.id ? updated : { ...n, _pending: false }) : n))));
    } catch {
      setNotes((prev) => sortNotes(prev.map((n) => (n.id === note.id ? { ...n, pinned: !next, _pending: false } : n))));
      onShowToast?.('Erreur lors de l\'épinglage', 'error');
    }
  };

  const mine = (c) => (me.email || '').toLowerCase() === (c.author_email || '').toLowerCase();
  // Noms surlignés dans une note : l'annuaire interne, et soi-même (absent de son propre annuaire).
  const noteMentions = useMemo(() => [...notePeople, { id: me.id, name: myName }], [notePeople, me.id, myName]);
  const t = {
    readOnly, ro, people, notePeople, noteMentions, myName, react, reactNote, sendReply, sendNoteReply, replySeed, replying, bump, edit, confirming, deleting, saveEdit, remove, togglePin,
    canPin: !!internal?.canPin,
    canEdit: (c) => !readOnly && (c.can_edit || mine(c) || ['admin', 'ceo'].includes(me.role)),
    reactionsOf: (target, id) => reactions[`${target}:${id}`] || [],
    toggleReply: (key) => { if (readOnly) return; setReplySeed((s) => ({ text: '', n: s.n + 1 })); setReplying((k) => (k === key ? null : key)); },
    // Répondre à une réponse précise : la saisie du fil s'ouvre sur « @Auteur » s'il peut être mentionné.
    replyTo: (key, author, directory) => {
      if (readOnly) return;
      const person = (directory || []).find((p) => p.name === author);
      setReplySeed((s) => ({ text: person ? `@${person.name} ` : '', n: s.n + 1 }));
      setReplying(key);
    },
    cancelReply: () => setReplying(null),
    startEdit: (key, body) => { setEdit({ key, draft: body || '', saving: false, error: '' }); setConfirming(null); },
    setEditDraft: (value) => setEdit((s) => ({ ...s, draft: value })),
    cancelEdit: () => setEdit({ key: null, draft: '', saving: false, error: '' }),
    askDelete: (key) => { setConfirming(key); setEdit({ key: null, draft: '', saving: false, error: '' }); },
    cancelDelete: () => setConfirming(null),
  };

  // « @ » et emoji : insérés au curseur ; la liste des personnes s'ouvre comme à la frappe.
  const insert = (text, spaced) => {
    const el = document.getElementById(composerId);
    const pos = el ? (el.selectionStart ?? draft.length) : draft.length;
    const before = draft.slice(0, pos);
    const sep = spaced && before && !/\s$/.test(before) ? ' ' : '';
    setDraft(`${before}${sep}${text}${draft.slice(pos)}`);
    requestAnimationFrame(() => { if (!el) return; el.focus(); const caret = pos + sep.length + text.length; el.setSelectionRange(caret, caret); });
  };
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

  const counts = { all: entries.length, comment: 0, rating: 0, note: 0 };
  entries.forEach((e) => { counts[e.kind] += 1; });
  const filters = KINDS.filter(([k]) => k === 'all' || counts[k] > 0);
  const activeKind = counts[kind] ? kind : 'all';
  const unit = KINDS.find(([k]) => k === activeKind)[2];
  const visible = activeKind === 'all' ? entries : entries.filter((e) => e.kind === activeKind);
  const shown = visible.slice(0, limit);
  const older = visible.slice(limit);
  const nextBatch = Math.min(STEP, older.length);
  const noteMode = mode === 'note';
  const sendOff = !canWrite || posting || (noteMode ? !draft.trim() : (!draft.trim() && !files.length));

  return (
    <div ref={rootRef} className="fx">
      <div className={`fx-composer${dragging ? ' is-drag' : ''}${noteMode ? ' is-note' : ''}`}
        onDragEnter={(e) => { if (!noteMode && e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDragging(true); } }}
        onDragOver={(e) => { if (!noteMode && e.dataTransfer?.types?.includes('Files')) e.preventDefault(); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
        onDrop={(e) => { if (noteMode || !e.dataTransfer?.files?.length) return; e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}>
        <MentionTextarea id={composerId} value={draft} onChange={setDraft} people={noteMode ? notePeople : people} rows={2} className="fx-ta" maxLength={4000}
          aria-label={noteMode ? 'Note interne finance' : 'Message de l’espace commun'} onPaste={pasteFiles}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
          placeholder={noteMode ? 'Note pour la finance : promesse de règlement, retour du cabinet…' : `Écrire à Owner, Opti’Lex et la finance… (collez une image avec ${isMac ? '⌘' : 'Ctrl'} V)`}
          {...ro} />
        <ComposerFiles files={files} disabled={posting} onRemove={dropFile} />
        <div className="fx-bar">
          <button type="button" className="fx-tool" onClick={() => insert('@', true)} disabled={(noteMode && !notePeople.length) || !canWrite} aria-label="Mentionner quelqu’un"
            title={noteMode ? 'Mentionner un collègue de la finance : il reçoit un e-mail et une notification' : 'Mentionner quelqu’un : il reçoit un e-mail et une notification'} {...ro}><AtSign size={16} /></button>
          <button type="button" className="fx-tool" onClick={() => fileInput.current?.click()} disabled={noteMode || !canWrite || posting} aria-label="Joindre des fichiers"
            title={noteMode ? 'Une note interne n’accepte pas de pièce jointe' : 'Joindre des fichiers (PDF, image, e-mail, audio · 20 Mo au plus) ou les glisser ici'} {...ro}><Paperclip size={16} /></button>
          {readOnly
            ? <button type="button" className="fx-tool" aria-label="Insérer un emoji" {...READ_ONLY_PROPS}><Smile size={16} /></button>
            : <EmojiPalette label="Insérer un emoji" className="fx-tool" onPick={(emoji) => insert(emoji, false)}><Smile size={16} /></EmojiPalette>}
          <input ref={fileInput} type="file" hidden multiple accept={MESSAGE_FILE_ACCEPT} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          {notesBase && numero && (
            <div className="fx-aud" role="group" aria-label="À qui écrire">
              {[['shared', 'Partagé', Users, canShare, 'Visible par Owner, le cabinet Opti’Lex et la finance'],
                ['note', 'Interne', Lock, canNote && !files.length, files.length ? 'Retirez les pièces jointes : une note interne n’en accepte pas' : 'Note visible par la finance seulement']].map(([k, label, Icon, on, title]) => (
                <button key={k} type="button" aria-pressed={mode === k} className={mode === k ? 'is-on' : ''} disabled={!on && mode !== k} title={title} onClick={() => setAudience(k)}>
                  {mode === k && <Motion.span layoutId={`${composerId}-aud`} className="fx-aud-thumb" transition={SPRING} />}
                  <span><Icon size={12} strokeWidth={2.1} />{label}</span>
                </button>
              ))}
            </div>
          )}
          <span className="fx-hint" aria-hidden="true">{isMac ? '⌘' : 'Ctrl'} Entrée</span>
          <button type="button" className="fx-send" onClick={submit} disabled={sendOff} {...ro}>{posting ? 'Envoi…' : noteMode ? 'Noter' : 'Envoyer'}</button>
        </div>
      </div>
      <p className="fx-scope">
        {noteMode
          ? <><Lock size={12} strokeWidth={2.1} />Note interne : seule la finance la voit, jamais le cabinet. @ prévient un collègue par e-mail et notification.</>
          : <><Users size={12} strokeWidth={2.1} />Visible par Owner, le cabinet Opti’Lex et la finance. @ prévient par e-mail et notification.</>}
      </p>
      <AnimatePresence>
        {notice && <Motion.p key="notice" role="status" className="fx-notice" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{notice}</Motion.p>}
      </AnimatePresence>
      {error && <p role="alert" className="fx-error">{error}</p>}
      {shared === 'error' && <p role="alert" className="fx-error">L’espace commun n’a pas pu être chargé. <button type="button" onClick={() => setRefresh((v) => v + 1)}>Réessayer</button></p>}
      {notesState === 'error' && <p role="alert" className="fx-error">Les notes internes n’ont pas pu être chargées. Votre texte est conservé. <button type="button" onClick={() => setRefresh((v) => v + 1)}>Réessayer</button></p>}

      {loading ? <p className="fx-empty">Chargement des échanges…</p>
        : !entries.length ? <p className="fx-empty">Aucun échange pour le moment.</p>
        : (
          <div className="fx-count-bar">
            <span className="fx-count">{plural(visible.length, unit)}</span>
            {filters.length > 2 && (
              <div className="fx-seg" role="group" aria-label="Filtrer les échanges">
                {filters.map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={activeKind === k} className={activeKind === k ? 'is-on' : ''} onClick={() => { setKind(k); setLimit(STEP); }}>
                    {activeKind === k && <Motion.span layoutId={`${composerId}-kind`} className="fx-seg-thumb" transition={SPRING} />}
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

      {/* Pas d'animation de mise en page sur la liste : au « Réduire », les cartes mesurées pendant que la liste
          rétrécit restaient écrasées (retour finance 18/09/2026). Elles entrent et sortent en fondu. */}
      {!loading && (
        <div className="fx-list">
          <AnimatePresence initial={false}>
            {shown.map((e) => (e.kind === 'rating' ? <WeatherCard key={e.key} e={e} t={t} />
              : e.kind === 'note' ? <NoteCard key={e.key} e={e} t={t} />
              : <MessageCard key={e.key} e={e} t={t} />))}
          </AnimatePresence>
        </div>
      )}

      {!loading && (older.length > 0 ? (
        <button type="button" className="fx-more" onClick={() => setLimit((l) => l + STEP)}>
          <AvatarStack names={older.slice(0, STEP).map(authorOf)} size={20} max={3} />
          Voir {nextBatch > 1 ? `les ${nextBatch} précédents` : 'le précédent'}
          {older.length > nextBatch && <span className="fx-more-n">sur {older.length}</span>}
        </button>
      ) : visible.length > STEP && (
        <button type="button" className="fx-more" onClick={() => { setLimit(STEP); rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Réduire</button>
      ))}
    </div>
  );
}
