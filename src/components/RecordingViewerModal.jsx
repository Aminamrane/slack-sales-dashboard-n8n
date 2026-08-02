// src/components/RecordingViewerModal.jsx
//
// Modal de lecture d'un enregistrement sales : lecteur vidéo (proxy stream via
// le service account, aucune vidéo stockée en interne) OU visionneuse de la
// transcription (note Gemini exportée en texte). createPortal(document.body)
// -> on remet fontFamily Inter explicitement (le portal sort du conteneur de police).

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import apiClient from "../services/apiClient";
import ScorecardView from "./ScorecardView.jsx";

const INTER = "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif";

export default function RecordingViewerModal({ rec, mode, onClose, C, darkMode }) {
  const [trans, setTrans] = useState(null);
  const [scData, setScData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (mode !== "transcription" || !rec) return;
    let alive = true;
    setLoading(true); setErr(null); setTrans(null);
    apiClient.getRecordingTranscription(rec.id, rec.owner)
      .then((r) => { if (alive) setTrans(r); })
      .catch((e) => { if (alive) setErr(e?.message || "erreur"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [rec, mode]);

  useEffect(() => {
    if (mode !== "scorecard" || !rec?.scorecard?.id) return;
    let alive = true;
    setLoading(true); setErr(null); setScData(null);
    apiClient.getScorecard(rec.scorecard.id)
      .then((r) => { if (alive) setScData(r?.payload || null); })
      .catch((e) => { if (alive) setErr(e?.message || "erreur"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [rec, mode]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!rec) return null;
  const streamUrl = mode === "video" ? apiClient.getRecordingStreamUrl(rec.id, rec.owner) : null;
  const body = darkMode ? "#1a1c25" : "#fff";

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9000, background: "rgba(6,8,15,0.62)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        fontFamily: INTER, animation: "recModalIn 0.18s ease both",
      }}
    >
      <style>{`@keyframes recModalIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes recPanelIn { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: none; } }`}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: body, borderRadius: 16, fontFamily: INTER,
          width: mode === "video" ? "min(920px, 94vw)" : mode === "scorecard" ? "min(920px, 94vw)" : "min(760px, 94vw)",
          maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "0 24px 70px rgba(0,0,0,0.45)", border: `1px solid ${C.border}`,
          animation: "recPanelIn 0.22s cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 16 }}>{mode === "video" ? "🎥" : mode === "scorecard" ? "📊" : "📄"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rec.name}</div>
            {mode === "transcription" && trans?.words != null && (
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>{trans.words.toLocaleString("fr-FR")} mots</div>
            )}
          </div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: C.muted, fontSize: 22, lineHeight: 1, cursor: "pointer", padding: 4, fontFamily: INTER }}>×</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: (mode === "video" || mode === "scorecard") ? 0 : "18px 22px", background: mode === "video" ? "#000" : mode === "scorecard" ? "#FBFAF7" : body }}>
          {mode === "video" ? (
            <video src={streamUrl} controls autoPlay preload="metadata" style={{ width: "100%", maxHeight: "78vh", background: "#000", display: "block" }} />
          ) : loading ? (
            <div style={{ color: C.muted, fontSize: 13, padding: "24px 4px" }}>Chargement…</div>
          ) : err ? (
            <div style={{ color: "#ef4444", fontSize: 13, padding: "24px 4px" }}>{mode === "scorecard" ? "Scorecard indisponible." : "Transcription indisponible."} {String(err).slice(0, 140)}</div>
          ) : mode === "scorecard" ? (
            <ScorecardView sc={scData} />
          ) : (
            <div>
              {!trans?.has_verbatim && (
                <div style={{ fontSize: 12, color: "#b45309", background: darkMode ? "rgba(180,83,9,0.15)" : "#fff7ed", borderRadius: 8, padding: "9px 12px", marginBottom: 14, lineHeight: 1.5 }}>
                  ⚠ Verbatim complet non détecté (note Gemini sans transcription intégrale, ou appel très court). Le texte ci-dessous est le contenu brut de la note.
                </div>
              )}
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: INTER, fontSize: 13, lineHeight: 1.65, color: C.text, margin: 0 }}>
                {trans?.verbatim || trans?.text || "(vide)"}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
