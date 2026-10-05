// Calendrier interne (demande dev 05/10/2026), un seul composant pour trois vues, en lecture seule :
//   · sales    : son agenda tel que dans Google Agenda (copie synchronisée côté serveur) + ses RDV du CRM
//                avec leurs détails internes (setter qui l'a posé, résultat), ses rappels et ses absences ;
//   · setter   : les RDV qu'il a posés chez les commerciaux (no-show bien visible) et ses rappels ;
//   · director : tous les RDV, en distinguant ceux que suit un setter de ceux à relancer soi-même.
// Rien n'est écrit chez Google ni dans le CRM depuis ce calendrier. Grille et placement des événements
// repris du calendrier Linked ; logique pure (testée) dans src/utils/internalCalendar.js.
import { createElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, LoaderCircle, MapPin, Phone,
  PhoneCall, RefreshCw, User, UserRoundCheck, UserX, Video, X,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import {
  ABSENCE_COLOR, CALLBACK_COLOR, DAY_MINUTES, GOOGLE_COLOR, GOOGLE_COLOR_DARK, HANDLED, OUTCOME, RDV_COLORS, addDays, chipColors,
  eventColor, filterHandled, fmtDayHead, fmtDayTitle, fmtRange, fmtSince, fmtTime, fmtWeekLabel, groupBySales, hasWeekendEvents,
  layoutDay, mondayOf, parisNow, rdvLabel, splitEvents, stepWorkday, weekDays,
} from '../../utils/internalCalendar.js';

const HOUR_HEIGHT = 52;
const RULER = 56;
const SALES_COL_MIN = 184;                // vue direction : largeur mini d'une colonne commercial (défilement horizontal au-delà)
const POPOVER_WIDTH = 340;
const RELOAD_EVERY_MS = 3 * 60 * 1000;
const NAVY = '#121b35';
const NO_SHOW_HATCH = 'repeating-linear-gradient(135deg, rgba(220,38,38,0.13) 0 5px, transparent 5px 11px)';
const ABSENCE_HATCH = 'repeating-linear-gradient(45deg, rgba(100,116,139,0.13) 0 1.5px, transparent 1.5px 9px)';

const GOOGLE_STATUS = {
  ok: null,
  pending: 'Première synchronisation de votre agenda Google en cours.',
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

function eventTitle(ev) {
  if (ev.kind === 'rdv') return ev.company || ev.prospect || 'Prospect';
  if (ev.kind === 'callback') return ev.company || ev.prospect || 'Prospect';
  return ev.title || 'Occupé';
}

// Vue direction : « MOI » = aucun setter n'a posé ce RDV, la relance revient à la direction.
function MineTag({ dark }) {
  return (
    <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.03em', color: dark ? NAVY : '#fff', background: dark ? '#fbbf24' : '#b45309', borderRadius: 4, padding: '1px 4px' }}>
      MOI
    </span>
  );
}

function SetterTag({ name, dark }) {
  const first = String(name || '').trim().split(/\s+/)[0];
  if (!first) return null;
  return (
    <span title={`Suivi par ${name}`} style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 600, color: dark ? '#cbd5e1' : '#475569', background: dark ? 'rgba(148,163,184,0.18)' : 'rgba(71,85,105,0.10)', borderRadius: 4, padding: '1px 4px', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {first}
    </span>
  );
}

function Chip({ ev, view, dark, onOpen, height }) {
  const color = eventColor(ev, dark);
  const tone = chipColors(color, dark);
  const isRdv = ev.kind === 'rdv';
  const noShow = isRdv && ev.outcome === 'no_show';
  const toQualify = isRdv && ev.outcome === 'to_qualify';
  const held = isRdv && ev.outcome === 'held';
  const extends100 = ev.leftPct + ev.widthPct >= 99.5;
  const context = !isRdv ? null
    : view === 'setter' ? (ev.assigned?.name ? `Chez ${ev.assigned.name}` : null)
      : view === 'director' ? (ev.handled_by === 'setter' ? `Suivi par ${ev.setter_name}` : 'À relancer par moi')
        : (ev.setter_name ? `Posé par ${ev.setter_name}` : null);
  return (
    <button
      type="button"
      data-ical-chip
      onClick={(e) => { e.stopPropagation(); onOpen(ev, e.currentTarget.getBoundingClientRect()); }}
      title={`${isRdv ? `${rdvLabel(ev)} · ` : ''}${eventTitle(ev)}${noShow ? ' · No-show' : ''}`}
      style={{
        position: 'absolute', top: (ev.segStart / 60) * HOUR_HEIGHT, height: Math.max(18, height),
        left: `${ev.leftPct}%`, width: `calc(${ev.widthPct}% - ${extends100 ? 10 : 2}px)`, zIndex: ev.zIndex,
        boxSizing: 'border-box', margin: 0, padding: height >= 34 ? '4px 7px' : '1px 7px', textAlign: 'left',
        borderRadius: 8, border: 'none', boxShadow: `inset 0 0 0 1.5px ${dark ? '#1e1f28' : '#fff'}`,
        borderLeft: `3px solid ${tone.line}`,
        background: noShow ? `${NO_SHOW_HATCH}, ${tone.bg}` : tone.bg,
        color: tone.text, fontFamily: 'inherit', fontSize: 11.5, lineHeight: 1.25, cursor: 'pointer', overflow: 'hidden',
        opacity: ev.kind === 'google' && ev.busy === false ? 0.75 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
        {isRdv && <span style={{ fontWeight: 700, fontSize: 10, flexShrink: 0 }}>{rdvLabel(ev)}</span>}
        {ev.kind === 'callback' && <PhoneCall size={11} style={{ flexShrink: 0 }} />}
        <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: view === 'director' ? 52 : 0, flex: 1 }}>
          {eventTitle(ev)}
        </span>
        {held && <CheckCircle2 size={12} color={OUTCOME.held.color} style={{ flexShrink: 0 }} aria-label="Honoré" />}
        {noShow && view === 'director' && <UserX size={13} color={OUTCOME.no_show.color} strokeWidth={2.4} style={{ flexShrink: 0 }} aria-label="No-show" />}
        {noShow && view !== 'director' && (
          <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, color: '#fff', background: OUTCOME.no_show.color, borderRadius: 4, padding: '1px 4px', letterSpacing: '0.02em' }}>
            NO-SHOW
          </span>
        )}
        {toQualify && <span title={OUTCOME.to_qualify.hint} style={{ flexShrink: 0, width: 7, height: 7, borderRadius: 4, background: OUTCOME.to_qualify.color }} />}
        {isRdv && view === 'director' && (ev.handled_by === 'setter' ? <SetterTag name={ev.setter_name} dark={dark} /> : <MineTag dark={dark} />)}
      </div>
      {height >= 34 && (
        <div style={{ fontSize: 10.5, opacity: 0.8, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {fmtTime(ev.start)} - {fmtTime(ev.end)}
        </div>
      )}
      {height >= 52 && context && (
        <div style={{ fontSize: 10.5, opacity: 0.8, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {context}
        </div>
      )}
    </button>
  );
}

function Row({ icon, children, C }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: C.text, lineHeight: 1.4 }}>
      {createElement(icon, { size: 15, color: C.secondary, style: { flexShrink: 0, marginTop: 2 } })}
      <div style={{ minWidth: 0, flex: 1 }}>{children}</div>
    </div>
  );
}

function Popover({ ev, rect, view, C, dark, onClose, onOpenLead, canOpenLead }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

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

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={eventTitle(ev)}
      style={{
        position: 'fixed', left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: POPOVER_WIDTH, zIndex: 1000,
        opacity: pos ? 1 : 0, transition: 'opacity 90ms ease', background: C.bg, color: C.text,
        border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden',
        boxShadow: dark ? '0 18px 48px rgba(0,0,0,0.5)' : '0 18px 48px rgba(18,27,53,0.18)',
      }}
    >
      <div style={{ height: 4, background: ev.kind === 'rdv' && ev.outcome === 'no_show' ? `${NO_SHOW_HATCH}, ${color}` : color }} />
      <div style={{ padding: '12px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {isRdv && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: RDV_COLORS[ev.rdv_type] || RDV_COLORS.r1, borderRadius: 5, padding: '2px 6px' }}>
                  {rdvLabel(ev)}
                </span>
              )}
              {outcome && (
                <span title={outcome.hint} style={{ fontSize: 11, fontWeight: 700, color: outcome.color, background: `${outcome.color}1a`, borderRadius: 5, padding: '2px 6px' }}>
                  {outcome.label}
                </span>
              )}
              {ev.kind === 'callback' && <span style={{ fontSize: 11, fontWeight: 700, color: CALLBACK_COLOR }}>À rappeler</span>}
              {ev.kind === 'google' && <span style={{ fontSize: 11, fontWeight: 600, color: C.secondary }}>Google Agenda</span>}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, wordBreak: 'break-word' }}>{eventTitle(ev)}</div>
            <div style={{ fontSize: 12.5, color: C.secondary, marginTop: 3 }}>{fmtRange(ev)}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{ border: 'none', background: 'transparent', color: C.secondary, cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {isRdv && ev.outcome === 'no_show' && (
          <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: dark ? 'rgba(220,38,38,0.14)' : '#fef2f2', color: dark ? '#fca5a5' : '#b91c1c', fontSize: 12.5, fontWeight: 600 }}>
            Le prospect ne s'est pas présenté.
          </div>
        )}
        {view === 'director' && isRdv && (
          <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: C.subtle, fontSize: 12.5 }}>
            {ev.handled_by === 'setter'
              ? <>Suivi par <strong>{ev.setter_name}</strong>, qui a posé ce rendez-vous.</>
              : <><strong>À relancer par vous</strong> : aucun setter n'a posé ce rendez-vous.</>}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {(ev.kind === 'rdv' || ev.kind === 'callback') && ev.prospect && ev.company && <Row icon={User} C={C}>{ev.prospect}</Row>}
          {ev.phone && (
            <Row icon={Phone} C={C}>
              <a href={`tel:${String(ev.phone).replace(/\s+/g, '')}`} style={{ color: C.text, textDecoration: 'none', fontVariantNumeric: 'tabular-nums' }}>{ev.phone}</a>
            </Row>
          )}
          {isRdv && view !== 'sales' && assigned && <Row icon={UserRoundCheck} C={C}>Commercial : {assigned}</Row>}
          {isRdv && view !== 'director' && ev.setter_name && (
            <Row icon={UserRoundCheck} C={C}>
              {view === 'setter' ? 'Posé par vous' : `Posé par ${ev.setter_name}`}
              <span style={{ color: C.secondary }}>{ev.channel === 'webinar_link' ? ', via le lien webinaire' : ', depuis le CRM'}</span>
            </Row>
          )}
          {isRdv && view === 'director' && ev.channel && (
            <Row icon={UserRoundCheck} C={C}>{ev.channel === 'webinar_link' ? 'Pris via le lien webinaire' : 'Posé depuis le CRM'}</Row>
          )}
          {isRdv && ev.origin && <Row icon={CalendarDays} C={C}>Origine : {ev.origin}</Row>}
          {ev.location && <Row icon={MapPin} C={C}>{ev.location}</Row>}
          {ev.private && <Row icon={CalendarDays} C={C}><span style={{ color: C.secondary }}>Créneau occupé, détail privé.</span></Row>}
        </div>

        {(ev.meet_link || canOpen) && (
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {canOpen && (
              <button type="button" onClick={() => { onClose(); onOpenLead(ev.lead_id, ev); }} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: 'none',
                background: dark ? '#eef0f6' : NAVY, color: dark ? NAVY : '#fff', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
              }}>
                Ouvrir la fiche <ChevronRight size={14} />
              </button>
            )}
            {ev.meet_link && (
              <a href={ev.meet_link} target="_blank" rel="noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
                color: C.text, fontSize: 12.5, fontWeight: 600, textDecoration: 'none',
              }}>
                <Video size={14} /> Rejoindre la visio <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default function InternalCalendar({ view = 'sales', C, darkMode = false, asUser, onOpenLead, canOpenLead, toolbarExtra, reloadKey, fill = true }) {
  const byDay = view === 'director';                       // direction : un jour à la fois, une colonne par commercial
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
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_HEIGHT - 12;      // 7 h, avec son libellé visible
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
      const ids = new Set(timed.get(anchor).map((e) => e.id));
      return groupBySales(events).map((g) => {
        const segs = timed.get(anchor).filter((e) => g.events.some((x) => x.id === e.id) && ids.has(e.id));
        const noShows = g.events.filter((e) => e.outcome === 'no_show').length;
        return { key: g.key, day: anchor, label: g.name, sub: `${g.events.length} RDV${noShows ? ` · ${noShows} no-show` : ''}`, items: layoutDay(segs), allDay: [], absences: [] };
      });
    }
    const days = weekDays(anchor, hasWeekendEvents(events, anchor));
    const { allDay, timed } = splitEvents(events, days);
    return days.map((d) => {
      const head = fmtDayHead(d);
      return {
        key: d, day: d, label: `${head.dow} ${head.day}`, items: layoutDay(timed.get(d)),
        allDay: allDay.get(d), absences: allDay.get(d).filter((e) => e.kind === 'absence'),
      };
    });
  }, [byDay, events, anchor]);

  const hasAllDay = columns.some((c) => c.allDay.length > 0);
  const counts = useMemo(() => {
    const out = { setter: 0, direction: 0 };
    for (const ev of data?.events || []) if (ev.kind === 'rdv' && ev.handled_by in out) out[ev.handled_by] += 1;
    return out;
  }, [data]);

  const todayAnchor = byDay ? now.key : mondayOf(now.key);
  const isCurrent = anchor === todayAnchor;
  const step = (dir) => setAnchor((a) => (byDay ? stepWorkday(a, dir) : addDays(a, 7 * dir)));
  const colWidth = byDay ? `minmax(${SALES_COL_MIN}px, 1fr)` : 'minmax(0, 1fr)';
  const cols = `${RULER}px repeat(${Math.max(1, columns.length)}, ${colWidth})`;
  const minWidth = byDay ? RULER + Math.max(1, columns.length) * SALES_COL_MIN : undefined;
  const openPopover = useCallback((ev, rect) => setPopover((p) => (p?.ev.id === ev.id ? null : { ev, rect })), []);
  const closePopover = useCallback(() => setPopover(null), []);
  const google = view === 'sales' ? data?.google : null;
  const googleWarning = google && !asUser ? GOOGLE_STATUS[google.status] : null;
  const title = byDay ? fmtDayTitle(anchor) : fmtWeekLabel(weekDays(anchor, columns.length === 7));
  const nowCol = columns.findIndex((c) => c.day === now.key);
  const showNow = !byDay ? nowCol >= 0 : anchor === now.key;

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

  const navBtn = {
    width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.text,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
  };
  const segBtn = (active) => ({
    padding: '5px 11px', borderRadius: 7, border: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    background: active ? (darkMode ? '#eef0f6' : NAVY) : 'transparent', color: active ? (darkMode ? NAVY : '#fff') : C.secondary,
    display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
  });
  const stickyBg = C.bg;

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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: fill ? 1 : undefined, color: C.text }}>
      <style>{'@keyframes icalSpin{to{transform:rotate(360deg)}}'}</style>

      {/* Barre d'outils */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={() => step(-1)} style={navBtn} aria-label={byDay ? 'Jour précédent' : 'Semaine précédente'} title={byDay ? 'Jour précédent' : 'Semaine précédente'}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" onClick={() => setAnchor(byDay && [0, 6].includes(new Date(`${now.key}T12:00:00Z`).getUTCDay()) ? stepWorkday(now.key, 1) : todayAnchor)} style={{
            ...navBtn, width: 'auto', padding: '0 14px', fontSize: 12, fontWeight: 600,
            background: isCurrent ? (darkMode ? '#eef0f6' : NAVY) : 'transparent',
            color: isCurrent ? (darkMode ? NAVY : '#fff') : C.text,
            borderColor: isCurrent ? 'transparent' : C.border,
          }}>
            Aujourd'hui
          </button>
          <button type="button" onClick={() => step(1)} style={navBtn} aria-label={byDay ? 'Jour suivant' : 'Semaine suivante'} title={byDay ? 'Jour suivant' : 'Semaine suivante'}>
            <ChevronRight size={16} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 650, marginLeft: 6, whiteSpace: 'nowrap' }}>{title}</span>
          {loading && data && <LoaderCircle size={15} color={C.secondary} style={{ animation: 'icalSpin 0.9s linear infinite' }} />}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {byDay && (
            <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 9, background: C.subtle, border: `1px solid ${C.border}` }}>
              <button type="button" onClick={() => setHandled('all')} style={segBtn(handled === 'all')}>Tous <span style={{ opacity: 0.7 }}>{counts.setter + counts.direction}</span></button>
              <button type="button" onClick={() => setHandled('setter')} style={segBtn(handled === 'setter')} title="Rendez-vous posés par un setter, qui en assure le suivi">
                {HANDLED.setter.label} <span style={{ opacity: 0.7 }}>{counts.setter}</span>
              </button>
              <button type="button" onClick={() => setHandled('direction')} style={segBtn(handled === 'direction')} title="Aucun setter n'a posé ces rendez-vous : la relance vous revient">
                {HANDLED.direction.label} <span style={{ opacity: 0.7 }}>{counts.direction}</span>
              </button>
            </div>
          )}
          {google && !asUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.secondary }}>
              <span>{google.last_success_at ? `Google Agenda à jour ${fmtSince(google.last_success_at)}` : 'Google Agenda'}</span>
              <button type="button" onClick={refresh} disabled={refreshing} title="Actualiser mon agenda Google" aria-label="Actualiser mon agenda Google" style={{ ...navBtn, width: 28, height: 28, cursor: refreshing ? 'default' : 'pointer' }}>
                <RefreshCw size={13} style={refreshing ? { animation: 'icalSpin 0.9s linear infinite' } : undefined} />
              </button>
            </div>
          )}
          {toolbarExtra}
        </div>
      </div>

      {(googleWarning || notice) && (
        <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12.5, background: darkMode ? 'rgba(217,119,6,0.14)' : '#fffbeb', color: darkMode ? '#fcd34d' : '#92400e', border: `1px solid ${darkMode ? 'rgba(217,119,6,0.3)' : '#fde68a'}` }}>
          {notice || googleWarning}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: fill ? 1 : undefined, border: `1px solid ${C.border}`, borderRadius: 12, background: C.bg, overflow: 'hidden', position: 'relative' }}>
        <div ref={scrollRef} style={{ overflow: 'auto', flex: fill ? 1 : undefined, maxHeight: fill ? undefined : 'calc(100vh - 260px)', minHeight: 0, position: 'relative' }}>
          <div style={{ minWidth, position: 'relative' }}>
            {/* En-têtes (jours ou commerciaux) et bandeau « journée entière », collés en haut au défilement */}
            <div style={{ position: 'sticky', top: 0, zIndex: 60, background: stickyBg }}>
              <div style={{ display: 'grid', gridTemplateColumns: cols, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ position: 'sticky', left: 0, background: stickyBg, zIndex: 2 }} />
                {columns.map((c) => {
                  const today = !byDay && c.day === now.key;
                  return (
                    <div key={c.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: byDay ? '8px 6px' : '9px 0', borderLeft: `1px solid ${C.border}`, minWidth: 0 }}>
                      <span style={{
                        fontSize: byDay ? 13 : 12.5, padding: byDay ? 0 : '4px 12px', borderRadius: 999, fontWeight: today || byDay ? 650 : 500, maxWidth: '100%',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        background: today ? (darkMode ? '#eef0f6' : NAVY) : 'transparent', color: today ? (darkMode ? NAVY : '#fff') : (byDay ? C.text : C.secondary),
                      }}>
                        {c.label}
                      </span>
                      {c.sub && <span style={{ fontSize: 11, color: C.secondary, marginTop: 2, whiteSpace: 'nowrap' }}>{c.sub}</span>}
                    </div>
                  );
                })}
              </div>
              {hasAllDay && (
                <div style={{ display: 'grid', gridTemplateColumns: cols, borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, position: 'sticky', left: 0, background: stickyBg }}>Journée</div>
                  {columns.map((c) => (
                    <div key={c.key} style={{ borderLeft: `1px solid ${C.border}`, padding: 3, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                      {c.allDay.map((ev) => {
                        const tone = chipColors(eventColor(ev, darkMode), darkMode);
                        return (
                          <button key={ev.id} type="button" data-ical-chip onClick={(e) => openPopover(ev, e.currentTarget.getBoundingClientRect())} title={ev.title} style={{
                            border: 'none', borderRadius: 6, padding: '3px 7px', textAlign: 'left', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600,
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
              <div style={{ position: 'sticky', left: 0, zIndex: 45, background: stickyBg }}>
                {Array.from({ length: 24 }, (_, h) => h > 0 && (
                  <div key={h} style={{ position: 'absolute', top: h * HOUR_HEIGHT - 7, right: 8, fontSize: 10.5, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>
              {columns.map((c) => (
                <div key={c.key} style={{ position: 'relative', borderLeft: `1px solid ${C.border}`, background: !byDay && c.day === now.key ? (darkMode ? 'rgba(124,138,219,0.04)' : 'rgba(18,27,53,0.018)') : 'transparent' }}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} style={{ position: 'absolute', left: 0, right: 0, top: h * HOUR_HEIGHT, borderTop: `1px solid ${C.border}`, opacity: h === 0 ? 0 : 0.8, pointerEvents: 'none' }} />
                  ))}
                  {c.absences.map((a) => {
                    const from = a.period === 'pm' ? 13 : 0;
                    const to = a.period === 'am' ? 13 : 24;
                    return <div key={a.id} style={{ position: 'absolute', left: 0, right: 0, top: from * HOUR_HEIGHT, height: (to - from) * HOUR_HEIGHT, background: ABSENCE_HATCH, pointerEvents: 'none' }} />;
                  })}
                  {c.items.map((ev) => (
                    <Chip key={ev.id} ev={ev} view={view} dark={darkMode} onOpen={openPopover}
                      height={((ev.segEnd - ev.segStart) / 60) * HOUR_HEIGHT - 2} />
                  ))}
                </div>
              ))}
              {!columns.length && !loading && (
                <div style={{ position: 'absolute', left: RULER, right: 0, top: 9 * HOUR_HEIGHT, textAlign: 'center', fontSize: 13, color: C.secondary }}>
                  Aucun rendez-vous ce jour-là.
                </div>
              )}

              {/* Heure courante */}
              {showNow && now.minutes < DAY_MINUTES && (() => {
                const y = (now.minutes / 60) * HOUR_HEIGHT;
                const n = Math.max(1, columns.length);
                const left = byDay ? `${RULER}px` : `calc(${RULER}px + (100% - ${RULER}px) * ${nowCol} / ${n})`;
                const width = byDay ? `calc(100% - ${RULER}px)` : `calc((100% - ${RULER}px) / ${n})`;
                return (
                  <>
                    <div style={{ position: 'absolute', zIndex: 40, pointerEvents: 'none', top: y, left, width, borderTop: `2px solid ${darkMode ? '#eef0f6' : NAVY}` }} />
                    <div style={{ position: 'absolute', zIndex: 46, pointerEvents: 'none', top: y, left, transform: 'translate(-100%, -50%)', background: darkMode ? '#eef0f6' : NAVY, color: darkMode ? NAVY : '#fff', fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 999, fontVariantNumeric: 'tabular-nums' }}>
                      {now.iso.slice(11, 16)}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {loading && !data && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, color: C.secondary, background: darkMode ? 'rgba(30,31,40,0.6)' : 'rgba(255,255,255,0.6)', zIndex: 70 }}>
            <LoaderCircle size={16} style={{ animation: 'icalSpin 0.9s linear infinite' }} /> Chargement du calendrier…
          </div>
        )}
        {error && !loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 13, color: C.secondary, background: darkMode ? 'rgba(30,31,40,0.85)' : 'rgba(255,255,255,0.85)', zIndex: 70 }}>
            Impossible de charger le calendrier.
            <button type="button" onClick={() => load()} style={{ ...navBtn, width: 'auto', padding: '0 14px', fontSize: 12.5, fontWeight: 600 }}>Réessayer</button>
          </div>
        )}

        {/* Légende */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '8px 14px', borderTop: `1px solid ${C.border}`, fontSize: 11.5, color: C.secondary, flexShrink: 0 }}>
          {legend.map((l) => {
            if (l.mark) {
              return (
                <span key={l.label} title={l.mark === 'mine' ? 'Aucun setter n\'a posé ce rendez-vous' : OUTCOME[l.mark].hint} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {l.mark === 'held' && <CheckCircle2 size={12} color={OUTCOME.held.color} />}
                  {l.mark === 'to_qualify' && <span style={{ width: 7, height: 7, borderRadius: 4, background: OUTCOME.to_qualify.color }} />}
                  {l.mark === 'mine' && <MineTag dark={darkMode} />}
                  {l.label}
                </span>
              );
            }
            const tone = chipColors(l.color, darkMode);
            return (
              <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 10, borderRadius: 3, borderLeft: `3px solid ${l.color}`, background: l.hatch ? `${NO_SHOW_HATCH}, ${tone.bg}` : l.absence ? `${ABSENCE_HATCH}, ${tone.bg}` : tone.bg }} />
                {l.label}
              </span>
            );
          })}
        </div>
      </div>

      {popover && <Popover ev={popover.ev} rect={popover.rect} view={view} C={C} dark={darkMode} onClose={closePopover} onOpenLead={onOpenLead} canOpenLead={canOpenLead} />}
    </div>
  );
}
