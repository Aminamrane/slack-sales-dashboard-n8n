// Page CEO « Setters » (demande dev 05/10/2026, pour Paul) : pour chaque setter, les RDV qu'il a posés, via le CRM
// ou via son lien webinaire personnel (passés et à venir), ce qu'ils sont devenus, et les clients qu'il a amenés,
// au mois de signature. Lecture seule. Calculs côté serveur (app/services/ceo_setters.py), logique d'affichage
// testée dans ./settersStats.js. Données : GET /ceo-dashboard/setters?month=YYYY-MM (admin, CEO).
import { useEffect, useMemo, useState } from "react";
import apiClient from "../../services/apiClient";
import {
  CHANNEL_LABELS, CLIENT_STATE_LABELS, ORIGIN_LABELS, ORIGIN_TONES, OUTCOME_HINTS, OUTCOME_LABELS, OUTCOME_TONES,
  assignedLabel, clientState, conversion, fmtDay, fmtEuro, fmtInt, fmtMonth, fmtMonthShort, fmtRate, fmtRdv,
  neighbourMonth, originEntries, rowsForMonth,
} from "./settersStats.js";

const CLIENT_TONES = { client: "#10b981", already_client: "#94a3b8", signed_not_declared: "#f59e0b" };

export default function SettersStats({ C, darkMode }) {
  const [month, setMonth] = useState(null);           // null : mois en cours (choisi par le serveur)
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [setterId, setSetterId] = useState("");       // filtre des listes détaillées
  const [trend, setTrend] = useState("sales");
  const [detailId, setDetailId] = useState(null);     // setter dont on ouvre la fiche (clients signés)

  useEffect(() => {
    if (!detailId) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setDetailId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    apiClient.get("/api/v1/ceo-dashboard/setters" + (month ? `?month=${month}` : ""))
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch(() => { if (alive) { setError("Impossible de charger les statistiques des setters. Réessayez dans un instant."); setLoading(false); } });
    return () => { alive = false; };
  }, [month]);

  const current = data?.month || month;
  const team = data?.team?.months?.[current] || { rdv: {}, sales: {} };
  const rows = useMemo(() => rowsForMonth(data?.setters, current), [data, current]);
  const names = useMemo(() => Object.fromEntries((data?.setters || []).map((s) => [s.id, s.name])), [data]);
  const rdvList = useMemo(() => (data?.rdv || []).filter((r) => !setterId || r.setter_id === setterId), [data, setterId]);
  const salesList = useMemo(() => (data?.sales || []).filter((s) => !setterId || s.setter_id === setterId), [data, setterId]);
  const detail = useMemo(() => (data?.setters || []).find((s) => s.id === detailId) || null, [data, detailId]);
  const prev = neighbourMonth(data?.months, current, -1);
  const next = neighbourMonth(data?.months, current, 1);

  const card = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: C.shadow };
  const th = { padding: "10px 12px", fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left", whiteSpace: "nowrap" };
  const thNum = { ...th, textAlign: "right", whiteSpace: "normal", lineHeight: 1.35, verticalAlign: "bottom" };
  const td = { padding: "10px 12px", fontSize: 12.5, color: C.text, verticalAlign: "top" };
  const tdNum = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const sub = { fontSize: 11.5, color: C.secondary, marginTop: 2 };
  const h2 = { fontSize: 15, fontWeight: 700, color: C.text, margin: "28px 0 10px", letterSpacing: "-0.01em" };
  const navBtn = (enabled) => ({
    width: 32, height: 32, borderRadius: 9, border: `1px solid ${C.border}`, background: C.bg, color: enabled ? C.text : C.muted,
    cursor: enabled ? "pointer" : "default", fontSize: 16, lineHeight: 1, fontFamily: "inherit", opacity: enabled ? 1 : 0.5,
  });
  const seg = (active) => ({
    padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5,
    fontWeight: 600, background: active ? C.bg : "transparent", color: active ? C.text : C.secondary,
    boxShadow: active ? (darkMode ? "none" : "0 1px 2px rgba(16,24,40,0.08)") : "none",
  });
  const pill = (tone, label, title) => (
    <span title={title} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, color: tone, background: `${tone}1f`, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: tone }} />{label}
    </span>
  );
  const tile = (label, value, detail, tone) => (
    <div key={label} style={{ ...card, padding: "14px 16px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: tone || C.text, fontVariantNumeric: "tabular-nums" }}>{data ? value : "…"}</div>
      {detail && <div style={{ ...sub, marginTop: 4 }}>{data ? detail : ""}</div>}
    </div>
  );

  return (
    <div style={{ padding: "28px 32px 48px", maxWidth: 1480 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ flex: "1 1 520px" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "0 0 6px", letterSpacing: "-0.01em" }}>Setters</h1>
          <p style={{ fontSize: 13, color: C.muted, margin: 0, maxWidth: 860, lineHeight: 1.55 }}>
            Les rendez-vous posés par chaque setter, depuis le CRM ou via son lien webinaire, ce qu'ils sont devenus
            et les clients qu'ils ont amenés. Les RDV comptent au mois du rendez-vous (mois à venir compris), les ventes
            au mois de signature.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" aria-label="Mois précédent" disabled={!prev} onClick={() => prev && setMonth(prev)} style={navBtn(!!prev)}>‹</button>
          <div style={{ minWidth: 150, textAlign: "center", fontSize: 15, fontWeight: 700, color: C.text }}>{current ? fmtMonth(current) : "…"}</div>
          <button type="button" aria-label="Mois suivant" disabled={!next} onClick={() => next && setMonth(next)} style={navBtn(!!next)}>›</button>
        </div>
      </div>

      {error && <div role="alert" style={{ ...card, padding: 18, fontSize: 13.5, color: "#b42318", marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, opacity: loading ? 0.6 : 1, transition: "opacity 0.15s" }}>
        {tile("RDV posés", fmtInt(team.rdv.total), `dont ${fmtInt(team.rdv.webinar_link)} via un lien webinaire`)}
        {tile("Honorés", fmtInt(team.rdv.held), `${fmtInt(team.rdv.no_show)} no-show`, OUTCOME_TONES.held)}
        {tile("À qualifier", fmtInt(team.rdv.to_qualify), "RDV passés sans résultat saisi par le sales", OUTCOME_TONES.to_qualify)}
        {tile("À venir", fmtInt(team.rdv.upcoming), null, OUTCOME_TONES.upcoming)}
        {tile("Ventes signées", fmtInt(team.sales.count), `dont ${fmtInt(team.sales.webinar_link)} via un lien webinaire`, "#10b981")}
        {tile("CA des contrats", fmtEuro(team.sales.amount), `${fmtEuro(team.sales.cash)} encaissés à la signature`)}
      </div>

      <h2 style={h2}>Par setter, {current ? fmtMonth(current).toLowerCase() : ""}</h2>
      <div style={{ ...card, overflow: "hidden", opacity: loading ? 0.6 : 1 }}>
        {!data ? (
          <div style={{ padding: 22, fontSize: 13.5, color: C.muted }}>{error ? "" : "Chargement…"}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                  <th style={th}>Setter</th>
                  <th style={thNum} title="RDV dont la date tombe ce mois-ci (CRM · lien webinaire)">RDV du mois</th>
                  <th style={thNum}>Honorés</th>
                  <th style={thNum}>No-show</th>
                  <th style={thNum} title={OUTCOME_HINTS.to_qualify}>À qualifier</th>
                  <th style={thNum}>À venir</th>
                  <th style={thNum} title="RDV du mois dont la personne a signé (à ce jour)">Devenus clients</th>
                  <th style={thNum} title="Ventes signées ce mois-ci, issues d'un RDV de ce setter">Ventes signées</th>
                  <th style={thNum}>CA des contrats</th>
                  <th style={{ ...thNum, borderLeft: `1px solid ${C.border}` }} title="Depuis mai 2026 : clients amenés, CA, RDV posés et transformation (clients / RDV honorés)">Depuis mai</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const m = s.month;
                  const selected = setterId === s.id;
                  return (
                    <tr key={s.id} onClick={() => setSetterId(selected ? "" : s.id)} title={selected ? "Afficher tous les setters" : "Filtrer les listes sur ce setter"}
                      style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer", background: selected ? C.subtle : "transparent" }}>
                      <td style={td}>
                        <button type="button" title="Voir ses clients signés" onClick={(e) => { e.stopPropagation(); setDetailId(s.id); }}
                          style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, color: C.accent, whiteSpace: "nowrap", textAlign: "left" }}>
                          {s.name || "Setter inconnu"}
                        </button>
                        {s.has_webinar_link && <div style={{ marginTop: 4 }}>{pill(C.accent, "Lien webinaire")}</div>}
                        {!s.active && <div style={sub}>Compte désactivé</div>}
                      </td>
                      <td style={tdNum}>
                        <div>{fmtInt(m.rdv.total)}</div>
                        {(m.rdv.total || 0) > 0 && <div style={sub}>{fmtInt(m.rdv.crm)} CRM · {fmtInt(m.rdv.webinar_link)} lien</div>}
                      </td>
                      <td style={tdNum}>{fmtInt(m.rdv.held)}</td>
                      <td style={tdNum}>{fmtInt(m.rdv.no_show)}</td>
                      <td style={tdNum}>{fmtInt(m.rdv.to_qualify)}</td>
                      <td style={tdNum}>{fmtInt(m.rdv.upcoming)}</td>
                      <td style={tdNum}>{fmtInt(m.rdv.clients)}</td>
                      <td style={{ ...tdNum, fontWeight: 700 }}>{fmtInt(m.sales.count)}</td>
                      <td style={tdNum}>{fmtEuro(m.sales.amount)}</td>
                      <td style={{ ...tdNum, borderLeft: `1px solid ${C.border}` }}>
                        <div><b>{fmtInt(s.totals.sales.count)}</b> client{s.totals.sales.count > 1 ? "s" : ""} · {fmtEuro(s.totals.sales.amount)}</div>
                        <div style={sub}>{fmtInt(s.totals.rdv.total)} RDV · transfo {fmtRate(conversion(s.totals.rdv))}</div>
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ background: C.surface, fontWeight: 700 }}>
                  <td style={{ ...td, fontWeight: 700 }}>Équipe</td>
                  <td style={tdNum}>{fmtInt(team.rdv.total)}</td>
                  <td style={tdNum}>{fmtInt(team.rdv.held)}</td>
                  <td style={tdNum}>{fmtInt(team.rdv.no_show)}</td>
                  <td style={tdNum}>{fmtInt(team.rdv.to_qualify)}</td>
                  <td style={tdNum}>{fmtInt(team.rdv.upcoming)}</td>
                  <td style={tdNum}>{fmtInt(team.rdv.clients)}</td>
                  <td style={tdNum}>{fmtInt(team.sales.count)}</td>
                  <td style={tdNum}>{fmtEuro(team.sales.amount)}</td>
                  <td style={{ ...tdNum, borderLeft: `1px solid ${C.border}` }}>
                    <div>{fmtInt(data.team.totals.sales.count)} clients · {fmtEuro(data.team.totals.sales.amount)}</div>
                    <div style={{ ...sub, fontWeight: 600 }}>{fmtInt(data.team.totals.rdv.total)} RDV · transfo {fmtRate(conversion(data.team.totals.rdv))}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ ...h2, marginRight: "auto" }}>Mois par mois</h2>
        <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 10, background: C.subtle, border: `1px solid ${C.border}`, marginTop: 18 }}>
          {[["sales", "Ventes au mois de signature"], ["rdv", "RDV au mois du rendez-vous"]].map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTrend(key)} style={seg(trend === key)}>{label}</button>
          ))}
        </div>
      </div>
      {data && (
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                  <th style={th}>Setter</th>
                  {data.months.map((m) => (
                    <th key={m} style={{ ...thNum, color: m === current ? C.text : C.muted }}>
                      <button type="button" onClick={() => setMonth(m)} style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", font: "inherit", color: "inherit", textTransform: "inherit", letterSpacing: "inherit" }}>{fmtMonthShort(m)}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...data.setters, { id: "__team", name: "Équipe", months: data.team.months, team: true }].map((s) => (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}`, background: s.team ? C.surface : "transparent" }}>
                    <td style={{ ...td, fontWeight: s.team ? 700 : 600, whiteSpace: "nowrap" }}>{s.name || "Setter inconnu"}</td>
                    {data.months.map((m) => {
                      const cell = s.months?.[m] || { rdv: {}, sales: {} };
                      const value = trend === "sales" ? cell.sales.count : cell.rdv.total;
                      const detail = trend === "sales"
                        ? (cell.sales.count ? fmtEuro(cell.sales.amount) : "")
                        : (cell.rdv.total ? `${fmtInt(cell.rdv.clients)} client${cell.rdv.clients > 1 ? "s" : ""}` : "");
                      return (
                        <td key={m} style={{ ...tdNum, background: m === current ? C.subtle : "transparent", color: value ? C.text : C.muted, fontWeight: s.team ? 700 : 500 }}>
                          <div>{fmtInt(value)}</div>{detail && <div style={sub}>{detail}</div>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 style={h2}>Ventes signées en {current ? fmtMonth(current).toLowerCase() : ""}</h2>
        {setterId && (
          <button type="button" onClick={() => setSetterId("")} style={{ border: "none", background: "transparent", color: C.accent, cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit" }}>
            {names[setterId]} · afficher tous les setters
          </button>
        )}
      </div>
      <div style={{ ...card, overflow: "hidden" }}>
        {!salesList.length ? (
          <div style={{ padding: 20, fontSize: 13, color: C.muted }}>{data ? "Aucune vente issue d'un RDV de setter ce mois-ci." : ""}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                  {["N° client", "Client", "Origine", "Setter", "RDV posé", "Signé le", "Délai"].map((h) => <th key={h} style={th}>{h}</th>)}
                  <th style={thNum}>Contrat</th><th style={thNum}>Cash</th><th style={th}>Vendu par</th>
                </tr>
              </thead>
              <tbody>
                {salesList.map((s, i) => (
                  <tr key={`${s.setter_id}-${s.signed_at}-${i}`} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ ...td, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{s.numero_client || "Sans numéro"}</td>
                    <td style={td}><div style={{ fontWeight: 600 }}>{s.client_name || s.societe || "Client"}</div>{s.shared && <div style={sub}>RDV posés par plusieurs setters</div>}</td>
                    <td style={td}>{pill(ORIGIN_TONES[s.origin] || ORIGIN_TONES.other, ORIGIN_LABELS[s.origin] || s.origin)}{s.origin_label && <div style={sub}>{s.origin_label}</div>}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{s.setter_name}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      <div>{fmtRdv(s.rdv_at)}</div>
                      <div style={sub}>{s.kind === "r1" ? "R1" : "R2"} · {CHANNEL_LABELS[s.channel]}</div>
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDay(s.signed_at)}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtInt(s.days_to_sign)} j</td>
                    <td style={tdNum}>{fmtEuro(s.amount)}</td>
                    <td style={tdNum}>{fmtEuro(s.cash)}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{s.sales_name || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <h2 style={h2}>RDV de {current ? fmtMonth(current).toLowerCase() : ""}</h2>
      <div style={{ ...card, overflow: "hidden" }}>
        {!rdvList.length ? (
          <div style={{ padding: 20, fontSize: 13, color: C.muted }}>{data ? "Aucun RDV de setter ce mois-ci." : ""}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                  {["Prospect", "Setter", "Rendez-vous", "Résultat", "Client", "Affecté à"].map((h) => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rdvList.map((r) => {
                  const state = clientState(r);
                  const waiting = r.assigned?.state !== "assigned";
                  return (
                    <tr key={`${r.setter_id}-${r.lead_id}-${r.kind}`} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={td}><div style={{ fontWeight: 600 }}>{r.full_name || "Prospect sans nom"}</div>{r.company && <div style={sub}>{r.company}</div>}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{r.setter_name}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        <div>{fmtRdv(r.rdv_at)}</div>
                        <div style={sub}>{r.kind === "r1" ? "R1" : "R2"} · {CHANNEL_LABELS[r.channel]}</div>
                      </td>
                      <td style={td}>{pill(OUTCOME_TONES[r.outcome] || OUTCOME_TONES.removed, OUTCOME_LABELS[r.outcome] || r.outcome, OUTCOME_HINTS[r.outcome])}</td>
                      <td style={td}>
                        {state
                          ? <>{pill(CLIENT_TONES[state], CLIENT_STATE_LABELS[state])}{r.client && <div style={sub}>{fmtDay(r.client.signed_at)} · {fmtEuro(r.client.amount)}</div>}</>
                          : <span style={{ color: C.muted }}>Pas encore</span>}
                      </td>
                      <td style={{ ...td, whiteSpace: "nowrap", color: waiting ? C.muted : C.text, fontStyle: waiting ? "italic" : "normal" }}>{assignedLabel(r.assigned)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail && (
        <div onClick={() => setDetailId(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,17,23,0.35)", display: "flex", justifyContent: "flex-end" }}>
          <div role="dialog" aria-label={`Clients de ${detail.name}`} onClick={(e) => e.stopPropagation()}
            style={{ width: "min(980px, 100vw)", height: "100%", overflowY: "auto", background: darkMode ? "#0f1117" : "#f6f7f9", boxShadow: "-12px 0 40px rgba(0,0,0,0.18)", padding: "26px 28px 40px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: "0 0 6px" }}>{detail.name}</h2>
                <div style={{ fontSize: 13, color: C.secondary, lineHeight: 1.6 }}>
                  <b style={{ color: C.text }}>{fmtInt(detail.totals.sales.count)} client{detail.totals.sales.count > 1 ? "s" : ""} signé{detail.totals.sales.count > 1 ? "s" : ""}</b> depuis mai
                  {" · "}{fmtEuro(detail.totals.sales.amount)} de contrats · {fmtEuro(detail.totals.sales.cash)} encaissés à la signature
                  <br />{fmtInt(detail.totals.rdv.total)} RDV posés ({fmtInt(detail.totals.rdv.crm)} CRM, {fmtInt(detail.totals.rdv.webinar_link)} lien webinaire) · transformation {fmtRate(conversion(detail.totals.rdv))}
                </div>
              </div>
              <button type="button" aria-label="Fermer" onClick={() => setDetailId(null)}
                style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.border}`, background: C.bg, color: C.text, cursor: "pointer", fontSize: 18, lineHeight: 1, fontFamily: "inherit" }}>×</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0 18px" }}>
              {originEntries(detail.origins).map(([key, n]) => (
                <span key={key}>{pill(ORIGIN_TONES[key] || ORIGIN_TONES.other, `${ORIGIN_LABELS[key] || key} : ${fmtInt(n)}`)}</span>
              ))}
            </div>
            <div style={{ ...card, overflow: "hidden" }}>
              {!detail.clients?.length ? (
                <div style={{ padding: 20, fontSize: 13, color: C.muted }}>Aucun client signé à la suite de ses RDV depuis mai.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                        {["N° client", "Client", "Origine", "RDV posé", "Signé le"].map((h) => <th key={h} style={th}>{h}</th>)}
                        <th style={thNum}>Contrat</th><th style={th}>Vendu par</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.clients.map((c, i) => (
                        <tr key={`${c.numero_client || i}-${c.signed_at}`} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td style={{ ...td, whiteSpace: "nowrap", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{c.numero_client || "Sans numéro"}</td>
                          <td style={td}><div style={{ fontWeight: 600 }}>{c.client_name || c.societe || "Client"}</div>{c.societe && c.societe !== c.client_name && <div style={sub}>{c.societe}</div>}</td>
                          <td style={td}>{pill(ORIGIN_TONES[c.origin] || ORIGIN_TONES.other, ORIGIN_LABELS[c.origin] || c.origin)}{c.origin_label && <div style={sub}>{c.origin_label}</div>}</td>
                          <td style={{ ...td, whiteSpace: "nowrap" }}><div>{fmtRdv(c.rdv_at)}</div><div style={sub}>{c.kind === "r1" ? "R1" : "R2"} · {CHANNEL_LABELS[c.channel]}</div></td>
                          <td style={{ ...td, whiteSpace: "nowrap" }}><div>{fmtDay(c.signed_at)}</div><div style={sub}>{fmtInt(c.days_to_sign)} j après la pose</div></td>
                          <td style={tdNum}><div>{fmtEuro(c.amount)}</div><div style={sub}>{fmtEuro(c.cash)} cash</div></td>
                          <td style={{ ...td, whiteSpace: "nowrap" }}>{c.sales_name || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <p style={{ fontSize: 12, color: C.muted, margin: "18px 0 0", maxWidth: 980, lineHeight: 1.6 }}>
        Un RDV compte comme devenu client quand la même personne signe une vente déclarée après la pose du RDV
        (retrouvée par la fiche client, le contrat ou l'e-mail, comme dans le Suivi des ventes). Une vente signée avant
        la pose n'est pas comptée. Transformation = clients amenés / RDV honorés. Historique depuis mai 2026.
        {data?.dated_before_since > 0 && ` ${fmtInt(data.dated_before_since)} RDV ont une date de fiche antérieure à mai 2026 (date probablement mal saisie) : comptés dans les totaux, pas dans les mois.`}
      </p>
    </div>
  );
}
