import { Rational } from './calculation.js';
export function parisDateKey(now=new Date()) {
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function onboardingDay(raw){
 const s=String(raw||'').trim();let iso;
 if(/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(s))iso=s.slice(0,10);
 else {const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(m)iso=`${m[3]}-${m[2]}-${m[1]}`;}
 if(!iso)return null;
 const date=new Date(iso+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===iso?iso:null;
}
export function financeStatus(finance,today=parisDateKey()) {
 if(!finance||finance.receivedOwner==null)return {key:'unknown',label:'Finance à rapprocher',counted:false};
 let received;
 try{received=Rational.from(finance.receivedOwner);}catch{return {key:'unknown',label:'Finance à vérifier',counted:false};}
 if(received.n>0n)return {key:'paid',label:'Encaissement Owner',counted:true};
 const day=onboardingDay(finance.onboardingOwner);
 if(!day)return {key:'unknown',label:'Onboarding non renseigné',counted:false};
 // Finance uses calendar days in Paris; no browser-local UTC conversion.
 return day>today?{key:'upcoming',label:'Onboarding à venir',counted:false}:{key:'late',label:'Client en retard',counted:false};
}
