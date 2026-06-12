import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import apiClient from "../services/apiClient";

/**
 * Affichage de la créa (publicité) avec laquelle un lead s'est inscrit, depuis le
 * panneau détail du TrackingSheet sales. Tout est isolé ici (hook + bouton + pop-up)
 * pour que l'insertion dans le fichier sacré TrackingSheet.jsx reste minimale.
 *
 * Données : GET /api/v1/tracking/lead-creative/{lead_id}
 *   -> { matched, creative: { image_url, video_url, *_thumbnail_url, title, description }, ... }
 *
 * Motion calquée sur la modale Campagnes existante (grandit depuis le bouton,
 * cubic-bezier expo-out, backdrop, bouton close glass) pour rester cohérent.
 */

// Construit l'URL absolue d'un asset (/uploads/...) — même logique que Campaigns.jsx.
const mediaUrl = (p) => {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  return `${apiClient.baseUrl}${p}`;
};

/**
 * Pré-charge la créa d'un lead. À appeler au top-level du composant (pas dans une
 * IIFE/condition) — clé sur l'id du lead détaillé. Renvoie { loading, data }.
 */
export function useLeadCreative(leadId) {
  const [state, setState] = useState({ loading: false, data: null });

  useEffect(() => {
    if (!leadId) {
      setState({ loading: false, data: null });
      return;
    }
    let cancelled = false;
    setState({ loading: true, data: null });
    apiClient
      .get(`/api/v1/tracking/lead-creative/${leadId}`)
      .then((d) => { if (!cancelled) setState({ loading: false, data: d }); })
      .catch(() => { if (!cancelled) setState({ loading: false, data: null }); });
    return () => { cancelled = true; };
  }, [leadId]);

  return state;
}

/**
 * Petit bouton (haut-droite de l'onglet Détails). Icône active si une créa existe,
 * sinon icône grisée + tooltip "nous n'avons pas d'info sur cette créa".
 * Au clic (si matché) : capture le rect du bouton et appelle onOpen(creative, rect).
 */
export function CreativeButton({ data, loading, iconActive, iconEmpty, darkMode, onOpen, size = 30, style }) {
  const ref = useRef(null);
  const [hover, setHover] = useState(false);
  const matched = !!data?.matched;
  const creative = data?.creative || null;

  const handleClick = () => {
    if (!matched || !creative || !ref.current) return;
    onOpen(creative, ref.current.getBoundingClientRect());
  };

  return (
    <div style={{ position: "relative", display: "inline-flex", ...style }}>
      <button
        ref={ref}
        onClick={handleClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label={matched ? "Voir la créa du lead" : "Pas d'info sur cette créa"}
        style={{
          width: size, height: size, padding: 4, borderRadius: 9,
          border: "none", background: "transparent",
          cursor: matched ? "pointer" : "default",
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: loading ? 0.45 : 1,
          transform: hover && matched ? "translateY(-1px) scale(1.06)" : "none",
          transition: "transform 0.18s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s",
        }}
      >
        <img
          src={matched ? iconActive : iconEmpty}
          alt=""
          draggable={false}
          style={{
            width: "100%", height: "100%", objectFit: "contain",
            pointerEvents: "none",
          }}
        />
      </button>

      {/* Tooltip "pas d'info" au survol de l'état grisé */}
      {!matched && !loading && (
        <span
          style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0,
            whiteSpace: "nowrap", pointerEvents: "none", zIndex: 50,
            padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 500,
            color: darkMode ? "#e6e8f0" : "#fff",
            background: darkMode ? "rgba(40,42,54,0.97)" : "rgba(20,22,30,0.92)",
            boxShadow: "0 6px 20px rgba(0,0,0,0.22)",
            opacity: hover ? 1 : 0,
            transform: hover ? "translateY(0)" : "translateY(-4px)",
            transition: "opacity 0.18s ease, transform 0.18s ease",
          }}
        >
          Nous n'avons pas d'info sur cette créa
        </span>
      )}
    </div>
  );
}

/**
 * Pop-up plein écran de la créa. Grandit depuis le rect du bouton déclencheur.
 * creative = { image_url, video_url, image_thumbnail_url, video_thumbnail_url, title, description }
 */
export function CreativePopup({ creative, triggerRect, darkMode, onClose }) {
  const [closing, setClosing] = useState(false);

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => { onClose(); }, 380);
  };

  // Fermeture à l'Échap
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  if (!creative) return null;

  const rect = triggerRect || { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 40, height: 40 };
  const hasVideo = !!creative.video_url;
  const bg = darkMode ? "#1e1f28" : "#ffffff";
  const text = darkMode ? "#eef0f6" : "#1e2330";
  const muted = darkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)";
  const textSoft = darkMode ? "rgba(238,240,246,0.82)" : "#33373f";

  return createPortal(
    <>
      <style>{`
        @keyframes creaPopOpen {
          0%   { left: var(--cp-left); top: var(--cp-top);
                 width: var(--cp-width); height: var(--cp-height);
                 border-radius: 12px; opacity: 0.6; transform: translate(0,0); }
          100% { left: 50%; top: 50%;
                 width: min(92vw, 560px); height: auto; max-height: min(88vh, 780px);
                 border-radius: 26px; opacity: 1; transform: translate(-50%,-50%); }
        }
        @keyframes creaMediaIn {
          from { opacity: 0; transform: scale(0.98); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: "fixed", inset: 0, zIndex: 99990,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)",
          opacity: closing ? 0 : 1,
          transition: "opacity 0.38s ease",
        }}
      />

      {/* Carte qui grandit depuis le bouton */}
      <div
        style={{
          position: "fixed", zIndex: 99991,
          display: "flex", flexDirection: "column",
          background: bg, overflow: "hidden",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          boxShadow: "0 30px 90px rgba(0,0,0,0.28), 0 10px 30px rgba(0,0,0,0.12)",
          "--cp-left": `${rect.left}px`, "--cp-top": `${rect.top}px`,
          "--cp-width": `${rect.width}px`, "--cp-height": `${rect.height}px`,
          ...(closing
            ? {
                left: rect.left, top: rect.top, width: rect.width, height: rect.height,
                borderRadius: 12, opacity: 0,
                transform: "translate(0,0)",
                transition: "all 0.38s cubic-bezier(0.4,0,0.6,1)",
              }
            : {
                left: "50%", top: "50%", transform: "translate(-50%,-50%)",
                width: "min(92vw, 560px)", maxHeight: "min(88vh, 780px)",
                borderRadius: 26,
                animation: "creaPopOpen 0.5s cubic-bezier(0.16,1,0.3,1) forwards",
              }),
        }}
      >
        {/* Média (image ou vidéo) — contain pour voir toute la pub */}
        <div
          style={{
            position: "relative", flexShrink: 0,
            background: bg,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16, paddingBottom: 8,
          }}
        >
          {hasVideo ? (
            <video
              controls
              playsInline
              poster={mediaUrl(creative.video_thumbnail_url)}
              style={{ width: "100%", maxHeight: "56vh", objectFit: "contain", borderRadius: 16, background: "#000", animation: "creaMediaIn 0.45s cubic-bezier(0.16,1,0.3,1) 0.1s both" }}
            >
              <source src={mediaUrl(creative.video_url)} />
            </video>
          ) : (
            <img
              src={mediaUrl(creative.image_url || creative.image_thumbnail_url)}
              alt={creative.title || "Créa publicitaire"}
              style={{ width: "100%", maxHeight: "56vh", objectFit: "contain", display: "block", borderRadius: 16, boxShadow: darkMode ? "0 6px 22px rgba(0,0,0,0.45)" : "0 6px 22px rgba(0,0,0,0.13)", animation: "creaMediaIn 0.45s cubic-bezier(0.16,1,0.3,1) 0.1s both" }}
            />
          )}

          {/* Close glass */}
          <button
            onClick={(e) => { e.stopPropagation(); close(); }}
            aria-label="Fermer"
            style={{
              position: "absolute", top: 26, right: 26,
              width: 34, height: 34, borderRadius: "50%",
              background: "rgba(0,0,0,0.4)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.16)", color: "#fff",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s", fontFamily: "inherit",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.6)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.4)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Texte de la pub */}
        <div className="pc-scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 26px 28px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1.4, textTransform: "uppercase", color: muted, marginBottom: 12 }}>
            Publicité d'inscription
          </div>
          {creative.title && (
            <div style={{ fontSize: 19, fontWeight: 600, color: text, marginBottom: 10, letterSpacing: "-0.022em" }}>
              {creative.title}
            </div>
          )}
          {creative.description ? (
            <div style={{ fontSize: 15, lineHeight: 1.72, color: textSoft, whiteSpace: "pre-wrap", letterSpacing: "-0.011em" }}>
              {creative.description}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: muted, fontStyle: "italic" }}>Pas de texte pour cette créa.</div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

export default CreativePopup;
