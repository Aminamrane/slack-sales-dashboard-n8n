import React, {useEffect,useState} from 'react';
import {Mic, Square, LoaderCircle} from 'lucide-react';
export default function DictationControl({recording,transcribing,disabled,onClick}) {
 const [seconds,setSeconds]=useState(0);
 useEffect(()=>{setSeconds(0);if(!recording&&!transcribing)return;const started=Date.now();const timer=setInterval(()=>setSeconds(Math.floor((Date.now()-started)/1000)),1000);return()=>clearInterval(timer);},[recording,transcribing]);
 const time=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
 return <div className={`sj-dictation ${recording?'is-recording':''} ${transcribing?'is-transcribing':''}`}>
  <button type="button" disabled={disabled||transcribing} onClick={onClick} aria-label={recording?'Terminer la dictée et insérer le texte':transcribing?'Transcription en cours':'Dicter un commentaire'}>{transcribing?<LoaderCircle size={18} className="sj-spin"/>:recording?<Square size={16}/>:<Mic size={18}/>}<span>{recording?'Terminer':transcribing?'Transcription…':'Dicter'}</span>{(recording||transcribing)&&<time>{time}</time>}</button>
  <span className="sj-dictation-hint" role="status">{recording?'Parlez, puis terminez pour insérer votre texte.':transcribing?'Votre texte va apparaître directement dans le commentaire.':'Votre voix devient du texte dans le commentaire.'}</span>
 </div>;
}
