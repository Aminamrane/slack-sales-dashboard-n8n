import React,{useEffect,useState,useRef} from 'react';
import {frenchDate,parseFrenchDate} from '../../utils/parisDates';
export default function FrenchDateInput({value,onChange,...props}){
 const [text,setText]=useState(frenchDate(value));
 const emitted=useRef(value);
 useEffect(()=>{if(value!==emitted.current)setText(frenchDate(value));emitted.current=value;},[value]);
 return <input {...props} type="text" inputMode="numeric" placeholder="JJ/MM/AAAA" maxLength={10} value={text} onChange={e=>{
  const raw=e.target.value.replace(/[^0-9/.]/g,'');setText(raw);
  const iso=parseFrenchDate(raw);emitted.current=iso;e.target.setCustomValidity(raw&&!iso?'Saisissez une date valide au format JJ/MM/AAAA.':'');onChange(iso);
 }} onBlur={e=>{if(text&&!parseFrenchDate(text))e.target.reportValidity();}}/>;
}
export function ParisDateTimeInput({value,onChange,disabled,label}){
 const [day,setDay]=useState(value?.slice(0,10)||'');
 const [hour,setHour]=useState(value?.slice(11,13)||'09');
 const [minute,setMinute]=useState(value?.slice(14,16)||'00');
 const update=(d,h,m)=>onChange(d?`${d}T${h}:${m}`:'');
 return <fieldset className="sj-paris-date" disabled={disabled}><legend>{label}</legend><div>
 <FrenchDateInput aria-label={label+' — date'} value={day} onChange={d=>{setDay(d);update(d,hour,minute);}}/>
 <select aria-label="Heure de Paris" value={hour} onChange={e=>{setHour(e.target.value);update(day,e.target.value,minute);}}>{Array.from({length:24},(_,i)=>String(i).padStart(2,'0')).map(h=><option key={h} value={h}>{h} h</option>)}</select>
 <select aria-label="Minutes" value={minute} onChange={e=>{setMinute(e.target.value);update(day,hour,e.target.value);}}>{Array.from({length:60},(_,i)=>String(i).padStart(2,'0')).map(m=><option key={m}>{m}</option>)}</select>
 </div><small>Heure de Paris · jour / mois / année</small></fieldset>;
}
