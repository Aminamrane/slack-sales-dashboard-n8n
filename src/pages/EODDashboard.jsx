// src/pages/EODDashboard.jsx
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from "chart.js";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar";
import "../index.css";
import iconGlobal from "../assets/global.png";
import iconTech from "../assets/tech.png";
import iconRh from "../assets/rh.png";
import iconRapport from "../assets/rapport.png";
import iconFiles from "../assets/files.png";
import iconMarketing from "../assets/marketing.png";
import iconFinance from "../assets/finance.png";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip);

// ── DESIGN SYSTEM (aligned with Leaderboard CARD palette) ───────────────────
const CARD = (dark) => ({
  bg: dark ? "#1e1f28" : "#ffffff",
  border: dark ? "#2a2b36" : "#e2e6ef",
  surface: dark ? "#13141b" : "#edf0f8",
  text: dark ? "#eef0f6" : "#1e2330",
  muted: dark ? "#5e6273" : "#9ca3af",
  subtle: dark ? "#252636" : "#f4f6fb",
  secondary: dark ? "#8b8fa0" : "#6b7280",
  accent: dark ? "#7c8adb" : "#5b6abf",
  shadow: dark
    ? "0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)"
    : "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
  success: "#10b981",
  danger: "#ef4444",
  warning: "#f59e0b",
});

const DIMENSION_LABELS = {
  charge: "Charge",
  energie: "Énergie",
  clarte: "Clarté",
  efficacite: "Efficacité",
  relations: "Relations",
  alignement: "Alignement",
};

const DIMENSION_KEYS = ["charge", "energie", "clarte", "efficacite", "relations", "alignement"];

const DIMENSION_COLORS = {
  charge: "#6366f1",
  energie: "#f59e0b",
  clarte: "#3b82f6",
  efficacite: "#10b981",
  relations: "#ec4899",
  alignement: "#8b5cf6",
};

const DEPARTMENTS = [
  { key: "tech", label: "Tech", iconSrc: iconTech, expectedEods: 2 },
  { key: "marketing", label: "Marketing", iconSrc: iconMarketing, expectedEods: 2 },
  { key: "rh", label: "RH", iconSrc: iconRh, expectedEods: 1 },
  { key: "finance", label: "Finance", iconSrc: iconFinance, expectedEods: 2 },
];

const DEPT_MAP = { admin: "tech", hr: "rh", finance_director: "finance", finance_team: "finance" };

// Total expected EOD collaborators across all departments
const TOTAL_EXPECTED_COLLABS = DEPARTMENTS.reduce((s, d) => s + d.expectedEods, 0);

const DEPT_ACCENT = {
  tech: "#6366f1",
  marketing: "#f59e0b",
  rh: "#ec4899",
  finance: "#059669",
};

// ── HELPERS ─────────────────────────────────────────────────────────────────────

function getScoreColor(score) {
  if (score >= 4) return "#10b981";
  if (score >= 3) return "#5b6abf";
  if (score >= 2) return "#f59e0b";
  return "#ef4444";
}

function getWeekOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 8; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const weekNum = getWeekNumber(d);
    const year = d.getFullYear();
    const monday = getMonday(d);
    const friday = new Date(monday);
    friday.setDate(friday.getDate() + 4);
    options.push({
      value: `${year}-W${String(weekNum).padStart(2, "0")}`,
      label: `S${weekNum} — ${formatShortDate(monday)} → ${formatShortDate(friday)}`,
      weekNum,
      year,
    });
  }
  return options;
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date;
}

function formatShortDate(d) {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ── SMALL COMPONENTS ────────────────────────────────────────────────────────────

function CircleScore({ score, size = 56, strokeWidth = 4, C }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 5) * circumference;
  const color = getScoreColor(score);

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={C.subtle} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.3, fontWeight: 700, color: C.text,
      }}>
        {score.toFixed(1)}
      </div>
    </div>
  );
}

function DimensionBar({ label, value, color, C }) {
  const v = Number.isFinite(value) ? value : 0;
  const pct = (v / 5) * 100;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{v.toFixed(1)}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: C.subtle, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: color, transition: "width 0.8s ease" }} />
      </div>
    </div>
  );
}

// ── EOD HEATMAP (GitHub-style contribution graph) ────────────────────────────

function EODHeatmap({ days, weekDays, C, darkMode }) {
  // GitHub layout: 7 rows (Sun→Sat), columns = weeks
  // Range: Jan 2026 → Dec 2026 (full year, fills progressively)
  const CELL = 11;
  const GAP = 3;
  const LABEL_W = 32;
  // Row order: Sun(0), Mon(1), Tue(2), Wed(3), Thu(4), Fri(5), Sat(6)
  const ROW_LABELS = ["", "Lun", "", "Mer", "", "Ven", ""];

  const { weeks, monthLabels, todayStr, totalSubmitted } = useMemo(() => {
    // GitHub-style: last 52 weeks ending today
    // End = Saturday of the current week (or today's week)
    const now = new Date();
    const tStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // Find Saturday of the current week
    const endSaturday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    endSaturday.setDate(endSaturday.getDate() + (6 - endSaturday.getDay()));

    // Go back 52 weeks to get start Sunday
    const startSunday = new Date(endSaturday);
    startSunday.setDate(startSunday.getDate() - 52 * 7 + 1); // 52 weeks back → Sunday
    // Align to Sunday
    startSunday.setDate(startSunday.getDate() - startSunday.getDay());

    // Merge both data sources: personHistory (all-time) + weekDays (current week guaranteed)
    const dayMap = {};
    let count = 0;
    if (Array.isArray(days)) {
      for (const entry of days) {
        if (entry.report_date) {
          dayMap[entry.report_date] = entry;
          count++;
        }
      }
    }
    if (Array.isArray(weekDays)) {
      for (const entry of weekDays) {
        if (entry.report_date && !dayMap[entry.report_date]) {
          dayMap[entry.report_date] = entry;
          count++;
        }
      }
    }

    // Build week columns (each = 7 days, Sun→Sat)
    const result = [];
    const mLabels = [];
    let lastMonth = -1;
    const cursor = new Date(startSunday);

    while (cursor <= endSaturday) {
      const wDays = [];
      const weekSunday = new Date(cursor);

      // Month label: use Thursday of the week as reference (GitHub convention)
      const thursday = new Date(cursor);
      thursday.setDate(thursday.getDate() + 4);
      const thurMonth = thursday.getMonth();
      if (thurMonth !== lastMonth) {
        mLabels.push({
          index: result.length,
          label: thursday.toLocaleDateString("fr-FR", { month: "short" }),
        });
        lastMonth = thurMonth;
      }

      for (let d = 0; d < 7; d++) {
        const date = new Date(cursor);
        date.setDate(date.getDate() + d);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        const dateStr = `${y}-${m}-${dd}`;
        const dayData = dayMap[dateStr] || null;
        wDays.push({
          date: dateStr,
          score: dayData?.global_score ?? null,
          dayObj: date,
        });
      }
      result.push({ sunday: weekSunday, weekDays: wDays });
      cursor.setDate(cursor.getDate() + 7);
    }

    return { weeks: result, monthLabels: mLabels, todayStr: tStr, totalSubmitted: count };
  }, [days, weekDays]);

  // GitHub-exact green scale
  function getCellColor(score) {
    if (score === null) return darkMode ? "#161b22" : "#ebedf0";
    if (score < 2) return darkMode ? "#0e4429" : "#9be9a8";
    if (score < 3) return darkMode ? "#006d32" : "#40c463";
    if (score < 4) return darkMode ? "#26a641" : "#30a14e";
    return darkMode ? "#39d353" : "#216e39";
  }

  const [hoveredCell, setHoveredCell] = useState(null);

  return (
    <div>
      {/* Title + count */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
          {totalSubmitted} EOD soumis cette année
        </span>
      </div>

      {/* Scrollable container */}
      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        {/* Month labels row */}
        <div style={{ position: "relative", height: 16, marginLeft: LABEL_W, marginBottom: 4 }}>
          {monthLabels.map((ml, i) => (
            <span key={i} style={{
              fontSize: 10, fontWeight: 600, color: C.muted,
              position: "absolute",
              left: ml.index * (CELL + GAP),
            }}>
              {ml.label}
            </span>
          ))}
        </div>

        {/* Grid: 7 rows (Sun→Sat) × ~53 columns (weeks) */}
        <div style={{ display: "flex", gap: 0 }}>
          {/* Day labels */}
          <div style={{ display: "flex", flexDirection: "column", gap: GAP, width: LABEL_W, flexShrink: 0 }}>
            {ROW_LABELS.map((label, i) => (
              <div key={i} style={{
                height: CELL, display: "flex", alignItems: "center",
                fontSize: 10, fontWeight: 500, color: C.muted,
              }}>
                {label}
              </div>
            ))}
          </div>

          {/* Week columns */}
          <div style={{ display: "flex", gap: GAP }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap: GAP }}>
                {week.weekDays.map((day, di) => {
                  const isFuture = day.date > todayStr;
                  const cellColor = isFuture ? (darkMode ? "#1a1a1e" : "#f6f8fa") : getCellColor(day.score);
                  const isHovered = hoveredCell === day.date;
                  return (
                    <div
                      key={di}
                      onMouseEnter={() => setHoveredCell(day.date)}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        width: CELL, height: CELL,
                        borderRadius: 2,
                        background: cellColor,
                        outline: isHovered ? `2px solid ${C.accent}` : "none",
                        outlineOffset: -1,
                        cursor: day.score !== null ? "pointer" : "default",
                        transition: "outline-color 0.15s",
                      }}
                      title={day.score !== null
                        ? `${day.dayObj.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} — Score: ${day.score.toFixed(1)}/5`
                        : isFuture ? "" : `${day.dayObj.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} — Pas d'EOD`
                      }
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, justifyContent: "flex-start" }}>
        <span style={{ fontSize: 10, color: C.muted }}>Moins</span>
        {[null, 1, 2.5, 3.5, 4.5].map((score, i) => (
          <div key={i} style={{
            width: CELL, height: CELL, borderRadius: 2,
            background: getCellColor(score),
          }} />
        ))}
        <span style={{ fontSize: 10, color: C.muted }}>Plus</span>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────────

export default function EODDashboard() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

  // Navigation state: "overview" | dept key | person user_id
  const [sidebarView, setSidebarView] = useState("overview");
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);

  const [selectedWeek, setSelectedWeek] = useState(() => {
    const now = new Date();
    const wk = getWeekNumber(now);
    return `${now.getFullYear()}-W${String(wk).padStart(2, "0")}`;
  });
  const [showSummary, setShowSummary] = useState(false);

  // Person detail (daily EOD drill-down)
  const [showDetail, setShowDetail] = useState(false);
  const [detailDate, setDetailDate] = useState("");
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Person score history (for heatmap — all-time)
  const [personHistory, setPersonHistory] = useState([]);

  // API data
  const [collaborators, setCollaborators] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [weeklyReport, setWeeklyReport] = useState("");
  const [personSummaries, setPersonSummaries] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const fallbackAttempted = useRef(false);

  const weekOptions = useMemo(() => getWeekOptions(), []);
  const C = useMemo(() => CARD(darkMode), [darkMode]);

  useEffect(() => {
    const init = async () => {
      try {
        const user = await apiClient.getMe();
        setSession(user);
        const access = apiClient.hasAccess("eod_dashboard");
        setHasAccess(access);
        if (!access) { navigate("/"); return; }
        setTimeout(() => setFadeIn(true), 50);
      } catch { navigate("/login"); }
      finally { setLoading(false); }
    };
    init();
  }, [navigate]);

  const selectedWeekMeta = useMemo(() => {
    const match = selectedWeek.match(/^(\d{4})-W(\d{2})$/);
    if (!match) return null;
    const year = parseInt(match[1], 10);
    const weekNum = parseInt(match[2], 10);
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - dayOfWeek + 1 + (weekNum - 1) * 7);
    const friday = new Date(monday);
    friday.setDate(friday.getDate() + 4);
    const fmt = (d) => d.toISOString().split("T")[0];
    return { year, weekNum, startDate: fmt(monday), endDate: fmt(friday) };
  }, [selectedWeek]);

  function aggregateScores(dailyScores) {
    const byUser = {};
    for (const entry of dailyScores) {
      const uid = entry.user_id;
      if (!byUser[uid]) {
        const rawDept = (entry.department || "").toLowerCase();
        byUser[uid] = {
          user_id: uid,
          name: entry.full_name || entry.name || "Inconnu",
          department: DEPT_MAP[rawDept] || rawDept,
          days: [],
        };
      }
      byUser[uid].days.push(entry);
    }
    return Object.values(byUser).map((u) => {
      const n = u.days.length;
      const avg_scores = {};
      DIMENSION_KEYS.forEach((k) => {
        avg_scores[k] = u.days.reduce((s, d) => s + (d[k] || 0), 0) / n;
      });
      const avg_global = u.days.reduce((s, d) => s + (d.global_score || 0), 0) / n;
      const latestSummary = u.days[u.days.length - 1]?.ressenti_individuel || "";
      return { user_id: u.user_id, name: u.name, department: u.department, avg_scores, avg_global, eods_submitted: n, eods_expected: 5, summary: latestSummary, days: u.days };
    });
  }

  useEffect(() => {
    if (!hasAccess || loading || !selectedWeekMeta) return;
    const fetchData = async () => {
      setDataLoading(true);
      try {
        const { year, weekNum } = selectedWeekMeta;
        const [scoresResp, alertsResp, reportResp] = await Promise.allSettled([
          apiClient.get(`/api/v1/eod/dashboard/scores?period=${year}-W${String(weekNum).padStart(2, "0")}`),
          apiClient.get(`/api/v1/eod/dashboard/alerts?resolved=false`),
          apiClient.get(`/api/v1/eod/dashboard/weekly-report?week=${weekNum}&year=${year}`),
        ]);
        if (scoresResp.status === "fulfilled") {
          const raw = scoresResp.value?.scores || scoresResp.value?.collaborators || scoresResp.value || [];
          const list = Array.isArray(raw) ? raw : [];
          if (list.length === 0 && !fallbackAttempted.current) {
            // Current week has no data — fall back to previous week
            fallbackAttempted.current = true;
            const prevWeek = weekOptions[1]; // index 0 = current, 1 = previous
            if (prevWeek && prevWeek.value !== selectedWeek) {
              setSelectedWeek(prevWeek.value);
              return; // will re-fetch with previous week
            }
          }
          setCollaborators(list.length > 0 ? aggregateScores(list) : []);
        } else { setCollaborators([]); }
        if (alertsResp.status === "fulfilled" && alertsResp.value?.alerts) {
          setAlerts(alertsResp.value.alerts);
        } else { setAlerts([]); }
        if (reportResp.status === "fulfilled" && reportResp.value) {
          setWeeklyReport(reportResp.value.global_summary || reportResp.value.report_text || "");
          setPersonSummaries(reportResp.value.person_summaries || []);
        } else { setWeeklyReport(""); setPersonSummaries([]); }
      } catch (error) { console.error("Error fetching dashboard data:", error); }
      finally { setDataLoading(false); }
    };
    fetchData();
    setSelectedPerson(null);
    setSidebarView("overview");
    setSelectedDept(null);
  }, [selectedWeek, hasAccess, loading, selectedWeekMeta]);

  useEffect(() => { localStorage.setItem("darkMode", darkMode); }, [darkMode]);

  // ── COMPUTED DATA ─────────────────────────────────────────────────────────────

  const deptStats = useMemo(() => {
    if (collaborators.length === 0) return [];
    const groups = {};
    for (const c of collaborators) {
      const dept = c.department;
      if (!dept) continue;
      if (!groups[dept]) groups[dept] = { key: dept, people: [] };
      groups[dept].people.push(c);
    }
    return Object.values(groups).map((g) => {
      const n = g.people.length;
      const avg = {};
      DIMENSION_KEYS.forEach((k) => {
        avg[k] = g.people.reduce((s, c) => s + c.avg_scores[k], 0) / n;
      });
      const avgGlobal = g.people.reduce((s, c) => s + c.avg_global, 0) / n;
      const meta = DEPARTMENTS.find(d => d.key === g.key);
      return { key: g.key, label: meta?.label || g.key, icon: meta?.icon || "●", count: n, avg, avgGlobal, people: g.people };
    }).sort((a, b) => b.avgGlobal - a.avgGlobal);
  }, [collaborators]);

  const globalAvg = useMemo(() => {
    if (collaborators.length === 0) return 0;
    return collaborators.reduce((s, c) => s + c.avg_global, 0) / collaborators.length;
  }, [collaborators]);

  const globalDimAvg = useMemo(() => {
    if (collaborators.length === 0) return null;
    const avg = {};
    DIMENSION_KEYS.forEach((k) => {
      avg[k] = collaborators.reduce((s, c) => s + c.avg_scores[k], 0) / collaborators.length;
    });
    return avg;
  }, [collaborators]);

  // What to show based on sidebar selection
  const currentDeptData = selectedDept ? deptStats.find(d => d.key === selectedDept) : null;
  const currentPersonData = selectedPerson ? collaborators.find(c => c.user_id === selectedPerson) : null;

  const radarScores = currentPersonData
    ? currentPersonData.avg_scores
    : currentDeptData
      ? currentDeptData.avg
      : globalDimAvg;

  const radarLabel = currentPersonData
    ? currentPersonData.name
    : currentDeptData
      ? `Moyenne ${currentDeptData.label}`
      : "Moyenne globale";

  const radarConfig = useMemo(() => {
    if (!radarScores) return null;
    return {
      data: {
        labels: DIMENSION_KEYS.map((k) => DIMENSION_LABELS[k]),
        datasets: [{
          label: radarLabel,
          data: DIMENSION_KEYS.map((k) => radarScores[k]),
          backgroundColor: darkMode ? "rgba(124,138,219,0.15)" : "rgba(91,106,191,0.12)",
          borderColor: C.accent,
          borderWidth: 2,
          pointBackgroundColor: C.accent,
          pointBorderColor: C.bg,
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          datalabels: false,
          tooltip: {
            backgroundColor: C.bg,
            titleColor: C.text,
            bodyColor: C.secondary,
            borderColor: C.border,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw.toFixed(1)} / 5` },
          },
        },
        scales: {
          r: {
            min: 0, max: 5,
            ticks: { stepSize: 1, display: true, backdropColor: "transparent", color: C.muted, font: { size: 10 } },
            grid: { color: darkMode ? 'rgba(255,255,255,0.18)' : C.border, lineWidth: 1 },
            angleLines: { color: darkMode ? 'rgba(255,255,255,0.18)' : C.border },
            pointLabels: { color: C.text, font: { size: 12, weight: 600 } },
          },
        },
      },
    };
  }, [radarScores, radarLabel, darkMode, C]);

  // ── NAVIGATION HANDLERS ───────────────────────────────────────────────────────

  function goToOverview() {
    setSidebarView("overview");
    setSelectedDept(null);
    setSelectedPerson(null);
  }
  function goToDept(deptKey) {
    setSidebarView("dept");
    setSelectedDept(deptKey);
    setSelectedPerson(null);
  }
  function goToPerson(userId) {
    setSidebarView("person");
    setSelectedPerson(userId);
    setShowDetail(false);
    setDetailData(null);
    setDetailDate("");
    // Fetch full score history for heatmap — fetch last 13 months in parallel
    setPersonHistory([]);
    const now = new Date();
    const months = [];
    for (let i = 12; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    Promise.allSettled(
      months.map(m => apiClient.get(`/api/v1/eod/dashboard/scores?period=${m}`))
    ).then(results => {
      const allDays = [];
      for (const r of results) {
        if (r.status === "fulfilled") {
          const scores = r.value?.scores || [];
          for (const s of scores) {
            if (s.user_id === userId && s.report_date) allDays.push(s);
          }
        }
      }
      setPersonHistory(allDays);
    });
  }

  // Fetch daily EOD detail for a specific person + date
  async function fetchDayDetail(date) {
    if (!date || !selectedPerson) return;
    setDetailLoading(true);
    setDetailData(null);
    try {
      // 1) Get AI scores from cached data (already loaded)
      const personCollab = collaborators.find(c => c.user_id === selectedPerson);
      const dayScore = personCollab?.days?.find(d => d.report_date === date) || null;

      // 2) Get team report summary (submitted_at, total_hours, etc.)
      let teamReport = null;
      try {
        const resp = await apiClient.get(`/api/v1/eod/team-reports?date=${date}`);
        const reports = resp?.reports || [];
        // Backend returns user.id (nested), not user_id
        teamReport = reports.find(r => (r.user?.id || r.user_id) === selectedPerson) || null;
      } catch { /* team-reports may fail, that's ok */ }

      // 3) Try to get full report detail (questions, tasks) if endpoint exists
      let fullReport = null;
      try {
        const detailResp = await apiClient.get(`/api/v1/eod/dashboard/report/${selectedPerson}?date=${date}`);
        if (detailResp && !detailResp.detail) fullReport = detailResp;
      } catch { /* endpoint may not exist yet */ }

      if (dayScore || teamReport || fullReport) {
        setDetailData({
          ai_score: dayScore,
          submitted_at: teamReport?.submitted_at || null,
          total_hours: teamReport?.total_hours || null,
          tasks_count: teamReport?.tasks_count || null,
          question_answers: fullReport?.question_answers || null,
          tasks: fullReport?.tasks || null,
          custom_answer: fullReport?.custom_answer || null,
          pool_key: fullReport?.pool_key || null,
          rating: fullReport?.rating ?? null,
          mood_emoji: fullReport?.mood_emoji || null,
        });
      } else {
        setDetailData(null);
      }
    } catch (err) {
      console.error("Error fetching day detail:", err);
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  }

  // ── RENDER ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.surface, color: C.text }}>
        Chargement...
      </div>
    );
  }
  if (!hasAccess) return null;

  const filteredAlerts = selectedDept
    ? alerts.filter(a => (DEPT_MAP[(a.department || "").toLowerCase()] || (a.department || "").toLowerCase()) === selectedDept)
    : alerts;

  return (
    <div style={{
      minHeight: "100vh",
      paddingTop: 80,
      background: C.surface,
      color: C.text,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    }}>
      <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} session={session} />

      <div style={{
        maxWidth: 1400, margin: "32px auto 64px", padding: "0 18px",
        opacity: fadeIn ? 1 : 0,
        transform: fadeIn ? "translateY(0)" : "translateY(10px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}>
        {/* ── Outer wrapper (like Leaderboard) ────────────────────────────────── */}
        <div style={{
          background: darkMode ? "rgba(0,0,0,0.10)" : "rgba(190,197,215,0.20)",
          borderRadius: 32,
          padding: 18,
        }}>
          {/* ── Inner board ──────────────────────────────────────────────────── */}
          <div style={{
            background: C.bg,
            borderRadius: 24,
            boxShadow: C.shadow,
            border: `1px solid ${C.border}`,
            display: "flex",
            minHeight: "calc(100vh - 200px)",
            overflow: "hidden",
          }}>

            {/* ══════════════════════════════════════════════════════════════════
                LEFT SIDEBAR
            ══════════════════════════════════════════════════════════════════ */}
            <div style={{
              width: 260,
              minWidth: 260,
              borderRight: `1px solid ${C.border}`,
              display: "flex",
              flexDirection: "column",
              background: C.subtle,
            }}>
              {/* Sidebar header */}
              <div style={{ padding: "24px 20px 16px" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px 0", color: C.text, letterSpacing: "-0.01em" }}>
                  Dashboard EOD
                </h2>
                <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
                  Analyse & Suivi
                </p>
              </div>

              {/* Week selector */}
              <div style={{ padding: "0 16px 16px" }}>
                <select
                  value={selectedWeek}
                  onChange={(e) => { fallbackAttempted.current = true; setSelectedWeek(e.target.value); }}
                  style={{
                    width: "100%",
                    padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                    border: `1px solid ${C.border}`,
                    background: C.bg,
                    color: C.text,
                    cursor: "pointer",
                  }}
                >
                  {weekOptions.map((w) => (
                    <option key={w.value} value={w.value}>{w.label}</option>
                  ))}
                </select>
              </div>

              {/* Nav separator */}
              <div style={{ padding: "0 16px", marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Navigation
                </span>
              </div>

              {/* Overview item */}
              <SidebarItem
                iconSrc={iconGlobal}
                label="Vue globale"
                active={sidebarView === "overview"}
                onClick={goToOverview}
                C={C}
                darkMode={darkMode}
              />

              {/* Department separator */}
              <div style={{ padding: "16px 16px 8px" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Pôles
                </span>
              </div>

              {/* Department items */}
              {DEPARTMENTS.map((dept) => {
                const stat = deptStats.find(d => d.key === dept.key);
                const isActive = selectedDept === dept.key && sidebarView !== "person";
                return (
                  <SidebarItem
                    key={dept.key}
                    icon={dept.icon}
                    iconSrc={dept.iconSrc}
                    label={dept.label}
                    badge={stat ? stat.count : 0}
                    score={stat?.avgGlobal}
                    active={isActive}
                    accent={DEPT_ACCENT[dept.key]}
                    onClick={() => goToDept(dept.key)}
                    C={C}
                    darkMode={darkMode}
                  />
                );
              })}

              {/* Person list (when a dept is selected) */}
              {selectedDept && currentDeptData && (
                <>
                  <div style={{ padding: "16px 16px 8px" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Collaborateurs
                    </span>
                  </div>
                  {currentDeptData.people
                    .sort((a, b) => b.avg_global - a.avg_global)
                    .map((p) => (
                      <SidebarItem
                        key={p.user_id}
                        icon={null}
                        label={p.name}
                        score={p.avg_global}
                        active={selectedPerson === p.user_id}
                        onClick={() => goToPerson(p.user_id)}
                        C={C}
                        darkMode={darkMode}
                        indent
                      />
                    ))}
                </>
              )}

              {/* Alerts badge at bottom */}
              <div style={{ flex: 1 }} />
              {alerts.length > 0 && (
                <div style={{
                  margin: "8px 16px 20px",
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: darkMode ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.06)",
                  border: `1px solid ${darkMode ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.15)"}`,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span style={{ fontSize: 14 }}>!</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.danger }}>
                    {alerts.length} alerte{alerts.length > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                MAIN CONTENT
            ══════════════════════════════════════════════════════════════════ */}
            <div style={{ flex: 1, padding: "28px 32px", overflowY: "auto" }}>

              {dataLoading && (
                <div style={{ textAlign: "center", padding: "60px 0", color: C.muted, fontSize: 14 }}>
                  Chargement des données...
                </div>
              )}

              {!dataLoading && collaborators.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 0", color: C.muted, fontSize: 14 }}>
                  Aucune donnée disponible pour cette semaine.<br />
                  Les scores apparaîtront une fois les EODs analysés.
                </div>
              )}

              {!dataLoading && collaborators.length > 0 && (
                <>
                  {/* ── Page Title (contextual) ──────────────────────────────── */}
                  <div style={{ marginBottom: 24 }}>
                    {/* Breadcrumb */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12, color: C.muted }}>
                      <span style={{ cursor: "pointer" }} onClick={goToOverview}>Dashboard</span>
                      {selectedDept && (
                        <>
                          <span>/</span>
                          <span
                            style={{ cursor: currentPersonData ? "pointer" : "default", color: currentPersonData ? C.muted : C.text }}
                            onClick={() => currentPersonData && goToDept(selectedDept)}
                          >
                            {currentDeptData?.label || selectedDept}
                          </span>
                        </>
                      )}
                      {currentPersonData && (
                        <>
                          <span>/</span>
                          <span style={{ color: C.text }}>{currentPersonData.name}</span>
                        </>
                      )}
                    </div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: C.text, letterSpacing: "-0.01em" }}>
                      {currentPersonData
                        ? currentPersonData.name
                        : currentDeptData
                          ? `Pôle ${currentDeptData.label}`
                          : "Vue globale"
                      }
                    </h1>
                  </div>

                  {/* ── KPI Row ──────────────────────────────────────────────── */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
                    <KPICard C={C} label="Score moyen"
                      value={(currentPersonData?.avg_global || currentDeptData?.avgGlobal || globalAvg).toFixed(1)}
                      suffix="/5"
                      color={getScoreColor(currentPersonData?.avg_global || currentDeptData?.avgGlobal || globalAvg)}
                    />
                    <KPICard C={C} label="Collaborateurs"
                      value={currentPersonData ? 1 : currentDeptData ? (DEPARTMENTS.find(d => d.key === selectedDept)?.expectedEods || currentDeptData.count) : TOTAL_EXPECTED_COLLABS}
                      color={C.accent}
                    />
                    <KPICard C={C} label="EODs soumis"
                      value={(() => {
                        const list = currentPersonData ? [currentPersonData] : currentDeptData ? currentDeptData.people : collaborators;
                        const sub = list.reduce((s, c) => s + c.eods_submitted, 0);
                        const expectedCollabs = currentPersonData ? 1 : currentDeptData ? (DEPARTMENTS.find(d => d.key === selectedDept)?.expectedEods || currentDeptData.count) : TOTAL_EXPECTED_COLLABS;
                        const exp = expectedCollabs * 5;
                        return `${sub}/${exp}`;
                      })()}
                      color={C.success}
                    />
                    <KPICard C={C} label="Alertes"
                      value={filteredAlerts.length}
                      color={filteredAlerts.length > 0 ? C.danger : C.success}
                    />
                  </div>

                  {/* ── Weekly Summary ────────────────────────────────────────── */}
                  <div style={{
                    background: C.subtle,
                    borderRadius: 14,
                    border: `1px solid ${C.border}`,
                    padding: "16px 20px",
                    marginBottom: 24,
                  }}>
                    <div
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                      onClick={() => setShowSummary(!showSummary)}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                        Résumé de la semaine
                      </span>
                      <span style={{
                        fontSize: 11, color: C.muted,
                        transform: showSummary ? "rotate(180deg)" : "rotate(0)",
                        transition: "transform 0.2s",
                      }}>
                        ▼
                      </span>
                    </div>
                    {showSummary && (
                      <p style={{
                        fontSize: 13, lineHeight: 1.7, margin: "12px 0 0 0",
                        color: C.secondary, whiteSpace: "pre-line",
                      }}>
                        {weeklyReport || "Aucun résumé disponible pour cette semaine. Le résumé sera généré dimanche soir."}
                      </p>
                    )}
                  </div>

                  {/* ══════════════════════════════════════════════════════════
                      VIEW: OVERVIEW (global) — dept comparison table
                  ══════════════════════════════════════════════════════════ */}
                  {sidebarView === "overview" && (
                    <>
                      {/* Department comparison — clean horizontal table */}
                      <div style={{
                        background: C.bg,
                        borderRadius: 14,
                        border: `1px solid ${C.border}`,
                        overflow: "hidden",
                        marginBottom: 24,
                      }}>
                        <div style={{
                          padding: "16px 20px",
                          borderBottom: `1px solid ${C.border}`,
                        }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                            Comparaison inter-pôles
                          </span>
                        </div>
                        {/* Table header */}
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "160px repeat(6, 1fr) 80px",
                          padding: "10px 20px",
                          borderBottom: `1px solid ${C.border}`,
                          background: C.subtle,
                        }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>Pôle</span>
                          {DIMENSION_KEYS.map((k) => (
                            <span key={k} style={{ fontSize: 11, fontWeight: 600, color: C.muted, textAlign: "center" }}>
                              {DIMENSION_LABELS[k].slice(0, 4)}.
                            </span>
                          ))}
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textAlign: "right" }}>Global</span>
                        </div>
                        {/* Dept rows */}
                        {deptStats.map((dept, i) => (
                          <div
                            key={dept.key}
                            onClick={() => goToDept(dept.key)}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "160px repeat(6, 1fr) 80px",
                              padding: "14px 20px",
                              borderBottom: i < deptStats.length - 1 ? `1px solid ${C.border}` : "none",
                              cursor: "pointer",
                              transition: "background 0.15s",
                              background: "transparent",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = C.subtle}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{
                                width: 8, height: 8, borderRadius: "50%",
                                background: DEPT_ACCENT[dept.key] || C.accent,
                              }} />
                              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                                {dept.label}
                              </span>
                              <span style={{ fontSize: 11, color: C.muted }}>
                                ({dept.count})
                              </span>
                            </div>
                            {DIMENSION_KEYS.map((k) => (
                              <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <ScorePill value={dept.avg[k]} C={C} />
                              </div>
                            ))}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                              <span style={{
                                fontSize: 15, fontWeight: 700,
                                color: getScoreColor(dept.avgGlobal),
                              }}>
                                {dept.avgGlobal.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Global radar + dimension bars */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                        <div style={{
                          background: C.bg, borderRadius: 14, border: `1px solid ${C.border}`, padding: 24,
                        }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.text, display: "block", marginBottom: 16 }}>
                            {radarLabel}
                          </span>
                          <div style={{ maxWidth: 300, margin: "0 auto" }}>
                            {radarConfig && <Radar data={radarConfig.data} options={radarConfig.options} />}
                          </div>
                        </div>
                        <div style={{
                          background: C.bg, borderRadius: 14, border: `1px solid ${C.border}`, padding: 24,
                        }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.text, display: "block", marginBottom: 16 }}>
                            Détail par dimension
                          </span>
                          {radarScores && DIMENSION_KEYS.map((k) => (
                            <DimensionBar key={k} label={DIMENSION_LABELS[k]} value={radarScores[k]} color={DIMENSION_COLORS[k]} C={C} />
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* ══════════════════════════════════════════════════════════
                      VIEW: DEPARTMENT — people list + radar
                  ══════════════════════════════════════════════════════════ */}
                  {sidebarView === "dept" && currentDeptData && (
                    <>
                      {/* People table */}
                      <div style={{
                        background: C.bg, borderRadius: 14, border: `1px solid ${C.border}`,
                        overflow: "hidden", marginBottom: 24,
                      }}>
                        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                            Collaborateurs — {currentDeptData.label}
                          </span>
                        </div>
                        {/* Table header */}
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "1fr repeat(6, 70px) 80px 70px",
                          padding: "10px 20px",
                          borderBottom: `1px solid ${C.border}`,
                          background: C.subtle,
                        }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>Nom</span>
                          {DIMENSION_KEYS.map((k) => (
                            <span key={k} style={{ fontSize: 11, fontWeight: 600, color: C.muted, textAlign: "center" }}>
                              {DIMENSION_LABELS[k].slice(0, 4)}.
                            </span>
                          ))}
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textAlign: "center" }}>Global</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textAlign: "center" }}>EODs</span>
                        </div>
                        {currentDeptData.people
                          .sort((a, b) => b.avg_global - a.avg_global)
                          .map((person, i) => (
                            <div
                              key={person.user_id}
                              onClick={() => goToPerson(person.user_id)}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr repeat(6, 70px) 80px 70px",
                                padding: "14px 20px",
                                borderBottom: i < currentDeptData.people.length - 1 ? `1px solid ${C.border}` : "none",
                                cursor: "pointer",
                                transition: "background 0.15s",
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = C.subtle}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >
                              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                                {person.name}
                              </span>
                              {DIMENSION_KEYS.map((k) => (
                                <div key={k} style={{ display: "flex", justifyContent: "center" }}>
                                  <ScorePill value={person.avg_scores[k]} C={C} />
                                </div>
                              ))}
                              <div style={{ display: "flex", justifyContent: "center" }}>
                                <span style={{ fontSize: 15, fontWeight: 700, color: getScoreColor(person.avg_global) }}>
                                  {person.avg_global.toFixed(1)}
                                </span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "center" }}>
                                <span style={{
                                  fontSize: 12, fontWeight: 500,
                                  color: person.eods_submitted < person.eods_expected ? C.warning : C.muted,
                                }}>
                                  {person.eods_submitted}/{person.eods_expected}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>

                      {/* Dept radar + bars */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                        <div style={{ background: C.bg, borderRadius: 14, border: `1px solid ${C.border}`, padding: 24 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.text, display: "block", marginBottom: 16 }}>
                            {radarLabel}
                          </span>
                          <div style={{ maxWidth: 300, margin: "0 auto" }}>
                            {radarConfig && <Radar data={radarConfig.data} options={radarConfig.options} />}
                          </div>
                        </div>
                        <div style={{ background: C.bg, borderRadius: 14, border: `1px solid ${C.border}`, padding: 24 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.text, display: "block", marginBottom: 16 }}>
                            Détail par dimension
                          </span>
                          {radarScores && DIMENSION_KEYS.map((k) => (
                            <DimensionBar key={k} label={DIMENSION_LABELS[k]} value={radarScores[k]} color={DIMENSION_COLORS[k]} C={C} />
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* ══════════════════════════════════════════════════════════
                      VIEW: PERSON — individual detail
                  ══════════════════════════════════════════════════════════ */}
                  {sidebarView === "person" && currentPersonData && (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                        {/* Radar */}
                        <div style={{ background: C.bg, borderRadius: 14, border: `1px solid ${C.border}`, padding: 24 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.text, display: "block", marginBottom: 16 }}>
                            Profil — {currentPersonData.name}
                          </span>
                          <div style={{ maxWidth: 300, margin: "0 auto" }}>
                            {radarConfig && <Radar data={radarConfig.data} options={radarConfig.options} />}
                          </div>
                        </div>

                        {/* Dimension bars */}
                        <div style={{ background: C.bg, borderRadius: 14, border: `1px solid ${C.border}`, padding: 24 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.text, display: "block", marginBottom: 16 }}>
                            Détail par dimension
                          </span>
                          {DIMENSION_KEYS.map((k) => (
                            <DimensionBar
                              key={k}
                              label={DIMENSION_LABELS[k]}
                              value={currentPersonData.avg_scores[k]}
                              color={DIMENSION_COLORS[k]}
                              C={C}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Résumé de la semaine (from weekly report person_summaries) */}
                      {(() => {
                        const ps = personSummaries.find(p => p.user_id === selectedPerson || p.name === currentPersonData.name);
                        const summaryText = ps?.summary || ps?.text || currentPersonData.summary;
                        if (!summaryText) return null;
                        return (
                          <div style={{
                            background: C.subtle,
                            borderRadius: 14,
                            border: `1px solid ${C.border}`,
                            padding: "20px 24px",
                            marginBottom: 24,
                          }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 2, marginBottom: 10, marginLeft: -10 }}>
                              <img src={iconRapport} alt="" style={{ width: 32, height: 32, opacity: 0.85, filter: darkMode ? "brightness(0) invert(1)" : "brightness(0)" }} />
                              Résumé de la semaine
                            </span>
                            <p style={{
                              fontSize: 13, lineHeight: 1.7, margin: 0,
                              color: C.secondary, whiteSpace: "pre-line",
                            }}>
                              {summaryText}
                            </p>
                          </div>
                        );
                      })()}

                      {/* EOD Heatmap (GitHub-style) */}
                      <div style={{
                        background: C.bg,
                        borderRadius: 14,
                        border: `1px solid ${C.border}`,
                        padding: "20px 24px",
                        marginBottom: 24,
                      }}>
                        <EODHeatmap
                          days={personHistory}
                          weekDays={currentPersonData?.days}
                          C={C}
                          darkMode={darkMode}
                        />
                      </div>

                      {/* ── Detail Button + Daily EOD Panel ──────────────────── */}
                      <div style={{
                        background: C.bg, borderRadius: 14, border: `1px solid ${C.border}`,
                        overflow: "hidden",
                      }}>
                        {/* Detail header with toggle + date picker */}
                        <div style={{
                          padding: "16px 24px",
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          borderBottom: showDetail ? `1px solid ${C.border}` : "none",
                        }}>
                          <button
                            onClick={() => {
                              const next = !showDetail;
                              setShowDetail(next);
                              if (next && !detailDate) {
                                // Default to today or the most recent day with data
                                const today = new Date().toISOString().split("T")[0];
                                setDetailDate(today);
                                fetchDayDetail(today);
                              }
                            }}
                            style={{
                              display: "flex", alignItems: "center", gap: 8,
                              padding: "8px 18px", borderRadius: 8,
                              fontSize: 13, fontWeight: 600,
                              border: `1px solid ${showDetail ? C.accent : C.border}`,
                              background: showDetail ? `${C.accent}10` : "transparent",
                              color: showDetail ? C.accent : C.text,
                              cursor: "pointer", transition: "all 0.2s",
                            }}
                          >
                            <span style={{ fontSize: 15 }}>📋</span>
                            Détail journalier
                            <span style={{
                              fontSize: 10,
                              transform: showDetail ? "rotate(180deg)" : "rotate(0)",
                              transition: "transform 0.2s",
                            }}>▼</span>
                          </button>

                          {showDetail && (
                            <input
                              type="date"
                              value={detailDate}
                              onChange={(e) => {
                                setDetailDate(e.target.value);
                                fetchDayDetail(e.target.value);
                              }}
                              style={{
                                padding: "7px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                                border: `1px solid ${C.border}`,
                                background: C.subtle,
                                color: C.text,
                                cursor: "pointer",
                              }}
                            />
                          )}
                        </div>

                        {/* Detail content */}
                        {showDetail && (
                          <div style={{ padding: "20px 24px" }}>
                            {detailLoading && (
                              <p style={{ fontSize: 13, color: C.muted, textAlign: "center", margin: "20px 0" }}>
                                Chargement...
                              </p>
                            )}

                            {!detailLoading && !detailData && (
                              <p style={{ fontSize: 13, color: C.muted, textAlign: "center", margin: "20px 0" }}>
                                Aucun EOD trouvé pour {currentPersonData.name} le {detailDate ? new Date(detailDate + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "—"}.
                              </p>
                            )}

                            {!detailLoading && detailData && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                                {/* Summary line (submitted_at, hours) */}
                                {(detailData.submitted_at || detailData.total_hours) && (
                                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                                    {detailData.submitted_at && (
                                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>Soumis à</span>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                                          {new Date(detailData.submitted_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                      </div>
                                    )}
                                    {detailData.total_hours != null && (
                                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>Heures totales</span>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>
                                          {detailData.total_hours}h
                                        </span>
                                      </div>
                                    )}
                                    {detailData.tasks_count != null && (
                                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>Tâches</span>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                                          {detailData.tasks_count}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* AI Score for that day */}
                                {detailData.ai_score && (
                                  <div>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 10 }}>
                                      Analyse IA — Score du jour
                                    </span>
                                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                      {DIMENSION_KEYS.map((k) => (
                                        <div key={k} style={{
                                          display: "flex", alignItems: "center", gap: 6,
                                          padding: "6px 12px", borderRadius: 8,
                                          background: C.subtle, border: `1px solid ${C.border}`,
                                        }}>
                                          <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>{DIMENSION_LABELS[k]}</span>
                                          <span style={{ fontSize: 13, fontWeight: 700, color: getScoreColor(detailData.ai_score[k] || 0) }}>
                                            {(detailData.ai_score[k] || 0).toFixed(1)}
                                          </span>
                                        </div>
                                      ))}
                                      <div style={{
                                        display: "flex", alignItems: "center", gap: 6,
                                        padding: "6px 14px", borderRadius: 8,
                                        background: `${getScoreColor(detailData.ai_score.global_score || 0)}12`,
                                        border: `1px solid ${getScoreColor(detailData.ai_score.global_score || 0)}30`,
                                      }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>Global</span>
                                        <span style={{ fontSize: 14, fontWeight: 800, color: getScoreColor(detailData.ai_score.global_score || 0) }}>
                                          {(detailData.ai_score.global_score || 0).toFixed(2)}
                                        </span>
                                      </div>
                                    </div>
                                    {/* AI ressenti for that day */}
                                    {detailData.ai_score.ressenti_individuel && (
                                      <div style={{
                                        marginTop: 12, padding: "12px 16px", borderRadius: 10,
                                        background: C.subtle, border: `1px solid ${C.border}`,
                                      }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, display: "block", marginBottom: 6 }}>
                                          Ressenti IA
                                        </span>
                                        <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: C.secondary, whiteSpace: "pre-line" }}>
                                          {detailData.ai_score.ressenti_individuel}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Questions & Answers (needs backend endpoint) */}
                                {detailData.question_answers && detailData.question_answers.length > 0 && (
                                  <div>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 10 }}>
                                      Questions & Réponses
                                    </span>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                      {detailData.question_answers.map((qa, i) => (
                                        <div key={i} style={{
                                          padding: "14px 18px", borderRadius: 10,
                                          background: C.subtle, border: `1px solid ${C.border}`,
                                        }}>
                                          <p style={{ fontSize: 13, fontWeight: 600, color: C.accent, margin: "0 0 8px 0", lineHeight: 1.5 }}>
                                            Q{i + 1}. {qa.question}
                                          </p>
                                          <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: C.text }}>
                                            {qa.answer}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Custom answer (object: {question_id, question, answer}) */}
                                {detailData.custom_answer && (
                                  <div>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 10 }}>
                                      Question personnalisée (IA)
                                    </span>
                                    <div style={{
                                      padding: "14px 18px", borderRadius: 10,
                                      background: C.subtle, border: `1px solid ${C.accent}30`,
                                    }}>
                                      {typeof detailData.custom_answer === "object" && detailData.custom_answer.question ? (
                                        <>
                                          <p style={{ fontSize: 13, fontWeight: 600, color: C.accent, margin: "0 0 8px 0", lineHeight: 1.5 }}>
                                            {detailData.custom_answer.question}
                                          </p>
                                          <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: C.text }}>
                                            {detailData.custom_answer.answer}
                                          </p>
                                        </>
                                      ) : (
                                        <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: C.text }}>
                                          {typeof detailData.custom_answer === "string" ? detailData.custom_answer : JSON.stringify(detailData.custom_answer)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Tasks & Subtasks */}
                                {detailData.tasks && detailData.tasks.length > 0 && (
                                  <div>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 10 }}>
                                      Tâches réalisées
                                    </span>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                      {detailData.tasks.map((task, i) => (
                                        <div key={i} style={{
                                          padding: "14px 18px", borderRadius: 10,
                                          background: C.subtle, border: `1px solid ${C.border}`,
                                        }}>
                                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: task.subtasks?.length > 0 ? 10 : 0 }}>
                                            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                                              {task.task_name}
                                            </span>
                                            {task.hours_spent > 0 && (
                                              <span style={{
                                                fontSize: 11, fontWeight: 600,
                                                padding: "3px 8px", borderRadius: 6,
                                                background: `${C.accent}12`, color: C.accent,
                                              }}>
                                                {task.hours_spent}h
                                              </span>
                                            )}
                                          </div>
                                          {task.subtasks && task.subtasks.length > 0 && (
                                            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 16, borderLeft: `2px solid ${C.border}` }}>
                                              {task.subtasks.map((sub, j) => (
                                                <div key={j} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                  <span style={{ fontSize: 13, color: C.secondary }}>
                                                    {sub.task_name}
                                                  </span>
                                                  {sub.hours_spent > 0 && (
                                                    <span style={{ fontSize: 11, fontWeight: 500, color: C.muted }}>
                                                      {sub.hours_spent}h
                                                    </span>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Rating & Mood */}
                                {(detailData.rating != null || detailData.mood_emoji) && (
                                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                                    {detailData.rating != null && (
                                      <div style={{
                                        padding: "12px 18px", borderRadius: 10,
                                        background: C.subtle, border: `1px solid ${C.border}`,
                                        display: "flex", alignItems: "center", gap: 8,
                                      }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>Auto-évaluation</span>
                                        <span style={{ fontSize: 18, fontWeight: 700, color: getScoreColor(detailData.rating) }}>
                                          {detailData.rating}/5
                                        </span>
                                      </div>
                                    )}
                                    {detailData.mood_emoji && (
                                      <div style={{
                                        padding: "12px 18px", borderRadius: 10,
                                        background: C.subtle, border: `1px solid ${C.border}`,
                                        display: "flex", alignItems: "center", gap: 8,
                                      }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>Humeur</span>
                                        <span style={{ fontSize: 22 }}>{detailData.mood_emoji}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* ── Alerts Section (bottom, all views) ───────────────────── */}
                  {filteredAlerts.length > 0 && (
                    <div style={{
                      background: C.bg, borderRadius: 14, border: `1px solid ${C.border}`,
                      padding: "16px 20px", marginTop: 24,
                    }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.danger, display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                        <span>!</span> Alertes — EODs manqués
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {filteredAlerts.map((alert) => (
                          <div key={alert.user_id} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 14px", borderRadius: 8,
                            background: darkMode ? "rgba(239,68,68,0.06)" : "rgba(239,68,68,0.03)",
                            border: `1px solid ${darkMode ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.1)"}`,
                          }}>
                            <div>
                              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                                {alert.full_name || alert.name}
                              </span>
                              <span style={{ fontSize: 11, marginLeft: 8, color: C.muted, textTransform: "capitalize" }}>
                                ({alert.department})
                              </span>
                            </div>
                            <span style={{ fontSize: 12, color: C.danger, fontWeight: 500 }}>
                              {alert.message || `${(alert.missed_dates || []).length} EODs manqués`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SIDEBAR ITEM ────────────────────────────────────────────────────────────────

function SidebarItem({ icon, iconSrc, label, badge, score, active, accent, onClick, C, indent, darkMode }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: indent ? "8px 16px 8px 32px" : "10px 16px",
        cursor: "pointer",
        borderRadius: 0,
        background: active ? (accent ? `${accent}10` : `${C.accent}10`) : "transparent",
        borderLeft: active ? `3px solid ${accent || C.accent}` : "3px solid transparent",
        transition: "all 0.15s",
      }}
    >
      {(iconSrc || (!icon && indent)) && (
        <div style={{
          width: 30, height: 30, flexShrink: 0,
          backgroundColor: active ? (accent || C.accent) : darkMode ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.35)",
          WebkitMaskImage: `url(${iconSrc || iconFiles})`,
          WebkitMaskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskImage: `url(${iconSrc || iconFiles})`,
          maskSize: "contain",
          maskRepeat: "no-repeat",
          maskPosition: "center",
          transition: "all 0.15s",
        }} />
      )}
      {icon && !iconSrc && (
        <span style={{ fontSize: 14, width: 20, textAlign: "center", flexShrink: 0 }}>{icon}</span>
      )}
      <span style={{
        fontSize: 13, fontWeight: active ? 700 : 500,
        color: active ? (accent || C.accent) : C.muted,
        flex: 1,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {label}
      </span>
      {score !== undefined && score !== null && (
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: getScoreColor(score),
        }}>
          {score.toFixed(1)}
        </span>
      )}
      {badge !== undefined && badge > 0 && !score && (
        <span style={{
          fontSize: 10, fontWeight: 600,
          padding: "2px 6px", borderRadius: 4,
          background: C.subtle, color: C.muted,
        }}>
          {badge}
        </span>
      )}
    </div>
  );
}

// ── SCORE PILL (for table cells) ────────────────────────────────────────────────

function ScorePill({ value, C }) {
  const v = Number.isFinite(value) ? value : 0;
  const color = getScoreColor(v);
  return (
    <span style={{
      fontSize: 13, fontWeight: 600,
      padding: "3px 10px", borderRadius: 6,
      background: `${color}12`,
      color,
    }}>
      {v.toFixed(1)}
    </span>
  );
}

// ── KPI CARD ────────────────────────────────────────────────────────────────────

function KPICard({ C, label, value, suffix = "", color }) {
  return (
    <div style={{
      background: C.bg, borderRadius: 12,
      border: `1px solid ${C.border}`,
      padding: "18px 20px",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ fontSize: 24, fontWeight: 700, color, letterSpacing: "-0.02em" }}>
          {value}
        </span>
        {suffix && (
          <span style={{ fontSize: 13, fontWeight: 500, color: C.muted }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
