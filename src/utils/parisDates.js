// Appointment fields are legacy Paris wall-clock values, even when suffixed +00:00.
// Never convert those stored fields as instants. Audit: paris-date-audit.json.
export const PARIS_ZONE='Europe/Paris';
export function parisToday(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:PARIS_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const part=k=>parts.find(p=>p.type===k).value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}
export function frenchDate(value){return value?`${value.slice(8,10)}/${value.slice(5,7)}/${value.slice(0,4)}`:'';}
export function parseFrenchDate(value){
 const m=/^(\d{2})[/.](\d{2})[/.](\d{4})$/.exec(value);
 if(!m)return '';
 const iso=`${m[3]}-${m[2]}-${m[1]}`;
 const d=new Date(iso+'T12:00:00Z');
 return Number.isFinite(+d)&&d.toISOString().slice(0,10)===iso?iso:'';
}
export function validParisAppointment(value){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value||''))return false;
 const ms=Date.parse(value+'Z');
 if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,16)!==value)return false;
 // A Paris civil time has one or two matching instants; spring's missing hour has none.
 return [1,2].some(offset=>{
  const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:PARIS_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ms-offset*3600000));
  return parts.replace(' ','T')===value;
 });
}

// Server timestamps (created_at...) are real instants, unlike appointment fields: show them at Paris time.
export function parisInstantLabel(value){
 const d=value?new Date(value):null;
 if(!d||!Number.isFinite(d.getTime()))return '';
 const p=Object.fromEntries(new Intl.DateTimeFormat('fr-FR',{timeZone:PARIS_ZONE,day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(x=>[x.type,x.value]));
 return `${p.day}/${p.month}/${p.year} · ${p.hour}h${p.minute}`;
}

export function parisParts(date){return Object.fromEntries(new Intl.DateTimeFormat('fr-FR',{timeZone:PARIS_ZONE,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));}

export function minuteOptions(current='00'){
 const steps=Array.from({length:12},(_,i)=>String(i*5).padStart(2,'0'));
 // Display an existing off-step appointment faithfully, without offering every minute.
 return /^([0-5][0-9])$/.test(current)&&!steps.includes(current)?[...steps,current].sort():steps;
}
