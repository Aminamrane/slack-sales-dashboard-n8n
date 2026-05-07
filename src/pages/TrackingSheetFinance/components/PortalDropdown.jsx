// PortalDropdown.jsx — wrapper générique pour rendre un dropdown via
// `createPortal(document.body)` afin d'échapper aux conteneurs scrollables
// (`overflow: auto`) qui clippent les enfants positionnés en absolute.
//
// Pourquoi ce composant existe :
//   Dans Vue 1 (ViewSheet), la table a `overflow: auto` + `maxHeight: 620`.
//   Les dropdowns "État finance" / "Check PSP" / "Prélèv. auto" sont rendus
//   en `position: absolute` sous une `StickyCell`. Le wrapper scrollable les
//   coupe verticalement, donc le menu s'affiche derrière les rows visuellement.
//   Augmenter le z-index ne change rien : le clipping est dû à `overflow`.
//
// Solution : le menu est portalé sur `document.body` (z-index global), et sa
// position est calculée à partir des coordonnées de l'élément `triggerRef`.
//
// Usage :
//   const triggerRef = useRef(null);
//   const [open, setOpen] = useState(false);
//   <button ref={triggerRef} onClick={() => setOpen(true)}>...</button>
//   <PortalDropdown
//     open={open}
//     anchorRef={triggerRef}
//     onClose={() => setOpen(false)}
//   >
//     ...children (les items)
//   </PortalDropdown>

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

const PortalDropdown = React.memo(function PortalDropdown({
  open,
  anchorRef,
  onClose,
  children,
  align = 'left',           // 'left' | 'right'
  offsetY = 4,              // gap vertical entre le trigger et le menu
  minWidth = 200,
  maxHeight,
  panelStyle = {},          // override styles du panel
  zIndex = 1000,
}) {
  const panelRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  // Le panel est portalé sur `document.body` → l'héritage CSS de `font-family`
  // remonte au body (font système par défaut) au lieu de la chaîne d'ancêtres
  // React. On capture la fontFamily calculée du trigger pour la rejouer sur
  // le panel : ainsi le picker hérite de la même typo que la page parente
  // (Inter dans la TSF, INTER_FAMILY dans SidePanel mode='task'…).
  const [inheritedFont, setInheritedFont] = useState(null);

  // Recalcule la position du menu à chaque ouverture / scroll / resize.
  useEffect(() => {
    if (!open || !anchorRef?.current) return;
    const compute = () => {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + offsetY,
        left: align === 'right' ? rect.right : rect.left,
        width: rect.width,
      });
    };
    compute();
    // Capture la fontFamily résolue du trigger une seule fois à l'ouverture
    // (pas dans le compute scroll/resize : pas besoin de la recalculer).
    try {
      const cs = window.getComputedStyle(anchorRef.current);
      if (cs && cs.fontFamily) setInheritedFont(cs.fontFamily);
    } catch (_) { /* noop */ }
    // Ré-applique sur scroll/resize : si l'utilisateur scrolle la table en
    // dessous, le menu suit le trigger (ou l'utilisateur ferme & rouvre).
    // On utilise `capture: true` pour attraper aussi les scrolls internes
    // (le wrapper de la table).
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [open, anchorRef, align, offsetY]);

  // Click outside (anchor + panel) → close.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      if (anchorRef?.current?.contains(e.target)) return;
      onClose?.();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, anchorRef, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: align === 'right' ? undefined : pos.left,
        right: align === 'right' ? (window.innerWidth - pos.left) : undefined,
        minWidth,
        maxHeight,
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 10px 28px rgba(0,0,0,0.12)',
        padding: 4,
        zIndex,
        animation: 'tsfFadeIn 0.15s ease both',
        overflowY: maxHeight ? 'auto' : undefined,
        // fontFamily du trigger : transparent côté caller, surchargeable
        // explicitement via `panelStyle.fontFamily`.
        fontFamily: inheritedFont || undefined,
        ...panelStyle,
      }}
    >
      {children}
    </div>,
    document.body
  );
});

export default PortalDropdown;
