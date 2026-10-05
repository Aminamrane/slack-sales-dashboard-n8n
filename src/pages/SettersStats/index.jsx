// Page CEO « Setters » (demande dev 05/10/2026, pour Paul ; refonte UX le même jour).
// Une période (« Depuis mai » ou un mois), le classement des setters (appels Allo, RDV posés, résultat des RDV,
// clients signés, CA, transformation), les clients signés mois par mois, et la fiche d'un setter : ses clients
// signés et ses RDV posés, regroupés par mois et triés par date. Lecture seule.
// Calculs côté serveur (app/services/ceo_setters.py) ; logique d'affichage testée dans ./settersStats.js.
// Données : GET /ceo-dashboard/setters et /ceo-dashboard/setters/calls?period= (admin, CEO).
// Lien direct vers une fiche : ?setter=<id>.
import { useEffect, useMemo, useState } from "react";
import apiClient from "../../services/apiClient";
import { fmtTalk } from "../../utils/setterPilotage.js";
import {
  ALL, CHANNEL_LABELS, CLIENT_STATE_LABELS, ORIGIN_LABELS, ORIGIN_TONES, OUTCOME_HINTS, OUTCOME_LABELS, OUTCOME_TONES,
  assignedLabel, clientState, conversion, fmtDay, fmtEuro, fmtInt, fmtMonth, fmtMonthShort, fmtRate, fmtRdv,
  groupByMonth, hasActivity, initials, originEntries, periodOptions, periodStats, resultSegments, splitClient,
} from "./settersStats.js";

const CLIENT_TONES = { client: "#10b981", already_client: "#94a3b8", signed_not_declared: "#f59e0b" };
const RESULT_LABELS = { held: "Honorés", no_show: "No-show", to_qualify: "À qualifier", upcoming: "À venir" };

function readSetterParam() {
  try { return new URLSearchParams(window.location.search).get("setter"); } catch { return null; }
}
function writeSetterParam(id) {
  try {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("setter", id); else url.searchParams.delete("setter");
    window.history.replaceState(window.history.state, "", url);
  } catch { /* lien direct indisponible : la fiche s'ouvre quand même */ }
}

// Appels Allo d'un setter sur une période : chiffres, ou la raison de leur absence (jamais un 0 inventé).
function callsOf(response, setterId) {
  if (!response) return { state: "loading" };
  if (response.status === "error") return { state: "error" };
  const st = response.setters?.[setterId];
  if (!st || st.status === "missing") return { state: "missing" };
  if (st.status === "error") return { state: "error" };
  return { state: "ok", ...st };
}

export default function SettersStats({ C, darkMode }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState(ALL);
  const [calls, setCalls] = useState({});             // période -> réponse Allo
  const [detailId, setDetailId] = useState(readSetterParam);
  const [tab, setTab] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("onglet") === "rdv" ? "rdv" : "clients"; } catch { return "clients"; }
  });

  useEffect(() => {
    let alive = true;
    apiClient.get("/api/v1/ceo-dashboard/setters")
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setError("Impossible de charger les statistiques des setters. Réessayez dans un instant."); });
    return () => { alive = false; };
  }, []);

  // Allo à la demande, par période (le cache du serveur rend les relectures immédiates).
  const wanted = useMemo(() => [...new Set([period, ...(detailId ? [ALL] : [])])], [period, detailId]);
  useEffect(() => {
    wanted.filter((p) => !(p in calls)).forEach((p) => {
      setCalls((c) => ({ ...c, [p]: null }));
      apiClient.get(`/api/v1/ceo-dashboard/setters/calls?period=${p}`)
        .then((res) => setCalls((c) => ({ ...c, [p]: res })))
        .catch(() => setCalls((c) => ({ ...c, [p]: { status: "error", setters: {} } })));
    });
  }, [wanted, calls]);

  const openDetail = (id) => { setDetailId(id); setTab("clients"); writeSetterParam(id); };
  const closeDetail = () => { setDetailId(null); writeSetterParam(null); };
  useEffect(() => {
    if (!detailId) return undefined;
    const onKey = (e) => { if (e.key === "Escape") closeDetail(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailId]);

  const options = useMemo(() => periodOptions(data?.months, data?.since?.slice(0, 7)), [data]);
  const team = periodStats(data?.team, period);
  const ranked = useMemo(() => (data?.setters || [])
    .map((s) => ({ ...s, st: periodStats(s, period) }))
    .sort((a, b) => (b.st.sales.count || 0) - (a.st.sales.count || 0) || (b.st.rdv.total || 0) - (a.st.rdv.total || 0)
      || String(a.name || "").localeCompare(String(b.name || ""), "fr")), [data, period]);
  const periodCalls = calls[period];
  const active = ranked.filter((s) => hasActivity(s.st) || (callsOf(periodCalls, s.id).calls || 0) > 0);
  const idle = ranked.filter((s) => !active.includes(s));
  const teamCalls = useMemo(() => {
    if (!periodCalls || periodCalls.status === "error") return null;
    return Object.values(periodCalls.setters || {}).filter((x) => x.status === "linked")
      .reduce((t, x) => ({ calls: t.calls + x.calls, answered: t.answered + x.answered, duration: t.duration + x.duration }),
        { calls: 0, answered: 0, duration: 0 });
  }, [periodCalls]);
  const everActive = useMemo(() => (data?.setters || []).filter((s) => (s.totals?.sales?.count || 0) > 0), [data]);
  const shownMonths = useMemo(() => (data?.months || []).filter((m) => m <= (data?.now || "").slice(0, 7)), [data]);
  const detail = useMemo(() => (data?.setters || []).find((s) => s.id === detailId) || null, [data, detailId]);
  const periodLabel = options.find((o) => o.value === period)?.label || "";

  // ── Styles ─────────────────────────────────────────────────────────────────────────────────
  const card = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: C.shadow };
  const label = { fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" };
  const th = { ...label, padding: "11px 14px", textAlign: "left", whiteSpace: "nowrap" };
  const thNum = { ...th, textAlign: "right" };
  const td = { padding: "12px 14px", fontSize: 13, color: C.text, verticalAlign: "middle" };
  const tdNum = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const sub = { fontSize: 11.5, color: C.secondary, marginTop: 2 };
  const h2 = { fontSize: 15, fontWeight: 700, color: C.text, margin: "30px 0 12px", letterSpacing: "-0.01em" };
  const pill = (tone, text, title) => (
    <span title={title} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, color: tone, background: `${tone}1f`, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: tone }} />{text}
    </span>
  );
  const avatar = (name, size = 32) => (
    <span style={{ width: size, height: size, borderRadius: 999, background: darkMode ? "#2a2b36" : "#e8ebf5", color: C.accent, fontSize: size * 0.38, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {initials(name)}
    </span>
  );
  const resultBar = (rdv, height = 8) => {
    const parts = resultSegments(rdv);
    if (!parts.length) return <div style={{ height, borderRadius: 999, background: C.subtle }} />;
    return (
      <div title={parts.map((p) => `${RESULT_LABELS[p.key]} : ${p.value}`).join(" · ")}
        style={{ display: "flex", height, borderRadius: 999, overflow: "hidden", background: C.subtle }}>
        {parts.map((p) => <span key={p.key} style={{ width: `${p.pct}%`, background: OUTCOME_TONES[p.key] }} />)}
      </div>
    );
  };
  const legend = (rdv) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 10 }}>
      {Object.keys(RESULT_LABELS).map((k) => (
        <span key={k} title={OUTCOME_HINTS[k]} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.secondary }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: OUTCOME_TONES[k] }} />
          {RESULT_LABELS[k]} <b style={{ color: C.text, fontVariantNumeric: "tabular-nums" }}>{fmtInt(rdv?.[k])}</b>
        </span>
      ))}
    </div>
  );
  const kpi = (title, value, detailText, tone) => (
    <div style={{ ...card, padding: "16px 18px" }}>
      <div style={label}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: tone || C.text, fontVariantNumeric: "tabular-nums", marginTop: 6 }}>{value}</div>
      {detailText && <div style={{ ...sub, marginTop: 4 }}>{detailText}</div>}
    </div>
  );
  const callsCell = (c) => {
    if (c.state === "loading") return <span style={{ color: C.muted }}>…</span>;
    if (c.state === "missing") return <span style={{ fontSize: 12, color: C.muted }}>Pas de compte Allo</span>;
    if (c.state === "error") return <span style={{ fontSize: 12, color: C.muted }}>Allo indisponible</span>;
    return (
      <>
        <div style={{ fontWeight: 600 }}>{fmtInt(c.calls)}</div>
        <div style={sub}>{fmtInt(c.answered)} répondus · {fmtTalk(c.duration)}</div>
      </>
    );
  };

  return (
    <div style={{ padding: "28px 32px 56px", maxWidth: 1320 }}>
      {/* En-tête et période */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
        <div style={{ flex: "1 1 420px" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "0 0 6px", letterSpacing: "-0.01em" }}>Setters</h1>
          <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.55 }}>
            Appels, rendez-vous posés et clients amenés par chaque setter. Cliquez sur un setter pour voir ses clients et ses RDV.
          </p>
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={label}>Période</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} disabled={!data}
            style={{ minWidth: 200, padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>

      {error && <div role="alert" style={{ ...card, padding: 18, fontSize: 13.5, color: "#b42318", marginBottom: 16 }}>{error}</div>}

      {/* Chiffres clés de la période */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        {kpi("Appels passés", teamCalls ? fmtInt(teamCalls.calls) : (periodCalls?.status === "error" ? "Indisponible" : "…"),
          teamCalls ? `${fmtInt(teamCalls.answered)} répondus · ${fmtTalk(teamCalls.duration)} au téléphone` : "Allo")}
        {kpi("RDV posés", data ? fmtInt(team.rdv.total) : "…", data ? `dont ${fmtInt(team.rdv.webinar_link)} via un lien webinaire` : null)}
        {kpi("Clients signés", data ? fmtInt(team.sales.count) : "…", "à la suite d'un RDV de setter", "#10b981")}
        {kpi("CA des contrats", data ? fmtEuro(team.sales.amount) : "…", data ? `${fmtEuro(team.sales.cash)} encaissés à la signature` : null)}
        {kpi("Transformation", data ? fmtRate(conversion(team.rdv)) : "…", "clients signés / RDV honorés")}
      </div>
      <div style={{ ...card, padding: "16px 18px", marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
          <div style={label}>Résultat des RDV posés</div>
          <div style={{ fontSize: 12, color: C.muted }}>{periodLabel}</div>
        </div>
        {resultBar(team.rdv, 12)}
        {legend(team.rdv)}
      </div>

      {/* Classement */}
      <h2 style={h2}>Classement des setters</h2>
      <div style={{ ...card, overflow: "hidden" }}>
        {!data ? (
          <div style={{ padding: 22, fontSize: 13.5, color: C.muted }}>{error ? "" : "Chargement…"}</div>
        ) : !active.length ? (
          <div style={{ padding: 22, fontSize: 13.5, color: C.muted }}>Aucune activité de setter sur cette période.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: 980 }}>
              <colgroup>
                <col style={{ width: "23%" }} /><col style={{ width: "13%" }} /><col style={{ width: "9%" }} /><col style={{ width: "22%" }} />
                <col style={{ width: "9%" }} /><col style={{ width: "11%" }} /><col style={{ width: "8%" }} /><col style={{ width: 36 }} />
              </colgroup>
              <thead>
                <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                  <th style={th}>Setter</th>
                  <th style={thNum}>Appels Allo</th>
                  <th style={thNum}>RDV posés</th>
                  <th style={th}>Résultat des RDV</th>
                  <th style={thNum}>Clients</th>
                  <th style={thNum}>CA contrats</th>
                  <th style={thNum} title="Clients signés / RDV honorés">Transfo</th>
                  <th style={th} aria-label="Ouvrir" />
                </tr>
              </thead>
              <tbody>
                {active.map((s) => (
                  <tr key={s.id} onClick={() => openDetail(s.id)} title="Voir ses clients et ses RDV"
                    style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer", transition: "background 0.12s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.subtle; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {avatar(s.name)}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name || "Setter inconnu"}</div>
                          <div style={sub}>{s.has_webinar_link ? "Lien webinaire" : "CRM"}{!s.active ? " · compte désactivé" : ""}</div>
                        </div>
                      </div>
                    </td>
                    <td style={tdNum}>{callsCell(callsOf(periodCalls, s.id))}</td>
                    <td style={tdNum}>
                      <div style={{ fontWeight: 600 }}>{fmtInt(s.st.rdv.total)}</div>
                      {(s.st.rdv.webinar_link || 0) > 0 && <div style={sub}>dont {fmtInt(s.st.rdv.webinar_link)} lien</div>}
                    </td>
                    <td style={td}>
                      {resultBar(s.st.rdv)}
                      <div style={{ ...sub, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {fmtInt(s.st.rdv.held)} honorés · {fmtInt(s.st.rdv.no_show)} no-show · {fmtInt(s.st.rdv.to_qualify)} à qualifier
                      </div>
                    </td>
                    <td style={{ ...tdNum, fontSize: 15, fontWeight: 700, color: (s.st.sales.count || 0) > 0 ? "#10b981" : C.muted }}>{fmtInt(s.st.sales.count)}</td>
                    <td style={tdNum}>{fmtEuro(s.st.sales.amount)}</td>
                    <td style={tdNum}>{fmtRate(conversion(s.st.rdv))}</td>
                    <td style={{ ...td, color: C.muted, fontSize: 18, textAlign: "center" }}>›</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && idle.length > 0 && (
          <div style={{ padding: "12px 16px", fontSize: 12.5, color: C.muted, borderTop: `1px solid ${C.border}`, background: C.surface }}>
            Sans activité sur la période : {idle.map((s) => s.name || "Setter inconnu").join(", ")}
          </div>
        )}
      </div>

      {/* Clients signés par mois */}
      {data && everActive.length > 0 && (
        <>
          <h2 style={h2}>Clients signés par mois</h2>
          <div style={{ ...card, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                    <th style={th}>Setter</th>
                    {shownMonths.map((m) => (
                      <th key={m} style={{ ...thNum, color: m === period ? C.accent : C.muted }}>
                        <button type="button" onClick={() => setPeriod(m)} title={`Voir ${fmtMonth(m).toLowerCase()}`}
                          style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", font: "inherit", color: "inherit", textTransform: "inherit", letterSpacing: "inherit" }}>
                          {fmtMonthShort(m)}
                        </button>
                      </th>
                    ))}
                    <th style={thNum}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...everActive, { id: "__team", name: "Équipe", months: data.team.months, totals: data.team.totals, team: true }].map((s) => (
                    <tr key={s.id} onClick={s.team ? undefined : () => openDetail(s.id)}
                      style={{ borderBottom: `1px solid ${C.border}`, background: s.team ? C.surface : "transparent", cursor: s.team ? "default" : "pointer" }}>
                      <td style={{ ...td, fontWeight: s.team ? 700 : 600, whiteSpace: "nowrap" }}>{s.name || "Setter inconnu"}</td>
                      {shownMonths.map((m) => {
                        const st = s.months?.[m]?.sales || {};
                        return (
                          <td key={m} style={{ ...tdNum, background: m === period ? C.subtle : "transparent", color: st.count ? C.text : C.muted, fontWeight: s.team ? 700 : 500 }}>
                            <div>{st.count ? fmtInt(st.count) : "·"}</div>
                            {st.count > 0 && <div style={sub}>{fmtEuro(st.amount)}</div>}
                          </td>
                        );
                      })}
                      <td style={{ ...tdNum, fontWeight: 700 }}>
                        <div>{fmtInt(s.totals.sales.count)}</div>
                        <div style={sub}>{fmtEuro(s.totals.sales.amount)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {detail && <SetterDetail detail={detail} rdvAll={data?.rdv_all || []} allCalls={callsOf(calls[ALL], detail.id)} tab={tab} setTab={setTab}
        onClose={closeDetail} C={C} darkMode={darkMode} styles={{ card, label, sub, pill, avatar, resultBar, legend }} />}
    </div>
  );
}

function SetterDetail({ detail, rdvAll, allCalls, tab, setTab, onClose, C, darkMode, styles }) {
  const { card, label, sub, pill, avatar, resultBar, legend } = styles;
  const clientsByMonth = useMemo(() => groupByMonth(detail.clients, "signed_at"), [detail]);
  const rdvs = useMemo(() => rdvAll.filter((r) => r.setter_id === detail.id), [rdvAll, detail]);
  const rdvByMonth = useMemo(() => groupByMonth(rdvs, "rdv_at"), [rdvs]);
  const t = detail.totals;
  const callsValue = allCalls.state === "ok" ? fmtInt(allCalls.calls) : allCalls.state === "loading" ? "…" : allCalls.state === "missing" ? "Pas de compte" : "Indisponible";
  const callsDetail = allCalls.state === "ok" ? `${fmtInt(allCalls.answered)} répondus · ${fmtTalk(allCalls.duration)}` : "Allo";
  const tabBtn = (key, text) => (
    <button type="button" onClick={() => setTab(key)} style={{
      padding: "9px 14px", border: "none", borderBottom: `2px solid ${tab === key ? C.accent : "transparent"}`, background: "transparent",
      color: tab === key ? C.text : C.secondary, fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
    }}>{text}</button>
  );
  const monthHeader = (month, right) => (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "18px 2px 8px" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{month === "sans-date" ? "Sans date" : fmtMonth(month)}</div>
      <div style={{ fontSize: 12.5, color: C.secondary }}>{right}</div>
    </div>
  );
  const row = { display: "grid", alignItems: "center", gap: 14, padding: "12px 16px", borderBottom: `1px solid ${C.border}` };
  const ellipsis = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,17,23,0.35)", display: "flex", justifyContent: "flex-end" }}>
      <div role="dialog" aria-label={`Fiche de ${detail.name}`} onClick={(e) => e.stopPropagation()}
        style={{ width: "min(1080px, 100vw)", height: "100%", overflowY: "auto", background: darkMode ? "#0f1117" : "#f6f7f9", boxShadow: "-12px 0 40px rgba(0,0,0,0.18)", padding: "24px 28px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {avatar(detail.name, 44)}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>{detail.name}</h2>
            <div style={sub}>{detail.has_webinar_link ? "Setter avec lien webinaire" : "Setter"}{!detail.active ? " · compte désactivé" : ""} · chiffres depuis mai 2026</div>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose}
            style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.text, cursor: "pointer", fontSize: 20, lineHeight: 1, fontFamily: "inherit" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10, marginTop: 18 }}>
          {[["Appels Allo", callsValue, callsDetail],
            ["RDV posés", fmtInt(t.rdv.total), `${fmtInt(t.rdv.crm)} CRM · ${fmtInt(t.rdv.webinar_link)} lien webinaire`],
            ["Clients signés", fmtInt(t.sales.count), null],
            ["CA des contrats", fmtEuro(t.sales.amount), `${fmtEuro(t.sales.cash)} encaissés`],
            ["Transformation", fmtRate(conversion(t.rdv)), "clients / RDV honorés"]].map(([k, v, d]) => (
            <div key={k} style={{ ...card, padding: "12px 14px" }}>
              <div style={label}>{k}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{v}</div>
              {d && <div style={sub}>{d}</div>}
            </div>
          ))}
        </div>
        <div style={{ ...card, padding: "12px 14px", marginTop: 10 }}>
          {resultBar(t.rdv, 10)}
          {legend(t.rdv)}
        </div>
        {originEntries(detail.origins).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12 }}>
            <span style={{ ...label, marginRight: 4 }}>Origine des clients</span>
            {originEntries(detail.origins).map(([key, n]) => (
              <span key={key}>{pill(ORIGIN_TONES[key] || ORIGIN_TONES.other, `${ORIGIN_LABELS[key] || key} · ${fmtInt(n)}`)}</span>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, marginTop: 18 }}>
          {tabBtn("clients", `Clients signés (${fmtInt(detail.clients?.length)})`)}
          {tabBtn("rdv", `RDV posés (${fmtInt(rdvs.length)})`)}
        </div>

        {tab === "clients" && (
          !clientsByMonth.length
            ? <div style={{ padding: "22px 2px", fontSize: 13, color: C.muted }}>Aucun client signé à la suite de ses RDV depuis mai.</div>
            : clientsByMonth.map((g) => {
              const total = g.items.reduce((n, c) => n + (Number(c.amount) || 0), 0);
              return (
                <div key={g.month}>
                  {monthHeader(g.month, `${fmtInt(g.items.length)} client${g.items.length > 1 ? "s" : ""} · ${fmtEuro(total)}`)}
                  <div style={{ ...card, overflow: "hidden" }}>
                    {g.items.map((c, i) => {
                      const who = splitClient(c.client_name, c.societe);
                      return (
                        <div key={`${c.numero_client || i}-${c.signed_at}`} style={{ ...row, gridTemplateColumns: "78px minmax(0, 2fr) minmax(0, 1.2fr) minmax(0, 1.9fr) 104px minmax(0, 1.3fr)" }}>
                          <div style={{ fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>{c.numero_client || "Sans n°"}</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: C.text, ...ellipsis }}>{who.company}</div>
                            {who.person && <div style={{ ...sub, ...ellipsis }}>{who.person}</div>}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            {pill(ORIGIN_TONES[c.origin] || ORIGIN_TONES.other, ORIGIN_LABELS[c.origin] || c.origin)}
                            {c.origin_label && <div style={{ ...sub, ...ellipsis }}>{c.origin_label}</div>}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: C.text }}>Signé le {fmtDay(c.signed_at)}</div>
                            <div style={sub}>RDV du {fmtRdv(c.rdv_at)} · {c.kind === "r1" ? "R1" : "R2"} {CHANNEL_LABELS[c.channel]}</div>
                            <div style={sub}>{fmtInt(c.days_to_sign)} j entre le RDV posé et la signature</div>
                          </div>
                          <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                            <div style={{ fontWeight: 600, color: C.text }}>{fmtEuro(c.amount)}</div>
                            <div style={sub}>{fmtEuro(c.cash)} cash</div>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ ...label, fontSize: 9.5 }}>Vendu par</div>
                            <div style={{ fontSize: 12.5, color: C.text, ...ellipsis }}>{c.sales_name || "Non renseigné"}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
        )}

        {tab === "rdv" && (
          !rdvByMonth.length
            ? <div style={{ padding: "22px 2px", fontSize: 13, color: C.muted }}>Aucun RDV posé depuis mai.</div>
            : rdvByMonth.map((g) => {
              const held = g.items.filter((r) => r.outcome === "held").length;
              const clients = g.items.filter((r) => r.client).length;
              return (
                <div key={g.month}>
                  {monthHeader(g.month, `${fmtInt(g.items.length)} RDV · ${fmtInt(held)} honoré${held > 1 ? "s" : ""} · ${fmtInt(clients)} client${clients > 1 ? "s" : ""}`)}
                  <div style={{ ...card, overflow: "hidden" }}>
                    {g.items.map((r) => {
                      const state = clientState(r);
                      const waiting = r.assigned?.state !== "assigned";
                      return (
                        <div key={`${r.lead_id}-${r.kind}`} style={{ ...row, gridTemplateColumns: "172px minmax(0, 2fr) minmax(0, 1.1fr) 120px minmax(0, 1.4fr) minmax(0, 1.2fr)" }}>
                          <div>
                            <div style={{ fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>{fmtRdv(r.rdv_at)}</div>
                            <div style={sub}>{r.kind === "r1" ? "R1" : "R2"} · {CHANNEL_LABELS[r.channel]}</div>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: C.text, ...ellipsis }}>{r.company || r.full_name || "Prospect sans nom"}</div>
                            {r.company && r.full_name && <div style={{ ...sub, ...ellipsis }}>{r.full_name}</div>}
                          </div>
                          <div style={{ minWidth: 0 }}>{pill(ORIGIN_TONES[r.origin] || ORIGIN_TONES.other, ORIGIN_LABELS[r.origin] || r.origin)}</div>
                          <div>{pill(OUTCOME_TONES[r.outcome] || OUTCOME_TONES.removed, OUTCOME_LABELS[r.outcome] || r.outcome, OUTCOME_HINTS[r.outcome])}</div>
                          <div style={{ minWidth: 0 }}>
                            {state
                              ? <>{pill(CLIENT_TONES[state], state === "client" && r.client?.numero_client ? `Client ${r.client.numero_client}` : CLIENT_STATE_LABELS[state])}
                                {r.client && <div style={sub}>signé le {fmtDay(r.client.signed_at)}</div>}</>
                              : <span style={{ fontSize: 12.5, color: C.muted }}>Pas encore client</span>}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ ...label, fontSize: 9.5 }}>Affecté à</div>
                            <div style={{ fontSize: 12.5, color: waiting ? C.muted : C.text, fontStyle: waiting ? "italic" : "normal", ...ellipsis }}>{assignedLabel(r.assigned)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}
