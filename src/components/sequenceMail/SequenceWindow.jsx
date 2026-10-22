// src/components/sequenceMail/SequenceWindow.jsx
//
// Fenêtre flottante des outils de séquence (« Gestion de séquence », « Schéma de séquence », « Éditeur de
// mail ») : barre de titre (déplacer, réduire, agrandir, fermer), poignées de redimensionnement et, à
// l'ouverture, accrochage sur une moitié de l'écran — comme Win + ← / Win + →.
//
// Positionnement : le cadre est centré par CSS (`top: 50%`, `left: calc(50% + sidebar / 2)`,
// `translate(-50%, -50%)`) puis décalé de (x, y) — c'est le modèle attendu par
// WindowResizeHandles. Il est rendu sous <body> : ancré au viewport, il ne défile pas avec la page
// et ne dépend d'aucun conteneur transformé (avant, son bloc conteneur était un parent animé, d'où un
// centre décalé et une fenêtre qui suivait le défilement de la page).
//
// Accrochage : `side` ('left' | 'right') place la fenêtre sur la moitié gauche / droite de la zone
// utile — à droite de la sidebar, sous la navbar, mêmes marges que « Agrandir ». Elle y reste
// (suit les redimensionnements du navigateur et le repli de la sidebar) tant qu'on ne la déplace pas
// et qu'on ne la redimensionne pas ; « Agrandir » puis « Restaurer » la remet sur sa moitié.
//
// Fenêtre libre (déplacée ou redimensionnée) : son décalage est relatif au centre de repos, qui suit la
// sidebar ; on le compense quand la sidebar change de largeur (sinon la fenêtre sauterait de la moitié de
// l'écart) et on la recadre dans la zone utile quand le navigateur est redimensionné.
//
// Petit écran (`compact`) : deux fenêtres côte à côte ne tiennent plus. Chaque fenêtre occupe alors toute la zone
// utile ; la page ne montre que celle du dessus et réduit les autres en icônes (cliquer une icône échange).
//
// Accessibilité : chaque fenêtre est un `role="dialog"` non modal nommé par son titre ; elle prend le focus à
// l'ouverture (`focusOnOpen`) et à la restauration, l'icône prend le focus quand on réduit, et le déplacement
// se fait aux événements pointeur (souris, doigt, stylet) avec capture : plus de fenêtre « collée » au curseur.

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import WindowResizeHandles from './WindowResizeHandles';
import MinimizedIcon from './MinimizedIcon';
import { RESTORE_MS, playRestore, prefersReducedMotion, setIconAnchor, shrinkTransform } from './iconPlacement';
import { fixedViewport } from './viewportBox';
import { beginDragMode, useLatest } from './hooks';
import { NAVBAR_SAFE_TOP, SIDEBAR_OPEN_WIDTH, Z_SEQUENCE_WINDOW } from './constants';
import { ensureStyles } from './injectStyles';

/** Marge (px) laissée après la sidebar, à droite et en bas : celle de « Agrandir ». */
const EDGE = 8;
/** Rang le plus bas des trois fenêtres : sous la sidebar (z-index 40) et la navbar (1000), comme avant. */
export const SEQUENCE_WINDOW_Z = Z_SEQUENCE_WINDOW;
const FONT = 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
/** Déplacement (px) en dessous duquel un appui sur la barre de titre reste un clic (le doigt tremble davantage). */
const DRAG_THRESHOLD = 4;
const DRAG_THRESHOLD_TOUCH = 8;

// Animations d'ouverture / de chute, propres à ce composant (elles vivaient dans la page : la réutilisation
// cassait en silence dès qu'on les renommait). Réduire les animations : aucune, la fenêtre se cache à la fermeture.
ensureStyles('smx-window-css', `
@keyframes smx-win-pop { 0% { opacity: 0; transform: scale(0.94) translateY(8px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
@keyframes smx-win-fall { 0% { transform: translateY(0) rotate(0deg); } 100% { transform: translateY(160vh) rotate(5deg); } }
[data-smx-frame]:focus { outline: none; }
[data-smx-frame]:focus-visible { outline: 2px solid #2F4BFF; outline-offset: -2px; }
@media (prefers-reduced-motion: reduce) {
  [data-smx-frame] { animation: none !important; transition: none !important; }
}
`);

/**
 * @brief Zone utile `{ box, left, right, top, bottom }` : à droite de la sidebar, sous la navbar, avec les mêmes
 * marges que « Agrandir ». `box` est le bloc conteneur MESURÉ du `position: fixed` (cf. viewportBox.js).
 */
function usableArea(sidebarWidth, safeTop) {
  const box = fixedViewport();
  return {
    box,
    left: box.left + sidebarWidth + EDGE,
    right: box.left + box.width - EDGE,
    top: box.top + safeTop,
    bottom: box.top + box.height - EDGE,
  };
}

/**
 * @brief Géométrie `{ w, h, x, y }` d'une fenêtre qui occupe `where` : la moitié gauche, la moitié droite
 * ou toute la zone utile (à droite de la sidebar, sous la navbar). `(x, y)` est le décalage du centre du
 * cadre par rapport à son centre de repos.
 * @note Tout se calcule dans le bloc conteneur MESURÉ du `position: fixed` (cf. viewportBox.js), celui
 * sur lequel le CSS résout `top: 50%` et `left: calc(50% + …)` : la fenêtre tombe donc exactement sur sa cible.
 */
function fit(where, sidebarWidth, safeTop) {
  const { box, left: aLeft, right: aRight, top, bottom } = usableArea(sidebarWidth, safeTop);
  const mid = Math.round((aLeft + aRight) / 2);
  const left = where === 'right' ? mid : aLeft;
  const right = where === 'left' ? mid : aRight;
  return {
    w: Math.max(200, right - left),
    h: Math.max(200, bottom - top),
    x: (left + right) / 2 - (box.left + box.width / 2 + sidebarWidth / 2),
    y: (top + bottom) / 2 - (box.top + box.height / 2),
  };
}

/**
 * @brief Ramène une géométrie libre dans la zone utile : jamais plus grande qu'elle, jamais hors de l'écran ni sous la
 * navbar. Même modèle que `fit` (décalage du centre de repos), donc sans effet sur une fenêtre déjà dans la zone.
 */
function clampGeo(g, sidebarWidth, safeTop) {
  const { box, left: aLeft, right: aRight, top: aTop, bottom: aBottom } = usableArea(sidebarWidth, safeTop);
  const w = Math.min(g.w, Math.max(200, aRight - aLeft));
  const h = Math.min(g.h, Math.max(200, aBottom - aTop));
  const restX = box.left + box.width / 2 + sidebarWidth / 2;
  const restY = box.top + box.height / 2;
  const left = Math.min(Math.max(restX + g.x - w / 2, aLeft), Math.max(aLeft, aRight - w));
  const top = Math.min(Math.max(restY + g.y - h / 2, aTop), Math.max(aTop, aBottom - h));
  return { w: Math.round(w), h: Math.round(h), x: Math.round(left + w / 2 - restX), y: Math.round(top + h / 2 - restY) };
}

const sameGeometry = (a, b) => a.w === b.w && a.h === b.h && a.x === b.x && a.y === b.y;

/**
 * @brief Rogne l'ombre du côté de la jointure : sans cela, l'ombre de chaque fenêtre assombrirait la voisine.
 * @note Les autres côtés gardent une réserve énorme, pour ne pas couper l'animation de chute à la fermeture.
 */
const seamClip = (snap) =>
  snap === 'left' ? 'inset(-200vh 0 -200vh -200vw)' : snap === 'right' ? 'inset(-200vh -200vw -200vh 0)' : undefined;

/**
 * @param title Titre affiché dans la barre (et nom accessible de la fenêtre).
 * @param side Moitié occupée à l'ouverture : `'left'` | `'right'`.
 * @param phase `'window-in'` | `'window-open'` | `'window-closing'` : pilote l'animation ; interactive quand `'window-open'`.
 * @param sidebarWidth Largeur de la sidebar (px) : la zone utile commence après elle.
 * @param safeTop Hauteur réservée en haut (navbar flottante) : la fenêtre ne la recouvre jamais.
 * @param colors Palette `getColors` de la page (`bg`, `border`, `secondary`, `muted`, `subtle`).
 * @param darkMode Mode sombre (tuile du logo et ombre).
 * @param logo Logo de la barre de titre.
 * @param borderWidth Épaisseur du contour (px).
 * @param labelSuffix Ajouté aux noms accessibles des boutons, pour distinguer les fenêtres.
 * @param closeLabel Nom accessible du bouton de fermeture (défaut : « Fermer » + `labelSuffix`) : utile quand fermer
 * ferme aussi d'autres fenêtres.
 * @param closeTitle Infobulle du bouton de fermeture.
 * @param zIndex Ordre d'empilement (rang 37 à 39 : la dernière fenêtre utilisée est au-dessus).
 * @param onActivate Appelé quand on prend la main sur la fenêtre (clic, focus, agrandissement).
 * @param onClose Fermeture demandée.
 * @param minimized `true` : la fenêtre est réduite en icône (elle reste montée, seulement cachée).
 * @param onMinimize Réduction demandée (bouton « Réduire »).
 * @param onRestore Réouverture demandée (clic sur l'icône).
 * @param icon Image de l'icône de la fenêtre réduite.
 * @param iconId Identifiant stable de l'icône (sa place est mémorisée le temps qu'elle existe).
 * @param compact Petit écran : la fenêtre occupe toute la zone utile, sans déplacement ni redimensionnement.
 * @param focusOnOpen `true` : la fenêtre prend le focus clavier quand elle devient interactive (ouverture demandée).
 */
export default function SequenceWindow({
  title, side, phase, sidebarWidth, safeTop = NAVBAR_SAFE_TOP, colors: C, darkMode = false, logo,
  borderWidth = 1, labelSuffix = '', closeLabel, closeTitle = 'Fermer', zIndex = SEQUENCE_WINDOW_Z, onActivate, onClose,
  minimized = false, onMinimize, onRestore, icon, iconId, compact = false, focusOnOpen = false, children,
}) {
  const interactive = phase === 'window-open';
  const titleId = useId();
  const [snap, setSnap] = useState(side);
  const [maximized, setMaximized] = useState(false);
  const [geo, setGeo] = useState(() => fit(side, sidebarWidth, safeTop));
  const restoreRef = useRef(null);
  const frameRef = useRef(null);
  const wrapRef = useRef(null);
  // Transformation « réduite » du cadre (glisse vers son icône, en haut à gauche), calculée au clic sur Réduire.
  const [shrink, setShrink] = useState(null);
  // L'icône prend le focus quand l'utilisateur vient de réduire la fenêtre (pas quand la page la réduit d'office).
  const [iconFocus, setIconFocus] = useState(false);
  const dragRef = useRef(null);
  useEffect(() => () => dragRef.current?.stop(), []);
  const latest = useLatest({ geo, snap, maximized, sidebarWidth, safeTop });
  const reduce = prefersReducedMotion();

  // Petit écran : la fenêtre passe en pleine zone ; on garde sa disposition libre pour la retrouver au retour.
  const compactSave = useRef(null);
  useLayoutEffect(() => {
    const now = latest.current;
    if (compact) {
      if (!compactSave.current) compactSave.current = { geo: now.geo, snap: now.snap, maximized: now.maximized };
      return;
    }
    const saved = compactSave.current;
    if (!saved) return;
    compactSave.current = null;
    setMaximized(saved.maximized);
    setSnap(saved.snap);
    if (!saved.snap && !saved.maximized) setGeo(clampGeo(saved.geo, now.sidebarWidth, now.safeTop));
  }, [compact, latest]);

  // Accrochée ou agrandie, la fenêtre suit le viewport : redimensionnement du navigateur, repli de la
  // sidebar, apparition d'une barre de défilement. Sans effet dès qu'elle a été déplacée.
  const where = compact || maximized ? 'full' : snap;
  useLayoutEffect(() => {
    if (!where) return undefined;
    const apply = () => setGeo((g) => {
      const next = fit(where, sidebarWidth, safeTop);
      return sameGeometry(g, next) ? g : next;
    });
    apply();
    window.addEventListener('resize', apply);
    const ro = new ResizeObserver(apply);
    ro.observe(document.documentElement);
    return () => {
      window.removeEventListener('resize', apply);
      ro.disconnect();
    };
  }, [where, sidebarWidth, safeTop]);

  // Fenêtre libre : la sidebar change de largeur → le centre de repos bouge de la moitié de l'écart ; on le compense pour
  // qu'elle garde sa place à l'écran. Redimensionner le navigateur la recadre dans la zone utile.
  const prevSidebar = useRef(sidebarWidth);
  useLayoutEffect(() => {
    const delta = sidebarWidth - prevSidebar.current;
    prevSidebar.current = sidebarWidth;
    if (!delta || where) return;
    setGeo((g) => ({ ...g, x: g.x - delta / 2 }));
  }, [sidebarWidth, where]);
  useLayoutEffect(() => {
    if (where) return undefined;
    const apply = () => setGeo((g) => {
      const next = clampGeo(g, sidebarWidth, safeTop);
      return sameGeometry(g, next) ? g : next;
    });
    window.addEventListener('resize', apply);
    // Le 1er rappel d'un ResizeObserver part dès l'observation : sans changement réel, il ne doit rien recadrer
    // (replier la sidebar ne doit pas remonter une fenêtre que l'on a laissée un peu sous le bord de l'écran).
    let initial = true;
    const ro = new ResizeObserver(() => {
      if (initial) { initial = false; return; }
      apply();
    });
    ro.observe(document.documentElement);
    return () => {
      window.removeEventListener('resize', apply);
      ro.disconnect();
    };
  }, [where, sidebarWidth, safeTop]);

  // Les icônes ne descendent jamais sous la barre latérale : sur un écran à souris, la barre dans son état le plus large
  // (repliée, elle se déplie par-dessus au survol) ; sur un petit écran, sa largeur réelle.
  useLayoutEffect(() => { setIconAnchor(compact ? sidebarWidth : SIDEBAR_OPEN_WIDTH); }, [compact, sidebarWidth]);

  // Un clic DANS une iframe (aperçu d'e-mail, zone de rédaction) n'atteint jamais les écouteurs de la page : la fenêtre
  // restait dessous. Le seul signe est le `blur` de la fenêtre du navigateur, l'iframe devenant l'élément actif.
  useEffect(() => {
    const onWindowBlur = () => {
      requestAnimationFrame(() => {
        const a = document.activeElement;
        if (a && a.tagName === 'IFRAME' && wrapRef.current?.contains(a)) onActivate?.();
      });
    };
    window.addEventListener('blur', onWindowBlur);
    return () => window.removeEventListener('blur', onWindowBlur);
  }, [onActivate]);

  // Ouverture demandée : le focus entre dans la fenêtre (une fois par ouverture).
  const focusedOnOpen = useRef(false);
  useLayoutEffect(() => {
    if (!interactive) { focusedOnOpen.current = false; return; }
    if (focusOnOpen && !focusedOnOpen.current) {
      focusedOnOpen.current = true;
      frameRef.current?.focus({ preventScroll: true });
    }
  }, [interactive, focusOnOpen]);

  // Réouverture : la fenêtre grandit depuis l'icône là où elle est MAINTENANT (même déplacée depuis la
  // réduction) et prend le focus. Pendant ce temps, le rognage de la jointure est levé : sans cela, une fenêtre de
  // droite qui revient de l'icône (à gauche) serait coupée net à sa propre jointure.
  const wasMinimized = useRef(minimized);
  const [flying, setFlying] = useState(false);
  const flyTimer = useRef(0);
  useLayoutEffect(() => {
    if (wasMinimized.current && !minimized) {
      const r = wrapRef.current?.getBoundingClientRect();
      if (r) {
        playRestore(frameRef.current, iconId || title, r);
        setFlying(true);
        clearTimeout(flyTimer.current);
        flyTimer.current = setTimeout(() => setFlying(false), RESTORE_MS + 40);
      }
      setIconFocus(false);
      if (interactive) frameRef.current?.focus({ preventScroll: true });
    }
    wasMinimized.current = minimized;
  }, [minimized, iconId, title, interactive]);
  useEffect(() => () => clearTimeout(flyTimer.current), []);

  const minimize = () => {
    if (!interactive) return;
    const r = frameRef.current?.getBoundingClientRect();
    if (r) setShrink(shrinkTransform(iconId || title, r));
    setIconFocus(true);
    onMinimize?.();
  };

  const toggleMaximize = () => {
    if (!interactive || compact) return;
    onActivate?.();
    if (maximized) {
      const r = restoreRef.current;
      setMaximized(false);
      if (r?.snap) {
        setSnap(r.snap);
        setGeo(fit(r.snap, sidebarWidth, safeTop));
      } else if (r) {
        setGeo(clampGeo(r.geo, sidebarWidth, safeTop));
      }
      return;
    }
    restoreRef.current = { geo, snap };
    setSnap(null);
    setMaximized(true);
    setGeo(fit('full', sidebarWidth, safeTop));
  };

  // Déplacement par la barre de titre — décalage RELATIF au centre de repos, comme le reste du cadre. Aux événements
  // pointeur (souris, doigt, stylet) avec capture : le geste continue au-dessus d'une iframe et ne se perd jamais
  // (le `mouseup` relâché sur une iframe n'atteignait pas `window` : la fenêtre restait collée au curseur). Bouton
  // principal seulement, et un seuil avant de décrocher la fenêtre de son accrochage : un simple clic ne la bouge pas.
  const onHeaderPointerDown = (e) => {
    if (!interactive || maximized || compact || e.button !== 0) return;
    if (e.target.closest('button')) return;
    const head = e.currentTarget;
    head.setPointerCapture?.(e.pointerId);
    const start = { x: e.clientX, y: e.clientY, ox: geo.x, oy: geo.y };
    const threshold = e.pointerType === 'touch' || e.pointerType === 'pen' ? DRAG_THRESHOLD_TOUCH : DRAG_THRESHOLD;
    // Le plafond vertical est calculé en absolu (position réelle à l'écran) : la fenêtre s'arrête à
    // `safeTop` du haut du viewport, quelle que soit sa hauteur. Les plafonds tiennent compte d'un
    // décalage déjà large (fenêtre accrochée sur un grand écran, ou redimensionnée). Le viewport ne
    // change pas pendant un geste : on le mesure une fois, pas à chaque mouvement.
    const minY = safeTop - (fixedViewport().height - geo.h) / 2;
    const limX = Math.max(500, Math.abs(start.ox));
    const limY = Math.max(320, start.oy);
    let moved = false;
    let endMode = null;
    let raf = 0;
    let pending = null;
    const flush = () => {
      raf = 0;
      if (!pending) return;
      const { x, y } = pending;
      pending = null;
      setSnap(null);
      setGeo((g) => ({ ...g, x, y }));
    };
    const onMove = (ev) => {
      if (!moved) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < threshold) return;
        moved = true;
        endMode = beginDragMode('grabbing');
      }
      pending = {
        x: Math.max(-limX, Math.min(start.ox + (ev.clientX - start.x), limX)),
        y: Math.max(minY, Math.min(start.oy + (ev.clientY - start.y), limY)),
      };
      if (!raf) raf = requestAnimationFrame(flush);
    };
    const stop = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      cancelAnimationFrame(raf);
      flush();
      head.removeEventListener('pointermove', onMove);
      head.removeEventListener('pointerup', stop);
      head.removeEventListener('pointercancel', stop);
      head.removeEventListener('lostpointercapture', stop);
      try { head.releasePointerCapture?.(e.pointerId); } catch { /* déjà relâchée */ }
      endMode?.();
    };
    dragRef.current = { stop };
    head.addEventListener('pointermove', onMove);
    head.addEventListener('pointerup', stop);
    head.addEventListener('pointercancel', stop);
    head.addEventListener('lostpointercapture', stop);
  };

  const buttonBase = {
    width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted,
  };
  const hover = (bg, color) => ({
    onMouseEnter: (e) => { e.currentTarget.style.background = bg; e.currentTarget.style.color = color; },
    onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.muted; },
  });
  const maxLabel = maximized ? 'Restaurer' : 'Agrandir';
  // Petit écran : une fenêtre réduite d'office par la page (ce n'est pas celle du dessus) n'a pas de coin d'où partir ;
  // son icône se range en bas à droite, hors de la barre de titre de la fenêtre affichée.
  const iconOrigin = compact && minimized ? (() => { const b = fixedViewport(); return { x: b.left + b.width - 100, y: b.top + b.height - 150 }; })() : undefined;
  // Sans animation (préférence système), une fenêtre en cours de fermeture disparaît tout de suite.
  const hidden = minimized || (reduce && phase === 'window-closing');

  return createPortal(
    <>
    <div
      ref={wrapRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      data-smx-window={iconId || title}
      inert={minimized || undefined}
      onPointerDownCapture={onActivate}
      onFocusCapture={onActivate}
      style={{
        position: 'fixed',
        top: '50%',
        left: `calc(50% + ${sidebarWidth / 2}px)`,
        width: geo.w,
        height: geo.h,
        transform: `translate(calc(-50% + ${geo.x}px), calc(-50% + ${geo.y}px))`,
        zIndex,
        pointerEvents: interactive && !minimized ? 'auto' : 'none',
        // Réduite : cachée mais montée (le contenu garde son état), après le court fondu du cadre.
        visibility: hidden ? 'hidden' : 'visible',
        transition: minimized ? 'visibility 0s linear 0.22s' : 'none',
        // Réduite (ou en train de rouvrir), le cadre voyage vers/depuis son icône : rien ne doit le rogner.
        clipPath: minimized || flying || compact ? undefined : seamClip(snap),
        overscrollBehavior: 'contain',
        fontFamily: FONT,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility',
      }}
    >
      <div
        ref={frameRef}
        tabIndex={-1}
        data-smx-frame=""
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 14,
          overflow: 'hidden',
          overscrollBehavior: 'contain',
          border: `${borderWidth}px solid ${C.border}`,
          boxShadow: darkMode ? '0 24px 64px rgba(0,0,0,0.55)' : '0 24px 64px rgba(16,24,40,0.28)',
          display: 'flex',
          flexDirection: 'column',
          opacity: minimized ? 0 : 1,
          transformOrigin: '0 0',
          transform: minimized && shrink ? shrink : 'none',
          // Réduction : le cadre glisse vers l'icône puis se fond à l'arrivée (l'icône apparaît à ce moment).
          // Réouverture : animée par `playRestore` (depuis l'icône), pas par une transition CSS.
          transition: minimized ? 'opacity 0.12s linear 0.1s, transform 0.22s cubic-bezier(0.4,0,0.2,1)' : 'none',
          animation:
            phase === 'window-in' ? 'smx-win-pop 0.22s cubic-bezier(0.16,1,0.3,1) both'
              : phase === 'window-closing' ? 'smx-win-fall 0.6s cubic-bezier(0.55,0,0.85,0.35) both'
                : 'none',
        }}
      >
        {/* Barre supérieure : déplacer, réduire, agrandir, fermer. */}
        <div
          onPointerDown={onHeaderPointerDown}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            height: 42, flexShrink: 0, padding: '0 8px 0 14px',
            background: C.bg, borderBottom: `1px solid ${C.border}`,
            cursor: interactive && !maximized && !compact ? 'grab' : 'default',
            userSelect: 'none',
            // Le doigt qui glisse la barre la déplace : le navigateur ne doit pas le prendre pour un défilement.
            touchAction: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              background: darkMode ? '#fff' : '#1e2330',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img src={logo} alt="" style={{ width: 14, height: 14, objectFit: 'contain', filter: darkMode ? 'none' : 'brightness(0) invert(1)' }} />
            </div>
            <span id={titleId} style={{ fontSize: 12.5, fontWeight: 600, color: C.secondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              aria-label={`Réduire${labelSuffix}`}
              title="Réduire"
              onClick={minimize}
              style={{ ...buttonBase, cursor: 'pointer', transition: 'background 0.15s, color 0.15s' }}
              {...hover(C.subtle, C.text)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="5" y1="19" x2="19" y2="19" />
              </svg>
            </button>
            {!compact && (
              <button
                type="button"
                aria-label={`${maxLabel}${labelSuffix}`}
                title={maxLabel}
                onClick={toggleMaximize}
                style={{ ...buttonBase, cursor: 'pointer', transition: 'background 0.15s, color 0.15s' }}
                {...hover(C.subtle, C.text)}
              >
                {maximized ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
                    <rect x="8" y="4" width="12" height="12" rx="2" />
                    <path d="M4 8v10a2 2 0 0 0 2 2h10" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                )}
              </button>
            )}
            <button
              type="button"
              aria-label={closeLabel ?? `Fermer${labelSuffix}`}
              title={closeTitle}
              onClick={onClose}
              style={{ ...buttonBase, cursor: 'pointer', transition: 'background 0.15s, color 0.15s' }}
              {...hover('#ff3b30', '#fff')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
        {/* `minHeight: 0` : sans lui le contenu ferait déborder le cadre. */}
        <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>{children}</div>
      </div>
      {/* Poignées : sœurs du cadre arrondi (qui, lui, coupe son débordement). Redimensionner décroche la fenêtre. */}
      <WindowResizeHandles
        geometry={geo}
        safeTop={safeTop}
        min={{ w: 640, h: 440 }}
        disabled={!interactive || maximized || compact}
        onChange={(g) => { setSnap(null); setGeo(g); }}
      />
    </div>
    {interactive && icon && (
      <MinimizedIcon active={minimized} id={iconId || title} src={icon} label={title} onOpen={onRestore} autoFocus={iconFocus} origin={iconOrigin} />
    )}
    </>,
    document.body
  );
}
