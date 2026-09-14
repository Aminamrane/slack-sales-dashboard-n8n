import React, { useEffect, useRef, useState } from 'react';

export default function CompanyNameInput({ value, onCommit }) {
  const [draft, setDraft] = useState(value || '');
  const [status, setStatus] = useState('');
  const saving = useRef(false);

  useEffect(() => { setDraft(value || ''); }, [value]);

  const save = async () => {
    const next = draft.trim().replace(/\s+/g, ' ');
    if (saving.current || next === (value || '')) return;
    if (next.length < 2) { setStatus('Le nom doit contenir au moins deux caractères.'); return; }
    saving.current = true;
    setStatus('Enregistrement…');
    try {
      await onCommit(next);
      setDraft(next);
      setStatus('Enregistré');
    } catch {
      setStatus('Enregistrement impossible. Réessayez.');
    } finally {
      saving.current = false;
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: 460 }}>
      <input
        aria-label="Société principale"
        type="text"
        value={draft}
        disabled={status === 'Enregistrement…'}
        maxLength={200}
        placeholder="Nom de la société principale"
        onChange={(e) => { setDraft(e.target.value); setStatus(''); }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setDraft(value || ''); setStatus(''); }
        }}
        style={{ width: '100%', boxSizing: 'border-box', minWidth: 180,
          border: '1px solid #d9d9d5', borderRadius: 6, background: '#fff',
          padding: '7px 10px', color: '#37352f', fontSize: 13, fontFamily: 'inherit' }}
      />
      {status && <div role="status" style={{ marginTop: 4, fontSize: 11, color: status === 'Enregistré' ? '#0f766e' : '#787774' }}>{status}</div>}
    </div>
  );
}
