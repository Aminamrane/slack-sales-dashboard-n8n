import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarCheck2, CalendarClock, CalendarDays, Check, ChevronLeft, ChevronRight, LoaderCircle, RefreshCw, X } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useDialogFocus } from '../salesJourney/QualificationDialog';
import { availableSelection } from '../../utils/setterJourney';
import './setterJourney.css';

const dateLabel = (day, opts = {}) => new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', ...opts });
// RDV actuel en heure murale, lu tel qu'il est stocké (jamais converti).
const currentLabel = (value) => value ? `${dateLabel(value.slice(0, 10), { weekday: 'long' })} à ${value.slice(11, 16).replace(':', ' h ')}` : '';

// Report d'un R1 (dev 13/10/2026) ou d'un R2 (agenda setter, dev 27/10/2026) par un setter : seul l'agenda du
// commercial du RDV (le propriétaire du lead) est proposé, avec ses créneaux réellement libres pour ce type de RDV
// (horaires et durée de R1 ou de R2, RDV du CRM, absences, agenda Google, délai de 2 h, jamais le jour même).
// Le serveur revérifie le créneau au moment du report. `onConfirm(date)` enregistre et lève l'erreur en cas d'échec.
export default function SetterRescheduleDialog({ lead, kind = 'r1', dark = false, onClose, onConfirm }) {
  const label = kind.toUpperCase();
  const current = lead?.[kind] || null;
  const owner = (lead?.assigned_to || '').trim();
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [reload, setReload] = useState(0);
  const [day, setDay] = useState(''), [dayPage, setDayPage] = useState(0), [slot, setSlot] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const ref = useRef(null), submitting = useRef(false);
  useDialogFocus(ref, onClose, busy);
  const query = `/api/v1/tracking/setter/availability?${new URLSearchParams({ kind, lead_id: String(lead.id), sales_email: owner })}`;
  const ownerOf = (result) => (result?.sales || []).find(s => s.email.toLowerCase() === owner.toLowerCase()) || null;

  useEffect(() => {
    let disposed = false;
    setLoading(true); setError(''); setSlot(null); setDay(''); setDayPage(0);
    apiClient.get(query).then(result => { if (!disposed) setData(result); })
      .catch(e => { if (!disposed) setError(e.message || 'Impossible de consulter l’agenda du commercial. Réessayez.'); })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [query, reload]);

  const sales = ownerOf(data);
  const name = lead.assigned_to_name || sales?.full_name || owner;
  const days = (sales?.days || []).filter(d => d.slots?.length).map(d => d.date);
  const page = Math.min(dayPage, Math.max(0, Math.ceil(days.length / 5) - 1));
  const shownDays = days.slice(page * 5, page * 5 + 5);
  const chosenDay = days.includes(day) ? day : shownDays[0];
  const times = sales?.days?.find(d => d.date === chosenDay)?.slots || [];

  async function save() {
    if (submitting.current || !slot) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const latest = await apiClient.get(query);
      setData(latest);
      if (!availableSelection(latest, { email: ownerOf(latest)?.email, date: slot.date, time: slot.time })) {
        setSlot(null);
        throw new Error('Ce créneau n’est plus disponible. Choisissez-en un autre.');
      }
      await onConfirm(`${slot.date}T${slot.time}`);
      onClose();
    } catch (e) {
      const detail = e?.data?.detail;
      setError((typeof detail === 'string' && detail) || e.message || 'Le report n’a pas été enregistré. Réessayez.');
    } finally { submitting.current = false; setBusy(false); }
  }

  return createPortal(<div className={`sj-overlay stj-overlay ${dark ? 'sj-dark' : ''}`} onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <section ref={ref} tabIndex={-1} className="sj-dialog stj-dialog stj-wide" role="dialog" aria-modal="true" aria-labelledby="stj-reschedule-title">
      <header className="sj-head"><span className="sj-icon"><CalendarClock size={24}/></span><div><small>PARCOURS SETTER</small><h2 id="stj-reschedule-title">Reporter le {label}</h2><p>{lead.full_name}{current ? ` · ${label} actuel : ${currentLabel(current)}` : ''}</p></div><button className="sj-close" onClick={onClose} disabled={busy} aria-label="Fermer"><X size={20}/></button></header>
      <div className="sj-body">
        <div className="stj-calendar">
          <div className="stj-calendar-bar"><div><CalendarDays size={17}/><strong>Agenda de {name}</strong><span>Heure de Paris</span></div><button aria-label="Actualiser les disponibilités" disabled={loading || busy} onClick={() => setReload(v => v + 1)}><RefreshCw size={16} className={loading ? 'stj-spin' : ''}/></button></div>
          <p className="stj-muted">Le {label} reste avec {name}. Seuls ses créneaux libres sont proposés : absences, rendez-vous, horaires et agenda Google sont pris en compte.</p>
          {loading && <div className="stj-empty" role="status"><LoaderCircle className="stj-spin" size={22}/> Consultation de l’agenda…</div>}
          {!loading && data && !sales && <p className="stj-empty">L’agenda de {name} n’est pas consultable pour ce lead.</p>}
          {!loading && sales && !sales.available && <p className="stj-unavailable">{sales.reason || 'Agenda indisponible. Réessayez dans un instant.'}</p>}
          {!loading && sales?.available && !days.length && <p className="stj-empty">Aucun créneau libre sur les 6 prochaines semaines.</p>}
          {!!days.length && <><div className="stj-week-nav"><button aria-label="Dates précédentes" disabled={busy || page === 0} onClick={() => {setDayPage(page - 1);setDay('');setSlot(null);}}><ChevronLeft size={17}/></button><span>6 semaines de disponibilités<small>{dateLabel(days[0])} – {dateLabel(days.at(-1))}</small></span><button aria-label="Dates suivantes" disabled={busy || (page + 1) * 5 >= days.length} onClick={() => {setDayPage(page + 1);setDay('');setSlot(null);}}><ChevronRight size={17}/></button></div><div className="stj-days" aria-label="Jours disponibles">{shownDays.map(d => <button key={d} disabled={busy} aria-pressed={chosenDay === d} onClick={() => { setDay(d); setSlot(null); }}><small>{dateLabel(d, { weekday: 'long', day: undefined, month: undefined })}</small><strong>{dateLabel(d, { weekday: undefined })}</strong></button>)}</div></>}
          {chosenDay && <div className="stj-sales-grid"><article className="stj-sales-card"><div className="stj-sales-name"><span>{name.slice(0, 1)}</span><div><strong>{name}</strong><small>{`${sales?.duration || 30} min · ${dateLabel(chosenDay)}`}</small></div></div>{times.length === 0 ? <p className="stj-muted">Aucun créneau disponible ce jour.</p> : <div className="stj-slots">{times.map(t => <button key={t} disabled={busy} aria-pressed={slot?.date === chosenDay && slot?.time === t} onClick={() => setSlot({ date: chosenDay, time: t })}>{t.replace(':', ' h ')}{slot?.date === chosenDay && slot?.time === t && <Check size={13}/>}</button>)}</div>}</article></div>}
        </div>
        {slot && <div className="stj-summary"><CalendarCheck2 size={20}/><span><strong>{dateLabel(slot.date, { weekday: 'long', year: 'numeric' })} à {slot.time.replace(':', ' h ')}</strong><small>Nouveau {label} avec {name} · heure de Paris</small></span></div>}
        {error && <p className="sj-error" role="alert">{error}</p>}
      </div>
      <footer className="sj-footer"><button disabled={busy} onClick={onClose}>Annuler</button><button className="sj-primary" disabled={busy || loading || !slot} onClick={save}>{busy ? <><LoaderCircle size={17} className="stj-spin"/> Enregistrement…</> : <>Confirmer le report<ChevronRight size={17}/></>}</button></footer>
    </section>
  </div>, document.body);
}
