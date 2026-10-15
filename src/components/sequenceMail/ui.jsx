// src/components/sequenceMail/ui.jsx
//
// Petites briques d'interface partagées : puce, menu déroulant accessible, surlignage de recherche.

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { highlightParts } from './highlight.js';

/** @brief Puce colorée (phase, statut, cohorte). */
export function Chip({ tone = 'grey', large = false, className = '', title, children }) {
  return (
    <span className={`smx-chip is-${tone}${large ? ' is-lg' : ''}${className ? ` ${className}` : ''}`} title={title}>
      {children}
    </span>
  );
}

/** @brief Les éléments cliquables d'un menu : `menuitem`, `menuitemradio` ou `menuitemcheckbox`. */
const ITEM_SELECTOR = '[role^="menuitem"]';

/** @brief Éléments d'un menu, dans l'ordre du document. */
const itemsOf = (menuEl) => [...(menuEl?.querySelectorAll(ITEM_SELECTOR) ?? [])];

/** @brief Place le focus (et l'unique arrêt de tabulation du menu) sur l'élément `el`. */
function focusMenuItem(menuEl, el) {
  for (const item of itemsOf(menuEl)) item.tabIndex = item === el ? 0 : -1;
  el?.focus();
}

/** @brief Titre visuel d'un menu : masqué aux technologies d'assistance (le menu porte déjà le nom de son bouton). */
export function MenuTitle({ children }) {
  return <div className="smx-menu-title" aria-hidden="true">{children}</div>;
}

/** @brief Séparateur d'un menu. */
export function MenuSeparator() {
  return <div className="smx-menu-sep" role="separator" />;
}

/**
 * @brief Menu déroulant ancré à un bouton, conforme au motif « menu button » d'ARIA :
 *  - ouverture au clic, à Entrée/Espace, et à ↓ / ↑ depuis le bouton (↑ ouvre sur le dernier élément) ;
 *  - un seul arrêt de tabulation à l'intérieur (tabindex « itinérant ») : ↑ ↓ Début Fin parcourent les éléments ;
 *  - Échap ferme et rend le focus au bouton ; Tab ferme et laisse le focus suivre sa route ; un clic ou un
 *    focus ailleurs ferme aussi ;
 *  - à l'ouverture, le focus va sur l'élément coché (`aria-checked="true"`), sinon sur le premier.
 * @param renderButton `({ open, toggle, props }) => ReactNode` — `props` porte `id` et les attributs ARIA du bouton :
 * à répandre sur le bouton (`{...props}`).
 * @param children Contenu du menu ; les éléments cliquables portent `role="menuitem"` (ou `menuitemradio` +
 * `aria-checked` pour un choix exclusif).
 * @param align `'left'` | `'right'` (bord du bouton auquel le menu s'aligne).
 * @param up Ouvre vers le haut.
 */
export function MenuButton({ renderButton, children, align = 'left', up = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const menuRef = useRef(null);
  /** Élément à focaliser à l'ouverture : `'first'` (clic, ↓) ou `'last'` (↑). */
  const startRef = useRef('first');
  const buttonId = useId();
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

  // À l'ouverture : le focus va sur l'élément coché, sinon sur le premier (ou le dernier, ouvert par ↑).
  useEffect(() => {
    if (!open) return;
    const list = itemsOf(menuRef.current);
    if (!list.length) return;
    const target = startRef.current === 'last' ? list[list.length - 1] : list.find((i) => i.getAttribute('aria-checked') === 'true') ?? list[0];
    focusMenuItem(menuRef.current, target);
  }, [open]);

  const onKeyDown = (e) => {
    if (!open) {
      // Depuis le bouton fermé : ↓ ouvre sur le premier élément, ↑ sur le dernier.
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target.closest('[aria-haspopup]')) {
        e.preventDefault();
        startRef.current = e.key === 'ArrowUp' ? 'last' : 'first';
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.stopPropagation();
      close(true);
      return;
    }
    if (e.key === 'Tab') {
      // Le focus part du bouton (et non d'un élément qui va disparaître) : Tab / Maj+Tab continuent depuis lui.
      wrapRef.current?.querySelector('[aria-haspopup]')?.focus();
      setOpen(false);
      return;
    }
    const list = itemsOf(menuRef.current);
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    let next = null;
    if (e.key === 'ArrowDown') next = list[(i + 1) % list.length];
    else if (e.key === 'ArrowUp') next = list[(i - 1 + list.length) % list.length];
    else if (e.key === 'Home') next = list[0];
    else if (e.key === 'End') next = list[list.length - 1];
    if (!next) return;
    e.preventDefault();
    focusMenuItem(menuRef.current, next);
  };

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', display: 'inline-flex' }}
      className={className}
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        // Le focus part vers un AUTRE élément de la page : le menu se ferme. (Un focus perdu sans destination,
        // comme un clic sur le bouton sous Safari, est laissé aux autres moyens de fermeture.)
        if (open && e.relatedTarget && !wrapRef.current?.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      {renderButton({
        open,
        toggle: () => {
          startRef.current = 'first';
          setOpen((v) => !v);
        },
        props: { id: buttonId, 'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': open ? menuId : undefined },
      })}
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={buttonId}
          className="smx-menu"
          style={{ [up ? 'bottom' : 'top']: '100%', [align === 'right' ? 'right' : 'left']: 0, marginTop: up ? 0 : 4, marginBottom: up ? 4 : 0 }}
          onClick={(e) => {
            if (e.target.closest(ITEM_SELECTOR)) close(true);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * @brief Bouton de reprise après une erreur de chargement : « Réessayer », ou « Recharger la page » quand seul
 * un rechargement peut aider (le site a été mis à jour depuis l'ouverture de la page).
 * @param needsReload Vrai quand « Réessayer » ne servirait à rien.
 * @param onRetry Relance le chargement.
 * @param className Classes du bouton (`smx-btn` par défaut ; vide dans une bannière, dont le style s'applique déjà).
 */
export function RetryButton({ needsReload = false, onRetry, className = 'smx-btn' }) {
  if (needsReload) {
    return (
      <button type="button" className={className} onClick={() => window.location.reload()}>
        Recharger la page
      </button>
    );
  }
  return (
    <button type="button" className={className} onClick={onRetry}>
      Réessayer
    </button>
  );
}

// ── Surlignage de recherche ───────────────────────────────────────────────────

export function Highlight({ text, tokens }) {
  const parts = highlightParts(text, tokens);
  if (parts.length === 1 && !parts[0].hit) return text;
  return parts.map((p, i) => (p.hit ? <mark key={i} className="smx-hl">{p.text}</mark> : <span key={i}>{p.text}</span>));
}
