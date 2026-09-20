import React,{useEffect,useState,useRef} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';
import {frenchDate,parseFrenchDate,parisToday,minuteOptions} from '../../utils/parisDates';
import './frenchDateInput.css';
export default function FrenchDateInput({value,onChange,style,disabled,...props}){
 const [text,setText]=useState(frenchDate(value));
 const [open,setOpen]=useState(false);
 const [month,setMonth]=useState((value||parisToday()).slice(0,7));
 const root=useRef(null),input=useRef(null),emitted=useRef(value);
 useEffect(()=>{if(value!==emitted.current)setText(frenchDate(value));emitted.current=value;},[value]);
 useEffect(()=>{
  if(!open)return;
  const outside=e=>{if(!root.current?.contains(e.target))setOpen(false);};
  document.addEventListener('pointerdown',outside);
  return()=>document.removeEventListener('pointerdown',outside);
 },[open]);
 const choose=iso=>{emitted.current=iso;setText(frenchDate(iso));input.current?.setCustomValidity('');onChange(iso);setOpen(false);input.current?.focus();};
 const [year,m]=month.split('-').map(Number);
 const first=new Date(Date.UTC(year,m-1,1));
 const offset=(first.getUTCDay()+6)%7;
 const count=new Date(Date.UTC(year,m,0)).getUTCDate();
 const title=first.toLocaleDateString('fr-FR',{timeZone:'UTC',month:'long',year:'numeric'});
 const move=delta=>setMonth(new Date(Date.UTC(year,m-1+delta,1)).toISOString().slice(0,7));
 return <span className="fr-date-control" ref={root} style={style?{width:style.width,flexShrink:style.flexShrink}:undefined} onKeyDown={e=>{if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();setOpen(false);input.current?.focus();}}}>
 <input {...props} ref={input} disabled={disabled} style={style?{...style,width:'100%',paddingRight:32}:undefined} type="text" inputMode="numeric" placeholder="JJ/MM/AAAA" maxLength={10} value={text} onChange={e=>{
  const raw=e.target.value.replace(/[^0-9/.]/g,'');setText(raw);
  const iso=parseFrenchDate(raw);emitted.current=iso;e.target.setCustomValidity(raw&&!iso?'Saisissez une date valide au format JJ/MM/AAAA.':'');onChange(iso);
 }}/>
 <button type="button" className="fr-date-trigger" disabled={disabled} aria-label="Choisir une date dans le calendrier" aria-expanded={open} onClick={()=>{if(!open)setMonth((value||parisToday()).slice(0,7));setOpen(!open);}}><CalendarDays size={17}/></button>
 {open&&<span className="fr-calendar" role="group" aria-label="Calendrier français">
 <span className="fr-calendar-head"><button type="button" aria-label="Mois précédent" onClick={()=>move(-1)}><ChevronLeft size={18}/></button><strong aria-live="polite">{title}</strong><button type="button" aria-label="Mois suivant" onClick={()=>move(1)}><ChevronRight size={18}/></button></span>
 <span className="fr-calendar-grid">{['L','M','M','J','V','S','D'].map((d,i)=><small key={'w'+i}>{d}</small>)}{Array.from({length:offset},(_,i)=><span key={'blank'+i}/>)}{Array.from({length:count},(_,i)=>{
  const iso=`${month}-${String(i+1).padStart(2,'0')}`;
  return <button type="button" key={iso} aria-label={frenchDate(iso)} aria-pressed={value===iso} className={iso===parisToday()?'is-today':''} onClick={()=>choose(iso)}>{i+1}</button>;
 })}</span><button type="button" className="fr-calendar-today" onClick={()=>choose(parisToday())}>Aujourd’hui</button>
 </span>}
 </span>;
}
export function ParisDateTimeInput({value,onChange,disabled,label}){
 const [day,setDay]=useState(value?.slice(0,10)||'');
 const [hour,setHour]=useState(value?.slice(11,13)||'09');
 const [minute,setMinute]=useState(value?.slice(14,16)||'00');
 const update=(d,h,m)=>onChange(d?`${d}T${h}:${m}`:'');
 return <fieldset className="sj-paris-date" disabled={disabled}><legend>{label}</legend><div>
 <FrenchDateInput aria-label={label+' — date'} value={day} onChange={d=>{setDay(d);update(d,hour,minute);}}/>
 <select aria-label="Heure de Paris" value={hour} onChange={e=>{setHour(e.target.value);update(day,e.target.value,minute);}}>{Array.from({length:24},(_,i)=>String(i).padStart(2,'0')).map(h=><option key={h} value={h}>{h} h</option>)}</select>
 <select aria-label="Minutes" value={minute} onChange={e=>{setMinute(e.target.value);update(day,hour,e.target.value);}}>{minuteOptions(minute).map(m=><option key={m}>{m}</option>)}</select>
 </div><small>Heure de Paris · jour / mois / année</small></fieldset>;
}
