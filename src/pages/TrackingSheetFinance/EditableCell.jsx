// EditableCell.jsx — inline-edit primitives for the Tracking Finance table.
//
// Three flavors :
//   - <EditableNumber />  : amount input (Decimal-as-string, FR formatted)
//   - <EditableDate />    : <input type="date">
//   - <EditableSelect />  : portal-dropdown picker for enum fields
//
// Common behavior :
//   - Click → enters edit mode (input/select shows up, autoFocus + selectAll).
//   - Save on Enter or blur ; Escape cancels.
//   - On save, calls `onCommit(value)` which the parent wires to `apiClient.patch`.
//   - Visual feedback : "saved" green flash for 1s after a successful commit.
//
// All cells are scale-friendly : zero work on idle (just text rendering),
// editor mounted only when active.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Copy } from 'lucide-react';
import PortalDropdown from './components/PortalDropdown.jsx';
import {
  formatEUR,
  formatDateFR,
  toNumber,
  STATUS_DETAIL_COLORS,
  STATUS_DETAIL_FALLBACK,
} from './constants.js';

// ── Copy-to-clipboard helper ──────────────────────────────────────────────
// Petit bouton icône qui copie une valeur arbitraire dans le presse-papiers.
// Visible au hover du wrapper parent (cf. <CopyWrapper />).
// Garde le DOM léger : un seul <button> en absolute, no portal needed.
export const CopyButton = React.memo(function CopyButton({
  value,
  onCopied,
  size = 14,
  style = {},
}) {
  const [phase, setPhase] = useState('idle'); // idle | copied
  const timerRef = useRef(null);

  const onClick = useCallback(async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const text = value === null || value === undefined ? '' : String(value);
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Legacy fallback (no async clipboard in older browsers / non-https).
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setPhase('copied');
      onCopied?.(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setPhase('idle'), 900);
    } catch (err) {
      console.warn('[CopyButton] failed', err);
    }
  }, [value, onCopied]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      title="Copier"
      className="tsf-copy-btn"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size + 8,
        height: size + 8,
        padding: 0,
        background: phase === 'copied' ? '#dcfce7' : 'transparent',
        border: 'none',
        borderRadius: 4,
        color: phase === 'copied' ? '#166534' : '#787774',
        cursor: 'pointer',
        opacity: phase === 'copied' ? 1 : 0,
        transition: 'opacity 0.12s ease, background 0.12s ease, color 0.12s ease',
        fontFamily: 'inherit',
        ...style,
      }}
    >
      <Copy size={size} strokeWidth={1.8} />
    </button>
  );
});

// Wrapper qui révèle le bouton Copy au hover. Pose un `tsf-copy-wrap` data
// attribute pour le CSS qui pilote l'opacity du bouton (déclaré dans index.jsx).
// Si tu n'es pas dans le DOM `tsf-copy-wrap`, le bouton reste invisible.
export function CopyWrapper({ children, copyValue, onCopied, align = 'flex-start' }) {
  return (
    <span
      className="tsf-copy-wrap"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        justifyContent: align,
        position: 'relative',
        maxWidth: '100%',
        minWidth: 0,
      }}
    >
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        minWidth: 0,
        maxWidth: '100%',
      }}>
        {children}
      </span>
      {copyValue !== null && copyValue !== undefined && copyValue !== '' && (
        <CopyButton value={copyValue} onCopied={onCopied} />
      )}
    </span>
  );
}

const CELL_BASE = {
  cursor: 'pointer',
  minHeight: 28,
  borderRadius: 4,
  padding: '2px 6px',
  display: 'inline-flex',
  alignItems: 'center',
  transition: 'background 0.12s',
  fontSize: 13,
  lineHeight: 1.3,
  fontFamily: 'inherit',
};

// Visual states applied via inline style (avoids CSS-injection per cell).
const cellStyle = (state) => {
  switch (state) {
    case 'saving':
      return { ...CELL_BASE, background: '#fff7ed' };
    case 'saved':
      return { ...CELL_BASE, background: '#dcfce7', color: '#166534' };
    case 'error':
      return { ...CELL_BASE, background: '#fee2e2', color: '#991b1b' };
    default:
      return CELL_BASE;
  }
};

// Tiny hook : trigger a "saved" flash for `ms` after onCommit succeeds.
function useSaveFlash() {
  const [state, setState] = useState('idle'); // idle | saving | saved | error
  const timerRef = useRef(null);

  const flash = useCallback((next) => {
    setState(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (next === 'saved' || next === 'error') {
      timerRef.current = setTimeout(() => setState('idle'), 1200);
    }
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return [state, flash];
}

// ── Text ─────────────────────────────────────────────────────────────────
export const EditableText = React.memo(function EditableText({
  value,
  placeholder = '—',
  onCommit,
  width = '100%',
  disabled = false,
  placeholderItalic = false,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [state, flash] = useSaveFlash();
  const inputRef = useRef(null);

  const startEdit = useCallback(() => {
    if (disabled) return;
    setDraft(value || '');
    setEditing(true);
  }, [value, disabled]);

  const commit = useCallback(async (raw) => {
    const next = raw.trim() || null;
    const prev = value?.trim() || null;
    if (next === prev) { setEditing(false); return; }
    flash('saving');
    try {
      await onCommit(next);
      flash('saved');
    } catch (e) {
      flash('error');
      console.error('[EditableText] commit failed', e);
    }
    setEditing(false);
  }, [value, onCommit, flash]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        defaultValue={draft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
        }}
        onBlur={(e) => commit(e.currentTarget.value)}
        style={{
          width,
          padding: '2px 6px',
          fontSize: 13,
          fontFamily: 'inherit',
          border: 'none',
          borderRadius: 0,
          outline: 'none',
          background: 'transparent',
          color: '#111827',
        }}
      />
    );
  }

  const isEmpty = !value;
  return (
    <span
      onClick={(e) => { e.stopPropagation(); startEdit(); }}
      title={disabled ? '' : 'Cliquer pour modifier'}
      style={{
        ...cellStyle(state),
        width,
        color: isEmpty ? (placeholderItalic ? '#c7c7c2' : '#9ca3af') : '#111827',
        cursor: disabled ? 'default' : 'pointer',
        fontStyle: isEmpty && placeholderItalic ? 'italic' : 'normal',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '100%',
      }}
    >
      {isEmpty ? (placeholderItalic ? '' : placeholder) : value}
    </span>
  );
});

// ── Number ────────────────────────────────────────────────────────────────
export const EditableNumber = React.memo(function EditableNumber({
  value,
  placeholder = '—',
  onCommit,
  align = 'right',
  width = '100%',
  disabled = false,
  prefix = '',
  placeholderItalic = false,
  valueColor,      // override couleur (ex: vert pour Récupéré, rouge pour retard)
  valueBold,       // bool : valeur en gras
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [state, flash] = useSaveFlash();
  const inputRef = useRef(null);
  const lastClickRef = useRef(0);

  const display = formatEUR(value);

  const startEdit = useCallback(() => {
    if (disabled) return;
    setDraft(value === null || value === undefined || value === '' ? '' : String(value));
    setEditing(true);
  }, [value, disabled]);

  const commit = useCallback(async (raw) => {
    const trimmed = String(raw).trim();
    const next = trimmed === '' ? null : toNumber(trimmed);
    if (trimmed !== '' && next === null) {
      // Non-numeric input → reject without an API call.
      flash('error');
      setEditing(false);
      return;
    }
    // Re-serialize in canonical form expected by the backend (Decimal-as-str)
    const payload = next === null ? null : next.toFixed(2);
    const prev = value === null || value === undefined || value === '' ? null : Number(value).toFixed(2);
    if (payload === prev) {
      setEditing(false);
      return; // no-op
    }
    flash('saving');
    try {
      await onCommit(payload);
      flash('saved');
    } catch (e) {
      flash('error');
      console.error('[EditableNumber] commit failed', e);
    }
    setEditing(false);
  }, [value, onCommit, flash]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        defaultValue={draft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.currentTarget.blur(); }
          if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
        }}
        onBlur={(e) => commit(e.currentTarget.value)}
        style={{
          width,
          textAlign: align,
          padding: '2px 6px',
          fontSize: 13,
          fontFamily: 'inherit',
          border: 'none',
          borderRadius: 0,
          outline: 'none',
          background: 'transparent',
          color: '#111827',
        }}
      />
    );
  }

  // 0 affiché comme vide (demande dev 2026-05-11 : pas de "0 €" inutile,
  // visuellement la cell reste vide tant qu'il n'y a pas de vraie valeur).
  const isEmpty = value === null || value === undefined || value === '' || Number(value) === 0;
  // UX : 1-clic = sélection (Cell parent), dbl-clic n'importe où dans la
  // cell = édition. Détection manuelle via useRef + timestamp pour rester
  // fiable malgré les re-renders. Le span trigger couvre désormais toute
  // la cell (width/height 100%) — la zone cliquable est constante, donc
  // le tracking timing est stable entre les 2 clicks.
  return (
    <span
      onClick={(e) => {
        const now = Date.now();
        const isDouble = now - lastClickRef.current < 500;
        lastClickRef.current = now;
        if (isDouble) {
          e.stopPropagation();
          startEdit();
        }
        // single click : laisse propager → Cell parent gère la sélection
      }}
      title={disabled ? '' : 'Double-cliquer pour modifier'}
      style={{
        ...cellStyle(state),
        justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
        width: '100%',
        height: '100%',
        color: isEmpty
          ? (placeholderItalic ? '#c7c7c2' : '#9ca3af')
          : (valueColor || '#111827'),
        fontWeight: !isEmpty && valueBold ? 700 : 'normal',
        cursor: disabled ? 'default' : 'pointer',
        fontStyle: isEmpty && placeholderItalic ? 'italic' : 'normal',
        whiteSpace: 'nowrap',
      }}
    >
      {prefix}
      {isEmpty ? (placeholderItalic ? '' : placeholder) : display}
    </span>
  );
});

// ── Date ──────────────────────────────────────────────────────────────────
export const EditableDate = React.memo(function EditableDate({
  value,
  placeholder = '—',
  onCommit,
  width = '100%',
  disabled = false,
}) {
  const [editing, setEditing] = useState(false);
  const [state, flash] = useSaveFlash();
  const inputRef = useRef(null);

  const isoValue = value ? String(value).slice(0, 10) : '';
  const display = formatDateFR(value);

  const startEdit = useCallback(() => {
    if (disabled) return;
    setEditing(true);
  }, [disabled]);

  const commit = useCallback(async (raw) => {
    const next = raw === '' ? null : raw;
    if (next === isoValue || (next === null && !isoValue)) {
      setEditing(false);
      return;
    }
    flash('saving');
    try {
      await onCommit(next);
      flash('saved');
    } catch (e) {
      flash('error');
      console.error('[EditableDate] commit failed', e);
    }
    setEditing(false);
  }, [isoValue, onCommit, flash]);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        defaultValue={isoValue}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.currentTarget.blur(); }
          if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
        }}
        onBlur={(e) => commit(e.currentTarget.value)}
        style={{
          width,
          padding: '2px 6px',
          fontSize: 12.5,
          fontFamily: 'inherit',
          border: 'none',
          borderRadius: 0,
          outline: 'none',
          background: 'transparent',
          color: '#111827',
        }}
      />
    );
  }

  return (
    <span
      onClick={(e) => { e.stopPropagation(); startEdit(); }}
      title={disabled ? '' : 'Cliquer pour modifier'}
      style={{
        ...cellStyle(state),
        width,
        color: !value ? '#9ca3af' : '#111827',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {value ? display : placeholder}
    </span>
  );
});

// ── Select (portal dropdown) ──────────────────────────────────────────────
//
// `pillColors`     : map { value → { fg, bg } } pour rendre la valeur en pill
//                    coloré (Notion solid). `null` → texte simple.
// `optionLabels`   : map { value → label } pour afficher un label lisible
//                    (ex: enum 'a_signe' → 'À signer'). Default = value brute.
// `notionSolid`    : true → pill rectangulaire 4px-radius (vrai Notion).
//                    false (défaut) → pill arrondi 999px (legacy).
// `placeholderItalic` : "Vide" italique gris au lieu de "—".
export const EditableSelect = React.memo(function EditableSelect({
  value,
  options,
  onCommit,
  placeholder = '—',
  width = '100%',
  disabled = false,
  pillColors = null,
  pillFallback = null,
  optionLabels = null,
  notionSolid = false,
  placeholderItalic = false,
  truncate = true,
}) {
  const [open, setOpen] = useState(false);
  const [state, flash] = useSaveFlash();
  const triggerRef = useRef(null);

  const onPick = useCallback(async (next) => {
    setOpen(false);
    if (next === value) return;
    flash('saving');
    try {
      await onCommit(next);
      flash('saved');
    } catch (e) {
      flash('error');
      console.error('[EditableSelect] commit failed', e);
    }
  }, [value, onCommit, flash]);

  const meta = useMemo(() => {
    if (!pillColors || !value) return pillFallback || null;
    // Match exact d'abord
    if (pillColors[value]) return pillColors[value];
    // Match case-insensitive fallback : 1096 rows en DB ont 'Non' (mixed case)
    // alors que le dict a 'NON' (uppercase). Évite de tomber sur le fallback
    // gris (capture dev 2026-05-11 #39).
    const upper = String(value).toUpperCase();
    for (const k of Object.keys(pillColors)) {
      if (k.toUpperCase() === upper) return pillColors[k];
    }
    return pillFallback || null;
  }, [value, pillColors, pillFallback]);

  const labelStyle = pillColors && value ? {
    background: meta?.bg || '#f3f4f6',
    color: meta?.fg || '#374151',
    padding: '2px 8px',
    borderRadius: notionSolid ? 4 : 999,
    fontSize: 12,
    fontWeight: 500,
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'inline-block',
    lineHeight: 1.4,
  } : {};

  const labelFor = (v) => {
    if (v === null || v === undefined || v === '') return '';
    return optionLabels && optionLabels[v] ? optionLabels[v] : v;
  };

  return (
    <>
      <span
        ref={triggerRef}
        onClick={(e) => { if (!disabled) { e.stopPropagation(); setOpen((v) => !v); } }}
        style={{
          ...cellStyle(state),
          width,
          color: !value ? '#9ca3af' : '#111827',
          cursor: disabled ? 'default' : 'pointer',
          maxWidth: '100%',
          overflow: 'hidden',
          fontStyle: !value && placeholderItalic ? 'italic' : 'normal',
        }}
      >
        {value ? (
          pillColors ? (
            <span style={labelStyle}>{labelFor(value)}</span>
          ) : (
            <span style={truncate ? {
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
            } : undefined}>{labelFor(value)}</span>
          )
        ) : (
          placeholderItalic
            ? (placeholder
                ? <span style={{
                    // Pill placeholder : container vide style Notion empty hint.
                    // Border dashed + bg transparent + italic → clairement distinct
                    // des pills colorées (À signer/Traité/VIP/etc.) et ne se confond
                    // pas avec les valeurs réelles (demande dev 2026-05-11 #38).
                    display: 'inline-block',
                    background: 'transparent',
                    color: '#9b9a97',
                    padding: '1px 8px',
                    border: '1px dashed #c7c7c2',
                    borderRadius: notionSolid ? 4 : 999,
                    fontSize: 12,
                    fontStyle: 'italic',
                    fontWeight: 400,
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.4,
                  }}>{placeholder}</span>
                : null)
            : placeholder
        )}
      </span>
      <PortalDropdown
        open={open}
        anchorRef={triggerRef}
        onClose={() => setOpen(false)}
        minWidth={Math.max(180, triggerRef.current?.offsetWidth || 180)}
        maxHeight={360}
        zIndex={2000}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <button
            onClick={() => onPick(null)}
            style={pickerItemStyle(value === null)}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.background = value === null ? '#eef2ff' : 'transparent'}
          >
            <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>— effacer —</span>
          </button>
          <div style={{ height: 1, background: '#f3f4f6', margin: '4px 0' }} />
          {options.map((opt) => {
            const isActive = opt === value;
            const optMeta = pillColors && pillColors[opt] ? pillColors[opt] : null;
            return (
              <button
                key={opt}
                onClick={() => onPick(opt)}
                style={{
                  ...pickerItemStyle(isActive),
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.background = isActive ? '#eef2ff' : 'transparent'}
              >
                {optMeta && (
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: optMeta.fg, flexShrink: 0,
                  }} />
                )}
                <span>{labelFor(opt)}</span>
              </button>
            );
          })}
        </div>
      </PortalDropdown>
    </>
  );
});

const pickerItemStyle = (active) => ({
  border: 'none',
  outline: 'none',
  background: active ? '#eef2ff' : 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  padding: '6px 10px',
  fontSize: 13,
  fontFamily: 'inherit',
  color: '#111827',
  borderRadius: 4,
  width: '100%',
});

// Re-export — convenience for ViewSheet ↔ index ↔ modal sharing.
export { STATUS_DETAIL_COLORS, STATUS_DETAIL_FALLBACK };
