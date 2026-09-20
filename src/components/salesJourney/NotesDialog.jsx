import React, {useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {MessageSquareText, X, Check} from 'lucide-react';
import {useDialogFocus} from './QualificationDialog';
import SalesNotes from './SalesNotes';
import DictationControl from './DictationControl';
export default function NotesDialog({lead,value,onChange,onClose,onSave,dark,error,recording,transcribing,micError,onDictate}) {
  const ref=useRef(null), [busy,setBusy]=useState(false);
  useDialogFocus(ref,onClose,busy||recording||transcribing);
  return createPortal(<div className={`sj-overlay ${dark?'sj-dark':''}`} onMouseDown={e=>{if(e.target===e.currentTarget&&!busy&&!recording&&!transcribing)onClose();}}><section className="sj-dialog sj-comments" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="sj-comments-title"><header className="sj-head"><span className="sj-icon"><MessageSquareText size={25}/></span><div><small>SUIVI CLIENT</small><h2 id="sj-comments-title">Commentaire</h2><p>{lead?.full_name}{lead?.company_name?` · ${lead.company_name}`:''}</p></div><button className="sj-close" aria-label="Fermer le commentaire" disabled={busy||recording||transcribing} onClick={onClose}><X size={19}/></button></header><div className="sj-body"><p className="sj-comment-hint">Les points clés du rendez-vous, les décisions et la prochaine étape.</p><SalesNotes value={value} onChange={onChange} dark={dark}/><DictationControl recording={recording} transcribing={transcribing} disabled={busy} onClick={onDictate}/><p className="sj-draft-hint">Brouillon conservé à la fermeture, jusqu’au rechargement de la page.</p>{micError&&<p role="alert" className="sj-error">{micError}</p>}{error&&<p role="alert" className="sj-error">{error}</p>}</div><footer className="sj-footer"><button disabled={busy||recording||transcribing} onClick={onClose}>Fermer</button><button className="sj-primary" disabled={busy||recording||transcribing} onClick={async()=>{setBusy(true);try{await onSave();}finally{setBusy(false);}}}><Check size={17}/>{busy?'Enregistrement…':'Enregistrer'}</button></footer></section></div>,document.body);
}
