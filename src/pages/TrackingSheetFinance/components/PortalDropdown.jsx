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

import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';
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
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, effectiveAlign: align });
  // Le panel est portalé sur `document.body` → l'héritage CSS de `font-family`
  // remonte au body (font système par défaut) au lieu de la chaîne d'ancêtres
  // React. On capture la fontFamily calculée du trigger pour la rejouer sur
  // le panel : ainsi le picker hérite de la même typo que la page parente
  // (Inter dans la TSF, INTER_FAMILY dans SidePanel mode='task'…).
  const [inheritedFont, setInheritedFont] = useState(null);

  // Recalcule la position du menu à chaque ouverture / scroll / resize.
  // Auto-flip vertical : si pas assez de place en bas, on bascule au-dessus
  // du trigger pour ne pas être coupé par le viewport. useLayoutEffect pour
  // que la mesure + correction se fassent avant le paint (pas de flash).
  useLayoutEffect(() => {
    if (!open || !anchorRef?.current) return;

    const compute = () => {
      const rect = anchorRef.current.getBoundingClientRect();
      const panelHeight = panelRef.current?.offsetHeight ?? 0;
      const viewportHeight = window.innerHeight;
      const margin = 8; // garde de sécurité vs bord viewport

      let top;
      if (panelHeight === 0) {
        // Premier render avant mesure : placement par défaut en bas
        top = rect.bottom + offsetY;
      } else {
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        const wantedHeight = panelHeight + offsetY + margin;

        if (spaceBelow >= wantedHeight) {
          // Place suffisante sous le trigger → bottom (cas normal)
          top = rect.bottom + offsetY;
        } else if (spaceAbove >= wantedHeight) {
          // Pas assez en bas mais assez en haut → flip up
          top = rect.top - panelHeight - offsetY;
        } else {
          // Aucun côté ne tient la hauteur complète : on clamp en bas du
          // viewport pour minimiser le clipping (l'utilisateur peut scroller
          // si maxHeight est défini, l'overflow interne joue).
          top = Math.max(margin, viewportHeight - panelHeight - margin);
        }
      }

      const panelWidth = panelRef.current?.offsetWidth || minWidth;
      const viewportWidth = window.innerWidth;
      let resolvedAlign = align;
      if (align === 'left' && rect.left + panelWidth > viewportWidth - margin) {
        resolvedAlign = 'right';
      }

      setPos({
        top,
        left: resolvedAlign === 'right' ? rect.right : rect.left,
        width: rect.width,
        effectiveAlign: resolvedAlign,
      });
    };

    // Capture la fontFamily résolue du trigger une seule fois à l'ouverture.
    try {
      const cs = window.getComputedStyle(anchorRef.current);
      if (cs && cs.fontFamily) setInheritedFont(cs.fontFamily);
    } catch (_) { /* noop */ }

    // Première passe : positionne en bas par défaut (panelHeight=0).
    compute();
    // Deuxième passe au prochain frame : panelRef est monté, on mesure la
    // vraie hauteur du panel et on flip si nécessaire.
    const raf = requestAnimationFrame(compute);

    // Ré-applique sur scroll/resize : si l'utilisateur scrolle la table en
    // dessous, le menu suit le trigger (et peut basculer de bottom à top
    // selon la position du trigger dans le viewport).
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      cancelAnimationFrame(raf);
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
        left: pos.effectiveAlign === 'right' ? undefined : pos.left,
        right: pos.effectiveAlign === 'right' ? (window.innerWidth - pos.left) : undefined,
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
