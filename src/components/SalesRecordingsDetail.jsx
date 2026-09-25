// src/components/SalesRecordingsDetail.jsx
//
// Fiche d'un sales, présentée comme un DOSSIER À ONGLETS (style éditorial du bilan
// de coaching : pastille ambre, IBM Plex Mono). Un seul volet visible à la fois pour
// éviter les pages à rallonge :
//   · Bilan de la semaine  → dossier de coaching (WeeklyBilanView), volet par défaut
//   · Analyses             → maître-détail RDV ↔ scorecard complète
//   · Transcriptions       → notes/transcripts bruts
//   · Vidéos               → enregistrements Meet (proxy stream)

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Video, FileText, ChartNoAxesCombined, BookOpen, Share2, ArrowUpRight, Phone } from "lucide-react";
import "./SalesRecordings.css";
import apiClient from "../services/apiClient";
import ScorecardView from "./ScorecardView.jsx";
import RecordingViewerModal from "./RecordingViewerModal.jsx";
import WeeklyBilanView from "./WeeklyBilanView.jsx";
import SalesCallsPanel from "./SalesCallsPanel.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";

const RDV_TONE = {
  R1: { label: "R1", color: "#3b82f6", bg: "#eff6ff" },
  R2: { label: "R2", color: "#fb923c", bg: "#fff7ed" },
};

// Chargement : anneau qui tourne + libellé, sur la palette encre/ambre du dossier.
function Loading({ label = "Chargement…" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "48px 24px" }}>
      <span className="rec-spin" />
      <span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 11.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8A9099" }}>{label}</span>
    </div>
  );
}
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

export default function SalesRecordingsDetail({ sales, onBack, C, darkMode, initialTab = "analyses", loadingFiles = false }) {
  const [tab, setTab] = useState(initialTab);
  const [scList, setScList] = useState(null);
  const [scLoading, setScLoading] = useState(false);
  const [scError, setScError] = useState(false);
  const [selId, setSelId] = useState(null);
  const [scData, setScData] = useState(null);
  const [scDataLoading, setScDataLoading] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [bilan, setBilan] = useState(null);
  const [bilanLoading, setBilanLoading] = useState(true);

  useEffect(() => { setTab(initialTab); setViewing(null); }, [sales.email, initialTab]);

  // Polices éditoriales (mêmes que le bilan de coaching) pour les onglets
  useEffect(() => {
    const id = "owner-scorecard-fonts";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap";
    document.head.appendChild(l);
  }, []);

  useEffect(() => {
    let alive = true; setBilan(null); setBilanLoading(true);
    apiClient.getRecordingAnalysis(sales.email, "sales_weekly", sales.period)
      .then((r) => { if (alive) setBilan(r?.payload || null); })
      .catch(() => {})
      .finally(() => { if (alive) setBilanLoading(false); });
    return () => { alive = false; };
  }, [sales.email, sales.period]);

  useEffect(() => {
    let alive = true; setScLoading(true); setScError(false); setScList(null); setSelId(null);
    apiClient.getScorecards(sales.email)
      .then((r) => {
        if (!alive) return;
        const list = (r?.scorecards || []).slice().sort((a, b) => (b.rdv_date || "").localeCompare(a.rdv_date || ""));
        setScList(list);
        if (list[0]) setSelId(list[0].id);
      })
      .catch(() => { if (alive) setScError(true); })
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

  const videos = useMemo(() => (sales.recordings || []).filter((r) => r.kind === "video" && !r.shared), [sales]);
  const notes = useMemo(() => (sales.recordings || []).filter((r) => (r.kind === "note" || r.kind === "transcript") && !r.shared), [sales]);

  const shared = useMemo(() => (sales.recordings || []).filter((r) => r.shared), [sales]);

  const TABS = [
    { key: "analyses", label: "Analyses", icon: ChartNoAxesCombined, n: scList?.length ?? sales.nb_scored ?? 0 },
    { key: "calls", label: "Appels", icon: Phone, n: sales.nb_calls ?? undefined },
    { key: "videos", label: "Vidéos", icon: Video, n: videos.length },
    { key: "transcriptions", label: "Notes & transcriptions", icon: FileText, n: notes.length },
    ...(shared.length ? [{ key: "shared", label: "Partagés avec ce sales", icon: Share2, n: shared.length }] : []),
    { key: "bilan", label: "Bilan de la semaine", icon: BookOpen },
  ];

  const rowStyle = (active) => ({
    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, cursor: "pointer",
    background: active ? (darkMode ? "rgba(6,182,212,0.14)" : "#eef7f9") : "transparent",
    border: `1px solid ${active ? "#0891b2" : "transparent"}`, transition: "background 0.12s",
  });

  return (
    <div className={`recordings-detail sales-recordings-ui${darkMode ? " is-dark" : ""}`} style={{ animation: "recFade 0.28s ease both" }}>
      <style>{`@keyframes recFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes recSpin { to { transform: rotate(360deg); } }
        .rec-spin { width: 30px; height: 30px; border-radius: 50%; border: 2.5px solid ${darkMode ? "rgba(255,255,255,0.12)" : "#E1DED5"}; border-top-color: #E8A317; animation: recSpin 0.7s linear infinite; }
        .rec-hover:hover { background: ${darkMode ? "rgba(255,255,255,0.04)" : "#f6f7f9"} !important; }
        .owner-rectabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 22px;}
        .owner-rectabs .rt{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;letter-spacing:.13em;text-transform:uppercase;font-weight:600;color:${C.muted};background:transparent;border:1.5px solid ${C.border};border-radius:999px;padding:9px 16px;cursor:pointer;transition:color .14s,background .14s,border-color .14s;line-height:1;}
        .owner-rectabs .rt:hover{color:${C.text};border-color:${C.muted};}
        .owner-rectabs .rt.on{color:#14181C;background:#E8A317;border-color:#14181C;}
        .owner-rectabs .rt .n{margin-left:7px;opacity:.7;font-weight:600;}
        .owner-rectabs .rt.on .n{opacity:.85;}`}</style>

      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <button onClick={onBack} title="Retour" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 9, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}><ArrowLeft size={16} aria-hidden="true" /> Retour</button>
        <Avatar url={sales.avatar_url} name={sales.name} color={sales.teamColor} size={44} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>{sales.name}</div>
          <div style={{ fontSize: 12.5, color: C.muted }}>{sales.team}{sales.nb_scored ? ` · ${sales.nb_scored} analyse${sales.nb_scored > 1 ? "s" : ""}` : ""}</div>
        </div>
      </div>

      {/* Onglets éditoriaux (pastille ambre = onglet actif, écho au bilan) */}
      <div className="owner-rectabs">
        {TABS.map((t) => (
          <button key={t.key} className={`rt${tab === t.key ? " on" : ""}`} aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
            <t.icon size={17} strokeWidth={1.8} aria-hidden="true" />{t.label}{t.n != null && <span className="n">{t.n}</span>}
          </button>
        ))}
      </div>

      <div key={tab} style={{ animation: "recFade 0.24s ease both" }}>

      {/* APPELS ALLO — même lecture que le tracking finance, périmètre de la page */}
      {tab === "calls" && (
        <ErrorBoundary key={`calls-${sales.email}`}>
          <SalesCallsPanel email={sales.email} name={sales.name} linked={sales.allo_linked !== false} />
        </ErrorBoundary>
      )}

      {/* BILAN DE LA SEMAINE — dossier de coaching */}
      {tab === "bilan" && (
        bilanLoading ? (
          <Loading label="Chargement du bilan…" />
        ) : (
          <ErrorBoundary key={`bilan-${sales.email}`}>
            <WeeklyBilanView bilan={bilan} salesName={sales.name} avatarUrl={sales.avatar_url} team={sales.team} />
          </ErrorBoundary>
        )
      )}

      {/* ANALYSES — maître-détail */}
      {tab === "analyses" && (
        scLoading ? (
          <Loading label="Chargement des analyses…" />
        ) : scError ? (
          <div role="alert" className="recordings-empty">Les analyses n’ont pas pu être chargées. Revenez à la liste pour réessayer.</div>
        ) : !scList || scList.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 13.5, padding: "32px 4px" }}>Aucune analyse disponible pour le moment.</div>
        ) : (
          <div className="recordings-analysis-layout" style={{ display: "grid", gridTemplateColumns: "minmax(240px, 300px) 1fr", gap: 18, alignItems: "start" }}>
            {/* Liste RDV */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, position: "sticky", top: 8 }}>
              {scList.map((sc) => {
                const tone = RDV_TONE[sc.rdv_type] || RDV_TONE.R1;
                const active = String(sc.id) === String(selId);
                return (
                  <button type="button" aria-pressed={active} key={sc.id} className={active ? "" : "rec-hover"} onClick={() => setSelId(sc.id)} style={{ ...rowStyle(active), textAlign: "left", fontFamily: "inherit" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: tone.color, background: darkMode ? "transparent" : tone.bg, borderRadius: 5, padding: "1px 6px", flexShrink: 0 }}>{tone.label}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(sc.prospect || "Prospect").split("(")[0].trim()}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{fmtDate(sc.rdv_date)}</div>
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: scColor(sc.score), flexShrink: 0 }}>{sc.score}</span>
                  </button>
                );
              })}
            </div>
            {/* Scorecard */}
            <div style={{ background: "#FBFAF7", borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden", minHeight: 400 }}>
              {scDataLoading ? (
                <Loading label="Chargement de la scorecard…" />
              ) : scData ? (
                <ErrorBoundary key={selId}>
                  <ScorecardView sc={scData} />
                </ErrorBoundary>
              ) : (
                <div style={{ color: "#4A5259", fontSize: 13, padding: 28 }}>Sélectionnez un RDV à gauche.</div>
              )}
            </div>
          </div>
        )
      )}

      {["videos", "transcriptions", "shared"].includes(tab) && (() => {
        const files = tab === "videos" ? videos : tab === "shared" ? shared : notes;
        if ((sales.files_loading ?? loadingFiles) && !files.length) return <Loading label="Chargement des fichiers…" />;
        if (!files.length) return <div className="recordings-empty">{tab === "videos" ? "Aucune vidéo disponible pour le moment." : "Aucun document disponible pour le moment."}</div>;
        return <div className="recordings-files">{files.map((r) => {
          const isVideo = r.kind === "video";
          const Icon = isVideo ? Video : FileText;
          return <button type="button" key={r.id} className="recordings-file" onClick={() => setViewing({ rec: r, mode: isVideo ? "video" : "transcription" })}>
            <span className="recordings-icon"><Icon size={22} strokeWidth={1.8} aria-hidden="true" /></span>
            <span className="recordings-file-copy"><strong>{r.name}</strong><span>{fmtDate(r.created)}{r.rdv ? ` · ${r.rdv}` : ""}{r.shared ? " · Document partagé" : ""}</span></span>
            <span className="recordings-file-open">{isVideo ? "Voir la vidéo" : "Ouvrir"}<ArrowUpRight size={16} aria-hidden="true" /></span>
          </button>;
        })}</div>;
      })()}

      </div>

      {viewing && (
        <RecordingViewerModal rec={viewing.rec} mode={viewing.mode} onClose={() => setViewing(null)} C={C} darkMode={darkMode} />
      )}
    </div>
  );
}
