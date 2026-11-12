import React, {useEffect,useState} from 'react';
import {Mic, Square, LoaderCircle} from 'lucide-react';
// `liveText` : ce que le navigateur entend pendant la dictée, affiché au fil de la voix (la transcription finale le remplace).
export default function DictationControl({recording,transcribing,liveText,disabled,onClick,compact=false}) {
 const [seconds,setSeconds]=useState(0);
 useEffect(()=>{setSeconds(0);if(!recording&&!transcribing)return;const started=Date.now();const timer=setInterval(()=>setSeconds(Math.floor((Date.now()-started)/1000)),1000);return()=>clearInterval(timer);},[recording,transcribing]);
 const time=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
 // `compact` : le bouton seul, pour la barre d'outils de la fenêtre de commentaire (le texte en direct s'affiche dans la carte).
 if(compact)return <button type="button" className={`sj-dictate ${recording?'is-recording':''} ${transcribing?'is-transcribing':''}`} disabled={disabled||transcribing} onMouseDown={e=>e.preventDefault()} onClick={onClick} title={recording?'Terminer la dictée':'Dicter : le texte s’écrit pendant que vous parlez'} aria-label={recording?'Terminer la dictée et insérer le texte':transcribing?'Transcription en cours':'Dicter un commentaire'}>{transcribing?<LoaderCircle size={16} className="sj-spin"/>:recording?<Square size={13}/>:<Mic size={16}/>}<span>{recording?'Terminer':transcribing?'Transcription…':'Dicter'}</span>{(recording||transcribing)&&<time>{time}</time>}</button>;
 return <div className={`sj-dictation ${recording?'is-recording':''} ${transcribing?'is-transcribing':''}`}>
  <button type="button" disabled={disabled||transcribing} onClick={onClick} aria-label={recording?'Terminer la dictée et insérer le texte':transcribing?'Transcription en cours':'Dicter un commentaire'}>{transcribing?<LoaderCircle size={18} className="sj-spin"/>:recording?<Square size={16}/>:<Mic size={18}/>}<span>{recording?'Terminer':transcribing?'Transcription…':'Dicter'}</span>{(recording||transcribing)&&<time>{time}</time>}</button>
  {(recording||transcribing)&&liveText?<span className="sj-dictation-live" role="status" aria-live="polite"><i aria-hidden="true"/>{liveText}</span>:<span className="sj-dictation-hint" role="status">{recording?'Parlez : votre texte s’affiche ici au fil de la voix.':transcribing?'Votre texte va apparaître directement dans le commentaire.':'Votre voix devient du texte dans le commentaire.'}</span>}
 </div>;
}
