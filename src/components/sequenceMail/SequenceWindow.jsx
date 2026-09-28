// src/components/sequenceMail/SequenceWindow.jsx
//
// Fenêtre flottante des outils de séquence (« Gestion de séquence », « Schéma de séquence ») :
// barre de titre (déplacer, réduire, agrandir, fermer), poignées de redimensionnement et, à
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

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import WindowResizeHandles from './WindowResizeHandles';
import { fixedViewport } from './viewportBox';

/** Marge (px) laissée après la sidebar, à droite et en bas : celle de « Agrandir ». */
const EDGE = 8;
/** Sous la sidebar (z-index 40) et la navbar (1000) : tirée dessus, la fenêtre passe dessous, comme avant. */
export const SEQUENCE_WINDOW_Z = 38;
const FONT = 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif';

/**
 * @brief Géométrie `{ w, h, x, y }` d'une fenêtre qui occupe `where` : la moitié gauche, la moitié droite
 * ou toute la zone utile (à droite de la sidebar, sous la navbar). `(x, y)` est le décalage du centre du
 * cadre par rapport à son centre de repos.
 * @note Tout se calcule dans le bloc conteneur MESURÉ du `position: fixed` (cf. viewportBox.js), celui
 * sur lequel le CSS résout `top: 50%` et `left: calc(50% + …)` : la fenêtre tombe donc exactement sur sa cible.
 */
function fit(where, sidebarWidth, safeTop) {
  const box = fixedViewport();
  const area = {
    left: box.left + sidebarWidth + EDGE,
    right: box.left + box.width - EDGE,
    top: box.top + safeTop,
    bottom: box.top + box.height - EDGE,
  };
  const mid = Math.round((area.left + area.right) / 2);
  const left = where === 'right' ? mid : area.left;
  const right = where === 'left' ? mid : area.right;
  return {
    w: Math.max(200, right - left),
    h: Math.max(200, area.bottom - area.top),
    x: (left + right) / 2 - (box.left + box.width / 2 + sidebarWidth / 2),
    y: (area.top + area.bottom) / 2 - (box.top + box.height / 2),
  };
}

const sameGeometry = (a, b) => a.w === b.w && a.h === b.h && a.x === b.x && a.y === b.y;

/**
 * @brief Rogne l'ombre du côté de la jointure : sans cela, l'ombre de chaque fenêtre assombrirait la voisine.
 * @note Les autres côtés gardent une réserve énorme, pour ne pas couper l'animation de chute à la fermeture.
 */
const seamClip = (snap) =>
  snap === 'left' ? 'inset(-200vh 0 -200vh -200vw)' : snap === 'right' ? 'inset(-200vh -200vw -200vh 0)' : undefined;

/**
 * @param title Titre affiché dans la barre.
 * @param side Moitié occupée à l'ouverture : `'left'` | `'right'`.
 * @param phase `'window-in'` | `'window-open'` | `'window-closing'` : pilote l'animation ; interactive quand `'window-open'`.
 * @param sidebarWidth Largeur de la sidebar (px) : la zone utile commence après elle.
 * @param safeTop Hauteur réservée en haut (navbar flottante) : la fenêtre ne la recouvre jamais.
 * @param colors Palette `getColors` de la page (`bg`, `border`, `secondary`, `muted`, `subtle`).
 * @param darkMode Mode sombre (tuile du logo et ombre).
 * @param logo Logo de la barre de titre.
 * @param borderWidth Épaisseur du contour (px).
 * @param labelSuffix Ajouté aux noms accessibles des trois boutons, pour distinguer les fenêtres.
 * @param zIndex Ordre d'empilement (la fenêtre active passe devant).
 * @param onActivate Appelé quand on prend la main sur la fenêtre (clic, agrandissement).
 * @param onClose Fermeture demandée.
 */
export default function SequenceWindow({
  title, side, phase, sidebarWidth, safeTop = 64, colors: C, darkMode = false, logo,
  borderWidth = 1, labelSuffix = '', zIndex = SEQUENCE_WINDOW_Z, onActivate, onClose, children,
}) {
  const interactive = phase === 'window-open';
  const [snap, setSnap] = useState(side);
  const [maximized, setMaximized] = useState(false);
  const [geo, setGeo] = useState(() => fit(side, sidebarWidth, safeTop));
  const restoreRef = useRef(null);
  const dragRef = useRef(null);
  useEffect(() => () => dragRef.current?.stop(), []);

  // Accrochée ou agrandie, la fenêtre suit le viewport : redimensionnement du navigateur, repli de la
  // sidebar, apparition d'une barre de défilement. Sans effet dès qu'elle a été déplacée.
  const where = maximized ? 'full' : snap;
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

  const toggleMaximize = () => {
    if (!interactive) return;
    onActivate?.();
    if (maximized) {
      const r = restoreRef.current;
      setMaximized(false);
      if (r?.snap) {
        setSnap(r.snap);
        setGeo(fit(r.snap, sidebarWidth, safeTop));
      } else if (r) {
        setGeo(r.geo);
      }
      return;
    }
    restoreRef.current = { geo, snap };
    setSnap(null);
    setMaximized(true);
    setGeo(fit('full', sidebarWidth, safeTop));
  };

  // Déplacement par la barre de titre — décalage RELATIF au centre de repos, comme le reste du cadre.
  const onHeaderMouseDown = (e) => {
    if (!interactive || maximized) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY, ox: geo.x, oy: geo.y };
    // Le plafond vertical est calculé en absolu (position réelle à l'écran) : la fenêtre s'arrête à
    // `safeTop` du haut du viewport, quelle que soit sa hauteur. Les plafonds tiennent compte d'un
    // décalage déjà large (fenêtre accrochée sur un grand écran, ou redimensionnée). Le viewport ne
    // change pas pendant un geste : on le mesure une fois, pas à chaque mouvement.
    const minY = safeTop - (fixedViewport().height - geo.h) / 2;
    const limX = Math.max(500, Math.abs(start.ox));
    const limY = Math.max(320, start.oy);
    const onMove = (ev) => {
      const x = Math.max(-limX, Math.min(start.ox + (ev.clientX - start.x), limX));
      const y = Math.max(minY, Math.min(start.oy + (ev.clientY - start.y), limY));
      setSnap(null);
      setGeo((g) => ({ ...g, x, y }));
    };
    const stop = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', stop);
    };
    dragRef.current = { stop };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', stop);
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

  return createPortal(
    <div
      onMouseDownCapture={onActivate}
      style={{
        position: 'fixed',
        top: '50%',
        left: `calc(50% + ${sidebarWidth / 2}px)`,
        width: geo.w,
        height: geo.h,
        transform: `translate(calc(-50% + ${geo.x}px), calc(-50% + ${geo.y}px))`,
        zIndex,
        pointerEvents: interactive ? 'auto' : 'none',
        clipPath: seamClip(snap),
        overscrollBehavior: 'contain',
        fontFamily: FONT,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility',
      }}
    >
      <div
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
          animation:
            phase === 'window-in' ? 'ceoBotIaWindowPop 0.22s cubic-bezier(0.16,1,0.3,1) both'
              : phase === 'window-closing' ? 'ceoBotIaFallOut 0.6s cubic-bezier(0.55,0,0.85,0.35) both'
                : 'none',
        }}
      >
        {/* Barre supérieure : déplacer, réduire (inerte), agrandir, fermer. */}
        <div
          onMouseDown={onHeaderMouseDown}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            height: 42, flexShrink: 0, padding: '0 8px 0 14px',
            background: C.bg, borderBottom: `1px solid ${C.border}`,
            cursor: interactive && !maximized ? 'grab' : 'default',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              background: darkMode ? '#fff' : '#1e2330',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img src={logo} alt="" style={{ width: 14, height: 14, objectFit: 'contain', filter: darkMode ? 'none' : 'brightness(0) invert(1)' }} />
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.secondary }}>{title}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              aria-label={`Réduire${labelSuffix}`}
              title="Réduire"
              onMouseDown={(e) => e.stopPropagation()}
              style={{ ...buttonBase, cursor: 'default' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="5" y1="19" x2="19" y2="19" />
              </svg>
            </button>
            <button
              type="button"
              aria-label={`${maxLabel}${labelSuffix}`}
              title={maxLabel}
              onMouseDown={(e) => e.stopPropagation()}
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
            <button
              type="button"
              aria-label={`Fermer${labelSuffix}`}
              title="Fermer"
              onMouseDown={(e) => e.stopPropagation()}
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
        disabled={!interactive || maximized}
        onChange={(g) => { setSnap(null); setGeo(g); }}
      />
    </div>,
    document.body
  );
}
