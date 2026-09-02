// src/components/MyWeeklyBilan.jsx
//
// Onglet « Bilan IA » de la tracking sheet, côté SALES. Trois volets :
//   · Mon bilan     → bilan hebdo agrégé          (WeeklyBilanView)
//   · Mes analyses  → maître-détail RDV ↔ scorecard complète (ScorecardView)
//   · Mes vidéos    → enregistrements Meet, proxy de streaming (RecordingViewerModal)
//
// Tous les appels passent par des endpoints dont le périmètre est FORCÉ à l'email
// du JWT côté backend (/my-analysis, /my-recordings) ou contrôlé sur la ligne lue
// (/scorecards) : un sales ne peut voir que ses propres données, aucun paramètre
// de la requête ne peut élargir ça.
//
// Le composant reste autonome (fetch + état + palette) pour ne rien ajouter à
// TrackingSheet, qui est une zone sacrée.

import { useEffect, useMemo, useRef, useState } from "react";
import apiClient from "../services/apiClient";
import WeeklyBilanView from "./WeeklyBilanView.jsx";
import ScorecardView from "./ScorecardView.jsx";
import RecordingViewerModal from "./RecordingViewerModal.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";

// Palette claire éditoriale : l'onglet conserve l'aspect « dossier » du bilan de
// coaching même quand la tracking sheet est en mode sombre, comme aujourd'hui.
const C = { text: "#14181C", muted: "#8A9099", border: "#E1DED5" };

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

function Loading({ label = "Chargement…" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "60px 24px" }}>
      <span className="mwb-spin" />
      <span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 11.5, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>{label}</span>
    </div>
  );
}

function Empty({ children }) {
  return <div style={{ color: C.muted, fontSize: 13.5, padding: "40px 4px" }}>{children}</div>;
}

export default function MyWeeklyBilan({ name, avatarUrl, team }) {
  const myEmail = (apiClient.getUser()?.email || "").toLowerCase();

  const [tab, setTab] = useState("bilan");

  // ── Volet 1 : bilan hebdo (chargé d'emblée, c'est le volet par défaut) ──
  const [bilan, setBilan] = useState(null);
  const [bilanLoading, setBilanLoading] = useState(true);
  const [bilanError, setBilanError] = useState(false);

  // ── Volet 2 : analyses par RDV (chargées à la 1re ouverture du volet) ──
  const [scList, setScList] = useState(null);
  const [scLoading, setScLoading] = useState(false);
  const [selId, setSelId] = useState(null);
  const [scData, setScData] = useState(null);
  const [scDataLoading, setScDataLoading] = useState(false);

  // ── Volet 3 : vidéos (scan Drive, coûteux -> chargé à la 1re ouverture) ──
  const [recs, setRecs] = useState(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [viewing, setViewing] = useState(null);

  // Les deux volets paresseux ne doivent partir qu'UNE fois. Le drapeau vit dans
  // un ref, pas dans un state : un state de chargement placé en dépendance
  // relancerait l'effet dès sa mise à true, et le nettoyage annulerait la requête
  // en vol — le spinner tournerait alors indéfiniment.
  const scStarted = useRef(false);
  const recsStarted = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;                       // remis à true : en StrictMode
    return () => { mounted.current = false; };    // l'effet est rejoué au montage
  }, []);

  // Polices éditoriales, comme la fiche sales côté direction.
  useEffect(() => {
    const id = "owner-scorecard-fonts";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap";
    document.head.appendChild(l);
  }, []);

  useEffect(() => {
    let alive = true;
    setBilanLoading(true); setBilanError(false);
    apiClient.getMyAnalysis("sales_weekly")
      .then((r) => { if (alive) setBilan(r?.payload || null); })
      .catch(() => { if (alive) setBilanError(true); })
      .finally(() => { if (alive) setBilanLoading(false); });
    return () => { alive = false; };
  }, []);

  // Analyses : un seul chargement, à la première ouverture du volet.
  useEffect(() => {
    if (tab !== "analyses" || scStarted.current) return;
    scStarted.current = true;
    setScLoading(true);
    apiClient.getScorecards(myEmail)
      .then((r) => {
        if (!mounted.current) return;
        const list = (r?.scorecards || []).slice()
          .sort((a, b) => (b.rdv_date || "").localeCompare(a.rdv_date || ""));
        setScList(list);
        if (list[0]) setSelId(list[0].id);
      })
      .catch(() => { if (mounted.current) setScList([]); })
      .finally(() => { if (mounted.current) setScLoading(false); });
  }, [tab, myEmail]);

  useEffect(() => {
    if (!selId) { setScData(null); return; }
    let alive = true; setScDataLoading(true); setScData(null);
    apiClient.getScorecard(selId)
      .then((r) => { if (alive) setScData(r?.payload || null); })
      .catch(() => {})
      .finally(() => { if (alive) setScDataLoading(false); });
    return () => { alive = false; };
  }, [selId]);

  // Vidéos : le scan Drive prend plusieurs secondes, donc à la demande seulement.
  useEffect(() => {
    if (tab !== "videos" || recsStarted.current) return;
    recsStarted.current = true;
    setRecsLoading(true);
    apiClient.getMyRecordings()
      .then((r) => { if (mounted.current) setRecs(r?.recordings || []); })
      .catch(() => { if (mounted.current) setRecs([]); })
      .finally(() => { if (mounted.current) setRecsLoading(false); });
  }, [tab]);

  const videos = useMemo(() => (recs || []).filter((r) => r.kind === "video"), [recs]);

  const TABS = [
    { key: "bilan", label: "Mon bilan" },
    { key: "analyses", label: "Mes analyses", n: scList?.length },
    { key: "videos", label: "Mes vidéos", n: recs ? videos.length : undefined },
  ];

  const rowStyle = (active) => ({
    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, cursor: "pointer",
    background: active ? "#eef7f9" : "transparent",
    border: `1px solid ${active ? "#0891b2" : "transparent"}`, transition: "background 0.12s",
  });

  return (
    <div>
      <style>{`
        @keyframes mwbFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes mwbSpin { to { transform: rotate(360deg); } }
        .mwb-spin { width: 30px; height: 30px; border-radius: 50%; border: 2.5px solid ${C.border}; border-top-color: #E8A317; animation: mwbSpin 0.7s linear infinite; }
        .mwb-hover:hover { background: #f6f7f9 !important; }
        .owner-mwbtabs { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 22px; }
        .owner-mwbtabs .rt { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 11px; letter-spacing: .13em; text-transform: uppercase; font-weight: 600; color: ${C.muted}; background: transparent; border: 1.5px solid ${C.border}; border-radius: 999px; padding: 9px 16px; cursor: pointer; transition: color .14s, background .14s, border-color .14s; line-height: 1; }
        .owner-mwbtabs .rt:hover { color: ${C.text}; border-color: ${C.muted}; }
        .owner-mwbtabs .rt.on { color: #14181C; background: #E8A317; border-color: #14181C; }
        .owner-mwbtabs .rt .n { margin-left: 7px; opacity: .7; font-weight: 600; }
        .owner-mwbtabs .rt.on .n { opacity: .85; }
      `}</style>

      <div className="owner-mwbtabs">
        {TABS.map((t) => (
          <button key={t.key} className={`rt${tab === t.key ? " on" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}{t.n != null && <span className="n">{t.n}</span>}
          </button>
        ))}
      </div>

      <div key={tab} style={{ animation: "mwbFade 0.24s ease both" }}>

        {/* ── MON BILAN ───────────────────────────────────────────────── */}
        {tab === "bilan" && (
          bilanLoading ? <Loading label="Chargement de ton bilan…" />
          : bilanError ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#4A5259", fontSize: 14 }}>
              Ton bilan n'a pas pu être chargé pour le moment. Réessaie dans un instant.
            </div>
          ) : (
            <ErrorBoundary>
              <WeeklyBilanView bilan={bilan} salesName={name} avatarUrl={avatarUrl} team={team} />
            </ErrorBoundary>
          )
        )}

        {/* ── MES ANALYSES — maître-détail RDV ↔ scorecard ─────────────── */}
        {tab === "analyses" && (
          scLoading ? <Loading label="Chargement de tes analyses…" />
          : !scList || scList.length === 0 ? (
            <Empty>Aucune analyse pour l'instant. Elles apparaîtront après le prochain passage d'analyse de tes rendez-vous.</Empty>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 290px) 1fr", gap: 18, alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, position: "sticky", top: 8 }}>
                {scList.map((sc) => {
                  const tone = RDV_TONE[sc.rdv_type] || RDV_TONE.R1;
                  const active = String(sc.id) === String(selId);
                  return (
                    <div key={sc.id} className={active ? "" : "mwb-hover"} onClick={() => setSelId(sc.id)} style={rowStyle(active)}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: tone.color, background: tone.bg, borderRadius: 5, padding: "1px 6px", flexShrink: 0 }}>{tone.label}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(sc.prospect || "Prospect").split("(")[0].trim()}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{fmtDate(sc.rdv_date)}</div>
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: scColor(sc.score), flexShrink: 0 }}>{sc.score}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ background: "#FBFAF7", borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden", minHeight: 400 }}>
                {scDataLoading ? <Loading label="Chargement de l'analyse…" />
                  : scData ? (
                    <ErrorBoundary key={selId}><ScorecardView sc={scData} /></ErrorBoundary>
                  ) : (
                    <div style={{ color: "#4A5259", fontSize: 13, padding: 28 }}>Sélectionne un rendez-vous à gauche.</div>
                  )}
              </div>
            </div>
          )
        )}

        {/* ── MES VIDÉOS ──────────────────────────────────────────────── */}
        {tab === "videos" && (
          recsLoading ? <Loading label="Chargement de tes enregistrements…" />
          : videos.length === 0 ? (
            <Empty>Aucun enregistrement trouvé sur ton compte Google.</Empty>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {videos.map((r) => (
                <div key={r.id} className="mwb-hover" onClick={() => setViewing({ rec: r, mode: "video" })}
                     style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, border: `1px solid ${C.border}`, cursor: "pointer" }}>
                  <span style={{ fontSize: 14 }}>🎥</span>
                  <span style={{ fontSize: 13, color: C.text, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                  <span style={{ fontSize: 11.5, color: C.muted }}>{fmtDate(r.created)}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#0891b2" }}>▶ Lire</span>
                </div>
              ))}
            </div>
          )
        )}

      </div>

      {viewing && (
        <RecordingViewerModal rec={viewing.rec} mode={viewing.mode} onClose={() => setViewing(null)} C={C} darkMode={false} />
      )}
    </div>
  );
}
