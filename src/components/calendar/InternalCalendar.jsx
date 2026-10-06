// Calendrier interne (demande dev 05/10/2026), un seul composant pour trois vues, en lecture seule :
//   · sales    : son agenda tel que dans Google Agenda (copie synchronisée côté serveur) + ses RDV du CRM
//                avec leurs détails internes (setter qui l'a posé, résultat), ses rappels et ses absences ;
//   · setter   : les RDV qu'il a posés chez les commerciaux (no-show bien visible) et ses rappels ;
//   · director : tous les RDV, un jour à la fois et par commercial, en distinguant ceux que suit un setter
//                de ceux à relancer soi-même.
// Rien n'est écrit chez Google ni dans le CRM depuis ce calendrier. Style, grille et placement des
// événements repris du calendrier Tedeles (app Linked, WeekView / EventPopover) : pastilles pastel plates,
// texte teinté, quadrillage fin, police système. Logique pure (testée) dans src/utils/internalCalendar.js.
import { createElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, LoaderCircle, MapPin, Phone,
  PhoneCall, RefreshCw, TriangleAlert, User, UserRoundCheck, UserX, Video, X,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import {
  ABSENCE_COLOR, CALLBACK_COLOR, DAY_MINUTES, GOOGLE_COLOR, GOOGLE_COLOR_DARK, HANDLED, OUTCOME, RDV_COLORS, addDays, chipColors,
  dayOf, eventColor, filterHandled, fmtDayHead, fmtLongDate, fmtDayTitle, fmtRange, fmtSince, fmtTime, fmtWeekLabel, groupBySales, hasWeekendEvents,
  layoutDay, mondayOf, parisNow, rdvLabel, splitEvents, stepWorkday, weekDays,
} from '../../utils/internalCalendar.js';

// Mesures et typographie du calendrier Tedeles.
const HOUR_HEIGHT = 56;
const RULER = 56;
const SALES_COL_MIN = 184;                // vue direction : largeur mini d'une colonne commercial (défilement horizontal au-delà)
const POPOVER_WIDTH = 360;
const RELOAD_EVERY_MS = 3 * 60 * 1000;
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", system-ui, Inter, sans-serif';
const NO_SHOW_HATCH = 'repeating-linear-gradient(135deg, rgba(220,38,38,0.10) 0 5px, transparent 5px 11px)';
const ABSENCE_HATCH = 'repeating-linear-gradient(45deg, rgba(100,116,139,0.12) 0 1.25px, transparent 1.25px 9px)';

// Encre, traits et fonds (clair = tokens Tedeles ; sombre = palette du CRM).
function tokens(C, dark) {
  return dark
    ? { ink: C.text, muted: C.secondary, faint: C.muted, line: C.border, canvas: C.subtle, surface: C.bg, today: '#eef0f6', todayText: '#121b35' }
    : { ink: '#171a20', muted: '#5c6470', faint: '#9aa2af', line: '#e7e9ee', canvas: '#f6f7f9', surface: '#ffffff', today: '#171a20', todayText: '#ffffff' };
}

const GOOGLE_WARNINGS = {
  not_shared: 'Votre agenda Google n\'est pas partagé avec le CRM : seuls vos rendez-vous du CRM s\'affichent.',
  quota: 'Synchronisation Google en pause quelques minutes, elle reprendra seule.',
  error: 'La dernière synchronisation Google a échoué, nouvel essai automatique.',
};

const REFRESH_MESSAGES = {
  paused: 'Synchronisation Google en pause quelques minutes, elle reprendra seule.',
  fresh: 'Votre agenda est déjà à jour.',
  not_shared: 'Votre agenda Google n\'est pas partagé avec le CRM.',
  quota: 'Google demande de patienter : nouvel essai automatique.',
  error: 'Actualisation impossible pour le moment, nouvel essai automatique.',
};

// Setter lié au RDV : celui qui l'a posé, sinon celui qui a apporté le lead (un R2 tenu par le commercial après un
// R1 posé par le setter reste lié à ce setter).
function setterOf(ev) {
  return ev.setter_name || ev.lead_setter || null;
}

function eventTitle(ev) {
  if (ev.kind === 'rdv' || ev.kind === 'callback') return ev.company || ev.prospect || 'Prospect';
  return ev.title || 'Occupé';
}

// Pastilles d'état, discrètes (fond teinté, texte de la même teinte).
function SoftTag({ children, color, title, wide = false }) {
  return (
    <span title={title} style={{
      flexShrink: 0, fontSize: 10, fontWeight: 600, lineHeight: '14px', padding: '0 5px', borderRadius: 999,
      color, background: `${color}1f`, whiteSpace: 'nowrap', maxWidth: wide ? 'none' : 72, overflow: 'hidden', textOverflow: 'ellipsis',
    }}>
      {children}
    </span>
  );
}

function MineTag() {
  return <SoftTag color="#b45309" title="Aucun setter n'a posé ce rendez-vous : la relance vous revient">Moi</SoftTag>;
}

function SetterTag({ name }) {
  const first = String(name || '').trim().split(/\s+/)[0];
  return first ? <SoftTag color="#475569" title={`Suivi par ${name}`}>{first}</SoftTag> : null;
}

function Chip({ ev, view, dark, onOpen, height, ring }) {
  const tone = chipColors(eventColor(ev, dark), dark);
  const isRdv = ev.kind === 'rdv';
  const noShow = isRdv && ev.outcome === 'no_show';
  const toQualify = isRdv && ev.outcome === 'to_qualify';
  const held = isRdv && ev.outcome === 'held';
  const roomy = height >= 40;
  const toRight = ev.leftPct + ev.widthPct >= 99.5;
  const context = !isRdv ? null
    : view === 'setter' ? (ev.assigned?.name ? `Chez ${ev.assigned.name}` : null)
      : view === 'director' ? null
        : (ev.setter_name ? `Posé par ${ev.setter_name}` : ev.lead_setter ? (ev.lead_setter_placed_r1 ? `R1 posé par ${ev.lead_setter}` : `Setter : ${ev.lead_setter}`) : null);
  return (
    <button
      type="button"
      data-ical-chip
      className="ical-chip"
      onClick={(e) => { e.stopPropagation(); onOpen(ev, e.currentTarget.getBoundingClientRect()); }}
      title={`${isRdv ? `${rdvLabel(ev)} · ` : ''}${eventTitle(ev)}${noShow ? ' · No-show' : ''}${ev.crm_start ? ' · Date différente dans le CRM' : ''}`}
      style={{
        position: 'absolute', top: (ev.segStart / 60) * HOUR_HEIGHT, height: Math.max(20, height),
        left: `${ev.leftPct}%`, width: `calc(${ev.widthPct}% - ${toRight ? 12 : 2}px)`, zIndex: ev.zIndex,
        boxSizing: 'border-box', margin: 0, padding: roomy ? '6px 8px' : '3px 8px', textAlign: 'left',
        border: 'none', borderRadius: 10, boxShadow: `inset 0 0 0 2px ${ring}`,
        background: noShow ? `${NO_SHOW_HATCH}, ${tone.bg}` : tone.bg, color: tone.text,
        fontFamily: 'inherit', fontSize: 12, lineHeight: 1.25, cursor: 'pointer', overflow: 'hidden',
        opacity: ev.kind === 'google' && ev.busy === false ? 0.7 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
        {ev.kind === 'callback' && <PhoneCall size={11} style={{ flexShrink: 0 }} />}
        <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: view === 'director' ? 48 : 0, flex: 1 }}>
          {isRdv && <span style={{ opacity: 0.6, marginRight: 4 }}>{rdvLabel(ev)}</span>}
          {eventTitle(ev)}
          {!roomy && view !== 'director' && <span style={{ opacity: 0.65 }}>, {fmtTime(ev.start)}</span>}
        </span>
        {ev.crm_start && <TriangleAlert size={12} color="#d97706" style={{ flexShrink: 0 }} aria-label="Date différente dans le CRM" />}
        {held && <CheckCircle2 size={12} color={OUTCOME.held.color} style={{ flexShrink: 0 }} aria-label="Honoré" />}
        {toQualify && <span title={OUTCOME.to_qualify.hint} style={{ flexShrink: 0, width: 6, height: 6, borderRadius: 3, background: OUTCOME.to_qualify.color }} />}
        {noShow && (view === 'director'
          ? <UserX size={13} color={OUTCOME.no_show.color} strokeWidth={2.2} style={{ flexShrink: 0 }} aria-label="No-show" />
          : <SoftTag color={OUTCOME.no_show.color}>No-show</SoftTag>)}
        {isRdv && view === 'director' && (ev.handled_by === 'setter' ? <SetterTag name={setterOf(ev)} /> : <MineTag />)}
      </div>
      {roomy && (
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {fmtTime(ev.start)} - {fmtTime(ev.end)}
        </div>
      )}
      {roomy && height >= 56 && context && (
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{context}</div>
      )}
    </button>
  );
}

function Row({ icon, children, T }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 14, color: T.ink, lineHeight: 1.45 }}>
      {createElement(icon, { size: 15, color: T.muted, style: { flexShrink: 0, marginTop: 2 } })}
      <div style={{ minWidth: 0, flex: 1 }}>{children}</div>
    </div>
  );
}

function Popover({ ev, rect, view, T, dark, onClose, onOpenLead, canOpenLead }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  // Placement Tedeles : à droite de l'événement, sinon à gauche, toujours dans l'écran.
  useLayoutEffect(() => {
    const margin = 12;
    let left = rect.right + 8;
    if (left + POPOVER_WIDTH > window.innerWidth - margin) left = rect.left - 8 - POPOVER_WIDTH;
    if (left < margin) left = Math.max(margin, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - margin));
    const h = ref.current?.getBoundingClientRect().height ?? 240;
    let top = rect.top;
    if (top + h > window.innerHeight - margin) top = window.innerHeight - margin - h;
    setPos({ left, top: Math.max(margin, top) });
  }, [rect]);

  useEffect(() => {
    const down = (e) => { if (ref.current && !ref.current.contains(e.target) && !e.target.closest?.('[data-ical-chip]')) onClose(); };
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [onClose]);

  const color = eventColor(ev, dark);
  const isRdv = ev.kind === 'rdv';
  const outcome = isRdv ? OUTCOME[ev.outcome] : null;
  const canOpen = Boolean(onOpenLead && ev.lead_id && (!canOpenLead || canOpenLead(ev.lead_id)));
  const assigned = ev.assigned?.state === 'assigned' ? ev.assigned.name
    : ev.assigned?.state === 'archived' ? 'Lead archivé' : ev.assigned ? 'Non affecté' : null;
  const kindLabel = isRdv ? `Rendez-vous ${rdvLabel(ev)}` : ev.kind === 'callback' ? 'À rappeler' : ev.kind === 'absence' ? 'Absence' : 'Google Agenda';
  const pill = (bg, fg) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, border: 'none',
    background: bg, color: fg, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'none',
  });

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={eventTitle(ev)}
      style={{
        position: 'fixed', left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: POPOVER_WIDTH, zIndex: 1000,
        opacity: pos ? 1 : 0, transition: 'opacity 80ms ease', background: T.surface, color: T.ink, fontFamily: FONT,
        border: `1px solid ${T.line}`, borderRadius: 12, overflow: 'hidden',
        boxShadow: dark ? '0 25px 50px -12px rgba(0,0,0,0.6)' : '0 25px 50px -12px rgba(0,0,0,0.25)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 8px', borderBottom: `1px solid ${T.line}` }}>
        <button type="button" className="ical-icon-btn" onClick={onClose} aria-label="Fermer" title="Fermer" style={{ border: 'none', background: 'transparent', color: T.muted, cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex' }}>
          <X size={15} />
        </button>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ marginTop: 7, width: 12, height: 12, borderRadius: 3, background: color, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 500, lineHeight: 1.3, letterSpacing: '-0.01em', wordBreak: 'break-word' }}>{eventTitle(ev)}</div>
            <div style={{ fontSize: 13.5, color: T.muted, marginTop: 2 }}>{fmtRange(ev)}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <SoftTag wide color={color}>{kindLabel}</SoftTag>
          {outcome && <SoftTag wide color={outcome.color} title={outcome.hint}>{outcome.label}</SoftTag>}
          {view === 'director' && isRdv && (ev.handled_by === 'setter' ? <SetterTag name={setterOf(ev)} /> : <MineTag />)}
        </div>

        {isRdv && ev.crm_start && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 8, background: dark ? 'rgba(217,119,6,0.14)' : '#fffbeb', color: dark ? '#fcd34d' : '#92400e', fontSize: 13, lineHeight: 1.4 }}>
            <TriangleAlert size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Le CRM indique {fmtLongDate(dayOf(ev.crm_start))}, {fmtTime(ev.crm_start)}. L'agenda Google fait foi : pensez à corriger la fiche.</span>
          </div>
        )}
        {isRdv && ev.outcome === 'no_show' && (
          <div style={{ padding: '8px 10px', borderRadius: 8, background: dark ? 'rgba(220,38,38,0.14)' : '#fef2f2', color: dark ? '#fca5a5' : '#b91c1c', fontSize: 13 }}>
            Le prospect ne s'est pas présenté.
          </div>
        )}
        {view === 'director' && isRdv && (
          <div style={{ fontSize: 13, color: T.muted }}>
            {ev.handled_by === 'setter'
              ? <>Suivi par <span style={{ color: T.ink }}>{setterOf(ev)}</span>, {ev.setter_name ? 'qui a posé ce rendez-vous.' : ev.lead_setter_placed_r1 ? 'qui a posé le RDV initial (R1).' : 'qui a apporté ce lead.'}</>
              : <><span style={{ color: T.ink }}>À relancer par vous</span> : aucun setter n'a posé ce rendez-vous.</>}
          </div>
        )}

        {(ev.kind === 'rdv' || ev.kind === 'callback') && ev.prospect && ev.company && <Row icon={User} T={T}>{ev.prospect}</Row>}
        {ev.phone && (
          <Row icon={Phone} T={T}>
            <a href={`tel:${String(ev.phone).replace(/\s+/g, '')}`} style={{ color: T.ink, textDecoration: 'none', fontVariantNumeric: 'tabular-nums' }}>{ev.phone}</a>
          </Row>
        )}
        {isRdv && view !== 'sales' && assigned && <Row icon={UserRoundCheck} T={T}>Commercial : {assigned}</Row>}
        {isRdv && view !== 'director' && ev.setter_name && (
          <Row icon={UserRoundCheck} T={T}>
            {view === 'setter' ? 'Posé par vous' : `Posé par ${ev.setter_name}`}
            <span style={{ color: T.muted }}>{ev.channel === 'webinar_link' ? ', via le lien webinaire' : ', depuis le CRM'}</span>
          </Row>
        )}
        {isRdv && view !== 'setter' && !ev.setter_name && ev.lead_setter && (ev.lead_setter_placed_r1 || !/setter/i.test(ev.origin || '')) && (
          <Row icon={UserRoundCheck} T={T}>
            {ev.lead_setter_placed_r1 ? `RDV initial (R1) posé par ${ev.lead_setter}` : `Lead apporté par ${ev.lead_setter}`}
          </Row>
        )}
        {isRdv && view === 'director' && ev.channel && (
          <Row icon={UserRoundCheck} T={T}>{ev.channel === 'webinar_link' ? 'Pris via le lien webinaire' : 'Posé depuis le CRM'}</Row>
        )}
        {isRdv && ev.origin && (
          <Row icon={CalendarDays} T={T}>
            <span style={{ color: T.muted }}>Origine :</span> {ev.origin}
            {/setter/i.test(ev.origin) && setterOf(ev) && view !== 'setter' && !(ev.lead_setter_placed_r1 && !ev.setter_name) ? `, ${setterOf(ev)}` : ''}
          </Row>
        )}
        {ev.location && <Row icon={MapPin} T={T}>{ev.location}</Row>}
        {ev.private && <Row icon={CalendarDays} T={T}><span style={{ color: T.muted }}>Créneau occupé, détail privé.</span></Row>}
      </div>

      {(ev.meet_link || canOpen) && (
        <div style={{ borderTop: `1px solid ${T.line}`, padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          {ev.meet_link && (
            <a href={ev.meet_link} target="_blank" rel="noreferrer" style={pill(T.canvas, T.ink)}>
              <Video size={14} /> Rejoindre la visio
            </a>
          )}
          {canOpen && (
            <button type="button" onClick={() => { onClose(); onOpenLead(ev.lead_id, ev); }} style={pill(T.today, T.todayText)}>
              Ouvrir la fiche <ChevronRight size={14} />
            </button>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}

export default function InternalCalendar({ view = 'sales', C, darkMode = false, asUser, onOpenLead, canOpenLead, toolbarExtra, reloadKey, fill = true }) {
  const byDay = view === 'director';                       // direction : un jour à la fois, une colonne par commercial
  const T = useMemo(() => tokens(C, darkMode), [C, darkMode]);
  const [anchor, setAnchor] = useState(() => {
    const today = parisNow().key;
    return byDay ? ([0, 6].includes(new Date(`${today}T12:00:00Z`).getUTCDay()) ? stepWorkday(today, 1) : today) : mondayOf(today);
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [popover, setPopover] = useState(null);
  const [now, setNow] = useState(() => parisNow());
  const [handled, setHandled] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState(null);
  const scrollRef = useRef(null);
  const requestRef = useRef(0);

  const load = useCallback(async ({ quiet = false } = {}) => {
    const id = ++requestRef.current;
    if (!quiet) setLoading(true);
    try {
      const qs = new URLSearchParams({ view, start: anchor, end: addDays(anchor, byDay ? 1 : 7) });
      if (asUser) qs.set('as', asUser);
      const res = await apiClient.get(`/api/v1/calendar/events?${qs}`);
      if (id !== requestRef.current) return;
      setData(res);
      setError(false);
    } catch {
      if (id === requestRef.current && !quiet) setError(true);
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  }, [view, anchor, byDay, asUser, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps -- reloadKey : recharger à la demande du parent

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const tick = setInterval(() => setNow(parisNow()), 60_000);
    const reload = setInterval(() => { if (document.visibilityState === 'visible') load({ quiet: true }); }, RELOAD_EVERY_MS);
    return () => { clearInterval(tick); clearInterval(reload); };
  }, [load]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_HEIGHT;      // 7 h, comme Tedeles
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const events = useMemo(() => filterHandled(data?.events, byDay ? handled : 'all'), [data, byDay, handled]);

  // Colonnes : les jours de la semaine (sales, setter) ou les commerciaux du jour (direction).
  const columns = useMemo(() => {
    if (byDay) {
      const { timed } = splitEvents(events, [anchor]);
      return groupBySales(events).map((g) => {
        const ids = new Set(g.events.map((e) => e.id));
        const noShows = g.events.filter((e) => e.outcome === 'no_show').length;
        return {
          key: g.key, day: anchor, label: g.name, sub: `${g.events.length} RDV${noShows ? ` · ${noShows} no-show` : ''}`,
          items: layoutDay(timed.get(anchor).filter((e) => ids.has(e.id))), allDay: [], absences: [], weekend: false,
        };
      });
    }
    const days = weekDays(anchor, hasWeekendEvents(events, anchor));
    const { allDay, timed } = splitEvents(events, days);
    return days.map((d) => {
      const head = fmtDayHead(d);
      return {
        key: d, day: d, dow: head.dow, num: head.day, items: layoutDay(timed.get(d)),
        allDay: allDay.get(d), absences: allDay.get(d).filter((e) => e.kind === 'absence'), weekend: ['sam.', 'dim.'].includes(head.dow),
      };
    });
  }, [byDay, events, anchor]);

  const hasAllDay = columns.some((c) => c.allDay.length > 0);
  const counts = useMemo(() => {
    const out = { setter: 0, direction: 0 };
    for (const ev of data?.events || []) if (ev.kind === 'rdv' && ev.handled_by in out) out[ev.handled_by] += 1;
    return out;
  }, [data]);

  const todayAnchor = byDay ? ([0, 6].includes(new Date(`${now.key}T12:00:00Z`).getUTCDay()) ? stepWorkday(now.key, 1) : now.key) : mondayOf(now.key);
  const step = (dir) => setAnchor((a) => (byDay ? stepWorkday(a, dir) : addDays(a, 7 * dir)));
  const colWidth = byDay ? `minmax(${SALES_COL_MIN}px, 1fr)` : 'minmax(0, 1fr)';
  const cols = `${RULER}px repeat(${Math.max(1, columns.length)}, ${colWidth})`;
  const minWidth = byDay ? RULER + Math.max(1, columns.length) * SALES_COL_MIN : undefined;
  const openPopover = useCallback((ev, rect) => setPopover((p) => (p?.ev.id === ev.id ? null : { ev, rect })), []);
  const closePopover = useCallback(() => setPopover(null), []);
  const google = view === 'sales' && !asUser ? data?.google : null;
  const warning = notice || (google ? GOOGLE_WARNINGS[google.status] : null);
  const title = byDay ? fmtDayTitle(anchor) : fmtWeekLabel(weekDays(anchor, columns.length === 7));
  const nowCol = columns.findIndex((c) => c.day === now.key);
  const showNow = byDay ? anchor === now.key : nowCol >= 0;

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await apiClient.post('/api/v1/calendar/refresh', {});
      if (res?.status !== 'ok') setNotice(REFRESH_MESSAGES[res?.status] || REFRESH_MESSAGES.error);
      await load({ quiet: true });
    } catch {
      setNotice(REFRESH_MESSAGES.error);
    } finally {
      setRefreshing(false);
    }
  };

  const iconBtn = { border: 'none', background: 'transparent', color: T.ink, cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const segBtn = (active) => ({
    padding: '4px 10px', borderRadius: 999, border: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer',
    background: active ? T.today : 'transparent', color: active ? T.todayText : T.muted, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
  });
  const hourLine = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(231,233,238,0.85)';
  const halfLine = darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(231,233,238,0.4)';
  const ring = T.surface;

  const legend = [
    { label: 'R1', color: RDV_COLORS.r1 },
    { label: 'R2', color: RDV_COLORS.r2 },
    view === 'sales' && { label: 'R3', color: RDV_COLORS.r3 },
    { label: 'No-show', color: OUTCOME.no_show.color, hatch: true },
    !byDay && { label: 'À rappeler', color: CALLBACK_COLOR },
    view === 'sales' && { label: 'Google Agenda', color: darkMode ? GOOGLE_COLOR_DARK : GOOGLE_COLOR },
    !byDay && { label: 'Absence', color: ABSENCE_COLOR, absence: true },
    { label: 'Honoré', mark: 'held' },
    { label: 'À qualifier', mark: 'to_qualify' },
    byDay && { label: 'À relancer par moi', mark: 'mine' },
  ].filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: fill ? 1 : undefined, color: T.ink, fontFamily: FONT, WebkitFontSmoothing: 'antialiased' }}>
      <style>{`@keyframes icalSpin{to{transform:rotate(360deg)}}
        .ical-chip{transition:filter .12s ease}.ical-chip:hover{filter:brightness(${darkMode ? 1.12 : 0.97})}
        .ical-icon-btn:hover{background:${T.canvas}!important}`}</style>

      <section style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: fill ? 1 : undefined, border: `1px solid ${T.line}`, borderRadius: 16, background: T.surface, overflow: 'hidden', position: 'relative' }}>
        {/* Barre d'outils (Tedeles) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 16px', borderBottom: `1px solid ${T.line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button type="button" className="ical-icon-btn" onClick={() => step(-1)} style={iconBtn} aria-label={byDay ? 'Jour précédent' : 'Semaine précédente'} title={byDay ? 'Jour précédent' : 'Semaine précédente'}>
              <ChevronLeft size={16} />
            </button>
            <button type="button" className="ical-icon-btn" onClick={() => setAnchor(todayAnchor)} style={{ ...iconBtn, padding: '4px 10px', fontSize: 12, fontFamily: 'inherit', border: `1px solid ${T.line}` }}>
              Aujourd'hui
            </button>
            <button type="button" className="ical-icon-btn" onClick={() => step(1)} style={iconBtn} aria-label={byDay ? 'Jour suivant' : 'Semaine suivante'} title={byDay ? 'Jour suivant' : 'Semaine suivante'}>
              <ChevronRight size={16} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 500, marginLeft: 10, whiteSpace: 'nowrap' }}>{title}</span>
            {loading && data && <LoaderCircle size={14} color={T.faint} style={{ marginLeft: 6, animation: 'icalSpin 0.9s linear infinite' }} />}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {byDay && (
              <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 999, background: T.canvas }}>
                <button type="button" onClick={() => setHandled('all')} style={segBtn(handled === 'all')}>Tous <span style={{ opacity: 0.6 }}>{counts.setter + counts.direction}</span></button>
                <button type="button" onClick={() => setHandled('setter')} style={segBtn(handled === 'setter')} title="Rendez-vous posés par un setter, qui en assure le suivi">
                  {HANDLED.setter.label} <span style={{ opacity: 0.6 }}>{counts.setter}</span>
                </button>
                <button type="button" onClick={() => setHandled('direction')} style={segBtn(handled === 'direction')} title="Aucun setter n'a posé ces rendez-vous : la relance vous revient">
                  {HANDLED.direction.label} <span style={{ opacity: 0.6 }}>{counts.direction}</span>
                </button>
              </div>
            )}
            {google && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: T.faint }}>
                <span>{google.last_success_at ? `Google Agenda à jour ${fmtSince(google.last_success_at)}` : 'Google Agenda'}</span>
                <button type="button" className="ical-icon-btn" onClick={refresh} disabled={refreshing} title="Actualiser mon agenda Google" aria-label="Actualiser mon agenda Google" style={{ ...iconBtn, color: T.muted, cursor: refreshing ? 'default' : 'pointer' }}>
                  <RefreshCw size={13} style={refreshing ? { animation: 'icalSpin 0.9s linear infinite' } : undefined} />
                </button>
              </div>
            )}
            {toolbarExtra}
          </div>
        </div>

        {warning && (
          <div style={{ padding: '7px 16px', fontSize: 12, borderBottom: `1px solid ${T.line}`, background: darkMode ? 'rgba(217,119,6,0.12)' : '#fffbeb', color: darkMode ? '#fcd34d' : '#92400e' }}>
            {warning}
          </div>
        )}

        <div ref={scrollRef} style={{ overflow: 'auto', flex: fill ? 1 : undefined, maxHeight: fill ? undefined : 'calc(100vh - 260px)', minHeight: 0, position: 'relative' }}>
          <div style={{ minWidth, position: 'relative' }}>
            {/* En-têtes (jours ou commerciaux) et bandeau « journée entière », collés en haut au défilement */}
            <div style={{ position: 'sticky', top: 0, zIndex: 60, background: T.surface }}>
              <div style={{ display: 'grid', gridTemplateColumns: cols, borderBottom: `1px solid ${T.line}` }}>
                <div style={{ position: 'sticky', left: 0, background: T.surface, zIndex: 2 }} />
                {columns.map((c) => {
                  const today = !byDay && c.day === now.key;
                  return (
                    <div key={c.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: byDay ? '8px 6px' : '10px 0', borderLeft: `1px solid ${T.line}`, minWidth: 0 }}>
                      {byDay ? (
                        <>
                          <span style={{ fontSize: 13, fontWeight: 500, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
                          <span style={{ fontSize: 11, color: T.faint, marginTop: 1, whiteSpace: 'nowrap' }}>{c.sub}</span>
                        </>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: today ? T.ink : T.muted, fontWeight: today ? 500 : 400 }}>
                          {c.dow.charAt(0).toUpperCase() + c.dow.slice(1, -1)}
                          <span style={today
                            ? { minWidth: 22, height: 22, padding: '0 4px', boxSizing: 'border-box', borderRadius: 999, background: T.today, color: T.todayText, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 600 }
                            : undefined}>
                            {c.num}
                          </span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {hasAllDay && (
                <div style={{ display: 'grid', gridTemplateColumns: cols, borderBottom: `1px solid ${T.line}` }}>
                  <div style={{ fontSize: 10, color: T.faint, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, position: 'sticky', left: 0, background: T.surface }}>Journée</div>
                  {columns.map((c) => (
                    <div key={c.key} style={{ borderLeft: `1px solid ${T.line}`, padding: 3, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                      {c.allDay.map((ev) => {
                        const tone = chipColors(eventColor(ev, darkMode), darkMode);
                        return (
                          <button key={ev.id} type="button" data-ical-chip className="ical-chip" onClick={(e) => openPopover(ev, e.currentTarget.getBoundingClientRect())} title={ev.title} style={{
                            border: 'none', borderRadius: 8, padding: '3px 8px', textAlign: 'left', fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                            background: ev.kind === 'absence' ? `${ABSENCE_HATCH}, ${tone.bg}` : tone.bg, color: tone.text, cursor: 'pointer',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {ev.title}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Grille horaire */}
            <div style={{ display: 'grid', gridTemplateColumns: cols, height: 24 * HOUR_HEIGHT, position: 'relative' }}>
              <div style={{ position: 'sticky', left: 0, zIndex: 45, background: T.surface }}>
                {Array.from({ length: 24 }, (_, h) => h > 0 && (
                  <div key={h} style={{ position: 'absolute', top: h * HOUR_HEIGHT - 6, right: 8, fontSize: 10, color: T.faint, fontVariantNumeric: 'tabular-nums' }}>
                    {h}h
                  </div>
                ))}
              </div>
              {columns.map((c) => (
                <div key={c.key} style={{ position: 'relative', borderLeft: `1px solid ${T.line}`, background: c.weekend ? (darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(246,247,249,0.6)') : 'transparent' }}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h}>
                      {h > 0 && <div style={{ position: 'absolute', left: 0, right: 0, top: h * HOUR_HEIGHT, borderTop: `1px solid ${hourLine}`, pointerEvents: 'none' }} />}
                      <div style={{ position: 'absolute', left: 0, right: 0, top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2, borderTop: `1px solid ${halfLine}`, pointerEvents: 'none' }} />
                    </div>
                  ))}
                  {c.absences.map((a) => {
                    const from = a.period === 'pm' ? 13 : 0;
                    const to = a.period === 'am' ? 13 : 24;
                    return <div key={a.id} style={{ position: 'absolute', left: 0, right: 0, top: from * HOUR_HEIGHT, height: (to - from) * HOUR_HEIGHT, background: ABSENCE_HATCH, pointerEvents: 'none' }} />;
                  })}
                  {c.items.map((ev) => (
                    <Chip key={ev.id} ev={ev} view={view} dark={darkMode} ring={ring} onOpen={openPopover}
                      height={((ev.segEnd - ev.segStart) / 60) * HOUR_HEIGHT} />
                  ))}
                </div>
              ))}
              {!columns.length && !loading && (
                <div style={{ position: 'absolute', left: RULER, right: 0, top: 9 * HOUR_HEIGHT, textAlign: 'center', fontSize: 13, color: T.muted }}>
                  Aucun rendez-vous ce jour-là.
                </div>
              )}

              {/* Heure courante (Tedeles : trait sur la colonne du jour + pastille de l'heure) */}
              {showNow && now.minutes < DAY_MINUTES && (() => {
                const y = (now.minutes / 60) * HOUR_HEIGHT;
                const n = Math.max(1, columns.length);
                const left = byDay ? `${RULER}px` : `calc(${RULER}px + (100% - ${RULER}px) * ${nowCol} / ${n})`;
                const width = byDay ? `calc(100% - ${RULER}px)` : `calc((100% - ${RULER}px) / ${n})`;
                return (
                  <>
                    <div style={{ position: 'absolute', zIndex: 40, pointerEvents: 'none', top: y, left, width, borderTop: `2px solid ${T.today}` }} />
                    <div style={{ position: 'absolute', zIndex: 46, pointerEvents: 'none', top: y, left, transform: 'translate(-100%, -50%)', background: T.today, color: T.todayText, fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 999, fontVariantNumeric: 'tabular-nums' }}>
                      {now.iso.slice(11, 16).replace(/^0/, '')}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {loading && !data && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12, color: T.muted, background: darkMode ? 'rgba(30,31,40,0.6)' : 'rgba(255,255,255,0.6)', backdropFilter: 'blur(2px)', zIndex: 70 }}>
            <LoaderCircle size={15} style={{ animation: 'icalSpin 0.9s linear infinite' }} /> Chargement…
          </div>
        )}
        {error && !loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 13, color: T.muted, background: darkMode ? 'rgba(30,31,40,0.85)' : 'rgba(255,255,255,0.85)', zIndex: 70 }}>
            Impossible de charger le calendrier.
            <button type="button" className="ical-icon-btn" onClick={() => load()} style={{ ...iconBtn, padding: '5px 12px', fontSize: 12.5, fontFamily: 'inherit', border: `1px solid ${T.line}` }}>Réessayer</button>
          </div>
        )}

        {/* Légende (pied de carte Tedeles) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '8px 16px', borderTop: `1px solid ${T.line}`, background: darkMode ? 'transparent' : 'rgba(246,247,249,0.4)', fontSize: 11, color: T.muted, flexShrink: 0 }}>
          {legend.map((l) => {
            if (l.mark) {
              return (
                <span key={l.label} title={l.mark === 'mine' ? 'Aucun setter n\'a posé ce rendez-vous' : OUTCOME[l.mark].hint} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {l.mark === 'held' && <CheckCircle2 size={12} color={OUTCOME.held.color} />}
                  {l.mark === 'to_qualify' && <span style={{ width: 6, height: 6, borderRadius: 3, background: OUTCOME.to_qualify.color }} />}
                  {l.mark === 'mine' && <MineTag />}
                  {l.label}
                </span>
              );
            }
            const tone = chipColors(l.color, darkMode);
            return (
              <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 10, borderRadius: 3, background: l.hatch ? `${NO_SHOW_HATCH}, ${tone.bg}` : l.absence ? `${ABSENCE_HATCH}, ${tone.bg}` : tone.bg, boxShadow: `inset 0 0 0 1px ${tone.text}22` }} />
                {l.label}
              </span>
            );
          })}
        </div>
      </section>

      {popover && <Popover ev={popover.ev} rect={popover.rect} view={view} T={T} dark={darkMode} onClose={closePopover} onOpenLead={onOpenLead} canOpenLead={canOpenLead} />}
    </div>
  );
}
