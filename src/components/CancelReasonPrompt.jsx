// Raison d'une annulation de RDV (dev 16/10/2026 : « si les sales passent en annulé, obligés de mettre un commentaire
// pourquoi, pour que le setter voie dans sa fiche pourquoi »). Montée une fois à la racine : quel que soit l'écran qui
// annule (Tracking Sheet, fiche, pop-up de qualification), le serveur refuse sans raison et apiClient ouvre cette
// fenêtre, puis renvoie la même requête avec la raison. « Retour » = rien n'est enregistré.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import apiClient from '../services/apiClient';
import './cancelReasonPrompt.css';

const MIN_LENGTH = 3;
const stageLabel = (stages = []) => (stages.length ? `${stages.map(s => String(s).toUpperCase()).join(' et ')} annulé` : 'Rendez-vous annulé');

export default function CancelReasonPrompt() {
  const [current, setCurrent] = useState(null);
  const [reason, setReason] = useState('');
  const queue = useRef([]);
  const field = useRef(null);

  useEffect(() => {
    const pending = queue.current;
    const ask = (info) => new Promise(resolve => {
      pending.push({ info, resolve });
      setCurrent(c => c || pending[0]);
    });
    apiClient.cancelReasonPrompt = ask;
    return () => {
      if (apiClient.cancelReasonPrompt === ask) apiClient.cancelReasonPrompt = null;
      pending.splice(0).forEach(item => item.resolve(null));
    };
  }, []);

  useEffect(() => {
    if (!current) return undefined;
    setReason('');
    const id = requestAnimationFrame(() => field.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [current]);

  if (!current) return null;
  const valid = reason.trim().length >= MIN_LENGTH;
  const close = (value) => {
    const item = queue.current.shift();
    item?.resolve(value);
    setCurrent(queue.current[0] || null);
  };
  const submit = (e) => { e?.preventDefault(); if (valid) close(reason.trim()); };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(null); }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
  };

  return createPortal(
    <div className="crp-backdrop" onKeyDown={onKey}>
      <form className="crp-card" role="dialog" aria-modal="true" aria-labelledby="crp-title" onSubmit={submit}>
        <span className="crp-tag"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" /><path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" /></svg>{stageLabel(current.info?.stages)}</span>
        <h2 id="crp-title">Pourquoi ce rendez-vous est-il annulé ?</h2>
        <p>Le setter verra la raison dans sa fiche.</p>
        <textarea ref={field} value={reason} maxLength={1000} rows={4} onChange={e => setReason(e.target.value)}
          placeholder="Ex. : le gérant a annulé par téléphone, il rappellera en novembre" />
        <div className="crp-actions">
          <button type="button" className="crp-secondary" onClick={() => close(null)}>Retour</button>
          <button type="submit" className="crp-primary" disabled={!valid}>Confirmer l’annulation</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
