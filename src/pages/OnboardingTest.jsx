// Test de l'onboarding (dev 23/10) : le rendez-vous d'onboarding de la déclaration de vente, sans
// déclaration réelle. Créneaux = ceux proposés au sales, avec qui prendrait chacun (Emilie d'abord,
// Vincent en relais) ; un créneau choisi montre la réservation simulée par le vrai parcours, les
// rappels et leur heure ; « Envoyer le test » envoie l'e-mail et le SMS de prod à l'adresse et au
// numéro saisis. Côté serveur : aucun événement, aucune réservation, aucun envoi compté.
import { useEffect, useState } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
import { makeCharte } from "../styles/charte";

const NAVY = "#121b35";
const GREEN = "#3e7d5a";
const SOFT = "#e9eef6";
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const EASE = [0.16, 1, 0.3, 1];
const HOST_COLOR = { Emilie: GREEN, Vincent: NAVY };

const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// Heures de Paris lues dans la chaîne, jamais converties (convention du CRM).
function parts(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso || "") || [];
  return { y: +m[1], mo: +m[2], d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0) };
}
const weekday = (iso) => { const p = parts(iso); return JOURS[new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay()]; };
const hourFr = (iso) => { const p = parts(iso); return `${p.h} h${p.mi ? ` ${String(p.mi).padStart(2, "0")}` : ""}`; };
const dayFr = (iso) => { const p = parts(iso); return `${weekday(iso)} ${p.d} ${MOIS[p.mo - 1]}`; };
const whenFr = (iso) => `${dayFr(iso)} à ${hourFr(iso)}`;
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const whenShort = (iso) => { const p = parts(iso); return `${weekday(iso)} ${p.d} ${MOIS_COURTS[p.mo - 1]} · ${hourFr(iso)}`; };
function addDays(dateStr, n) {
  const p = parts(dateStr);
  const d = new Date(Date.UTC(p.y, p.mo - 1, p.d + n));
  return d.toISOString().slice(0, 10);
}
const todayParis = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

function HostBadge({ name, size = 18 }) {
  const color = HOST_COLOR[name] || "#6b7482";
  return (
    <span title={name} style={{ width: size, height: size, borderRadius: 6, background: color, color: "#fff", fontSize: size * 0.55,
      fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {(name || "?")[0]}
    </span>
  );
}

export default function OnboardingTest() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => { localStorage.setItem("darkMode", darkMode); document.body.classList.toggle("dark-mode", darkMode); document.documentElement.classList.toggle("dark-mode", darkMode); }, [darkMode]);
  const C = makeCharte(darkMode);
  const card = { background: C.bg, border: "1px solid " + C.border, borderRadius: 14, boxShadow: C.shadow };

  const [start, setStart] = useState(todayParis);
  const [week, setWeek] = useState(null);
  const [weekError, setWeekError] = useState("");
  const [slot, setSlot] = useState(null);           // 'YYYY-MM-DDTHH:MM:00'
  const [forced, setForced] = useState(null);       // e-mail de l'animateur forcé, sinon le parcours choisit
  const [sim, setSim] = useState(null);
  const [simError, setSimError] = useState("");
  const [simBusy, setSimBusy] = useState(false);
  const [email, setEmail] = useState(() => apiClient.getUser()?.email || "");
  const [phone, setPhone] = useState("");
  const [sendBusy, setSendBusy] = useState(false);
  const [sent, setSent] = useState(null);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    let live = true;
    setWeek(null); setWeekError("");
    apiClient.get(`/api/v1/onboarding-test/slots?start=${start}`)
      .then((r) => { if (live) setWeek(r); })
      .catch((e) => { if (live) setWeekError(e?.message || "Agendas injoignables."); });
    return () => { live = false; };
  }, [start]);

  useEffect(() => {
    if (!slot) return;
    let live = true;
    setSimBusy(true); setSimError(""); setSent(null); setSendError("");
    apiClient.post("/api/v1/onboarding-test/simulate", { slot, host: forced })
      .then((r) => { if (live) setSim(r); })
      .catch((e) => { if (live) { setSim(null); setSimError(e?.message || "Simulation impossible."); } })
      .finally(() => { if (live) setSimBusy(false); });
    return () => { live = false; };
  }, [slot, forced]);

  const send = async () => {
    if (sendBusy || !sim || (!email.trim() && !phone.trim())) return;
    setSendBusy(true); setSendError(""); setSent(null);
    try {
      setSent(await apiClient.post("/api/v1/onboarding-test/send",
        { slot, host: sim.host.email, email: email.trim() || null, phone: phone.trim() || null }));
    } catch (e) {
      setSendError(e?.message || "Le test n’a pas pu être envoyé.");
    } finally {
      setSendBusy(false);
    }
  };

  const hosts = week?.hosts || [];
  const input = { flex: "1 1 200px", minWidth: 0, padding: "9px 12px", borderRadius: 9, border: "1px solid " + C.border, background: C.bg, color: C.text, fontSize: 13, fontFamily: "inherit" };
  const label = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: C.muted };
  const okCount = (sent?.results || []).filter((r) => r.sent).length;

  return (
    <div style={{ fontFamily: FONT, minHeight: "100vh", background: C.surface, color: C.text, paddingTop: 80 }}>
      <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <style>{`.ot-slot{transition:transform .15s ease, box-shadow .15s ease, background .15s ease}.ot-slot:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 12px rgba(18,27,53,.10)}.ot-previews{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(260px,1fr);gap:16px;align-items:start}@media (max-width:760px){.ot-previews{grid-template-columns:1fr}}`}</style>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 16px 60px" }}>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 750, letterSpacing: "-0.02em" }}>Test de l’onboarding</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>RDV de la déclaration de vente · rien n’est réservé, seuls vos tests partent</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {hosts.map((h, i) => (
              <div key={h.email} style={{ ...card, padding: "9px 13px", display: "flex", alignItems: "center", gap: 10 }}>
                <HostBadge name={h.name} size={26} />
                <div style={{ lineHeight: 1.35 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{h.name} <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>{i === 0 ? "priorité" : "relais"}</span></div>
                  <div style={{ fontSize: 11.5, color: C.text2 }}>{h.phone || "sans numéro"} · réponses à {h.reply_to}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))", gap: 16, alignItems: "start" }}>
          {/* Créneaux de la semaine : ceux que voit le sales, avec qui prendrait chacun */}
          <div style={{ ...card, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
              <span style={label}>Créneaux · heure de Paris</span>
              <div style={{ display: "flex", gap: 6 }}>
                {[["‹", -7], ["›", 7]].map(([t, n]) => (
                  <button key={t} type="button" onClick={() => { const next = addDays(start, n); setStart(next < todayParis() ? todayParis() : next); }}
                    disabled={n < 0 && start <= todayParis()}
                    style={{ width: 30, height: 28, borderRadius: 8, border: "1px solid " + C.border, background: C.bg, color: C.text2, fontSize: 15, cursor: "pointer", opacity: n < 0 && start <= todayParis() ? 0.4 : 1 }}>{t}</button>
                ))}
              </div>
            </div>
            {weekError && <div role="alert" style={{ fontSize: 12.5, color: "#b42318" }}>{weekError}</div>}
            {!week && !weekError && <div style={{ fontSize: 12.5, color: C.muted, padding: "30px 0", textAlign: "center" }}>Lecture des agendas…</div>}
            {week && !week.days.length && <div style={{ fontSize: 12.5, color: C.muted, padding: "30px 0", textAlign: "center" }}>Aucun créneau libre cette semaine.</div>}
            {week && week.days.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${week.days.length}, minmax(0, 1fr))`, gap: 6, overflowX: "auto" }}>
                {week.days.map((d) => (
                  <div key={d.date} style={{ minWidth: 64 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text2, textAlign: "center", marginBottom: 6 }}>{weekday(d.date)} {parts(d.date).d}</div>
                    <div style={{ display: "grid", gap: 4 }}>
                      {d.slots.filter((s) => s.free).map((s) => {
                        const iso = `${d.date}T${s.t}:00`;
                        const on = iso === slot;
                        return (
                          <button key={s.t} type="button" className="ot-slot" onClick={() => { setForced(null); setSlot(iso); }}
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "6px 4px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                              border: "1px solid " + (on ? NAVY : C.border), background: on ? NAVY : C.bg, color: on ? "#fff" : C.text, fontSize: 12, fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>
                            {s.t}<HostBadge name={s.host} size={14} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 11.5, color: C.muted }}>
              {hosts.map((h) => <span key={h.email} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><HostBadge name={h.name} size={13} />{h.name}</span>)}
            </div>
          </div>

          {/* Réservation simulée, rappels, aperçus et envoi de test */}
          <div style={{ display: "grid", gap: 16 }}>
            {!slot && <div style={{ ...card, padding: "40px 16px", textAlign: "center", color: C.muted, fontSize: 13 }}>Choisissez un créneau.</div>}
            {simError && <div role="alert" style={{ ...card, padding: 14, color: "#b42318", fontSize: 13 }}>{simError}</div>}
            <AnimatePresence mode="wait">
              {sim && (
                <Motion.div key={sim.slot + sim.host.email} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.35, ease: EASE }} style={{ display: "grid", gap: 16, opacity: simBusy ? 0.6 : 1 }}>
                  <div style={{ ...card, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <HostBadge name={sim.host.name} size={30} />
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 750 }}>{sim.host.name} · {whenFr(sim.slot)}</div>
                          <div style={{ fontSize: 12, color: C.muted }}>{sim.chosen_by === "parcours" ? "choisi par le parcours" : "version forcée pour l’aperçu"}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", padding: 3, borderRadius: 10, background: darkMode ? "rgba(255,255,255,0.05)" : SOFT }}>
                        {[[null, "Parcours"], ...hosts.map((h) => [h.email, h.name])].map(([value, text]) => {
                          const on = forced === value;
                          return (
                            <button key={text} type="button" onClick={() => setForced(value)}
                              style={{ padding: "5px 11px", borderRadius: 8, border: "none", background: on ? C.bg : "transparent", color: on ? C.text : C.text2, fontSize: 12, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", boxShadow: on ? "0 1px 3px rgba(18,27,53,.12)" : "none" }}>{text}</button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 0, marginTop: 14 }}>
                      {[
                        ...sim.reminders.filter((r) => r.kind !== "t30").map((r) => ({ at: r.due_at, text: r.label, sub: r.due_at ? null : "ne partirait pas" })),
                        { at: sim.reminders.find((r) => r.kind === "t30")?.due_at, text: sim.reminders.find((r) => r.kind === "t30")?.label },
                        { at: sim.events[0].start, text: `Onboarding chez ${sim.host.name}, client invité, Google Meet`, sub: `jusqu’à ${hourFr(sim.events[0].end)} · ${sim.events[0].calendar}` },
                        { at: sim.events[1].start, text: "La facturation rejoint", sub: `jusqu’à ${hourFr(sim.events[1].end)} · ${sim.events[1].calendar}` },
                      ].sort((a, b) => String(a.at || "9").localeCompare(String(b.at || "9"))).map((step, i, all) => (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "132px 14px 1fr", gap: 10, alignItems: "start" }}>
                          <div style={{ fontSize: 12, color: C.text2, fontVariantNumeric: "tabular-nums", textAlign: "right", paddingTop: 1, whiteSpace: "nowrap" }}>{step.at ? whenShort(step.at) : "—"}</div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}>
                            <span style={{ width: 9, height: 9, borderRadius: "50%", background: step.at ? GREEN : C.border, marginTop: 4 }} />
                            {i < all.length - 1 && <span style={{ flex: 1, width: 1.5, background: C.border, minHeight: 22 }} />}
                          </div>
                          <div style={{ paddingBottom: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{step.text}</div>
                            {step.sub && <div style={{ fontSize: 11.5, color: C.muted }}>{step.sub}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, color: C.text2, background: darkMode ? "rgba(255,255,255,0.04)" : SOFT, borderRadius: 9, padding: "8px 11px" }}>
                      Invitation du client : « {sim.events[0].client_description} »
                    </div>
                  </div>

                </Motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        {sim && (
          <Motion.div key={"bas" + sim.slot + sim.host.email} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE, delay: 0.05 }} style={{ display: "grid", gap: 16, marginTop: 16, opacity: simBusy ? 0.6 : 1 }}>
            <div style={{ ...card, padding: "14px 16px" }}>
              <div style={{ ...label, marginBottom: 8 }}>Envoyer le test</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input style={input} type="email" placeholder="adresse@email.fr" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email de test" />
                <input style={input} type="tel" placeholder="Mobile pour le SMS (facultatif)" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Mobile de test" />
                <button type="button" onClick={send} disabled={sendBusy || (!email.trim() && !phone.trim())}
                  style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: sendBusy ? C.border : NAVY, color: sendBusy ? C.muted : "#fff", fontSize: 13, fontWeight: 700, cursor: sendBusy ? "default" : "pointer", fontFamily: "inherit" }}>
                  {sendBusy ? "Envoi…" : "Envoyer le test"}
                </button>
              </div>
              {sendError && <div role="alert" style={{ marginTop: 10, fontSize: 12.5, color: "#b42318" }}>{sendError}</div>}
              {sent && (
                <Motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: EASE }} style={{ marginTop: 10, display: "grid", gap: 3 }}>
                  <div role="status" style={{ fontSize: 12.5, fontWeight: 700, color: okCount === sent.results.length ? GREEN : "#b45309" }}>
                    {okCount}/{sent.results.length} envoyé{okCount > 1 ? "s" : ""} au nom de {sent.host.name}
                  </div>
                  {sent.results.map((r) => (
                    <div key={r.step} style={{ display: "flex", gap: 8, fontSize: 12, color: C.text2 }}>
                      <span style={{ color: r.sent ? GREEN : "#b42318", fontWeight: 800, width: 14 }}>{r.sent ? "✓" : "✕"}</span>
                      <span>{r.subject} · {r.to}</span>
                    </div>
                  ))}
                </Motion.div>
              )}
            </div>
            <div className="ot-previews">
              <div style={{ ...card, overflow: "hidden" }}>
                <div style={{ padding: "11px 14px", borderBottom: "1px solid " + C.border }}>
                  <div style={label}>E-mail deux jours avant</div>
                  <div style={{ fontSize: 13, fontWeight: 650, marginTop: 3 }}>{sim.messages.subject}</div>
                  <div style={{ fontSize: 11.5, color: C.muted }}>Réponses à {sim.host.reply_to}</div>
                </div>
                <iframe title="Aperçu de l’e-mail" sandbox="allow-same-origin" srcDoc={sim.messages.html}
                  onLoad={(e) => { const doc = e.currentTarget.contentDocument; if (doc?.body) e.currentTarget.style.height = `${doc.documentElement.scrollHeight + 8}px`; }}
                  style={{ width: "100%", height: 320, border: "none", background: "#fff", display: "block" }} />
              </div>
              <div style={{ ...card, padding: "11px 14px" }}>
                <div style={label}>SMS deux heures avant · OWNER</div>
                <div style={{ marginTop: 10, background: darkMode ? "#262a32" : "#eef0f3", borderRadius: "16px 16px 16px 4px", padding: "10px 13px", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {sim.messages.sms}
                </div>
              </div>
            </div>
          </Motion.div>
        )}
      </div>
    </div>
  );
}
