import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Paperclip, X } from 'lucide-react';
import { MESSAGE_FILE_ACCEPT, MESSAGE_FILE_MAX, uploadMessageFile } from './BoardClientFiles.jsx';

// Passage « En cours de résiliation » (dev 17/11/2026) : avant d'enregistrer, le mail de résiliation du client
// (obligatoire) et l'appel (facultatif). Mêmes formats et limite que les pièces des messages du board ; déposés par la
// route des pièces jointes du fil, puis portés par le message « Passage en cours de résiliation ». Même patron que la
// décision financière d'une sortie (BoardFinanceExitDialog).
const field = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #e3ded6', borderRadius: 8, font: 'inherit', cursor: 'pointer', background: '#fff' };
const button = { padding: '9px 16px', border: '1px solid #e3ded6', borderRadius: 10, font: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer', background: '#fff', color: '#2b2927' };
const size = (b) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} Ko` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`);

function FilePick({ label, hint, file, onPick, disabled }) {
  const input = useRef(null);
  return <div style={{ marginTop: 16 }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13, fontWeight: 500 }}>{label}<small style={{ color: '#8b867e', fontWeight: 400 }}>{hint}</small></div>
    <button type="button" disabled={disabled} onClick={() => input.current?.click()} aria-label={`${label} (${hint})`}
      style={{ ...field, marginTop: 6, opacity: disabled ? 0.6 : 1, textAlign: 'left' }}>
      <Paperclip size={15} color="#8b867e" aria-hidden="true" />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: file ? '#2b2927' : '#8b867e', fontSize: 13 }}>
        {file ? file.name : 'Choisir un fichier (PDF, image, e-mail, audio · 20 Mo au plus)'}
      </span>
      {file && <small style={{ color: '#8b867e' }}>{size(file.size)}</small>}
    </button>
    <input ref={input} type="file" hidden accept={MESSAGE_FILE_ACCEPT} onChange={e => { onPick(e.target.files?.[0] || null); e.target.value = ''; }} />
  </div>;
}

export function BoardResiliationDialog({ numero, payload, onResolve }) {
  const [mail, setMail] = useState(null), [call, setCall] = useState(null);
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.focus();
    return () => previous?.focus?.();
  }, []);
  const pick = (set) => (file) => { setError(file && file.size > MESSAGE_FILE_MAX ? `${file.name} dépasse 20 Mo.` : ''); set(file && file.size <= MESSAGE_FILE_MAX ? file : null); };
  const confirm = async () => {
    if (!mail || saving) return;
    setSaving(true); setError('');
    try {
      const ids = [];
      for (const file of [mail, call].filter(Boolean)) ids.push((await uploadMessageFile(numero, file)).id);
      onResolve({ ...payload, attachment_ids: ids });
    } catch (e) {
      setError(e?.message || 'Le fichier n’a pas pu être déposé. Réessayez.');
      setSaving(false);
    }
  };
  const keyDown = e => {
    if (e.key === 'Escape' && !saving) { e.stopPropagation(); onResolve(null); }
    if (e.key === 'Tab') {
      const els = [...dialog.current.querySelectorAll('button')].filter(el => !el.disabled);
      const first = els[0], last = els.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  };
  return <div style={{ position: 'fixed', inset: 0, zIndex: 10100, background: '#2b292766', display: 'grid', placeItems: 'center', padding: 16 }}>
    <section role="dialog" aria-modal="true" aria-labelledby="resiliation-title" ref={dialog} tabIndex={-1} onKeyDown={keyDown}
      style={{ background: '#fff', color: '#2b2927', borderRadius: 22, width: 'min(520px,100%)', maxHeight: '90vh', overflow: 'auto', padding: 24, boxSizing: 'border-box', font: '14px/1.5 Inter, system-ui, sans-serif', boxShadow: '0 20px 80px rgba(28,27,25,.14)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 16 }}>
        <div><h2 id="resiliation-title" style={{ margin: 0, fontSize: 20 }}>{payload.etat} · {numero}</h2>
          <div style={{ color: '#8b867e', marginTop: 4, fontSize: 13 }}>Les pièces sont jointes au fil du client, le Client Success est prévenu.</div></div>
        <button style={{ ...button, padding: 6, border: 0 }} aria-label="Fermer" disabled={saving} onClick={() => onResolve(null)}><X size={20}/></button>
      </div>
      <FilePick label="Joindre le mail de résiliation du client" hint="obligatoire" file={mail} onPick={pick(setMail)} disabled={saving} />
      <FilePick label="Joindre l’appel" hint="facultatif" file={call} onPick={pick(setCall)} disabled={saving} />
      {error && <p role="alert" style={{ color: '#c5221f', fontSize: 12.5, margin: '12px 0 0' }}>{error}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
        <button style={button} disabled={saving} onClick={() => onResolve(null)}>Annuler</button>
        <button disabled={!mail || saving} style={{ ...button, background: '#2b2927', borderColor: '#2b2927', color: '#fff', opacity: mail && !saving ? 1 : 0.45, cursor: mail && !saving ? 'pointer' : 'default' }} onClick={confirm}>
          {saving ? 'Envoi des pièces…' : 'Passer en cours de résiliation'}
        </button>
      </div>
    </section>
  </div>;
}

// Une seule fenêtre pour la cellule État du tableau et la section État de la fiche (changeEtat du board).
export function confirmBoardResiliation(numero, payload) {
  return new Promise(resolve => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const done = result => { root.unmount(); host.remove(); resolve(result); };
    root.render(<BoardResiliationDialog numero={numero} payload={payload} onResolve={done}/>);
  });
}
