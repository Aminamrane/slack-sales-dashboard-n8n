// Briques visuelles de la prospection setter : carte, puce, bouton, modale. Couleurs tirées de la
// palette `C` de la tracking sheet setter (thème clair / sombre).
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { chipColors, FONT } from './format';

export function Card({ C, darkMode, children, style }) {
  return (
    <div style={{
      background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16,
      boxShadow: darkMode ? 'none' : '0 1px 2px rgba(16,24,40,0.04), 0 10px 28px rgba(16,24,40,0.06)',
      ...style,
    }}>{children}</div>
  );
}

export function Chip({ C, darkMode, label, onRemove, title }) {
  const col = chipColors(C, darkMode);
  return (
    <span title={title || label} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 14px', borderRadius: 999,
      background: col.bg, color: col.text, fontSize: 14, fontWeight: 500, maxWidth: 360,
    }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Retirer ${label}`} style={{
          border: 'none', background: 'transparent', padding: 2, cursor: 'pointer', color: col.close, display: 'inline-flex',
        }}><X size={15} /></button>
      )}
    </span>
  );
}

export function Button({ C, darkMode, children, onClick, disabled, primary, danger, type = 'button', style, title }) {
  const bg = primary ? (darkMode ? '#eef0f6' : '#1e2330') : danger ? '#b42318' : C.bg;
  const color = primary ? (darkMode ? '#1e2330' : '#fff') : danger ? '#fff' : C.text;
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10,
      border: primary || danger ? 'none' : `1px solid ${C.border}`, background: bg, color,
      fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.55 : 1, whiteSpace: 'nowrap', transition: 'background 0.15s', ...style,
    }}>{children}</button>
  );
}

export function Modal({ C, darkMode, title, onClose, children, width = 520 }) {
  return createPortal(
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }} style={{
      position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.55)', fontFamily: FONT,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, animation: 'modalOverlayIn 0.2s ease-out both',
    }}>
      <div role="dialog" aria-modal="true" style={{
        width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto', background: C.bg, color: C.text,
        borderRadius: 22, border: `1px solid ${C.border}`, padding: 24, zIndex: 9999,
        boxShadow: darkMode ? 'none' : '0 24px 64px rgba(16,24,40,0.24)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{
            border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer', display: 'inline-flex', padding: 4,
          }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// Keyframes propres à la prospection (aucune feuille globale n'expose de rotation).
export function ProspectionStyles() {
  return <style>{'@keyframes prospSpin { to { transform: rotate(360deg); } }'}</style>;
}

// Bouton-icône : au survol, la couleur annonce l'action (rouge = retirer, accent = envoyer).
const TONES = {
  danger: (darkMode) => ({ color: darkMode ? '#f87171' : '#dc2626', bg: darkMode ? 'rgba(248,113,113,0.14)' : '#fef2f2' }),
  accent: (darkMode, C) => ({ color: C.accent, bg: darkMode ? 'rgba(124,138,219,0.16)' : '#eef1fb' }),
};

export function IconButton({ C, darkMode, tone = 'accent', title, onClick, disabled, children }) {
  const [hover, setHover] = useState(false);
  const active = hover && !disabled ? TONES[tone](darkMode, C) : null;
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} aria-label={title}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)}
      style={{
        border: 'none', borderRadius: 10, padding: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer', color: active ? active.color : C.text, background: active ? active.bg : 'transparent',
        opacity: disabled ? 0.35 : 1, transition: 'color 0.15s ease, background 0.15s ease',
      }}>{children}</button>
  );
}

