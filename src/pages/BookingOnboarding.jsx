import { useEffect, useMemo, useState } from "react";

// Page de réservation dédiée : placer un rendez-vous d'onboarding plateforme
// (30 min) dans l'agenda de Vincent. Accès par lien secret, sans compte : le
// jeton vit dans l'URL et n'est jamais embarqué dans le bundle.
const API = import.meta.env.VITE_API_URL || "https://api.ownertechnology.com";

const NAVY = "#121b35";
const GREEN = "#3e7d5a";
const SOFT = "#e9eef6";
const MUTED = "#6b7482";

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// Les créneaux arrivent en heure de Paris : on lit la chaîne, on ne convertit
// jamais, sinon un fuseau différent décale l'affichage.
function parts(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso) || [];
  return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5] };
}
function heure(iso) {
  const p = parts(iso);
  return `${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`;
}
function jourLong(dateStr) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const j = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return `${JOURS[j]} ${d} ${MOIS[mo - 1]}`;
}

export default function BookingOnboarding() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get("k") || "", []);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dayIdx, setDayIdx] = useState(0);
  const [slot, setSlot] = useState(null);
  const [form, setForm] = useState({ guest_name: "", guest_email: "", company: "", note: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/v1/booking/onboarding/slots?k=${encodeURIComponent(token)}`);
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.detail || "Chargement impossible.");
      setData(d);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) { setError("Lien incomplet."); setLoading(false); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const book = async () => {
    if (sending) return;
    setSending(true);
    try {
      const r = await fetch(`${API}/api/v1/booking/onboarding/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ k: token, start: slot, ...form }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.detail || "La réservation a échoué.");
      setDone(d);
    } catch (e) {
      setError(e.message);
      setSlot(null);
      load();
    } finally {
      setSending(false);
    }
  };

  const wrap = {
    minHeight: "100vh", background: SOFT, padding: "40px 20px",
    fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    color: NAVY, display: "flex", justifyContent: "center", alignItems: "flex-start",
  };
  const card = {
    background: "#fff", borderRadius: 20, width: "100%", maxWidth: 720,
    boxShadow: "0 18px 50px rgba(18,27,53,0.10)", overflow: "hidden",
  };
  const pad = { padding: "28px 30px" };
  const input = {
    width: "100%", padding: "11px 13px", borderRadius: 11, border: "1px solid #dfe4ee",
    fontSize: 14, fontFamily: "inherit", color: NAVY, outline: "none", background: "#fff",
    boxSizing: "border-box",
  };
  const label = { display: "block", fontSize: 12.5, fontWeight: 600, color: MUTED, marginBottom: 6 };

  if (loading) {
    return <div style={wrap}><div style={{ ...card, ...pad, textAlign: "center", color: MUTED }}>Chargement des disponibilités…</div></div>;
  }

  if (done) {
    const p = parts(done.start);
    return (
      <div style={wrap}>
        <div style={card}>
          <div style={{ ...pad, textAlign: "center" }}>
            <div style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(62,125,90,0.12)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <div style={{ fontSize: 21, fontWeight: 750, marginBottom: 8 }}>Rendez-vous confirmé</div>
            <div style={{ fontSize: 15, color: MUTED, lineHeight: 1.6 }}>
              {jourLong(`${p.y}-${String(p.mo).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`)} à {heure(done.start)},
              avec {done.host_name}.<br />
              L'invitation vient de partir à <strong style={{ color: NAVY }}>{done.guest_email}</strong>.
            </div>
            {done.meet_link && (
              <a href={done.meet_link} target="_blank" rel="noreferrer"
                style={{ display: "inline-block", marginTop: 18, padding: "11px 20px", borderRadius: 12, background: GREEN, color: "#fff", fontSize: 14, fontWeight: 650, textDecoration: "none" }}>
                Ouvrir le lien Meet
              </a>
            )}
            <div style={{ marginTop: 22 }}>
              <button onClick={() => { setDone(null); setSlot(null); setForm({ guest_name: "", guest_email: "", company: "", note: "" }); load(); }}
                style={{ background: "none", border: "none", color: MUTED, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                Placer un autre rendez-vous
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return <div style={wrap}><div style={{ ...card, ...pad, textAlign: "center" }}>
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Ce lien ne fonctionne pas</div>
      <div style={{ fontSize: 14, color: MUTED }}>{error}</div>
    </div></div>;
  }

  const days = data?.days || [];
  const day = days[dayIdx];

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ background: NAVY, color: "#fff", padding: "26px 30px" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.09em", textTransform: "uppercase", opacity: 0.65, marginBottom: 7 }}>
            Owner Technology
          </div>
          <div style={{ fontSize: 22, fontWeight: 750, marginBottom: 5 }}>Onboarding plateforme</div>
          <div style={{ fontSize: 14, opacity: 0.75 }}>
            {data?.duration_minutes} minutes avec {data?.host_name}, heure de Paris.
          </div>
        </div>

        {error && (
          <div style={{ padding: "12px 30px", background: "#fdecea", color: "#b42318", fontSize: 13.5 }}>{error}</div>
        )}

        {days.length === 0 ? (
          <div style={{ ...pad, textAlign: "center", color: MUTED }}>
            Aucun créneau libre dans les trois prochaines semaines.
          </div>
        ) : !slot ? (
          <div style={pad}>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 4 }}>
              {days.map((d, i) => (
                <button key={d.date} onClick={() => setDayIdx(i)}
                  style={{
                    flexShrink: 0, padding: "9px 14px", borderRadius: 11, cursor: "pointer",
                    fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                    border: `1px solid ${i === dayIdx ? NAVY : "#dfe4ee"}`,
                    background: i === dayIdx ? NAVY : "#fff",
                    color: i === dayIdx ? "#fff" : NAVY,
                    transition: "background 0.15s, border-color 0.15s",
                  }}>
                  {jourLong(d.date)}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 12 }}>
              {day.slots.length} créneau{day.slots.length > 1 ? "x" : ""} libre{day.slots.length > 1 ? "s" : ""}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 9 }}>
              {day.slots.map((s) => (
                <button key={s} onClick={() => { setError(null); setSlot(s); }}
                  style={{
                    padding: "11px 0", borderRadius: 11, border: "1px solid #dfe4ee", background: "#fff",
                    color: NAVY, fontSize: 14, fontWeight: 650, cursor: "pointer", fontFamily: "inherit",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = GREEN; e.currentTarget.style.background = "rgba(62,125,90,0.06)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#dfe4ee"; e.currentTarget.style.background = "#fff"; }}>
                  {heure(s)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={pad}>
            <button onClick={() => setSlot(null)}
              style={{ background: "none", border: "none", color: MUTED, fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: 14 }}>
              ← Changer de créneau
            </button>
            <div style={{ background: SOFT, borderRadius: 13, padding: "13px 16px", marginBottom: 20, fontSize: 14.5, fontWeight: 650 }}>
              {jourLong(slot.slice(0, 10))} à {heure(slot)}
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={label}>E-mail du client (il recevra l'invitation)</label>
                <input style={input} type="email" value={form.guest_email} placeholder="client@societe.fr"
                  onChange={(e) => setForm({ ...form, guest_email: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={label}>Nom du client</label>
                  <input style={input} value={form.guest_name}
                    onChange={(e) => setForm({ ...form, guest_name: e.target.value })} />
                </div>
                <div>
                  <label style={label}>Société</label>
                  <input style={input} value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={label}>Note pour Vincent (facultatif)</label>
                <input style={input} value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
            </div>

            <button onClick={book} disabled={sending || !form.guest_email.trim()}
              style={{
                marginTop: 22, width: "100%", padding: "13px 0", borderRadius: 13, border: "none",
                background: (sending || !form.guest_email.trim()) ? "#9db8aa" : GREEN, color: "#fff",
                fontSize: 15, fontWeight: 700, fontFamily: "inherit",
                cursor: (sending || !form.guest_email.trim()) ? "default" : "pointer",
                transition: "background 0.15s",
              }}>
              {sending ? "Réservation en cours…" : "Confirmer le rendez-vous"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
