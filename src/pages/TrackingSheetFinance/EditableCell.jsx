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
import PortalDropdown from './components/PortalDropdown.jsx';
import {
  formatEUR,
  formatDateFR,
  toNumber,
  STATUS_DETAIL_COLORS,
  STATUS_DETAIL_FALLBACK,
} from './constants.js';

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

// ── Number ────────────────────────────────────────────────────────────────
export const EditableNumber = React.memo(function EditableNumber({
  value,
  placeholder = '—',
  onCommit,
  align = 'right',
  width = '100%',
  disabled = false,
  prefix = '',
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [state, flash] = useSaveFlash();
  const inputRef = useRef(null);

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
          border: '1.5px solid #6366f1',
          borderRadius: 4,
          outline: 'none',
          background: '#fff',
          color: '#111827',
        }}
      />
    );
  }

  return (
    <span
      onClick={startEdit}
      title={disabled ? '' : 'Cliquer pour modifier'}
      style={{
        ...cellStyle(state),
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        width,
        color: value === null || value === undefined || value === '' ? '#9ca3af' : '#111827',
        cursor: disabled ? 'default' : 'pointer',
      }}
      onMouseEnter={(e) => { if (!disabled && state === 'idle') e.currentTarget.style.background = '#f3f4f6'; }}
      onMouseLeave={(e) => { if (state === 'idle') e.currentTarget.style.background = ''; }}
    >
      {prefix}
      {value === null || value === undefined || value === '' ? placeholder : display}
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
          border: '1.5px solid #6366f1',
          borderRadius: 4,
          outline: 'none',
          background: '#fff',
          color: '#111827',
        }}
      />
    );
  }

  return (
    <span
      onClick={startEdit}
      title={disabled ? '' : 'Cliquer pour modifier'}
      style={{
        ...cellStyle(state),
        width,
        color: !value ? '#9ca3af' : '#111827',
        cursor: disabled ? 'default' : 'pointer',
      }}
      onMouseEnter={(e) => { if (!disabled && state === 'idle') e.currentTarget.style.background = '#f3f4f6'; }}
      onMouseLeave={(e) => { if (state === 'idle') e.currentTarget.style.background = ''; }}
    >
      {value ? display : placeholder}
    </span>
  );
});

// ── Select (portal dropdown) ──────────────────────────────────────────────
export const EditableSelect = React.memo(function EditableSelect({
  value,
  options,
  onCommit,
  placeholder = '—',
  width = '100%',
  disabled = false,
  pillColors = null,
  pillFallback = null,
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
    if (!pillColors) return null;
    return value && pillColors[value] ? pillColors[value] : (pillFallback || null);
  }, [value, pillColors, pillFallback]);

  const labelStyle = pillColors && value ? {
    background: meta?.bg || '#f3f4f6',
    color: meta?.fg || '#374151',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 500,
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'inline-block',
  } : {};

  return (
    <>
      <span
        ref={triggerRef}
        onClick={() => { if (!disabled) setOpen((v) => !v); }}
        title={value || ''}
        style={{
          ...cellStyle(state),
          width,
          color: !value ? '#9ca3af' : '#111827',
          cursor: disabled ? 'default' : 'pointer',
          maxWidth: '100%',
          overflow: 'hidden',
        }}
        onMouseEnter={(e) => { if (!disabled && state === 'idle') e.currentTarget.style.background = '#f3f4f6'; }}
        onMouseLeave={(e) => { if (state === 'idle') e.currentTarget.style.background = ''; }}
      >
        {value ? (
          pillColors ? (
            <span style={labelStyle}>{value}</span>
          ) : (
            <span style={truncate ? {
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
            } : undefined}>{value}</span>
          )
        ) : (
          placeholder
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
                <span>{opt}</span>
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
