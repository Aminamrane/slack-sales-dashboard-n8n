import React, {useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X, Check} from 'lucide-react';
import {useDialogFocus} from './QualificationDialog';
import SalesNotes from './SalesNotes';
import DictationControl from './DictationControl';
import useFoldClose from './useFoldClose';

// Fenêtre de commentaire. À la fermeture, elle redescend vers l'endroit d'où elle a été ouverte (le bouton ou la
// note cliqués), comme une fenêtre qu'on range : on retient la position de l'élément actif au montage, avant que
// la fenêtre ne prenne le focus. `onSave` rend vrai quand l'enregistrement a réussi ; la fenêtre se ferme alors
// elle-même. `liveText` : ce que la dictée entend, affiché pendant qu'on parle.
export default function NotesDialog({lead,value,onChange,onClose,onSave,dark,error,recording,transcribing,liveText,micError,onDictate}) {
  const ref=useRef(null), [busy,setBusy]=useState(false);
  const {closing,close,style}=useFoldClose(ref,onClose);
  const locked=busy||recording||transcribing||closing;
  useDialogFocus(ref,close,locked);
  const save=async()=>{setBusy(true);let saved=false;try{saved=await onSave();}finally{setBusy(false);}if(saved)close();};
  return createPortal(
    <div className={`sj-overlay ${dark?'sj-dark':''} ${closing?'is-closing':''}`} onMouseDown={e=>{if(e.target===e.currentTarget&&!locked)close();}}>
      <section className="sj-dialog sj-comments" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="sj-comments-title"
        style={style}>
        {/* Fenêtre épurée (référence du dev : une carte de saisie, ses actions dans la carte) : un titre, la carte, rien d'autre. */}
        <header className="sj-comments-head">
          <div><h2 id="sj-comments-title">Commentaire</h2><p>{lead?.full_name}{lead?.company_name?` · ${lead.company_name}`:''}</p></div>
          <button className="sj-comments-close" aria-label="Fermer le commentaire" disabled={locked} onClick={close}><X size={18}/></button>
        </header>
        <div className="sj-comments-body">
          <SalesNotes value={value} onChange={onChange} dark={dark} placeholder="Les points clés du rendez-vous, les décisions, la prochaine étape…"
            top={(recording||transcribing)&&<p className={`sj-live ${transcribing?'is-done':''}`} role="status" aria-live="polite"><i aria-hidden="true"/>{liveText||(recording?'Je vous écoute…':'Mise au propre du texte…')}</p>}
            tools={<>
              <DictationControl compact recording={recording} transcribing={transcribing} disabled={busy||closing} onClick={onDictate}/>
              <button type="button" className="sj-send" disabled={locked} onClick={save} title="Enregistrer le commentaire"><Check size={16}/><span>{busy?'Enregistrement…':'Enregistrer'}</span></button>
            </>}/>
          {micError&&<p role="alert" className="sj-error">{micError}</p>}
          {error&&<p role="alert" className="sj-error">{error}</p>}
          <p className="sj-draft-hint">Brouillon conservé à la fermeture, jusqu’au rechargement de la page.</p>
        </div>
      </section>
    </div>,document.body);
}
