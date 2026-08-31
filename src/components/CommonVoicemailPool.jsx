// src/components/CommonVoicemailPool.jsx
//
// « Barrage répondeur commun » — les DEUX pools du chantier réactivité :
//   · Pool RÉACTIVITÉ : leads chauds jamais appelés (SLA raté). Premier arrivé,
//     premier servi : « Je le prends » suffit, puis 3 jours pour poser un RDV.
//   · Pool TRAITEMENT : leads à J+3 sans RDV + ancien pool 2 mois. VERROUILLÉ :
//     récupérable uniquement en positionnant un R1 (le barrage anti « je prends
//     d'abord, j'appelle après »). Compteur d'appels PARTAGÉ + date du dernier
//     appel pour éviter le gérant harcelé.
// Auto-alimenté via GET /tracking/pools (les props legacy leads/claimingId/
// onClaim sont acceptées mais ignorées : TrackingSheet reste intact).

import { useEffect, useMemo, useState } from "react";
import apiClient from "../services/apiClient";

const ORIGIN_TONE = { bg: "rgba(100,116,139,0.12)", text: "#64748b" };

const fmtAge = (iso) => {
  if (!iso) return null;
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 60) return `il y a ${d} j`;
  return `il y a ${Math.floor(d / 30)} mois`;
};
// Valeurs slugifiées selon le canal (« 3_-_5 », « entre_100_000_€… ») -> lisible.
const clean = (v) => (v ? String(v).replace(/_/g, " ").replace(/\s+/g, " ").trim() : null);
const fmtDate = (v) => { const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : null; };

// Ligne d'infos qualifiantes (mêmes données que le lead détail).
function InfoLine({ lead, C }) {
  const bits = [
    lead.email || null,
    clean(lead.headcount || lead.employee_range) ? `${clean(lead.headcount || lead.employee_range)} salariés` : null,
    clean(lead.revenue) ? `CA ${clean(lead.revenue)}` : null,
    clean(lead.sector) || null,
    lead.siren ? `SIREN ${lead.siren}` : null,
    fmtDate(lead.created_at) ? `entré le ${fmtDate(lead.created_at)}` : null,
  ].filter(Boolean);
  if (!bits.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", marginTop: 6, paddingLeft: 18, fontSize: 11.5, color: C.muted }}>
      {bits.map((b, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          {i > 0 && <span style={{ opacity: 0.4 }}>·</span>}{b}
        </span>
      ))}
    </div>
  );
}

// Compteur d'appels PARTAGÉ du pool (« appelé 5 fois, la dernière il y a 2 h »).
function PoolCallsBadge({ lead, C, darkMode }) {
  const n = lead.pool_calls || 0;
  if (!n) return <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>jamais appelé depuis le pool</span>;
  const hot = n >= 6;
  return (
    <span title="Appels passés par l'équipe depuis le pool" style={{
      fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", padding: "2px 9px", borderRadius: 20,
      color: hot ? "#b42318" : "#b45309",
      background: hot ? (darkMode ? "rgba(180,35,24,0.16)" : "#fdecea") : (darkMode ? "rgba(180,83,9,0.16)" : "#fff3e3"),
    }}>
      {n} appel{n > 1 ? "s" : ""} pool{lead.pool_last_call_at ? ` · ${fmtAge(lead.pool_last_call_at)}` : ""}
    </span>
  );
}

export default function CommonVoicemailPool({ leads = [], loading = false, claimingId = null, onClaim, canClaim = true, C, darkMode }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);      // claim en cours
  const [calledFlash, setCalledFlash] = useState({}); // feedback bouton « j'ai appelé »
  const [rdvFor, setRdvFor] = useState(null);      // lead_id du mini-formulaire RDV ouvert
  const [rdvDate, setRdvDate] = useState("");
  const [claimedMsg, setClaimedMsg] = useState(null);
  const [q, setQ] = useState("");
  // Un seul pool affiché à la fois : le sales choisit son mode de travail.
  const [pool, setPool] = useState("traitement");
  // Rendu progressif : tout est chargé, on affiche par tranches au scroll.
  const [shownCount, setShownCount] = useState(150);
  useEffect(() => { setShownCount(150); }, [pool, q]);
  useEffect(() => {
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 900) {
        setShownCount((n) => n + 150);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const fetchPools = async (search) => {
    try {
      const term = (search !== undefined ? search : q).trim();
      const d = await apiClient.get(`/api/v1/tracking/pools${term ? `?q=${encodeURIComponent(term)}` : ""}`);
      if (d && d.reactivite) { setData(d); setErr(null); }
    } catch (e) { setErr("Impossible de charger les pools."); }
  };
  useEffect(() => {
    fetchPools("");
    const t = setInterval(() => fetchPools(), 60000);
    return () => clearInterval(t);
  }, []);
  // La recherche interroge la base (un lead hors des premiers chargés doit
  // rester trouvable), avec un délai pour ne pas requêter à chaque frappe.
  useEffect(() => {
    const t = setTimeout(() => fetchPools(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const reaAll = data?.reactivite || [];
  const trtAll = data?.traitement || [];
  const rea = reaAll.slice(0, shownCount);
  const trt = trtAll.slice(0, shownCount);
  // Compteurs = totaux RÉELS du pool, pas le nombre de leads chargés.
  const totRea = data?.totals?.reactivite ?? reaAll.length;
  const totTrt = data?.totals?.traitement ?? trtAll.length;
  const searching = q.trim().length > 0;

  const claimRea = async (id) => {
    setBusyId(id);
    try {
      await apiClient.post(`/api/v1/tracking/pools/reactivite/${id}/claim`);
      setClaimedMsg("Lead récupéré — appelez-le maintenant, il est dans vos leads (3 jours pour poser un RDV).");
      fetchPools();
    } catch (e) {
      setClaimedMsg(e?.message?.includes("409") || e?.status === 409 ? "Trop tard — quelqu'un vient de le prendre." : "Récupération impossible.");
      fetchPools();
    } finally { setBusyId(null); setTimeout(() => setClaimedMsg(null), 5000); }
  };

  const claimTrt = async (id) => {
    if (!rdvDate) return;
    setBusyId(id);
    try {
      await apiClient.post(`/api/v1/tracking/pools/traitement/${id}/claim`, { r1_date: rdvDate });
      setClaimedMsg("Lead récupéré avec son RDV — il est dans vos R1 placés.");
      setRdvFor(null); setRdvDate("");
      fetchPools();
    } catch (e) {
      const detail = e?.detail || e?.message || "";
      setClaimedMsg(String(detail).includes("futur") ? "Le RDV doit être dans le futur." : "Trop tard — quelqu'un vient de le prendre.");
      fetchPools();
    } finally { setBusyId(null); setTimeout(() => setClaimedMsg(null), 5000); }
  };

  // Le prospect a demandé à ne plus être contacté : on le sort du pool et on
  // l'archive, pour qu'aucun autre sales ne le rappelle après son refus.
  const optOut = async (id, name) => {
    if (!window.confirm(`Retirer ${name || "ce lead"} du pool commun ?\n\nÀ utiliser quand la personne a dit qu'elle ne souhaite pas être rappelée : le lead est archivé et personne ne le rappellera.`)) return;
    setBusyId(id);
    try {
      await apiClient.post(`/api/v1/tracking/pools/${id}/opt-out`);
      setClaimedMsg("Lead retiré du pool et archivé — il ne sera plus rappelé.");
      fetchPools();
    } catch {
      setClaimedMsg("Retrait impossible — le lead n'est peut-être plus dans le pool.");
      fetchPools();
    } finally { setBusyId(null); setTimeout(() => setClaimedMsg(null), 5000); }
  };

  const markCalled = async (id) => {
    try {
      const r = await apiClient.post(`/api/v1/tracking/pools/${id}/called`);
      setCalledFlash((p) => ({ ...p, [id]: true }));
      setTimeout(() => setCalledFlash((p) => ({ ...p, [id]: false })), 1800);
      setData((d) => !d ? d : {
        ...d,
        traitement: d.traitement.map((l) => l.id === id ? { ...l, pool_calls: r.pool_calls, pool_last_call_at: r.pool_last_call_at } : l),
        reactivite: d.reactivite.map((l) => l.id === id ? { ...l, pool_calls: r.pool_calls, pool_last_call_at: r.pool_last_call_at } : l),
      });
    } catch {}
  };

  const card = (extra = {}) => ({
    borderRadius: 14, border: `1px solid ${C.border}`,
    background: darkMode ? "rgba(255,255,255,0.03)" : "#fff", ...extra,
  });

  if (!data && !err) {
    return <div style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>Chargement des pools…</div>;
  }
  if (err) {
    return <div style={{ padding: 32, textAlign: "center", color: "#b42318", fontSize: 13 }}>{err}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {claimedMsg && (
        <div style={{ padding: "10px 16px", borderRadius: 10, background: darkMode ? "rgba(62,125,90,0.18)" : "#e7f0eb", color: "#3e7d5a", fontSize: 12.5, fontWeight: 650 }}>
          {claimedMsg}
        </div>
      )}
      {/* Switch entre les deux pools */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 12, background: darkMode ? "rgba(255,255,255,0.05)" : "#f1f3f7" }}>
          {[
            { key: "reactivite", label: "Réactivité", n: totRea, color: "#ef4444" },
            { key: "traitement", label: "Traitement", n: totTrt, color: "#0891b2" },
          ].map((p) => {
            const on = pool === p.key;
            return (
              <button key={p.key} type="button" onClick={() => setPool(p.key)}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit",
                  fontSize: 13, fontWeight: 700, transition: "background 0.15s, color 0.15s",
                  background: on ? (darkMode ? "rgba(255,255,255,0.10)" : "#fff") : "transparent",
                  color: on ? C.text : C.muted,
                  boxShadow: on ? "0 1px 3px rgba(17,24,39,0.10)" : "none" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: on ? p.color : C.muted, opacity: on ? 1 : 0.5 }} />
                {p.label}
                <span style={{ fontSize: 11.5, fontWeight: 700, color: on ? p.color : C.muted }}>{p.n}</span>
              </button>
            );
          })}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (nom, société, téléphone)…"
          style={{ flex: 1, minWidth: 240, maxWidth: 420, padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: darkMode ? "rgba(255,255,255,0.04)" : "#fff", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
      </div>

      {(() => {
        const all = pool === "reactivite" ? reaAll.length : trtAll.length;
        const shown = Math.min(shownCount, all);
        const total = pool === "reactivite" ? totRea : totTrt;
        if (searching) return (
          <div style={{ fontSize: 11.5, color: C.muted }}>{all} résultat{all > 1 ? "s" : ""} sur les {total} leads du pool.</div>
        );
        if (shown < all) return (
          <div style={{ fontSize: 11.5, color: C.muted }}>
            {total} leads dans le pool, du plus récent au plus ancien — {shown} affichés, faites défiler pour la suite.
          </div>
        );
        return <div style={{ fontSize: 11.5, color: C.muted }}>{total} leads dans le pool, du plus récent au plus ancien.</div>;
      })()}

      {/* ── POOL RÉACTIVITÉ ── */}
      <div style={{ display: pool === "reactivite" ? "block" : "none" }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
          Leads chauds jamais appelés. Premier arrivé, premier servi : « Je le prends », vous l'appelez tout de suite, il est à vous 3 jours pour poser un RDV.
        </div>
        {rea.length === 0 ? (
          <div style={{ ...card({ padding: "14px 16px" }), color: C.muted, fontSize: 12.5 }}>
            Aucun lead en attente de premier appel — c'est bon signe.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rea.map((lead) => (
              <div key={lead.id} style={card({ padding: "11px 16px", borderColor: darkMode ? "rgba(239,68,68,0.4)" : "#f3c1bd" })}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 650, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {lead.full_name || lead.company_name || "Sans nom"}
                  </span>
                  {lead.origin && <span style={{ padding: "2px 8px", borderRadius: 50, fontSize: 10, fontWeight: 600, background: ORIGIN_TONE.bg, color: ORIGIN_TONE.text, flexShrink: 0 }}>{lead.origin}</span>}
                  {lead.phone && <span style={{ fontSize: 12.5, fontWeight: 650, color: C.text, whiteSpace: "nowrap" }}>{lead.phone}</span>}
                  <div style={{ flex: 1 }} />
                  {lead.pool_entered_at && (
                    <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700, whiteSpace: "nowrap" }}>arrivé {fmtAge(lead.pool_entered_at)}</span>
                  )}
                  {canClaim && (
                    <button onClick={() => claimRea(lead.id)} disabled={busyId === lead.id}
                      style={{ flexShrink: 0, padding: "7px 16px", borderRadius: 9, border: "none", background: busyId === lead.id ? C.muted : "#3e7d5a", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: busyId === lead.id ? "wait" : "pointer", fontFamily: "inherit" }}>
                      {busyId === lead.id ? "…" : "📞 Je le prends"}
                    </button>
                  )}
                </div>
                {canClaim && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                    <button onClick={() => optOut(lead.id, lead.full_name)} disabled={busyId === lead.id}
                      title="Retire le lead du pool et l'archive : plus personne ne le rappellera"
                      style={{ padding: "5px 11px", borderRadius: 8, border: "none", background: "transparent", color: C.muted, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}>
                      Ne souhaite pas être rappelé
                    </button>
                  </div>
                )}
                <InfoLine lead={lead} C={C} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── POOL TRAITEMENT ── */}
      <div style={{ display: pool === "traitement" ? "block" : "none" }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
          Récupérable <b>uniquement en positionnant un R1</b>. Passez un max d'appels (« J'ai appelé » alimente le compteur partagé), et dès que vous avez le gérant : posez le RDV, le lead est à vous.
        </div>
        {trt.length === 0 ? (
          <div style={{ ...card({ padding: "14px 16px" }), color: C.muted, fontSize: 12.5 }}>Pool vide.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {trt.map((lead) => (
              <div key={lead.id} style={card({ padding: "11px 16px" })}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#64748b", flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 60, flexShrink: 1 }}>
                    {lead.full_name || lead.company_name || "Sans nom"}
                  </span>
                  {lead.origin && <span style={{ padding: "2px 8px", borderRadius: 50, fontSize: 10, fontWeight: 600, background: ORIGIN_TONE.bg, color: ORIGIN_TONE.text, flexShrink: 0 }}>{lead.origin}</span>}
                  {(lead.company_name && lead.full_name) && (
                    <span style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 1, minWidth: 0 }}>{lead.company_name}</span>
                  )}
                  {lead.phone && <span style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap", flexShrink: 0 }}>{lead.phone}</span>}
                  <div style={{ flex: 1 }} />
                  <PoolCallsBadge lead={lead} C={C} darkMode={darkMode} />
                  {canClaim && (
                    <>
                      <button onClick={() => markCalled(lead.id)}
                        style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 9, border: `1px solid ${C.border}`, background: calledFlash[lead.id] ? "#3e7d5a" : "transparent", color: calledFlash[lead.id] ? "#fff" : C.text, fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", transition: "background 0.2s, color 0.2s" }}>
                        {calledFlash[lead.id] ? "Noté ✓" : "J'ai appelé"}
                      </button>
                      <button onClick={() => { setRdvFor(rdvFor === lead.id ? null : lead.id); setRdvDate(""); }}
                        style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 9, border: "none", background: "#0891b2", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        Prendre avec un RDV
                      </button>
                    </>
                  )}
                </div>
                {canClaim && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                    <button onClick={() => optOut(lead.id, lead.full_name)} disabled={busyId === lead.id}
                      title="Retire le lead du pool et l'archive : plus personne ne le rappellera"
                      style={{ padding: "5px 11px", borderRadius: 8, border: "none", background: "transparent", color: C.muted, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}>
                      Ne souhaite pas être rappelé
                    </button>
                  </div>
                )}
                {rdvFor === lead.id && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, paddingLeft: 18 }}>
                    <span style={{ fontSize: 12, color: C.muted }}>R1 le</span>
                    <input type="datetime-local" value={rdvDate} onChange={(e) => setRdvDate(e.target.value)}
                      style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: darkMode ? "rgba(255,255,255,0.04)" : "#fff", color: C.text, fontSize: 12.5, fontFamily: "inherit" }} />
                    <button onClick={() => claimTrt(lead.id)} disabled={!rdvDate || busyId === lead.id}
                      style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: !rdvDate ? C.muted : "#3e7d5a", color: "#fff", fontSize: 12, fontWeight: 700, cursor: !rdvDate ? "default" : "pointer", fontFamily: "inherit" }}>
                      {busyId === lead.id ? "…" : "Confirmer le RDV et récupérer"}
                    </button>
                  </div>
                )}
                <InfoLine lead={lead} C={C} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
