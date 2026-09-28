// src/components/sequenceMail/ui.jsx
//
// Petites briques d'interface partagées : puce, menu déroulant accessible, surlignage de recherche.

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { highlightParts } from './highlight';

/** @brief Puce colorée (phase, statut, cohorte). */
export function Chip({ tone = 'grey', large = false, className = '', title, children }) {
  return (
    <span className={`smx-chip is-${tone}${large ? ' is-lg' : ''}${className ? ` ${className}` : ''}`} title={title}>
      {children}
    </span>
  );
}

/**
 * @brief Menu déroulant ancré à un bouton : Échap et clic extérieur ferment, flèches naviguent.
 * @param renderButton `({ open, toggle, props }) => ReactNode` — `props` porte les attributs ARIA du bouton.
 * @param children Contenu du menu ; les éléments cliquables portent `role="menuitem"`.
 * @param align `'left'` | `'right'` (bord du bouton auquel le menu s'aligne).
 * @param up Ouvre vers le haut.
 */
export function MenuButton({ renderButton, children, align = 'left', up = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  const close = useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) wrapRef.current?.querySelector('[aria-haspopup]')?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open]);

  useEffect(() => {
    if (open) menuRef.current?.querySelector('[role="menuitem"]')?.focus();
  }, [open]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close(true);
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]') ?? [])];
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next].focus();
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }} className={className} onKeyDown={onKeyDown}>
      {renderButton({
        open,
        toggle: () => setOpen((v) => !v),
        props: { 'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': open ? menuId : undefined },
      })}
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          className="smx-menu"
          style={{ [up ? 'bottom' : 'top']: '100%', [align === 'right' ? 'right' : 'left']: 0, marginTop: up ? 0 : 4, marginBottom: up ? 4 : 0 }}
          onClick={(e) => {
            if (e.target.closest('[role="menuitem"]')) close(true);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ── Surlignage de recherche ───────────────────────────────────────────────────

export function Highlight({ text, tokens }) {
  const parts = highlightParts(text, tokens);
  if (parts.length === 1 && !parts[0].hit) return text;
  return parts.map((p, i) => (p.hit ? <mark key={i} className="smx-hl">{p.text}</mark> : <span key={i}>{p.text}</span>));
}
