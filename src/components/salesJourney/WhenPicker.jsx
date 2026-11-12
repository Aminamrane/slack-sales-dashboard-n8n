import React, { useState } from 'react';
import FrenchDateInput from './FrenchDateInput';
import { parisToday, minuteOptions } from '../../utils/parisDates';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const QUARTERS = ['00', '15', '30', '45'];
const pad = n => String(n).padStart(2, '0');

// Jour et heure d'un rendez-vous, dans les fenêtres de qualification (11/11/2026). Même geste que dans la fiche du lead :
// les sept prochains jours en pastilles (une autre date par le calendrier), les heures de bureau en grille, les quarts
// d'heure en dessous ; la phrase du haut redit le rendez-vous tel qu'il sera enregistré. Même contrat que l'ancien
// sélecteur à listes déroulantes : rien n'est rendu tant qu'aucun jour n'est choisi, puis « AAAA-MM-JJTHH:MM »
// (heure de Paris), 09h00 par défaut.
export default function WhenPicker({ value, onChange, disabled, label }) {
  const [day, setDay] = useState(value?.slice(0, 10) || '');
  const [hour, setHour] = useState(value?.slice(11, 13) || '09');
  const [minute, setMinute] = useState(value?.slice(14, 16) || '00');
  const [allHours, setAllHours] = useState(() => Number(hour) < 8 || Number(hour) > 19);
  const [allMinutes, setAllMinutes] = useState(() => !QUARTERS.includes(minute));
  const set = (d, h, m) => { setDay(d); setHour(h); setMinute(m); onChange(d ? `${d}T${h}:${m}` : ''); };
  const today = parisToday();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() + i);
    return { iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, week: i === 0 ? 'auj.' : d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''), num: d.getDate(), weekend: [0, 6].includes(d.getDay()) };
  });
  const hours = allHours ? HOURS : HOURS.slice(8, 20);
  const minutes = allMinutes ? minuteOptions(minute) : QUARTERS;
  const spoken = day ? new Date(`${day}T12:00:00`) : null;
  return (
    <fieldset className="sj-when" disabled={disabled}>
      <legend>{label}</legend>
      <p className={`sj-when-said${spoken ? '' : ' is-empty'}`} aria-live="polite">
        {spoken && !Number.isNaN(spoken.getTime())
          ? <>{spoken.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}<span> à {hour}h{minute}</span></>
          : 'Choisissez un jour'}
      </p>
      <div className="sj-when-head"><span>Jour</span>
        <span className="sj-when-other" title="Choisir une autre date">
          <FrenchDateInput aria-label={`${label} : autre date`} floating value={day} onChange={d => set(d, hour, minute)}
            style={{ width: 132, flexShrink: 0, padding: '5px 4px 5px 8px', borderRadius: 9, border: '1px solid var(--sj-line)', background: 'var(--sj-bg)', color: 'var(--sj-text)', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', outline: 'none' }} />
        </span>
      </div>
      <div className="sj-when-grid sj-when-days">
        {days.map(d => <button key={d.iso} type="button" aria-pressed={d.iso === day} className={d.weekend ? 'is-weekend' : undefined} onClick={() => set(d.iso, hour, minute)}><small>{d.week}</small>{d.num}</button>)}
      </div>
      <div className="sj-when-head"><span>Heure</span><button type="button" onClick={() => setAllHours(v => !v)}>{allHours ? 'Heures de bureau' : 'Autres heures'}</button></div>
      <div className="sj-when-grid sj-when-hours">
        {hours.map(h => <button key={h} type="button" aria-pressed={h === hour} onClick={() => set(day, h, minute)}>{h}h</button>)}
      </div>
      <div className="sj-when-head"><span>Minutes</span><button type="button" onClick={() => setAllMinutes(v => !v)}>{allMinutes ? 'Par quart d’heure' : 'Par 5 min'}</button></div>
      <div className={`sj-when-grid sj-when-minutes${allMinutes ? ' is-all' : ''}`}>
        {minutes.map(m => <button key={m} type="button" aria-pressed={m === minute} onClick={() => set(day, hour, m)}>{m}</button>)}
      </div>
    </fieldset>
  );
}
