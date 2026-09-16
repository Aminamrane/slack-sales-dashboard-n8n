// src/components/RecordingViewerModal.jsx
//
// Modal de lecture d'un enregistrement sales : lecteur vidéo (proxy stream via
// le service account, aucune vidéo stockée en interne) OU visionneuse de la
// transcription (note Gemini exportée en texte). createPortal(document.body)
// -> on remet fontFamily Inter explicitement (le portal sort du conteneur de police).

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import apiClient from "../services/apiClient";
import { Video, FileText, ChartNoAxesCombined, LoaderCircle, X } from "lucide-react";
import "./SalesRecordings.css";
import ScorecardView from "./ScorecardView.jsx";

const INTER = "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif";

export default function RecordingViewerModal({ rec, mode, onClose, C, darkMode }) {
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const [documentView, setDocumentView] = useState("transcription");
  const [trans, setTrans] = useState(null);
  const [scData, setScData] = useState(null);
  const [loading, setLoading] = useState(mode !== "video");
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoAttempt, setVideoAttempt] = useState(0);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (mode !== "transcription" || !rec) return;
    let alive = true;
    setLoading(true); setErr(null); setTrans(null); setDocumentView("transcription");
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

  useEffect(() => { setVideoLoading(true); setErr(null); }, [rec?.id, mode]);

  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = [...(dialogRef.current?.querySelectorAll('button, a[href], video[controls], [tabindex="0"]') || [])];
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [onClose]);

  if (!rec) return null;
  const streamUrl = mode === "video" ? apiClient.getRecordingStreamUrl(rec.id, rec.owner) : null;
  const Icon = mode === "video" ? Video : mode === "scorecard" ? ChartNoAxesCombined : FileText;
  const body = darkMode ? "#1a1c25" : "#fff";

  return createPortal(
    <div className={`recordings-viewer sales-recordings-ui${darkMode ? " is-dark" : ""}`}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9000, background: "rgba(6,8,15,0.62)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        fontFamily: INTER, animation: "recModalIn 0.18s ease both",
      }}
    >
      <style>{`@keyframes recModalIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes recPanelIn { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: none; } }`}</style>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={rec.name}
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
          <Icon size={24} strokeWidth={1.8} color={C.muted} aria-hidden="true" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rec.name}</div>
            {mode === "transcription" && trans?.words != null && (
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>{trans.has_verbatim ? "Transcription disponible" : "Notes de réunion"}</div>
            )}
          </div>
          <button ref={closeRef} aria-label="Fermer le document" onClick={onClose} style={{ border: "none", background: "transparent", color: C.muted, fontSize: 22, lineHeight: 1, cursor: "pointer", padding: 4, fontFamily: INTER }}><X size={22} aria-hidden="true" /></button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: (mode === "video" || mode === "scorecard") ? 0 : "18px 22px", background: mode === "video" ? "#000" : mode === "scorecard" ? "#FBFAF7" : body }}>
          {mode === "video" ? (
            <div className="recordings-video-stage" aria-busy={videoLoading && !err}>
              <video key={`${rec.id}-${videoAttempt}`} src={streamUrl} controls autoPlay preload="auto"
                onLoadStart={() => { setVideoLoading(true); setErr(null); }}
                onLoadedData={() => setVideoLoading(false)} onCanPlay={() => setVideoLoading(false)}
                onPlaying={() => setVideoLoading(false)} onWaiting={() => setVideoLoading(true)}
                onError={() => { setVideoLoading(false); setErr("video"); }} />
              {videoLoading && !err && <div className="recordings-video-loading" role="status" aria-live="polite"><LoaderCircle size={30} className="is-spinning" aria-hidden="true" /><span>Chargement de la vidéo…</span></div>}
              {err && <div className="recordings-video-error" role="alert"><span>La vidéo n’a pas pu être chargée.</span><button onClick={() => { setErr(null); setVideoLoading(true); setVideoAttempt(n => n + 1); }}>Réessayer</button></div>}
            </div>
          ) : loading ? (
            <div className="recordings-document-loading" role="status" aria-live="polite" aria-busy="true">
              <div><LoaderCircle size={25} className="is-spinning" aria-hidden="true" /><span>{mode === "scorecard" ? "Chargement de l’analyse…" : "Chargement du document…"}</span></div>
              <div className="recordings-text-skeleton" aria-hidden="true"><i /><i /><i /><i /><i /></div>
            </div>
          ) : err ? (
            <div style={{ color: "#ef4444", fontSize: 13, padding: "24px 4px" }}>{mode === "scorecard" ? "Scorecard indisponible." : "Transcription indisponible."} </div>
          ) : mode === "scorecard" ? (
            <ScorecardView sc={scData} />
          ) : (
            <div>
              {trans?.has_verbatim && (
                <div className="recordings-document-tabs">
                  <button aria-pressed={documentView === "transcription"} onClick={() => setDocumentView("transcription")}>Transcription</button>
                  <button aria-pressed={documentView === "notes"} onClick={() => setDocumentView("notes")}>Document complet</button>
                </div>
              )}
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: INTER, fontSize: 13, lineHeight: 1.65, color: C.text, margin: 0 }}>
                {(documentView === "transcription" ? trans?.verbatim || trans?.text : trans?.text) || "Ce document ne contient pas encore de texte."}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
