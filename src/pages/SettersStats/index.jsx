// Onglet « Classement » de Perf Setter (page CEO « Setters » née le 05/10/2026, refonte UX le même jour ; passée dans Perf Setter le 30/10/2026).
// Une période (« Depuis mai » ou un mois), le classement des setters (appels Allo, RDV posés, résultat des RDV, clients signés, CA, transformation),
// les clients signés mois par mois, et la fiche d'un setter : ses clients signés et ses RDV posés, regroupés par mois et triés par date. Lecture seule.
// Calculs côté serveur (app/services/ceo_setters.py) ; logique d'affichage testée dans ./settersStats.js.
// Données : GET /ceo-dashboard/setters et /ceo-dashboard/setters/calls?period= (admin, CEO). Lien direct vers une fiche : ?setter=<id>.
// Aucune donnée, aucun calcul n'a changé : la présentation reprend la charte de la Performance Sales (classes ps2 de perfSales/v2/v2.css).
import { useEffect, useMemo, useRef, useState } from "react";
import { motion as Motion } from "framer-motion";
import apiClient from "../../services/apiClient";
import { fmtTalk } from "../../utils/setterPilotage.js";
import { ITEM, Reveal } from "../../components/perfSales/motion";
import { CallsOverview, RdvCallsPanel } from "./RdvCalls.jsx";
import CallsPanel from "./CallsPanel.jsx";
import useProspectCalls from "./useProspectCalls.js";
import { overviewOf, rdvCallsView } from "./setterCalls.js";
import {
  ALL, CHANNEL_LABELS, CLIENT_STATE_LABELS, ORIGIN_LABELS, ORIGIN_TONES, OUTCOME_HINTS, OUTCOME_LABELS, OUTCOME_TONES,
  assignedLabel, clientState, conversion, fmtDay, fmtEuro, fmtInt, fmtMonth, fmtMonthShort, fmtRate, fmtRdv,
  groupByMonth, hasActivity, initials, originEntries, periodOptions, periodStats, resultSegments, splitClient,
} from "./settersStats.js";

// Couleurs des résultats : la charte Owner (vert, terre cuite, or, bleu clair), les mêmes dans la barre, la légende et les pastilles de la fiche.
const RESULT_TONES = { held: "#3e7d5a", no_show: "#c2410c", to_qualify: "#d4a017", upcoming: "#9fb3df" };
const outcomeTone = (key) => RESULT_TONES[key] || OUTCOME_TONES[key] || OUTCOME_TONES.removed;
const CLIENT_TONES = { client: "#3e7d5a", already_client: "#8a93a6", signed_not_declared: "#d4a017" };
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

// Lectures gardées le temps de la page Perf Setter (le changement d'onglet ne relit pas Allo) ; « Actualiser » (refreshKey) les relit.
const keep = (map, key, load) => {
  if (!map.has(key)) map.set(key, load().catch((e) => { map.delete(key); throw e; }));
  return map.get(key);
};
const loadOverview = (store, refreshKey) => keep(store.overview, String(refreshKey), () => apiClient.get("/api/v1/ceo-dashboard/setters"));
const loadCalls = (store, period, refreshKey) => keep(store.calls, `${refreshKey}|${period}`, () => apiClient.get(`/api/v1/ceo-dashboard/setters/calls?period=${period}`));

// ── Pièces de présentation (charte ps2) ───────────────────────────────────────────────────────────
function Face({ name, size = 30, url }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="ps2-avatar is-soft" style={{ flex: `0 0 ${size}px`, width: size, height: size, fontSize: Math.round(size * 0.37), overflow: "hidden" }}>
      {url && !broken ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setBroken(true)} /> : initials(name)}
    </span>
  );
}

const resultBar = (rdv, height = 14) => {
  const parts = resultSegments(rdv);
  const text = parts.map((p) => `${RESULT_LABELS[p.key]} : ${p.value}`).join(" · ");
  return (
    <div className="ps2-compo" role="img" aria-label={text || "Aucun RDV posé"} title={text || undefined} style={{ height, marginTop: 0 }}>
      {parts.map((p) => <i key={p.key} style={{ width: `${p.pct}%`, background: RESULT_TONES[p.key] }} />)}
    </div>
  );
};

const legend = (rdv) => (
  <div className="ps2-compo-legend" style={{ marginTop: 12 }}>
    {Object.keys(RESULT_LABELS).map((k) => (
      <span key={k} title={OUTCOME_HINTS[k]}><i style={{ background: RESULT_TONES[k] }} />{RESULT_LABELS[k]} <b className="ps2-num">{fmtInt(rdv?.[k])}</b></span>
    ))}
  </div>
);

const pill = (tone, text, title) => (
  <span title={title} className="pst-pill" style={{ color: `color-mix(in srgb, ${tone} 58%, var(--ink))`, background: `${tone}1f` }}>
    <span style={{ background: tone }} />{text}
  </span>
);

const kpi = (title, value, detailText, tone) => (
  <div className="ps2-setter-kpi" key={title}>
    <span>{title}</span>
    <b className="ps2-num" style={tone ? { color: tone } : undefined}>{value}</b>
    {detailText && <small>{detailText}</small>}
  </div>
);

const Chevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
);

export default function SettersStats({ C, darkMode, refreshKey = 0, cache, avatarFor }) {
  const own = useRef(null);
  if (!own.current) own.current = { overview: new Map(), calls: new Map() };
  const store = cache || own.current;
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
    setData(null); setError(""); setCalls({});
    loadOverview(store, refreshKey)
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setError("Impossible de charger les statistiques des setters. Réessayez dans un instant."); });
    return () => { alive = false; };
  }, [store, refreshKey]);

  // Allo à la demande, par période (le cache du serveur rend les relectures immédiates).
  const wanted = useMemo(() => [...new Set([period, ...(detailId ? [ALL] : [])])], [period, detailId]);
  useEffect(() => {
    wanted.filter((p) => !(p in calls)).forEach((p) => {
      setCalls((c) => ({ ...c, [p]: null }));
      loadCalls(store, p, refreshKey)
        .then((res) => setCalls((c) => ({ ...c, [p]: res })))
        .catch(() => setCalls((c) => ({ ...c, [p]: { status: "error", setters: {} } })));
    });
  }, [wanted, calls, store, refreshKey]);

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

  const sub = { fontSize: 11.5, color: C.secondary, marginTop: 2 };
  const styles = {
    card: { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18 },
    label: { fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 500, color: C.secondary, textTransform: "uppercase", letterSpacing: "0.05em" },
    sub, pill, resultBar, legend,
    avatar: (name, size = 32) => <Face name={name} size={size} url={avatarFor?.(name)} />,
  };
  const callsCell = (c) => {
    if (c.state === "loading") return <span className="ps2-muted">…</span>;
    if (c.state === "missing") return <small className="ps2-muted">Pas de compte Allo</small>;
    if (c.state === "error") return <small className="ps2-muted">Allo indisponible</small>;
    return (
      <>
        <b>{fmtInt(c.calls)}</b>
        <small>{fmtInt(c.answered)} répondus · {fmtTalk(c.duration)}</small>
      </>
    );
  };

  return (
    <div className="pst-rank">
      {/* Période */}
      <div className="pst-rank-top">
        <p>Cliquez sur un setter pour voir ses clients et ses RDV.</p>
        <span className="pst-rank-period">
          <span className="ps2-mono">Période</span>
          <label className="ps2-month">
            <span>{periodLabel || "Depuis mai"}</span>
            <Chevron />
            <select aria-label="Période" value={period} onChange={(e) => setPeriod(e.target.value)} disabled={!data}>
              {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </span>
      </div>

      {error && <div role="alert" className="ps2-empty">{error}</div>}

      {/* Chiffres clés de la période */}
      <Reveal as="section" className="ps2-setter-kpis" aria-label="Chiffres clés de la période" variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.07 } } }}>
        {[
          kpi("Appels passés", teamCalls ? fmtInt(teamCalls.calls) : (periodCalls?.status === "error" ? "Indisponible" : "…"),
            teamCalls ? `${fmtInt(teamCalls.answered)} répondus · ${fmtTalk(teamCalls.duration)} au téléphone` : "Allo"),
          kpi("RDV posés", data ? fmtInt(team.rdv.total) : "…", data ? `dont ${fmtInt(team.rdv.webinar_link)} via un lien webinaire` : null),
          kpi("Clients signés", data ? fmtInt(team.sales.count) : "…", "à la suite d'un RDV de setter", "var(--good-strong)"),
          kpi("CA des contrats", data ? fmtEuro(team.sales.amount) : "…", data ? `${fmtEuro(team.sales.cash)} encaissés à la signature` : null),
          kpi("Transformation", data ? fmtRate(conversion(team.rdv)) : "…", "clients signés / RDV honorés"),
        ].map((tile) => <Motion.div key={tile.key} variants={ITEM}>{tile}</Motion.div>)}
      </Reveal>

      <Reveal as="section" className="ps2-card" aria-labelledby="pst-rank-result">
        <Motion.div className="ps2-card-head" variants={ITEM}>
          <h2 id="pst-rank-result">Résultat des RDV posés</h2>
          <span className="ps2-chip-soft">{periodLabel}</span>
        </Motion.div>
        <Motion.div variants={ITEM} style={{ marginTop: 14 }}>
          {resultBar(team.rdv, 14)}
          {legend(team.rdv)}
        </Motion.div>
      </Reveal>

      {/* Classement */}
      <Reveal as="section" className="ps2-card" aria-labelledby="pst-rank-title">
        <Motion.div className="ps2-card-head" variants={ITEM}>
          <h2 id="pst-rank-title">Classement des setters</h2>
          <span className="ps2-chip-soft">{periodLabel}</span>
        </Motion.div>
        {!data ? (
          error ? null : <div className="ps2-loading" aria-label="Chargement"><i /><i /><i /><i /></div>
        ) : !active.length ? (
          <div className="ps2-empty">Aucune activité de setter sur cette période.</div>
        ) : (
          <div className="ps2-ctable-wrap" style={{ marginTop: 12 }}>
            <table className="ps2-ctable pst-ranktable" style={{ "--c": "var(--navy)" }}>
              <thead>
                <tr>
                  <th>Setter</th>
                  <th>Appels Allo</th>
                  <th>RDV posés</th>
                  <th style={{ textAlign: "left" }}>Résultat des RDV</th>
                  <th>Clients</th>
                  <th>CA contrats</th>
                  <th title="Clients signés / RDV honorés">Transfo</th>
                  <th><span className="pst-sr">Ouvrir la fiche</span></th>
                </tr>
              </thead>
              <tbody>
                {active.map((s) => (
                  <tr key={s.id} onClick={() => openDetail(s.id)} title="Voir ses clients et ses RDV" className="pst-row">
                    <td>
                      <span className="pst-who">
                        <Face name={s.name} url={avatarFor?.(s.name)} />
                        <span>
                          <button type="button" className="pst-open" onClick={(e) => { e.stopPropagation(); openDetail(s.id); }} aria-label={`Ouvrir la fiche de ${s.name || "Setter inconnu"}`}>{s.name || "Setter inconnu"}</button>
                          <small>{s.has_webinar_link ? "Lien webinaire" : "CRM"}{!s.active ? " · compte désactivé" : ""}</small>
                        </span>
                      </span>
                    </td>
                    <td className="pst-two">{callsCell(callsOf(periodCalls, s.id))}</td>
                    <td className="pst-two">
                      <b>{fmtInt(s.st.rdv.total)}</b>
                      {(s.st.rdv.webinar_link || 0) > 0 && <small>dont {fmtInt(s.st.rdv.webinar_link)} lien</small>}
                    </td>
                    <td style={{ textAlign: "left" }}>
                      <div className="pst-result">
                        {resultBar(s.st.rdv, 8)}
                        <small>{fmtInt(s.st.rdv.held)} honorés · {fmtInt(s.st.rdv.no_show)} no-show · {fmtInt(s.st.rdv.to_qualify)} à qualifier</small>
                      </div>
                    </td>
                    <td className="pst-clients" style={(s.st.sales.count || 0) > 0 ? { color: "var(--good-strong)" } : { color: "var(--muted)" }}>{fmtInt(s.st.sales.count)}</td>
                    <td>{fmtEuro(s.st.sales.amount)}</td>
                    <td>{fmtRate(conversion(s.st.rdv))}</td>
                    <td className="pst-chev" aria-hidden="true">›</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && idle.length > 0 && (
          <p className="ps2-note">Sans activité sur la période : {idle.map((s) => s.name || "Setter inconnu").join(", ")}</p>
        )}
      </Reveal>

      {/* Clients signés par mois */}
      {data && everActive.length > 0 && (
        <Reveal as="section" className="ps2-card" aria-labelledby="pst-rank-months">
          <Motion.div className="ps2-card-head" variants={ITEM}><h2 id="pst-rank-months">Clients signés par mois</h2></Motion.div>
          <div className="ps2-ctable-wrap" style={{ marginTop: 12 }}>
            <table className="ps2-ctable pst-monthtable" style={{ "--c": "var(--navy)", minWidth: 0 }}>
              <thead>
                <tr>
                  <th>Setter</th>
                  {shownMonths.map((m) => (
                    <th key={m} className={m === period ? "is-on" : undefined}>
                      <button type="button" onClick={() => setPeriod(m)} title={`Voir ${fmtMonth(m).toLowerCase()}`}>{fmtMonthShort(m)}</button>
                    </th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {[...everActive, { id: "__team", name: "Équipe", months: data.team.months, totals: data.team.totals, team: true }].map((s) => (
                  <tr key={s.id} className={s.team ? "is-total" : "pst-row"} onClick={s.team ? undefined : () => openDetail(s.id)}>
                    <td className="pst-name">{s.team ? s.name || "Setter inconnu" : (
                      <button type="button" className="pst-open" onClick={(e) => { e.stopPropagation(); openDetail(s.id); }} aria-label={`Ouvrir la fiche de ${s.name || "Setter inconnu"}`}>{s.name || "Setter inconnu"}</button>
                    )}</td>
                    {shownMonths.map((m) => {
                      const st = s.months?.[m]?.sales || {};
                      return (
                        <td key={m} className={`pst-two${m === period ? " is-on" : ""}${st.count ? "" : " is-nil"}`}>
                          <b>{st.count ? fmtInt(st.count) : "·"}</b>
                          {st.count > 0 && <small>{fmtEuro(st.amount)}</small>}
                        </td>
                      );
                    })}
                    <td className="pst-two">
                      <b>{fmtInt(s.totals.sales.count)}</b>
                      <small>{fmtEuro(s.totals.sales.amount)}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      )}

      {detail && <SetterDetail detail={detail} rdvAll={data?.rdv_all || []} allCalls={callsOf(calls[ALL], detail.id)} tab={tab} setTab={setTab}
        onClose={closeDetail} C={C} darkMode={darkMode} styles={styles} />}
    </div>
  );
}

function SetterDetail({ detail, rdvAll, allCalls, tab, setTab, onClose, C, darkMode, styles }) {
  const { card, label, sub, pill, avatar, resultBar, legend } = styles;
  const clientsByMonth = useMemo(() => groupByMonth(detail.clients, "signed_at"), [detail]);
  const rdvs = useMemo(() => rdvAll.filter((r) => r.setter_id === detail.id), [rdvAll, detail]);
  const rdvByMonth = useMemo(() => groupByMonth(rdvs, "rdv_at"), [rdvs]);
  const t = detail.totals;
  const calls = useProspectCalls(detail.id);                       // appels Allo de ce setter, par prospect de RDV (ajout du 23/10)
  const [openCall, setOpenCall] = useState(null);                  // { entry, rdv } : le prospect dont le panneau d'appels est ouvert (fermé par défaut)
  const callsValue = allCalls.state === "ok" ? fmtInt(allCalls.calls) : allCalls.state === "loading" ? "…" : allCalls.state === "missing" ? "Pas de compte" : "Indisponible";
  const callsDetail = allCalls.state === "ok" ? `${fmtInt(allCalls.answered)} répondus · ${fmtTalk(allCalls.duration)}` : "Allo";
  // Le cadre « Appels Allo vers les prospects » (sous les tuiles) reprend déjà le total d'appels, les répondus et la durée, ou dit pourquoi il n'y en a pas :
  // la tuile « Appels Allo » ne reste que tant qu'il n'est pas affiché (chargement, route absente), pour que ces chiffres ne figurent pas deux fois.
  const overviewShown = calls.state === "ready" && Boolean(overviewOf(calls.data));
  const tiles = [
    ...(overviewShown ? [] : [["Appels Allo", callsValue, callsDetail]]),
    ["RDV posés", fmtInt(t.rdv.total), `${fmtInt(t.rdv.crm)} CRM · ${fmtInt(t.rdv.webinar_link)} lien webinaire`],
    ["Clients signés", fmtInt(t.sales.count), null],
    ["CA des contrats", fmtEuro(t.sales.amount), `${fmtEuro(t.sales.cash)} encaissés`],
    ["Transformation", fmtRate(conversion(t.rdv)), "clients / RDV honorés"],
  ];
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
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(18,27,53,.32)", display: "flex", justifyContent: "flex-end" }}>
      <div role="dialog" aria-label={`Fiche de ${detail.name}`} onClick={(e) => e.stopPropagation()}
        style={{ width: "min(1080px, 100vw)", height: "100%", overflowY: "auto", background: "var(--bg)", boxShadow: "-24px 0 60px rgba(18,27,53,.18)", padding: "24px 28px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {avatar(detail.name, 44)}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>{detail.name}</h2>
            <div style={sub}>{detail.has_webinar_link ? "Setter avec lien webinaire" : "Setter"}{!detail.active ? " · compte désactivé" : ""} · chiffres depuis mai 2026</div>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose}
            style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.text, cursor: "pointer", fontSize: 20, lineHeight: 1, fontFamily: "inherit" }}>×</button>
        </div>

        <div className="pst-dkpis" style={{ display: "grid", gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))`, gap: 10, marginTop: 18 }}>
          {tiles.map(([k, v, d]) => (
            <div key={k} style={{ ...card, padding: "12px 14px" }}>
              <div style={label}>{k}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{v}</div>
              {d && <div style={sub}>{d}</div>}
            </div>
          ))}
        </div>
        <CallsOverview calls={calls} C={C} dark={darkMode} styles={styles} />
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
                        <div key={`${c.numero_client || i}-${c.signed_at}`} className="pst-drow" style={{ ...row, gridTemplateColumns: "78px minmax(0, 2fr) minmax(0, 1.2fr) minmax(0, 1.9fr) 104px minmax(0, 1.3fr)" }}>
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
                      const callsView = rdvCallsView(calls, r.lead_id);
                      return (
                        <div key={`${r.lead_id}-${r.kind}`} className="pst-drow" style={{ ...row, gridTemplateColumns: "172px minmax(0, 2fr) minmax(0, 1.1fr) 120px minmax(0, 1.4fr) minmax(0, 1.2fr)" }}>
                          <div>
                            <div style={{ fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>{fmtRdv(r.rdv_at)}</div>
                            <div style={sub}>{r.kind === "r1" ? "R1" : "R2"} · {CHANNEL_LABELS[r.channel]}</div>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: C.text, ...ellipsis }}>{r.company || r.full_name || "Prospect sans nom"}</div>
                            {r.company && r.full_name && <div style={{ ...sub, ...ellipsis }}>{r.full_name}</div>}
                          </div>
                          <div style={{ minWidth: 0 }}>{pill(ORIGIN_TONES[r.origin] || ORIGIN_TONES.other, ORIGIN_LABELS[r.origin] || r.origin)}</div>
                          <div>{pill(outcomeTone(r.outcome), OUTCOME_LABELS[r.outcome] || r.outcome, OUTCOME_HINTS[r.outcome])}</div>
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
                          <RdvCallsPanel view={callsView} C={C} onOpen={() => setOpenCall({ entry: callsView.entry, rdv: r })} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
        )}
        <CallsPanel target={openCall} setter={detail} dark={darkMode} onClose={() => setOpenCall(null)} />
      </div>
    </div>
  );
}
