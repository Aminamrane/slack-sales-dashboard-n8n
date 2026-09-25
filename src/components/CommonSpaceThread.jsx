// CommonSpaceThread.jsx : l'espace commun Owner / Opti'Lex / finance d'un client, hors du board.
//
// Même fil que la section « Échanges et notations » du board (GET/POST/PATCH /api/v1/optilex/comments) :
// ce que l'on écrit ici est visible par le cabinet. Le fil interne finance (client_finance_comment) reste
// distinct et privé. Mentions « @ » : la personne mentionnée reçoit un e-mail et une notification CRM
// (et une notification Opti'Lex pour le cabinet), le serveur s'en charge.
//
// Demande dev 2026-09-25 : Aurélie (finance_team) doit pouvoir répondre depuis sa page finance.
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { Users } from 'lucide-react';
import apiClient from '../services/apiClient';
import MentionTextarea, { MentionedText } from './MentionTextarea.jsx';
import { mentionedIds, notifiedSummary } from '../utils/mentions.js';

const C = { text: '#37352f', muted: '#787774', faint: '#9b9a97', border: '#e9e9e7', borderSoft: '#f1f1ef', navy: '#121b35', green: '#3e7d5a', soft: '#e9eef6' };
const PREVIEW = 2;
const AVATAR_COLORS = [['#e3f1ec', '#1f6b4e'], ['#e9eef6', '#121b35'], ['#fdf0e1', '#9a5b13'], ['#efe6fa', '#5b3a8e'], ['#e6f0fb', '#1d4f8a']];

export function timeAgo(iso, now = Date.now()) {
  if (!iso) return '';
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(String(iso)) ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.round((now - date.getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return date.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function Avatar({ name }) {
  const label = String(name || '?').trim();
  const initials = label.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
  const [bg, fg] = AVATAR_COLORS[[...label].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: bg, color: fg, fontSize: 10.5, fontWeight: 700, userSelect: 'none' }}>{initials}</span>;
}

const textareaStyle = { width: '100%', border: 'none', outline: 'none', resize: 'vertical', background: 'transparent', fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit', color: C.text, minHeight: 38, boxSizing: 'border-box' };
const buttonStyle = (enabled) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 12px', border: 'none', borderRadius: 6, background: enabled ? C.navy : '#e9e9e7', color: enabled ? '#fff' : C.faint, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: enabled ? 'pointer' : 'default', transition: 'background 0.15s, color 0.15s' });

export default function CommonSpaceThread({ numero, onShowToast, title = "Espace commun Owner / Opti'Lex" }) {
  const me = useMemo(() => apiClient.getUser() || {}, []);
  const [comments, setComments] = useState(null);      // null = chargement
  const [unavailable, setUnavailable] = useState(false); // client hors board ou fil indisponible : bloc masqué
  const [people, setPeople] = useState([]);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!numero) return undefined;
    let alive = true;
    setComments(null); setUnavailable(false); setExpanded(false); setEditingId(null);
    apiClient.get(`/api/v1/optilex/comments?numero_client=${encodeURIComponent(numero)}`)
      .then((r) => { if (alive) setComments(r.comments || []); })
      .catch(() => { if (alive) { setUnavailable(true); setComments([]); } });
    return () => { alive = false; };
  }, [numero]);
  useEffect(() => {
    let alive = true;
    apiClient.get('/api/v1/optilex/comments/mentionables')
      .then((r) => { if (alive) setPeople(r.people || []); })
      .catch(() => { /* sans annuaire : pas de complétion, le fil reste utilisable */ });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 8000);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!numero || unavailable) return null;

  const submit = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const created = await apiClient.post('/api/v1/optilex/comments', { numero_client: numero, body, mentions: mentionedIds(body, people) });
      setComments((prev) => [created, ...(prev || [])]);
      setDraft('');
      setNotice(notifiedSummary(created.notified));
    } catch (e) {
      onShowToast?.(e?.data?.detail || "Le commentaire n'a pas pu être publié. Votre texte est conservé.", 'error');
    } finally {
      setPosting(false);
    }
  };
  const saveEdit = async () => {
    const body = editDraft.trim();
    if (!body || saving) return;
    setSaving(true);
    try {
      const updated = await apiClient.patch(`/api/v1/optilex/comments/${editingId}`, { body, mentions: mentionedIds(body, people) });
      setComments((prev) => (prev || []).map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
      setEditingId(null); setEditDraft('');
      setNotice(notifiedSummary(updated.notified));
    } catch (e) {
      onShowToast?.(e?.data?.detail || "Le commentaire n'a pas pu être modifié.", 'error');
    } finally {
      setSaving(false);
    }
  };
  const deleteComment = async (id) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await apiClient.delete(`/api/v1/optilex/comments/${id}`);
      setComments((prev) => (prev || []).filter((c) => c.id !== id));
      setConfirmDeleteId(null);
    } catch (e) {
      onShowToast?.(e?.data?.detail || "Le commentaire n'a pas pu être supprimé.", 'error');
    } finally {
      setDeletingId(null);
    }
  };
  const canEdit = (c) => !!c.can_edit || (!!me.email && (c.author_email || '').toLowerCase() === me.email.toLowerCase()) || ['admin', 'ceo'].includes(me.role);
  const list = comments || [];
  const shown = expanded ? list : list.slice(0, PREVIEW);

  return (
    <section aria-label={title} style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '0 0 6px' }}>
        <h2 style={{ fontSize: 11, fontWeight: 600, color: C.muted, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Users size={12} strokeWidth={2} aria-hidden="true" />{title}
        </h2>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: C.green, background: '#e3f1ec', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>Visible par le cabinet</span>
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: C.faint, lineHeight: 1.45 }}>
        Le même fil que le board Owner / Opti'Lex. Tapez @ pour prévenir quelqu'un : il reçoit un e-mail et une notification.
      </p>

      <div style={{ border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: '10px 12px', marginBottom: list.length ? 10 : 0 }}>
        <MentionTextarea value={draft} onChange={setDraft} people={people} rows={2}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(); } }}
          placeholder="Répondre dans l'espace commun… (@ pour mentionner quelqu'un)" style={textareaStyle} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
          <span style={{ fontSize: 10.5, color: C.faint }}>⌘ + Entrée pour publier</span>
          <button type="button" onClick={submit} disabled={!draft.trim() || posting} style={buttonStyle(!!draft.trim() && !posting)}>
            {posting ? 'Envoi…' : 'Publier'}
          </button>
        </div>
      </div>
      {notice && <p role="status" style={{ margin: '0 0 10px', fontSize: 12, color: C.green }}>{notice}</p>}

      {comments === null ? (
        <div style={{ height: 52, background: '#f3f4f6', borderRadius: 10 }} />
      ) : list.length === 0 ? (
        <div style={{ padding: '10px 12px', fontSize: 12.5, color: C.faint, fontStyle: 'italic' }}>Aucun échange dans l'espace commun pour ce client.</div>
      ) : (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
            <AnimatePresence initial={false}>
              {shown.map((c) => (
                <Motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexShrink: 0, padding: '10px 12px', border: `1px solid ${C.borderSoft}`, borderRadius: 10, background: '#fff' }}>
                  <Avatar name={c.author_name || c.author_email} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{c.author_name || c.author_email || 'Inconnu'}</span>
                      <span style={{ fontSize: 11, color: C.faint, whiteSpace: 'nowrap' }}>{timeAgo(c.created_at)}{c.updated_at ? ' · modifié' : ''}</span>
                      {canEdit(c) && editingId !== c.id && (
                        <button type="button" onClick={() => { setEditingId(c.id); setEditDraft(c.body); }}
                          style={{ border: 'none', background: 'transparent', color: C.faint, cursor: 'pointer', padding: '0 2px', fontSize: 11, fontFamily: 'inherit' }}>
                          Modifier
                        </button>
                      )}
                      {canEdit(c) && editingId !== c.id && confirmDeleteId !== c.id && (
                        <button type="button" onClick={() => setConfirmDeleteId(c.id)}
                          style={{ border: 'none', background: 'transparent', color: C.faint, cursor: 'pointer', padding: '0 2px', fontSize: 11, fontFamily: 'inherit' }}>
                          Supprimer
                        </button>
                      )}
                      {confirmDeleteId === c.id && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.text }}>
                          Supprimer ce commentaire ?
                          <button type="button" onClick={() => setConfirmDeleteId(null)}
                            style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, borderRadius: 6, padding: '1px 7px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
                          <button type="button" onClick={() => deleteComment(c.id)} disabled={deletingId === c.id}
                            style={{ border: 'none', background: '#b91c1c', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {deletingId === c.id ? '…' : 'Supprimer'}
                          </button>
                        </span>
                      )}
                    </div>
                    {editingId === c.id ? (
                      <div style={{ marginTop: 6 }}>
                        <MentionTextarea value={editDraft} onChange={setEditDraft} people={people} rows={2} autoFocus
                          onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); saveEdit(); }
                            if (e.key === 'Escape') { setEditingId(null); setEditDraft(''); }
                          }}
                          style={{ ...textareaStyle, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 8px' }} />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                          <button type="button" onClick={() => { setEditingId(null); setEditDraft(''); }}
                            style={{ ...buttonStyle(true), background: 'transparent', color: C.muted, border: `1px solid ${C.border}` }}>Annuler</button>
                          <button type="button" onClick={saveEdit} disabled={!editDraft.trim() || saving} style={buttonStyle(!!editDraft.trim() && !saving)}>
                            {saving ? '…' : 'Enregistrer'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: 3, fontSize: 13, lineHeight: 1.5, color: C.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        <MentionedText text={c.body} mentions={c.mentions} />
                      </div>
                    )}
                  </div>
                </Motion.div>
              ))}
            </AnimatePresence>
          </div>
          {list.length > PREVIEW && (
            <button type="button" onClick={() => setExpanded((v) => !v)}
              style={{ marginTop: 6, border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 2px', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: C.muted }}>
              {expanded ? 'Réduire' : `Voir les ${list.length - PREVIEW} échanges précédents`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
