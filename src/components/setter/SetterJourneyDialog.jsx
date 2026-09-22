import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, CalendarCheck2, CalendarDays, Check, ChevronRight, Clock3, LoaderCircle, Phone, PhoneMissed, RefreshCw, UserRoundX, UsersRound, X } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useDialogFocus } from '../salesJourney/QualificationDialog';
import { ParisDateTimeInput } from '../salesJourney/FrenchDateInput';
import { availableSelection, canChooseSales, setterAction } from '../../utils/setterJourney';
import './setterJourney.css';

const outcomes = [
  ['r1', 'Placer un R1', 'Premier rendez-vous avec un commercial', CalendarDays],
  ['r2', 'Placer un R2', 'Le prospect est prêt pour son audit', CalendarCheck2],
  ['voicemail', 'Répondeur', 'L’appel n’a pas abouti', PhoneMissed],
  ['callback', 'À rappeler', 'Convenir d’un prochain appel', Clock3],
  ['disqualify', 'Disqualifier', 'Indiquer pourquoi ce lead ne convient pas', UserRoundX],
];
const dateLabel = (day, opts = {}) => new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', ...opts });

export default function SetterJourneyDialog({ lead, currentEmail, onClose, onSaved, dark = false, browseOnly = false, asSetter = null }) {
  const [outcome, setOutcome] = useState(browseOnly ? 'r1' : '');
  const [slot, setSlot] = useState(null), [note, setNote] = useState(''), [email, setEmail] = useState(lead?.email || '');
  const [callback, setCallback] = useState(''), [targetCalendar, setTargetCalendar] = useState('sales');
  const [data, setData] = useState(null), [loading, setLoading] = useState(false), [reload, setReload] = useState(0);
  const [day, setDay] = useState(''), [salesFilter, setSalesFilter] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submitting = useRef(false), ref = useRef(null);
  useDialogFocus(ref, onClose, busy);
  const booking = outcome === 'r1' || outcome === 'r2';
  const chooseSales = browseOnly || canChooseSales(lead, currentEmail);
  const lockedEmail = chooseSales ? '' : lead?.assigned_to || '';
  const query = () => {
    const params = new URLSearchParams({ kind: outcome });
    if (lockedEmail) params.set('sales_email', lockedEmail);
    if (asSetter) params.set('as_setter', asSetter);
    return `/api/v1/tracking/setter/availability?${params}`;
  };
  useEffect(() => {
    if (!booking) return;
    let disposed = false;
    setLoading(true); setError(''); setData(null); setSlot(null); setDay('');
    apiClient.get(query()).then(result => { if (!disposed) setData(result); })
      .catch(e => { if (!disposed) setError(e.message || 'Impossible de consulter les agendas. Réessayez.'); })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [outcome, lockedEmail, asSetter, reload]);
  const sales = (data?.sales || []).filter(s => !salesFilter || s.email === salesFilter);
  const days = [...new Set(sales.flatMap(s => s.days?.map(d => d.date) || []))].sort();
  const chosenDay = days.includes(day) ? day : days[0];
  function selectOutcome(value) { setOutcome(value); setSlot(null); setError(''); setNote(''); }
  async function save() {
    if (submitting.current || browseOnly) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const action = setterAction({ lead, outcome, slot, note, email, callback, targetCalendar, currentEmail });
      if (booking) {
        const latest = await apiClient.get(query());
        setData(latest);
        if (!availableSelection(latest, slot)) { setSlot(null); throw new Error('Ce créneau n’est plus disponible. Choisissez-en un autre.'); }
      }
      if (action.email) await apiClient.patch(`/api/v1/tracking/leads/${lead.id}`, { email: action.email });
      await apiClient[action.method](action.path, action.body);
      onSaved?.(booking ? `${outcome.toUpperCase()} placé.` : outcome === 'disqualify' ? 'Lead disqualifié.' : outcome === 'callback' ? 'Rappel enregistré.' : 'Appel enregistré.');
      onClose();
    } catch (e) { setError(e.message || 'L’action n’a pas été enregistrée. Réessayez.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  return createPortal(<div className={`sj-overlay stj-overlay ${dark ? 'sj-dark' : ''}`} onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <section ref={ref} tabIndex={-1} className={`sj-dialog stj-dialog ${booking ? 'stj-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="stj-title">
      <header className="sj-head"><span className="sj-icon">{browseOnly ? <UsersRound size={24}/> : <Phone size={24}/>}</span><div><small>{browseOnly ? 'AGENDAS COMMERCIAUX' : 'PARCOURS SETTER'}</small><h2 id="stj-title">{browseOnly ? 'Disponibilités des sales' : 'Qualifier l’appel'}</h2><p>{browseOnly ? 'Consultez les créneaux à proposer pendant votre appel.' : lead?.full_name}</p></div><button className="sj-close" onClick={onClose} disabled={busy} aria-label="Fermer"><X size={20}/></button></header>
      <div className="sj-body">
        {!outcome && <><h3 className="stj-question">Quel est le résultat de l’appel ?</h3><div className="sj-options stj-outcomes">{outcomes.map(([value, title, desc, Icon]) => <button key={value} onClick={() => selectOutcome(value)}><Icon size={23}/><span><strong>{title}</strong><small>{desc}</small></span><ChevronRight size={17}/></button>)}</div></>}
        {outcome && <>
          {browseOnly ? <div className="sj-attendance" aria-label="Type de rendez-vous">{['r1', 'r2'].map(k => <button key={k} disabled={busy} aria-pressed={outcome === k} onClick={() => selectOutcome(k)}>{k.toUpperCase()} · {k === 'r1' ? 'Premier rendez-vous' : 'Audit'}</button>)}</div> : <div className="stj-step"><button disabled={busy} onClick={() => selectOutcome('')}><ArrowLeft size={16}/> Résultat de l’appel</button><strong>{outcomes.find(o => o[0] === outcome)?.[1]}</strong></div>}
          {booking && <div className="stj-calendar">
            <div className="stj-calendar-bar"><div><CalendarDays size={17}/><strong>Créneaux disponibles</strong><span>Heure de Paris</span></div><button aria-label="Actualiser les disponibilités" disabled={loading || busy} onClick={() => setReload(v => v + 1)}><RefreshCw size={16} className={loading ? 'stj-spin' : ''}/></button></div>
            {chooseSales && data?.sales?.length > 1 && <label className="stj-sales-filter">Commercial<select disabled={busy} value={salesFilter} onChange={e => { setSalesFilter(e.target.value); setSlot(null); }}>{<option value="">Tous mes commerciaux</option>}{data.sales.map(s => <option key={s.email} value={s.email}>{s.full_name || s.email}</option>)}</select></label>}
            {loading && <div className="stj-empty" role="status"><LoaderCircle className="stj-spin" size={22}/> Consultation des agendas…</div>}
            {!loading && data?.sales?.length === 0 && <p className="stj-empty">Aucun commercial rattaché à votre compte.</p>}
            {!!days.length && <div className="stj-days" aria-label="Jours disponibles">{days.map(d => <button key={d} disabled={busy} aria-pressed={chosenDay === d} onClick={() => { setDay(d); setSlot(null); }}><small>{dateLabel(d, { weekday: 'long', day: undefined, month: undefined })}</small><strong>{dateLabel(d, { weekday: undefined })}</strong></button>)}</div>}
            <div className="stj-sales-grid">{sales.map(s => { const times = s.days?.find(d => d.date === chosenDay)?.slots || []; return <article key={s.email} className="stj-sales-card"><div className="stj-sales-name"><span>{(s.full_name || s.email).slice(0, 1)}</span><div><strong>{s.full_name || s.email}</strong><small>{s.available ? `${s.duration} min · ${chosenDay ? dateLabel(chosenDay) : '21 prochains jours'}` : 'Disponibilité non vérifiée'}</small></div></div>{!s.available ? <p className="stj-unavailable">{s.reason}</p> : times.length === 0 ? <p className="stj-muted">Aucun créneau disponible{chosenDay ? ' ce jour' : ' sur cette période'}.</p> : <div className="stj-slots">{times.map(t => <button key={t} disabled={busy} aria-pressed={slot?.email === s.email && slot?.date === chosenDay && slot?.time === t} onClick={() => setSlot({ email: s.email, name: s.full_name, date: chosenDay, time: t })}>{t.replace(':', ' h ')}{slot?.email === s.email && slot?.date === chosenDay && slot?.time === t && <Check size={13}/>}</button>)}</div>}</article>; })}</div>
            {browseOnly && <p className="stj-muted">Consultation uniquement · Aucun rendez-vous n’est réservé ici.</p>}
          </div>}
          {!browseOnly && <>
            {slot && <div className="stj-summary"><CalendarCheck2 size={20}/><span><strong>{dateLabel(slot.date, { weekday: 'long', year: 'numeric' })} à {slot.time.replace(':', ' h ')}</strong><small>Avec {slot.name || slot.email} · heure de Paris</small></span></div>}
            {booking && <div className="stj-fields"><label>Email du prospect{outcome === 'r2' ? ' *' : ' (facultatif)'}<input type="email" disabled={busy} value={email} onChange={e => setEmail(e.target.value)} placeholder="prenom@entreprise.fr"/></label>{outcome === 'r1' && <label>Agenda du rendez-vous<select disabled={busy} value={targetCalendar} onChange={e => setTargetCalendar(e.target.value)}><option value="sales">Agenda du commercial</option><option value="setter">Mon agenda setter</option></select><small>Le réglage prioritaire du commercial reste appliqué.</small></label>}</div>}
            {outcome === 'callback' && <ParisDateTimeInput label="Date du rappel" value={callback} onChange={setCallback} disabled={busy}/>}
            <label className="stj-note">{outcome === 'disqualify' ? 'Raison de la disqualification *' : 'Note pour l’équipe (facultatif)'}<textarea rows={2} disabled={busy} value={note} onChange={e => setNote(e.target.value)} placeholder={outcome === 'disqualify' ? 'Expliquez pourquoi ce lead ne convient pas…' : 'Contexte de l’échange, points à transmettre…'}/></label>
          </>}
        </>}
        {error && <p className="sj-error" role="alert">{error}</p>}
      </div>
      <footer className="sj-footer"><button disabled={busy} onClick={onClose}>{browseOnly ? 'Fermer' : 'Annuler'}</button>{!browseOnly && outcome && <button className="sj-primary" disabled={busy || (booking && (!slot || loading))} onClick={save}>{busy ? <><LoaderCircle size={17} className="stj-spin"/> Enregistrement…</> : <>{booking ? `Confirmer le ${outcome.toUpperCase()}` : 'Enregistrer'}<ArrowRight size={17}/></>}</button>}</footer>
    </section>
  </div>, document.body);
}
