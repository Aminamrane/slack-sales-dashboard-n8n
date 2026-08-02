// src/components/SalesRecordingsDetail.jsx
//
// Fiche d'un sales (maître-détail). Onglet ANALYSES par défaut : liste de ses RDV
// à gauche, scorecard complète du RDV sélectionné à droite. Onglets secondaires
// Vidéos + Transcriptions (pour approfondir). Analyses d'abord = premier plan.

import { useEffect, useMemo, useState } from "react";
import apiClient from "../services/apiClient";
import ScorecardView from "./ScorecardView.jsx";
import RecordingViewerModal from "./RecordingViewerModal.jsx";
import WeeklyBilanView from "./WeeklyBilanView.jsx";

const RDV_TONE = {
  R1: { label: "R1", color: "#3b82f6", bg: "#eff6ff" },
  R2: { label: "R2", color: "#fb923c", bg: "#fff7ed" },
};
const scColor = (s) => (s >= 80 ? "#2F6B4F" : s >= 70 ? "#0E4749" : s >= 60 ? "#B4740B" : "#A4262C");
const fmtDate = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }); }
  catch { return String(iso).slice(0, 10); }
};

function Avatar({ url, name, color, size = 40 }) {
  const initials = (name || "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  if (url) return <img src={url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: color || "#1e2330", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 700 }}>{initials}</div>
  );
}

export default function SalesRecordingsDetail({ sales, onBack, C, darkMode }) {
  const [tab, setTab] = useState("analyses");
  const [scList, setScList] = useState(null);
  const [scLoading, setScLoading] = useState(false);
  const [selId, setSelId] = useState(null);
  const [scData, setScData] = useState(null);
  const [scDataLoading, setScDataLoading] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [bilan, setBilan] = useState(null);

  useEffect(() => {
    let alive = true; setBilan(null);
    apiClient.getRecordingAnalysis(sales.email, "sales_weekly", sales.period)
      .then((r) => { if (alive) setBilan(r?.payload || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [sales.email, sales.period]);

  useEffect(() => {
    let alive = true; setScLoading(true); setScList(null); setSelId(null);
    apiClient.getScorecards(sales.email)
      .then((r) => {
        if (!alive) return;
        const list = (r?.scorecards || []).slice().sort((a, b) => (b.rdv_date || "").localeCompare(a.rdv_date || ""));
        setScList(list);
        if (list[0]) setSelId(list[0].id);
      })
      .catch(() => { if (alive) setScList([]); })
      .finally(() => { if (alive) setScLoading(false); });
    return () => { alive = false; };
  }, [sales.email]);

  useEffect(() => {
    if (!selId) { setScData(null); return; }
    let alive = true; setScDataLoading(true); setScData(null);
    apiClient.getScorecard(selId)
      .then((r) => { if (alive) setScData(r?.payload || null); })
      .catch(() => {})
      .finally(() => { if (alive) setScDataLoading(false); });
    return () => { alive = false; };
  }, [selId]);

  const videos = useMemo(() => (sales.recordings || []).filter((r) => r.kind === "video"), [sales]);
  const notes = useMemo(() => (sales.recordings || []).filter((r) => r.kind === "note" || r.kind === "transcript"), [sales]);

  const TABS = [
    { key: "analyses", label: "Analyses", n: sales.nb_scored || 0, color: "#2F6B4F" },
    { key: "videos", label: "Vidéos", n: videos.length, color: "#0891b2" },
    { key: "transcriptions", label: "Transcriptions", n: notes.length, color: "#7c3aed" },
  ];

  const rowStyle = (active) => ({
    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, cursor: "pointer",
    background: active ? (darkMode ? "rgba(6,182,212,0.14)" : "#eef7f9") : "transparent",
    border: `1px solid ${active ? "#0891b2" : "transparent"}`, transition: "background 0.12s",
  });

  return (
    <div style={{ animation: "recFade 0.28s ease both" }}>
      <style>{`@keyframes recFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .rec-hover:hover { background: ${darkMode ? "rgba(255,255,255,0.04)" : "#f6f7f9"} !important; }`}</style>

      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <button onClick={onBack} title="Retour" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 9, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>← Retour</button>
        <Avatar url={sales.avatar_url} name={sales.name} color={sales.teamColor} size={44} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>{sales.name}</div>
          <div style={{ fontSize: 12.5, color: C.muted }}>{sales.team}{sales.nb_scored ? ` · ${sales.nb_scored} analyse${sales.nb_scored > 1 ? "s" : ""}` : ""}</div>
        </div>
      </div>

      {/* Bilan hebdomadaire (en tête de fiche) */}
      <WeeklyBilanView bilan={bilan} C={C} darkMode={darkMode} />

      {/* Onglets */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 18 }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "9px 16px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit",
              fontSize: 13.5, fontWeight: active ? 700 : 500, color: active ? C.text : C.muted,
              borderBottom: `2px solid ${active ? t.color : "transparent"}`, marginBottom: -1,
            }}>
              {t.label} <span style={{ fontSize: 11.5, color: active ? t.color : C.muted, fontWeight: 700 }}>{t.n}</span>
            </button>
          );
        })}
      </div>

      {/* ANALYSES — maître-détail */}
      {tab === "analyses" && (
        scLoading ? (
          <div style={{ color: C.muted, fontSize: 13, padding: 24 }}>Chargement des analyses…</div>
        ) : !scList || scList.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 13.5, padding: "32px 4px" }}>Aucune analyse pour ce sales. {sales.error ? "(compte inaccessible)" : "Les scorecards apparaîtront après le prochain run d'analyse IA."}</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 300px) 1fr", gap: 18, alignItems: "start" }}>
            {/* Liste RDV */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, position: "sticky", top: 8 }}>
              {scList.map((sc) => {
                const tone = RDV_TONE[sc.rdv_type] || RDV_TONE.R1;
                const active = String(sc.id) === String(selId);
                return (
                  <div key={sc.id} className={active ? "" : "rec-hover"} onClick={() => setSelId(sc.id)} style={rowStyle(active)}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: tone.color, background: darkMode ? "transparent" : tone.bg, borderRadius: 5, padding: "1px 6px", flexShrink: 0 }}>{tone.label}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(sc.prospect || "Prospect").split("(")[0].trim()}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{fmtDate(sc.rdv_date)}</div>
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: scColor(sc.score), flexShrink: 0 }}>{sc.score}</span>
                  </div>
                );
              })}
            </div>
            {/* Scorecard */}
            <div style={{ background: "#FBFAF7", borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden", minHeight: 400 }}>
              {scDataLoading ? (
                <div style={{ color: "#4A5259", fontSize: 13, padding: 28 }}>Chargement de la scorecard…</div>
              ) : scData ? (
                <ScorecardView sc={scData} />
              ) : (
                <div style={{ color: "#4A5259", fontSize: 13, padding: 28 }}>Sélectionnez un RDV à gauche.</div>
              )}
            </div>
          </div>
        )
      )}

      {/* VIDÉOS */}
      {tab === "videos" && (
        videos.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 13.5, padding: "32px 4px" }}>Aucune vidéo pour ce sales.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {videos.map((r) => (
              <div key={r.id} className="rec-hover" onClick={() => setViewing({ rec: r, mode: "video" })} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, border: `1px solid ${C.border}`, cursor: "pointer" }}>
                <span style={{ fontSize: 14 }}>🎥</span>
                <span style={{ fontSize: 13, color: C.text, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                <span style={{ fontSize: 11.5, color: C.muted }}>{fmtDate(r.created)}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#0891b2" }}>▶ Lire</span>
              </div>
            ))}
          </div>
        )
      )}

      {/* TRANSCRIPTIONS */}
      {tab === "transcriptions" && (
        notes.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 13.5, padding: "32px 4px" }}>Aucune transcription pour ce sales.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {notes.map((r) => (
              <div key={r.id} className="rec-hover" onClick={() => setViewing({ rec: r, mode: "transcription" })} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, border: `1px solid ${C.border}`, cursor: "pointer" }}>
                <span style={{ fontSize: 14 }}>📄</span>
                {r.rdv && RDV_TONE[r.rdv] && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: RDV_TONE[r.rdv].color, background: darkMode ? "transparent" : RDV_TONE[r.rdv].bg, borderRadius: 5, padding: "1px 6px" }}>{RDV_TONE[r.rdv].label}</span>
                )}
                <span style={{ fontSize: 13, color: C.text, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                <span style={{ fontSize: 11.5, color: C.muted }}>{fmtDate(r.created)}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#7c3aed" }}>Lire</span>
              </div>
            ))}
          </div>
        )
      )}

      {viewing && (
        <RecordingViewerModal rec={viewing.rec} mode={viewing.mode} onClose={() => setViewing(null)} C={C} darkMode={darkMode} />
      )}
    </div>
  );
}
