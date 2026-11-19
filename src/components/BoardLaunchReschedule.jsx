// Reprogrammer un rendez-vous de lancement (fiscal / social) depuis le board (dev 19/11/2026).
// Les CSM ne faisaient plus confiance à la reprogrammation : créneaux affichés puis refusés, juriste inconnu, aucune idée
// de ce qui allait se passer. La fenêtre montre désormais le rendez-vous actuel et son juriste, la semaine complète de CE
// juriste (chaque jour fermé dit pourquoi), puis « avant → après » et ce qui arrive au client avant de confirmer.
// Tout ce qui est libre ici est accepté par la réservation (même moteur côté serveur).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CalendarClock, ChevronLeft, ChevronRight, Video, X } from "lucide-react";
import apiClient from "../services/apiClient";
import AppointmentConfirmation from "./booking/AppointmentConfirmation";
import { appointmentConfirmation, appointmentFailure } from "../utils/appointmentConfirmation";
import "./BoardLaunchReschedule.css";

const LABEL = { fiscal: "fiscal", social: "social" };
const CLOSED = { notice: "Moins de 5 jours", full: "Journée complète", busy: "Aucun créneau libre" };
// Mouvements : entrée en ressort dosé, sortie sèche, jamais d'opacité pendant un déplacement.
const ENTER = { type: "spring", stiffness: 420, damping: 32, mass: 0.9 };
const EXIT = { duration: 0.15, ease: [0.4, 0, 1, 1] };
const STAGGER = 0.07;

// Heure-mur de Paris : les dates arrivent en ISO sans conversion à faire ; on lit les chiffres tels quels.
const parts = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(iso || ""));
  return m ? { y: +m[1], mo: +m[2], d: +m[3], h: m[4] ?? null, mi: m[5] ?? null } : null;
};
const asDate = (iso) => { const p = parts(iso); return p ? new Date(Date.UTC(p.y, p.mo - 1, p.d)) : null; };
const dayName = (iso, opts) => { const d = asDate(iso); return d ? d.toLocaleDateString("fr-FR", { timeZone: "UTC", ...opts }) : ""; };
const hour = (iso) => { const p = parts(iso); return p && p.h ? `${p.h}:${p.mi}` : ""; };
const when = (iso) => `${dayName(iso, { weekday: "short", day: "numeric", month: "short" })} · ${hour(iso)}`;
const addDays = (isoDay, n) => { const d = asDate(isoDay); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mondayOf = (isoDay) => { const d = asDate(isoDay); return addDays(isoDay, -((d.getUTCDay() + 6) % 7)); };
const todayParis = () => new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
const weekLabel = (monday) => {
  const friday = addDays(monday, 4);
  const sameMonth = monday.slice(5, 7) === friday.slice(5, 7);
  return `${dayName(monday, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" })} – ${dayName(friday, { day: "numeric", month: "long" })}`;
};
const initials = (name) => (name || "?").split(/[\s.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function Jurist({ name, minutes }) {
  return (
    <span className="blr-jurist">
      <span className="blr-face" aria-hidden="true">{initials(name)}</span>
      <span className="blr-jurist-name">{name}</span>
      {minutes ? <span className="blr-muted">· {minutes} min</span> : null}
    </span>
  );
}

export default function LaunchRescheduleModal({ kind, num, label, onClose, onDone }) {
  const reduce = useReducedMotion();
  const [week, setWeek] = useState(null);          // lundi affiché (null : la semaine du premier jour réservable)
  const [direction, setDirection] = useState(0);   // 0 : ouverture, la semaine se pose sans glisser
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);             // { date, slot }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [uncertain, setUncertain] = useState(false);
  const [completed, setCompleted] = useState(null);
  const [reload, setReload] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const ticket = ++latest.current;
    setLoading(true);
    const start = week ? `&start=${week}` : "";
    apiClient.get(`/api/v1/optilex/board-reschedule-slots?kind=${kind}&numero_client=${encodeURIComponent(num)}${start}`)
      .then((r) => {
        if (ticket !== latest.current) return;
        setData(r); setLoading(false);
      })
      .catch((e) => {
        if (ticket !== latest.current) return;
        setData(null); setLoading(false);
        setError(typeof e?.data?.detail === "string" ? e.data.detail : "Impossible de lire l’agenda du juriste. Réessayez.");
      });
  }, [kind, num, week, reload]);

  // Le serveur dit quelle semaine il renvoie (à l'ouverture : celle du premier jour réservable).
  const monday = data?.week_start ? mondayOf(data.week_start) : week;
  const columns = useMemo(() => {
    if (!monday) return [];
    const byDate = Object.fromEntries((data?.days || []).map((d) => [d.date, d]));
    return [0, 1, 2, 3, 4].map((i) => {
      const date = addDays(monday, i);
      return byDate[date] || { date, closed: date < todayParis() ? "notice" : "busy", slots: [] };
    });
  }, [data, monday]);

  const appointment = data?.appointment;
  const host = data?.host;
  const current = appointment?.start ? { date: appointment.start.slice(0, 10), slot: hour(appointment.start) } : null;
  const canGoBack = monday && monday > (data?.first_week || mondayOf(todayParis()));

  const shift = (n) => {
    if (!monday || saving || uncertain) return;
    setDirection(n); setSel(null); setError(null);
    setWeek(addDays(monday, 7 * n));
  };

  const confirm = useCallback(async () => {
    if (!sel || saving || completed) return;
    setSaving(true); setError(null);
    try {
      const result = await apiClient.post("/api/v1/optilex/board-reschedule", { numero_client: num, kind, new_dt: `${sel.date}T${sel.slot}` });
      appointmentConfirmation(result, sel);
      setCompleted(result);
    } catch (e) {
      const failure = appointmentFailure(e);
      setUncertain(failure.uncertain);
      if (!failure.uncertain) {
        // Refusé (créneau pris entre-temps, journée complète) : la semaine est relue, le choix est à refaire.
        setSel(null); setReload((v) => v + 1);
      }
      setError(failure.message);
    } finally {
      setSaving(false);
    }
  }, [sel, saving, completed, num, kind]);

  if (completed) {
    return createPortal(<AppointmentConfirmation result={completed} selected={sel} label={label}
      detail={host ? `Avec ${host.name} · ${host.minutes} min · même lien Meet` : null} onClose={() => onDone()} />, document.body);
  }

  const busy = saving || uncertain;
  return createPortal(
    <div className="blr-root" role="dialog" aria-modal="true" aria-label={`Reprogrammer le lancement ${LABEL[kind]}`}>
      <motion.div className="blr-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={() => { if (!saving) onClose(); }} />
      <motion.div className="blr-card" initial={reduce ? false : { scale: 0.965, y: 14 }} animate={{ scale: 1, y: 0 }} transition={ENTER}>
        <header className="blr-head">
          <div className="blr-title-block">
            <div className="blr-title">Reprogrammer le lancement {LABEL[kind]}</div>
            <div className="blr-sub">{label}</div>
          </div>
          <button type="button" className="blr-close" aria-label="Fermer" disabled={saving} onClick={() => { if (!saving) onClose(); }}><X size={17} /></button>
        </header>

        <section className="blr-now" aria-label="Rendez-vous actuel">
          <CalendarClock size={18} className="blr-now-icon" aria-hidden="true" />
          <div className="blr-now-main">
            <div className="blr-kicker">Rendez-vous actuel</div>
            <div className="blr-now-when">
              {appointment?.start ? `${dayName(appointment.start, { weekday: "long", day: "numeric", month: "long" })} · ${hour(appointment.start)} – ${hour(appointment.end)}` : (loading ? "…" : "Sans heure connue")}
            </div>
          </div>
          {host && <Jurist name={host.name} minutes={host.minutes} />}
          {appointment?.meet_link && <a className="blr-meet" href={appointment.meet_link} target="_blank" rel="noreferrer"><Video size={13} aria-hidden="true" />Meet</a>}
        </section>

        <nav className="blr-week" aria-label="Semaine">
          <button type="button" className="blr-nav" aria-label="Semaine précédente" disabled={!canGoBack || busy} onClick={() => shift(-1)}><ChevronLeft size={16} /></button>
          <div className="blr-week-label">
            <span>{monday ? weekLabel(monday) : "…"}</span>
            <span className="blr-muted">créneaux de {host ? host.name : "…"} · heure de Paris</span>
          </div>
          <button type="button" className="blr-nav" aria-label="Semaine suivante" disabled={!monday || busy} onClick={() => shift(1)}><ChevronRight size={16} /></button>
        </nav>

        <div className="blr-grid-window">
          <AnimatePresence initial={false} mode="popLayout" custom={direction}>
            <motion.div key={monday || "loading"} className={`blr-grid${loading ? " is-loading" : ""}`} custom={direction}
              initial={reduce || !direction ? false : { x: `${direction * 100}%` }} animate={{ x: 0 }}
              exit={reduce || !direction ? undefined : { x: `${-direction * 100}%`, transition: EXIT }}
              transition={ENTER}>
              {columns.map((col, i) => (
                <motion.div key={col.date} className={`blr-col${col.closed ? " is-closed" : ""}`}
                  initial={reduce || loading ? false : { y: 10 }} animate={{ y: 0 }}
                  transition={{ ...ENTER, delay: i * STAGGER }}>
                  <div className="blr-day">
                    <span className="blr-day-name">{dayName(col.date, { weekday: "short" })}</span>
                    <span className="blr-day-num">{dayName(col.date, { day: "numeric", month: "short" })}</span>
                  </div>
                  {col.closed && !(current && current.date === col.date) ? (
                    // Jour fermé : une seule raison, lisible, au lieu d'une colonne d'heures grisées.
                    <div className="blr-closed">{CLOSED[col.closed]}</div>
                  ) : (
                    <div className="blr-slots">
                      {col.closed && <div className="blr-closed is-note">{CLOSED[col.closed]}</div>}
                      {/* Seuls les créneaux libres sont montrés (dev 19/11/2026 : « que les créneaux dispo »), plus le
                          rendez-vous actuel pour se repérer. */}
                      {(col.slots || []).filter((s) => s.free || (current && current.date === col.date && current.slot === s.t)).map((s) => {
                        const isCurrent = current && current.date === col.date && current.slot === s.t;
                        const on = sel && sel.date === col.date && sel.slot === s.t;
                        const free = s.free && !isCurrent;
                        return (
                          <motion.button key={s.t} type="button" disabled={busy || !free}
                            whileTap={free && !reduce ? { scale: 0.94 } : undefined}
                            className={`blr-slot${on ? " is-on" : ""}${free ? "" : " is-taken"}${isCurrent ? " is-current" : ""}`}
                            aria-pressed={on} title={isCurrent ? "Rendez-vous actuel" : free ? undefined : "Pris"}
                            onClick={() => { if (free) { setSel({ date: col.date, slot: s.t }); setError(null); } }}>
                            {s.t}{isCurrent && <span className="blr-tag">actuel</span>}
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="blr-foot">
          <div className="blr-summary-window" aria-live="polite">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div key={error ? "error" : sel ? `${sel.date}${sel.slot}` : "none"} className="blr-summary"
                initial={reduce ? false : { y: "110%" }} animate={{ y: 0 }} exit={reduce ? undefined : { y: "-110%", transition: EXIT }} transition={ENTER}>
                {error ? (
                  <span className="blr-error" role="alert">{error}</span>
                ) : sel ? (
                  <>
                    <span className="blr-change">
                      {appointment?.start && <><span className="blr-before">{when(appointment.start)}</span><ArrowRight size={14} aria-hidden="true" /></>}
                      <span className="blr-after">{when(`${sel.date}T${sel.slot}`)}</span>
                    </span>
                    <span className="blr-muted">Avec {host?.name} · même lien Meet · le client reçoit la nouvelle invitation</span>
                  </>
                ) : (
                  <span className="blr-muted">{loading ? "Lecture de l’agenda…" : "Choisissez un créneau libre"}</span>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <motion.button type="button" className="blr-confirm" disabled={!sel || saving} whileTap={sel && !reduce ? { scale: 0.97 } : undefined} onClick={confirm}>
            {saving ? "Reprogrammation…" : uncertain ? "Vérifier ce créneau" : "Reprogrammer"}
          </motion.button>
        </footer>
      </motion.div>
    </div>,
    document.body
  );
}
