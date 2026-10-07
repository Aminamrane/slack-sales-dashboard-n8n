import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, CalendarCheck2, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, LoaderCircle, Phone, PhoneMissed, RefreshCw, UserRoundX, UsersRound, X } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useDialogFocus } from '../salesJourney/QualificationDialog';
import { ParisDateTimeInput } from '../salesJourney/FrenchDateInput';
import { availableSelection, bookingSalesChoices, setterAction, singleBookingAction } from '../../utils/setterJourney';
import './setterJourney.css';

const outcomes = [
  ['r1', 'Placer un R1', 'Premier rendez-vous avec un commercial', CalendarDays],
  ['r2', 'Placer un R2', 'Le prospect est prêt pour son audit', CalendarCheck2],
  ['voicemail', 'Répondeur', 'L’appel n’a pas abouti', PhoneMissed],
  ['callback', 'À rappeler', 'Convenir d’un prochain appel', Clock3],
  ['disqualify', 'Disqualifier', 'Indiquer pourquoi ce lead ne convient pas', UserRoundX],
];
const dateLabel = (day, opts = {}) => new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', ...opts });

// `onBook` (prospection) : le R1 d'une entreprise qui n'est pas encore un lead ; la fenêtre s'ouvre sur
// « Placer un R1 » et confie l'enregistrement à `onBook(action)`, qui crée le lead avec le rendez-vous.
// Agenda unique (dev 06/10/2026) : pour un R1, le setter ne choisit plus le commercial. Il voit les créneaux où au
// moins un sales est libre (sans nom) et le serveur attribue le RDV (préférence de secteur, puis équité).
// `initialOutcome` : ouverture directe sur « Placer un R1 / R2 » (reprise d'un lead de Seconde chance) ;
// `lockSales` : un R2 repris se repose avec son commercial, seul agenda proposé.
export default function SetterJourneyDialog({ lead, teamSales = [], onClose, onSaved, dark = false, browseOnly = false, asSetter = null, prospect = null, onBook = null, initialOutcome = null, lockSales = null }) {
  const [outcome, setOutcome] = useState(initialOutcome || (browseOnly || onBook ? 'r1' : ''));
  const [slot, setSlot] = useState(null), [note, setNote] = useState(''), [email, setEmail] = useState(lead?.email || '');
  const [callback, setCallback] = useState(''), [targetCalendar, setTargetCalendar] = useState('sales');
  const [data, setData] = useState(null), [loading, setLoading] = useState(false), [reload, setReload] = useState(0);
  const [dayPage, setDayPage] = useState(0);
  const [bookingMode, setBookingMode] = useState('available');
  const [manualDate, setManualDate] = useState(''), [manualSales, setManualSales] = useState('');
  const [day, setDay] = useState(''), [salesFilter, setSalesFilter] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submitting = useRef(false), ref = useRef(null);
  useDialogFocus(ref, onClose, busy);
  const booking = outcome === 'r1' || outcome === 'r2';
  const single = outcome === 'r1';
  const query = () => {
    const params = new URLSearchParams({ kind: outcome });
    if (single && onBook && prospect?.itemId) return `/api/v1/prospection/items/${prospect.itemId}/agenda`;
    if (!browseOnly && !onBook && lead?.id) params.set('lead_id', String(lead.id));
    if (!single && lockSales) params.set('sales_email', lockSales);
    if (asSetter) params.set('as_setter', asSetter);
    return `/api/v1/tracking/setter/${single ? 'agenda' : 'availability'}?${params}`;
  };
  useEffect(() => {
    if (!booking || bookingMode === 'manual') { setLoading(false); return; }
    let disposed = false;
    setLoading(true); setError(''); setData(null); setSlot(null); setDay(''); setDayPage(0);
    apiClient.get(query()).then(result => { if (!disposed) setData(result); })
      .catch(e => { if (!disposed) setError(e.message || 'Impossible de consulter les agendas. Réessayez.'); })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [outcome, lead?.id, asSetter, reload, bookingMode]);
  // Lead webinaire (dev 07/10/2026) : seuls les sales prioritaires renvoyés par le serveur, jamais le propriétaire actuel.
  const manualOptions = data?.webinar ? bookingSalesChoices({}, data.sales || []) : bookingSalesChoices(lead, teamSales.length ? teamSales : data?.sales || []);
  const manualEmail = manualSales || (manualOptions.length === 1 ? manualOptions[0].email : '');
  const selectedSlot = bookingMode === 'manual' ? (manualEmail && manualDate ? { email: manualEmail, name: manualOptions.find(s => s.email === manualEmail)?.name || manualEmail, date: manualDate.slice(0, 10), time: manualDate.slice(11, 16) } : null) : slot;
  const sales = single ? [] : (data?.sales || []).filter(s => !salesFilter || s.email === salesFilter);
  const days = single ? (data?.days || []).filter(d => d.slots?.length).map(d => d.date) : [...new Set(sales.flatMap(s => s.days?.map(d => d.date) || []))].sort();
  const page = Math.min(dayPage, Math.max(0, Math.ceil(days.length / 5) - 1));
  const shownDays = days.slice(page * 5, page * 5 + 5);
  const chosenDay = days.includes(day) ? day : shownDays[0];
  const singleTimes = single ? ((data?.days || []).find(d => d.date === chosenDay)?.slots || []).map(x => x.time) : [];
  function selectOutcome(value) { setOutcome(value); setSlot(null); setError(''); setNote(''); if (value === 'r1') setBookingMode('available'); }
  async function save() {
    if (submitting.current || browseOnly) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      if (single && bookingMode === 'available') {
        const action = singleBookingAction({ lead: lead || {}, slot: selectedSlot, note, email, prospect: !!onBook });
        if (onBook) await onBook(action);
        else {
          if (action.email) await apiClient.patch(`/api/v1/tracking/leads/${lead.id}`, { email: action.email });
          const booked = await apiClient.post(action.path, action.body);
          onSaved?.(`R1 placé avec ${booked?.sales_full_name || booked?.sales_email || 'un commercial'}.`);
          onClose();
          return;
        }
        onSaved?.('R1 placé.');
        onClose();
        return;
      }
      const action = setterAction({ lead: lead || {}, outcome, slot: selectedSlot, note, email, callback, targetCalendar });
      if (booking && bookingMode === 'available') {
        const latest = await apiClient.get(query());
        setData(latest);
        if (!availableSelection(latest, slot)) { setSlot(null); throw new Error('Ce créneau n’est plus disponible. Choisissez-en un autre.'); }
      }
      if (onBook) await onBook(action);
      else {
        if (action.email) await apiClient.patch(`/api/v1/tracking/leads/${lead.id}`, { email: action.email });
        await apiClient[action.method](action.path, action.body);
      }
      onSaved?.(booking ? `${outcome.toUpperCase()} placé.` : outcome === 'disqualify' ? 'Lead disqualifié.' : outcome === 'callback' ? 'Rappel enregistré.' : 'Appel enregistré.');
      onClose();
    } catch (e) { setError(e.message || 'L’action n’a pas été enregistrée. Réessayez.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return createPortal(<div className={`sj-overlay stj-overlay ${dark ? 'sj-dark' : ''}`} onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <section ref={ref} tabIndex={-1} className={`sj-dialog stj-dialog ${booking ? 'stj-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="stj-title">
      <header className="sj-head"><span className="sj-icon">{browseOnly ? <UsersRound size={24}/> : <Phone size={24}/>}</span><div><small>{browseOnly ? 'AGENDAS COMMERCIAUX' : onBook ? 'PROSPECTION' : 'PARCOURS SETTER'}</small><h2 id="stj-title">{browseOnly ? 'Disponibilités des sales' : onBook ? 'Prendre le rendez-vous' : 'Qualifier l’appel'}</h2><p>{browseOnly ? 'Consultez les créneaux à proposer pendant votre appel.' : onBook ? prospect?.name : lead?.full_name}</p></div><button className="sj-close" onClick={onClose} disabled={busy} aria-label="Fermer"><X size={20}/></button></header>
      <div className="sj-body">
        {!outcome && <><h3 className="stj-question">Quel est le résultat de l’appel ?</h3><div className="sj-options stj-outcomes">{outcomes.map(([value, title, desc, Icon]) => <button key={value} onClick={() => selectOutcome(value)}><Icon size={23}/><span><strong>{title}</strong><small>{desc}</small></span><ChevronRight size={17}/></button>)}</div></>}
        {outcome && <>
          {browseOnly ? <div className="sj-attendance" aria-label="Type de rendez-vous">{['r1', 'r2'].map(k => <button key={k} disabled={busy} aria-pressed={outcome === k} onClick={() => selectOutcome(k)}>{k.toUpperCase()} · {k === 'r1' ? 'Premier rendez-vous' : 'Audit'}</button>)}</div> : <div className="stj-step">{!onBook && <button disabled={busy} onClick={() => selectOutcome('')}><ArrowLeft size={16}/> Résultat de l’appel</button>}<strong>{outcomes.find(o => o[0] === outcome)?.[1]}</strong></div>}
          {booking && !single && !browseOnly && !lockSales && <div className="sj-attendance stj-booking-mode" aria-label="Mode de réservation"><button disabled={busy} aria-pressed={bookingMode === 'available'} onClick={() => {setBookingMode('available');setError('');}}><CalendarDays size={18}/> Créneaux disponibles</button><button disabled={busy} aria-pressed={bookingMode === 'manual'} onClick={() => {setBookingMode('manual');setError('');}}><Clock3 size={18}/> Forcer un rendez-vous</button></div>}
          {booking && bookingMode === 'manual' && !browseOnly && <div className="stj-manual"><p className="stj-muted">Avec l’accord du sales, placez le rendez-vous à l’heure convenue, même hors de ses disponibilités.</p>{<label className="stj-sales-filter">Commercial<select aria-label="Commercial pour le rendez-vous manuel" disabled={busy} value={manualEmail} onChange={e => setManualSales(e.target.value)}><option value="">Choisir un commercial</option>{manualOptions.map(s => <option key={s.email} value={s.email}>{s.name}</option>)}</select></label>}<ParisDateTimeInput label="Date et heure convenues" value={manualDate} onChange={setManualDate} disabled={busy}/></div>}
          {booking && bookingMode === 'available' && <div className="stj-calendar">
            <div className="stj-calendar-bar"><div><CalendarDays size={17}/><strong>Créneaux disponibles</strong><span>Heure de Paris</span></div><button aria-label="Actualiser les disponibilités" disabled={loading || busy} onClick={() => setReload(v => v + 1)}><RefreshCw size={16} className={loading ? 'stj-spin' : ''}/></button></div>
            {!single && !lockSales && data?.sales?.length > 1 && <label className="stj-sales-filter">Commercial<select disabled={busy} value={salesFilter} onChange={e => { setSalesFilter(e.target.value); setSlot(null); setDay(''); setDayPage(0); }}>{<option value="">Tous mes commerciaux</option>}{data.sales.map(s => <option key={s.email} value={s.email}>{s.full_name || s.email}</option>)}</select></label>}
            {loading && <div className="stj-empty" role="status"><LoaderCircle className="stj-spin" size={22}/> Consultation des agendas…</div>}
            {!loading && !single && data?.sales?.length === 0 && <p className="stj-empty">Aucun commercial rattaché à votre compte.</p>}
            {!loading && single && data && !days.length && <p className="stj-empty">Aucun créneau libre sur les 6 prochaines semaines.</p>}
            {single && data?.owner_kept && <p className="stj-muted">Ce lead est déjà suivi par son commercial : le rendez-vous sera posé dans son agenda.</p>}
            {data?.webinar && <p className="stj-muted">Lead webinaire : seuls les commerciaux prioritaires peuvent recevoir ce rendez-vous.</p>}
            {!!days.length && <><div className="stj-week-nav"><button aria-label="Dates précédentes" disabled={busy || page === 0} onClick={() => {setDayPage(page - 1);setDay('');setSlot(null);}}><ChevronLeft size={17}/></button><span>6 semaines de disponibilités<small>{dateLabel(days[0])} – {dateLabel(days.at(-1))}</small></span><button aria-label="Dates suivantes" disabled={busy || (page + 1) * 5 >= days.length} onClick={() => {setDayPage(page + 1);setDay('');setSlot(null);}}><ChevronRight size={17}/></button></div><div className="stj-days" aria-label="Jours disponibles">{shownDays.map(d => <button key={d} disabled={busy} aria-pressed={chosenDay === d} onClick={() => { setDay(d); setSlot(null); }}><small>{dateLabel(d, { weekday: 'long', day: undefined, month: undefined })}</small><strong>{dateLabel(d, { weekday: undefined })}</strong></button>)}</div></>}
            {single && chosenDay && <div className="stj-sales-grid"><article className="stj-sales-card"><div className="stj-sales-name"><span><UsersRound size={16}/></span><div><strong>Tous les commerciaux</strong><small>{`${data?.duration || 30} min · ${dateLabel(chosenDay)} · commercial attribué automatiquement`}</small></div></div>{singleTimes.length === 0 ? <p className="stj-muted">Aucun créneau disponible ce jour.</p> : <div className="stj-slots">{singleTimes.map(t => <button key={t} disabled={busy || browseOnly} aria-pressed={slot?.date === chosenDay && slot?.time === t} onClick={() => setSlot({ email: '', name: '', date: chosenDay, time: t })}>{t.replace(':', ' h ')}{slot?.date === chosenDay && slot?.time === t && <Check size={13}/>}</button>)}</div>}</article></div>}
            <div className="stj-sales-grid">{sales.map(s => { const times = s.days?.find(d => d.date === chosenDay)?.slots || []; return <article key={s.email} className="stj-sales-card"><div className="stj-sales-name"><span>{(s.full_name || s.email).slice(0, 1)}</span><div><strong>{s.full_name || s.email}</strong><small>{s.available ? `${s.duration} min · ${chosenDay ? dateLabel(chosenDay) : '6 prochaines semaines'}` : 'Disponibilité non vérifiée'}</small></div></div>{!s.available ? <p className="stj-unavailable">{s.reason}</p> : times.length === 0 ? <p className="stj-muted">Aucun créneau disponible{chosenDay ? ' ce jour' : ' sur cette période'}.</p> : <div className="stj-slots">{times.map(t => <button key={t} disabled={busy} aria-pressed={slot?.email === s.email && slot?.date === chosenDay && slot?.time === t} onClick={() => setSlot({ email: s.email, name: s.full_name, date: chosenDay, time: t })}>{t.replace(':', ' h ')}{slot?.email === s.email && slot?.date === chosenDay && slot?.time === t && <Check size={13}/>}</button>)}</div>}</article>; })}</div>
            {browseOnly && <p className="stj-muted">Consultation uniquement · Aucun rendez-vous n’est réservé ici.</p>}
          </div>}
          {!browseOnly && <>
            {selectedSlot && <div className="stj-summary"><CalendarCheck2 size={20}/><span><strong>{dateLabel(selectedSlot.date, { weekday: 'long', year: 'numeric' })} à {selectedSlot.time.replace(':', ' h ')}</strong><small>{single && bookingMode === 'available' ? 'Commercial attribué automatiquement' : `Avec ${selectedSlot.name || selectedSlot.email}`} · heure de Paris</small></span></div>}
            {booking && <div className="stj-fields"><label>Email du prospect{outcome === 'r2' ? ' *' : ' (facultatif)'}<input type="email" disabled={busy} value={email} onChange={e => setEmail(e.target.value)} placeholder="prenom@entreprise.fr"/></label>{outcome === 'r1' && !single && <label>Agenda du rendez-vous<select disabled={busy} value={targetCalendar} onChange={e => setTargetCalendar(e.target.value)}><option value="sales">Agenda du commercial</option><option value="setter">Mon agenda setter</option></select><small>Le réglage prioritaire du commercial reste appliqué.</small></label>}</div>}
            {outcome === 'callback' && <ParisDateTimeInput label="Date du rappel" value={callback} onChange={setCallback} disabled={busy}/>}
            <label className="stj-note">{outcome === 'disqualify' ? 'Raison de la disqualification *' : 'Note pour l’équipe (facultatif)'}<textarea rows={2} disabled={busy} value={note} onChange={e => setNote(e.target.value)} placeholder={outcome === 'disqualify' ? 'Expliquez pourquoi ce lead ne convient pas…' : 'Contexte de l’échange, points à transmettre…'}/></label>
          </>}
        </>}
        {error && <p className="sj-error" role="alert">{error}</p>}
      </div>
      <footer className="sj-footer"><button disabled={busy} onClick={onClose}>{browseOnly ? 'Fermer' : 'Annuler'}</button>{!browseOnly && outcome && <button className="sj-primary" disabled={busy || (booking && (!selectedSlot || (bookingMode === 'available' && loading)))} onClick={save}>{busy ? <><LoaderCircle size={17} className="stj-spin"/> Enregistrement…</> : <>{booking ? `${bookingMode === 'manual' ? 'Placer' : 'Confirmer'} le ${outcome.toUpperCase()}` : 'Enregistrer'}<ArrowRight size={17}/></>}</button>}</footer>
    </section>
  </div>, document.body);
}
