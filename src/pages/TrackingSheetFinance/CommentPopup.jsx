// CommentPopup.jsx — Notion-style comment popup for a single (row, field) cell.
//
// Wired to the backend (Phase commentaires, 2026-05-08) :
//   GET    /api/v1/finance-periods/{periodRowId}/comments?field_name={fieldName}
//   POST   /api/v1/finance-periods/{periodRowId}/comments  body { field_name, content }
//   PATCH  /api/v1/finance-periods/{periodRowId}/comments/{commentId}  body { content }
//   DELETE /api/v1/finance-periods/{periodRowId}/comments/{commentId}
//
// Visual reference : Notion's per-cell comment popup. Pinned to the cell via
// `anchorRect` (no portal repositioning logic — the popup is rendered as a
// portal on document.body with absolute coords). Click-outside / ESC closes.
//
// Permissions :
//   - Anyone with finance access (gated upstream) can read all comments and add.
//   - Edit / delete : only the author (matched on `author_user_id === currentUser.id`).
//   - Backend returns 403 on PATCH/DELETE if not author — we hide the menu
//     upstream to avoid the 403 round-trip.
//
// MVP scope :
//   - Paperclip / @ mention icons in the composer are visual-only (no handler).
//   - No "Copy link" action in the per-comment menu (cf. brief).
//   - Edit + Delete only.
//   - No row-preview header (`📁 Personne assi... : @Youcef Amrane`) — added later.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUp, Paperclip, AtSign, MoreHorizontal, Pencil, Trash2,
  Loader2, AlertCircle,
} from 'lucide-react';
import apiClient from '../../services/apiClient.js';

// ── Notion palette (kept in sync with TableView.jsx N constant) ──────────
const N = {
  pageBg:    '#ffffff',
  bg:        '#ffffff',
  border:    '#e9e9e7',
  borderSft: '#e3e2e0',
  text:      '#37352f',
  textMuted: '#787774',
  textFaint: '#9b9a97',
  accent:    '#2383e2',
  red:       '#b74133',
  redBg:     '#ffe2dd',
  hover:     '#f7f7f5',
};

// 8 deterministic avatar colors (mirror existing pattern from LeadsManagement).
const AVATAR_PALETTE = [
  { bg: '#dbeafe', fg: '#1e40af' }, // blue
  { bg: '#fee2e2', fg: '#991b1b' }, // red
  { bg: '#d1fae5', fg: '#065f46' }, // green
  { bg: '#eae4f2', fg: '#6940a5' }, // purple
  { bg: '#fef3c7', fg: '#92400e' }, // amber
  { bg: '#f4dfeb', fg: '#ad1a72' }, // pink
  { bg: '#cffafe', fg: '#0e7490' }, // teal
];

function avatarColorFor(seed) {
  if (!seed) return AVATAR_PALETTE[0];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function initialsOf(fullName) {
  if (!fullName) return '?';
  const parts = String(fullName).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// "À l'instant" / "Il y a 5 min" / "Hier 14h32" / "12 mars 14h32".
function relativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24 && now.getDate() === d.getDate()) {
    return `Aujourd'hui ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Hier ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
  }
  // Same year → short date ; older → full date
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  }) + ` ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════
export default function CommentPopup({
  open,
  periodRowId,
  fieldName,
  anchorRect,     // DOMRect from the trigger button (getBoundingClientRect)
  onClose,
  currentUser,    // { id, full_name, name, first_name, email }
  onCountChange,  // (count: number) => void — pour updater le cache pastille
  onError,        // (msg: string) => void — toast côté parent
}) {
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');

  const currentUserId = currentUser?.id || null;

  // ── Fetch comments on open ───────────────────────────────────────────
  useEffect(() => {
    if (!open || !periodRowId || !fieldName) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const data = await apiClient.get(
          `/api/v1/finance-periods/${encodeURIComponent(periodRowId)}/comments?field_name=${encodeURIComponent(fieldName)}`
        );
        if (cancelled) return;
        const list = Array.isArray(data?.comments) ? data.comments : [];
        setComments(list);
        onCountChange?.(list.length);
      } catch (e) {
        if (cancelled) return;
        const msg = e?.data?.detail || e?.message || 'Erreur de chargement';
        setError(typeof msg === 'string' ? msg : 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // onCountChange volontairement exclu des deps : si recréé à chaque render
    // parent (pas useCallback), le useEffect re-fire en boucle infinie, loading
    // reste bloqué true, comments invisibles. Bug fix 2026-05-11.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, periodRowId, fieldName]);

  // ── Click outside + ESC ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      // Ignore clicks on the comment trigger button (handled by parent).
      if (e.target.closest?.('[data-tsf-comment-trigger]')) return;
      if (panelRef.current?.contains(e.target)) return;
      // Ignore clicks on the @ mention dropdown (portalisée hors du panel).
      if (e.target.closest?.('[data-tsf-mention-dropdown]')) return;
      onClose?.();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        // If editing → cancel edit instead of closing the whole popup.
        if (editingId) {
          setEditingId(null);
          setEditDraft('');
          return;
        }
        onClose?.();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, editingId]);

  // ── Autofocus composer on open (when no comments yet) ───────────────
  useEffect(() => {
    if (!open) return;
    // Slight delay so the portal is mounted before we focus.
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // ── Submit new comment ───────────────────────────────────────────────
  const submitNew = useCallback(async () => {
    const content = draft.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await apiClient.post(
        `/api/v1/finance-periods/${encodeURIComponent(periodRowId)}/comments`,
        { field_name: fieldName, content }
      );
      setComments((prev) => {
        const next = [...prev, created];
        onCountChange?.(next.length);
        return next;
      });
      setDraft('');
    } catch (e) {
      const msg = e?.data?.detail || e?.message || 'Erreur lors de l\'envoi';
      onError?.(typeof msg === 'string' ? msg : 'Erreur lors de l\'envoi');
    } finally {
      setSubmitting(false);
    }
  }, [draft, submitting, periodRowId, fieldName, onCountChange, onError]);

  // ── Edit / save an existing comment ─────────────────────────────────
  const beginEdit = useCallback((c) => {
    setEditingId(c.id);
    setEditDraft(c.content);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft('');
  }, []);

  const saveEdit = useCallback(async (commentId) => {
    const content = editDraft.trim();
    if (!content) {
      cancelEdit();
      return;
    }
    try {
      const updated = await apiClient.patch(
        `/api/v1/finance-periods/${encodeURIComponent(periodRowId)}/comments/${encodeURIComponent(commentId)}`,
        { content }
      );
      setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, ...updated } : c));
      cancelEdit();
    } catch (e) {
      const msg = e?.data?.detail || e?.message || 'Erreur lors de la modification';
      onError?.(typeof msg === 'string' ? msg : 'Erreur lors de la modification');
    }
  }, [editDraft, periodRowId, cancelEdit, onError]);

  // ── Delete a comment ─────────────────────────────────────────────────
  const removeComment = useCallback(async (commentId) => {
    if (!window.confirm('Supprimer ce commentaire ?')) return;
    try {
      await apiClient.delete(
        `/api/v1/finance-periods/${encodeURIComponent(periodRowId)}/comments/${encodeURIComponent(commentId)}`
      );
      setComments((prev) => {
        const next = prev.filter((c) => c.id !== commentId);
        onCountChange?.(next.length);
        return next;
      });
    } catch (e) {
      const msg = e?.data?.detail || e?.message || 'Erreur lors de la suppression';
      onError?.(typeof msg === 'string' ? msg : 'Erreur lors de la suppression');
    }
  }, [periodRowId, onCountChange, onError]);

  // ── Position calculation ─────────────────────────────────────────────
  // Popup anchored under the trigger ; clamped to viewport so it never
  // overflows on the right or bottom.
  const popupStyle = useMemo(() => {
    if (!anchorRect) return null;
    const POPUP_WIDTH = 360;
    const POPUP_MAX_HEIGHT = 420;
    const MARGIN = 8;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // Align right edge of popup with right edge of trigger (Notion-style).
    let left = anchorRect.right - POPUP_WIDTH;
    if (left < MARGIN) left = MARGIN;
    if (left + POPUP_WIDTH > viewportW - MARGIN) left = viewportW - POPUP_WIDTH - MARGIN;

    let top = anchorRect.bottom + 6;
    // If not enough space below → flip above.
    if (top + POPUP_MAX_HEIGHT > viewportH - MARGIN) {
      const above = anchorRect.top - POPUP_MAX_HEIGHT - 6;
      if (above > MARGIN) top = above;
      else top = Math.max(MARGIN, viewportH - POPUP_MAX_HEIGHT - MARGIN);
    }

    return {
      position: 'fixed',
      top,
      left,
      width: POPUP_WIDTH,
      maxHeight: POPUP_MAX_HEIGHT,
      zIndex: 1500,
    };
  }, [anchorRect]);

  if (!open || !popupStyle) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="comment-popup"
        ref={panelRef}
        initial={{ opacity: 0, y: -4, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.98 }}
        transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
        style={{
          ...popupStyle,
          background: N.bg,
          border: `1px solid ${N.border}`,
          borderRadius: 6,
          boxShadow: '0 4px 16px rgba(15,15,15,0.08), 0 12px 32px rgba(15,15,15,0.06)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          color: N.text,
        }}
      >
        {/* Comments list */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: comments.length || loading || error ? '6px 0' : 0,
          }}
        >
          {/* Loading retiré 2026-05-11 (demande dev) : pas de "Chargement…"
              visible. La liste reste vide pendant le fetch, l'input du composer
              en bas est visible immédiatement (capture #15). Quand la response
              arrive, les commentaires s'affichent direct. */}

          {error && !loading && (
            <div style={{
              margin: '10px 12px',
              padding: '8px 10px',
              background: N.redBg,
              border: `1px solid ${N.red}33`,
              borderRadius: 4,
              color: N.red,
              fontSize: 12.5,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <AlertCircle size={12} />
              {error}
            </div>
          )}

          {/* Liste commentaires — affichée dès que disponibles dans le state,
              indépendamment du flag loading (qui pouvait rester bloqué true
              et masquer la liste, bug fix 2026-05-11). */}
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              isOwn={!!currentUserId && c.author_user_id === currentUserId}
              isEditing={editingId === c.id}
              editDraft={editDraft}
              setEditDraft={setEditDraft}
              onBeginEdit={() => beginEdit(c)}
              onCancelEdit={cancelEdit}
              onSaveEdit={() => saveEdit(c.id)}
              onDelete={() => removeComment(c.id)}
            />
          ))}
        </div>

        {/* Inline keyframe for the spinner (avoid colliding with global @keyframes). */}
        <style>{`
          @keyframes tsfCommentSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .tsf-cm-row .tsf-cm-actions { opacity: 0; transition: opacity 0.12s; }
          .tsf-cm-row:hover .tsf-cm-actions { opacity: 1; }
        `}</style>

        {/* Composer */}
        <Composer
          inputRef={inputRef}
          value={draft}
          onChange={setDraft}
          onSubmit={submitNew}
          submitting={submitting}
          hasComments={comments.length > 0}
          currentUser={currentUser}
        />
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMMENT ITEM
// ════════════════════════════════════════════════════════════════════════════
function CommentItem({
  comment,
  isOwn,
  isEditing,
  editDraft,
  setEditDraft,
  onBeginEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef(null);

  const seed = comment.author_user_id || comment.author_full_name || comment.id;
  const palette = avatarColorFor(seed);
  const initials = initialsOf(comment.author_full_name);
  const isEdited = comment.created_at && comment.updated_at && comment.updated_at !== comment.created_at;

  return (
    <div
      className="tsf-cm-row"
      style={{
        position: 'relative',
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {/* Header : avatar + name + relative time + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 22, height: 22,
          flexShrink: 0,
          borderRadius: '50%',
          background: palette.bg,
          color: palette.fg,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10.5, fontWeight: 600,
          letterSpacing: '0.02em',
        }}>
          {initials}
        </span>
        <span style={{
          fontSize: 13, fontWeight: 600, color: N.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: 160,
        }}>
          {comment.author_full_name || 'Utilisateur'}
        </span>
        <span style={{ fontSize: 12, color: N.textFaint }}>
          {relativeTime(comment.created_at)}
          {isEdited ? ' (modifié)' : ''}
        </span>

        <div style={{ flex: 1 }} />

        {isOwn && !isEditing && (
          <div className="tsf-cm-actions" style={{ position: 'relative' }}>
            <button
              ref={menuTriggerRef}
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              title="Plus"
              style={{
                width: 22, height: 22,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', background: 'transparent', cursor: 'pointer',
                borderRadius: 3,
                color: N.textMuted,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = N.hover}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <CommentActionsMenu
                onClose={() => setMenuOpen(false)}
                onEdit={() => { onBeginEdit(); setMenuOpen(false); }}
                onDelete={() => { onDelete(); setMenuOpen(false); }}
              />
            )}
          </div>
        )}
      </div>

      {/* Body */}
      {isEditing ? (
        <div style={{ paddingLeft: 30, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea
            autoFocus
            value={editDraft}
            onChange={(e) => setEditDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSaveEdit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancelEdit();
              }
            }}
            rows={2}
            maxLength={2000}
            style={{
              width: '100%',
              resize: 'vertical',
              minHeight: 48,
              padding: '6px 8px',
              border: `1px solid ${N.accent}`,
              borderRadius: 4,
              outline: 'none',
              fontSize: 13,
              lineHeight: 1.4,
              color: N.text,
              fontFamily: 'inherit',
              background: '#fff',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <button
              type="button"
              onClick={onCancelEdit}
              style={miniBtnStyle(false)}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={!editDraft.trim()}
              style={miniBtnStyle(true, !editDraft.trim())}
            >
              Enregistrer
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          paddingLeft: 30,
          fontSize: 13.5,
          color: N.text,
          lineHeight: 1.45,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {comment.content}
        </div>
      )}
    </div>
  );
}

function miniBtnStyle(primary, disabled = false) {
  return {
    padding: '4px 10px',
    fontSize: 12.5,
    fontWeight: 500,
    border: primary ? 'none' : `1px solid ${N.borderSft}`,
    background: primary ? (disabled ? '#9bc2ed' : N.accent) : '#fff',
    color: primary ? '#fff' : N.text,
    borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  };
}

// ── Actions menu (Modifier / Supprimer) ─────────────────────────────────
function CommentActionsMenu({ onClose, onEdit, onDelete }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);
  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 2,
        minWidth: 140,
        background: '#fff',
        border: `1px solid ${N.border}`,
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(15,15,15,0.12)',
        zIndex: 10,
        padding: 4,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <MenuItem icon={<Pencil size={13} />} label="Modifier" onClick={onEdit} />
      <MenuItem icon={<Trash2 size={13} />} label="Supprimer" onClick={onDelete} danger />
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '6px 8px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        borderRadius: 4,
        fontSize: 13,
        color: danger ? N.red : N.text,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = danger ? N.redBg : N.hover}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {icon}
      {label}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMPOSER (input + paperclip + @ + send)
// ════════════════════════════════════════════════════════════════════════════
function Composer({ inputRef, value, onChange, onSubmit, submitting, hasComments, currentUser }) {
  const canSubmit = value.trim().length > 0 && !submitting;
  const [mentionOpen, setMentionOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionAnchor, setMentionAnchor] = useState(null); // DOMRect du composer
  const mentionWrapRef = useRef(null);
  const mentionBtnRef = useRef(null);
  const mentionDropdownRef = useRef(null);
  const composerWrapRef = useRef(null); // div parent du composer (input + boutons)
  const currentUserId = currentUser?.id || null;

  // Fetch users on first mention open (lazy)
  useEffect(() => {
    if (!mentionOpen || usersLoaded) return;
    (async () => {
      try {
        const data = await apiClient.get('/api/v1/users/assignable');
        const list = Array.isArray(data) ? data : (Array.isArray(data?.users) ? data.users : []);
        setUsers(list);
        setUsersLoaded(true);
      } catch {
        setUsersLoaded(true);
      }
    })();
  }, [mentionOpen, usersLoaded]);

  // Close mention dropdown on click outside (vérifie aussi le portal dropdown)
  useEffect(() => {
    if (!mentionOpen) return;
    const onDown = (e) => {
      const inBtn = mentionWrapRef.current?.contains(e.target);
      const inDropdown = mentionDropdownRef.current?.contains(e.target);
      if (!inBtn && !inDropdown) {
        setMentionOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [mentionOpen]);

  const insertMention = (user) => {
    const name = user?.full_name || user?.name || user?.email || 'utilisateur';
    // Si l'utilisateur a tapé `@` dans l'input puis cliqué un user, on REMPLACE
    // la portion `@xxx` en cours (depuis le dernier `@` après dernier espace)
    // par `@NomComplet `. Sinon (ouverture via bouton @), on append.
    const lastAt = value.lastIndexOf('@');
    const lastSpace = value.lastIndexOf(' ');
    let next;
    if (lastAt > lastSpace && lastAt !== -1) {
      // Mention en cours : remplacer la portion @xxx
      next = `${value.slice(0, lastAt)}@${name} `;
    } else if (value.endsWith(' ') || value === '') {
      next = `${value}@${name} `;
    } else {
      next = `${value} @${name} `;
    }
    onChange(next);
    setMentionOpen(false);
    setMentionFilter('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const filteredUsers = useMemo(() => {
    const q = mentionFilter.trim().toLowerCase();
    const list = !q ? users : users.filter((u) => {
      const haystack = `${u.full_name || ''} ${u.email || ''} ${u.name || ''}`.toLowerCase();
      return haystack.includes(q);
    });
    // Tri : user courant TOUJOURS en premier (style Notion)
    if (!currentUserId) return list;
    const me = list.find((u) => u.id === currentUserId);
    if (!me) return list;
    return [me, ...list.filter((u) => u.id !== currentUserId)];
  }, [users, mentionFilter, currentUserId]);

  return (
    <div style={{
      borderTop: hasComments ? `1px solid ${N.borderSft}` : 'none',
      padding: 8,
      display: 'flex',
      alignItems: 'flex-end',
      gap: 6,
      background: N.bg,
      position: 'relative',
    }}>
      <div ref={composerWrapRef} style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 6px',
        background: '#fff',
        border: `1px solid ${N.borderSft}`,
        borderRadius: 6,
        transition: 'border-color 0.12s',
      }}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.currentTarget.value;
            onChange(v);
            // Détecter @ en cours de frappe : ouvre la dropdown mention.
            // Mention "active" = dernier `@` après le dernier espace.
            const lastAt = v.lastIndexOf('@');
            const lastSpace = v.lastIndexOf(' ');
            if (lastAt > lastSpace && lastAt !== -1) {
              if (!mentionOpen) {
                const rect = composerWrapRef.current?.getBoundingClientRect();
                if (rect) setMentionAnchor({
                  left: rect.left, top: rect.top, right: rect.right,
                  bottom: rect.bottom, width: rect.width,
                });
                setMentionOpen(true);
              }
              setMentionFilter(v.slice(lastAt + 1));
            } else if (mentionOpen) {
              setMentionOpen(false);
              setMentionFilter('');
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (canSubmit) onSubmit();
            } else if (e.key === 'Escape' && mentionOpen) {
              e.preventDefault();
              setMentionOpen(false);
            }
          }}
          maxLength={2000}
          placeholder="Ajouter un commentaire..."
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            padding: '4px 4px',
            fontSize: 13.5,
            color: N.text,
            fontFamily: 'inherit',
          }}
          onFocus={(e) => e.currentTarget.parentElement.style.borderColor = N.accent}
          onBlur={(e) => e.currentTarget.parentElement.style.borderColor = N.borderSft}
        />
        {/* Paperclip : visuel MVP, non-fonctionnel */}
        <button
          type="button"
          title="Joindre un fichier (bientôt)"
          tabIndex={-1}
          style={composerIconBtnStyle}
          onClick={(e) => e.preventDefault()}
        >
          <Paperclip size={22} />
        </button>
        {/* @ Mention : fonctionnel (insère @Nom dans l'input) */}
        <div ref={mentionWrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
          <button
            ref={mentionBtnRef}
            type="button"
            title="Mentionner une personne"
            onClick={(e) => {
              e.preventDefault();
              if (!mentionOpen) {
                const rect = composerWrapRef.current?.getBoundingClientRect();
                setMentionAnchor(rect ? {
                  left: rect.left, top: rect.top, right: rect.right,
                  bottom: rect.bottom, width: rect.width,
                } : null);
              }
              setMentionOpen((v) => !v);
            }}
            style={{
              ...composerIconBtnStyle,
              background: mentionOpen ? N.sideHover || '#f1f1ef' : 'transparent',
            }}
          >
            <AtSign size={22} />
          </button>
          {mentionOpen && mentionAnchor && createPortal((
            <div
              ref={mentionDropdownRef}
              data-tsf-mention-dropdown="1"
              style={{
                position: 'fixed',
                // Dropdown EN DESSOUS du composer (style Notion capture #28)
                top: mentionAnchor.bottom + 6,
                left: mentionAnchor.left,
                width: mentionAnchor.width,
                maxHeight: 360,
                overflowY: 'auto',
                background: '#fff',
                border: 'none',
                borderRadius: 8,
                boxShadow: '0 6px 24px rgba(15,15,15,0.12), 0 1px 3px rgba(15,15,15,0.06)',
                zIndex: 100,
                padding: '8px 6px',
                fontFamily: 'inherit',
              }}
            >
              <div style={{
                padding: '4px 12px 8px',
                fontSize: 13,
                fontWeight: 500,
                color: N.textMuted,
              }}>
                Personnes
              </div>
              {!usersLoaded && (
                <div style={{ padding: '12px 8px', fontSize: 12, color: N.textMuted, textAlign: 'center' }}>
                  Chargement…
                </div>
              )}
              {usersLoaded && filteredUsers.length === 0 && (
                <div style={{ padding: '12px 8px', fontSize: 12, color: N.textMuted, textAlign: 'center' }}>
                  Aucun utilisateur trouvé
                </div>
              )}
              {usersLoaded && filteredUsers.map((u, idx) => {
                const name = u.full_name || u.name || u.email || '—';
                const initial = (name[0] || '?').toUpperCase();
                const isMe = !!currentUserId && u.id === currentUserId;
                const isFirst = idx === 0;
                return (
                  <button
                    key={u.id || u.email}
                    type="button"
                    onClick={() => insertMention(u)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      background: isFirst ? '#f1f1ef' : 'transparent',
                      borderRadius: 4,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f1f1ef'}
                    onMouseLeave={(e) => e.currentTarget.style.background = isFirst ? '#f1f1ef' : 'transparent'}
                  >
                    <span style={{
                      width: 26, height: 26,
                      borderRadius: '50%',
                      background: isMe ? '#6b6862' : '#e8e7e4',
                      color: isMe ? '#fff' : N.textMuted,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 600,
                      fontFamily: 'inherit',
                      flexShrink: 0,
                    }}>
                      {initial}
                    </span>
                    <span style={{
                      fontSize: 15,
                      color: N.text,
                      fontFamily: 'inherit',
                      fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {name}
                      {isMe && (
                        <span style={{ marginLeft: 6, color: N.textMuted, fontWeight: 400 }}>
                          (vous)
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ), document.body)}
        </div>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        title="Envoyer (Entrée)"
        style={{
          width: 30, height: 30,
          flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: 'none',
          background: canSubmit ? N.accent : '#cfd8e3',
          color: '#fff',
          borderRadius: '50%', // cercle parfait (capture #25)
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => { if (canSubmit) e.currentTarget.style.background = '#1a6fc2'; }}
        onMouseLeave={(e) => { if (canSubmit) e.currentTarget.style.background = N.accent; }}
      >
        {submitting
          ? <Loader2 size={14} style={{ animation: 'tsfCommentSpin 0.8s linear infinite' }} />
          : <ArrowUp size={15} strokeWidth={2.4} />}
      </button>
    </div>
  );
}

const composerIconBtnStyle = {
  width: 30, height: 30,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  color: N.textFaint,
  borderRadius: 4,
  cursor: 'pointer',
  flexShrink: 0,
};
