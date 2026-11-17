import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Copy, MessageCircle, Plus, X } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { formatPhoneDisplay } from '../../utils/phoneDisplay.js';
import { whatsappUrl } from '../../utils/whatsapp.js';
import { load, useContacts } from './leadContactsStore.js';

// Champ « WhatsApp » de la fiche lead (dev 17/11/2026) : le numéro WhatsApp du client, pour la facturation (relances
// de paiement, campagnes). Un champ à part, présenté exactement comme « Téléphone » et « Email » : icône, libellé,
// valeur, puis copier / ouvrir / modifier au survol. Vide, un « + » discret l'ajoute. Il n'est jamais prioritaire :
// les relances, les SMS et le contrat gardent le téléphone du lead. Enregistré comme contact du lead (type
// `whatsapp`), il suit le lead quand il devient client et la Finance le retrouve sur sa fiche.
// Si le serveur ne connaît pas encore ce type, le champ ne s'affiche pas.
const mono = "'SF Mono', 'Fira Code', monospace";

export default function WhatsAppField({ leadId, phone, C, darkMode, readOnly = false }) {
  const [{ data }] = useContacts(leadId);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);
  const isEditing = editing !== null;
  useEffect(() => { if (isEditing) inputRef.current?.focus(); }, [isEditing]);
  useEffect(() => { setEditing(null); setError(''); }, [leadId]);

  if (!data?.categories?.whatsapp) return null;
  const current = (data.contacts || []).find((contact) => contact.kind === 'whatsapp') || null;
  if (!current && readOnly) return null;
  const base = `/api/v1/tracking/leads/${leadId}/contacts`;
  const link = current ? whatsappUrl(current.value) : null;
  const samePhone = (phone || '').trim();

  const save = async () => {
    const value = (editing || '').trim();
    if (busy) return;
    if (!current && !value) { setEditing(null); return; }
    setBusy(true); setError('');
    try {
      if (current && !value) await apiClient.delete(`${base}/${current.id}`);
      else if (current) await apiClient.patch(`${base}/${current.id}`, { value });
      else await apiClient.post(base, { kind: 'whatsapp', category: 'whatsapp', value });
      await load(leadId);
      setEditing(null);
    } catch (e) {
      setError(e?.data?.detail?.message || (typeof e?.data?.detail === 'string' ? e.data.detail : '') || 'L’enregistrement a échoué. Réessayez.');
    } finally { setBusy(false); }
  };
  const cancel = () => { setEditing(null); setError(''); };
  const copy = () => {
    if (!current) return;
    navigator.clipboard?.writeText(current.value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }).catch(() => {});
  };

  const label = { fontSize: 10, fontWeight: 500, color: darkMode ? C.muted : '#a8a39b', textTransform: 'uppercase', letterSpacing: '0.09em' };
  const iconCell = { width: 22, height: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const glyph = <MessageCircle size={15} color="#949293" fill="#949293" strokeWidth={2} aria-hidden="true" />;
  const quiet = (opacity) => ({
    style: { display: 'inline-flex', flexShrink: 0, cursor: 'pointer', opacity, transition: 'opacity 0.15s' },
    onMouseEnter: (e) => { e.currentTarget.style.opacity = 0.8; },
    onMouseLeave: (e) => { e.currentTarget.style.opacity = opacity; },
  });

  if (editing !== null) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={iconCell}>{glyph}</div>
          <input ref={inputRef} type="tel" value={editing} placeholder="06 12 34 56 78" aria-label="Numéro WhatsApp" disabled={busy}
            onChange={(e) => setEditing(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
            style={{ flex: 1, minWidth: 0, fontSize: 12, color: C.text, border: `1px solid ${C.accent}`, borderRadius: 6, padding: '5px 8px', background: C.bg, fontFamily: mono, fontWeight: 500, outline: 'none' }} />
          <button type="button" onClick={save} disabled={busy} aria-label="Enregistrer" style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: C.accent, color: C.onAccent, cursor: busy ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={14} strokeWidth={2.2} aria-hidden="true" /></button>
          <button type="button" onClick={cancel} aria-label="Annuler" style={{ width: 24, height: 24, borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} strokeWidth={2} aria-hidden="true" /></button>
        </div>
        {(samePhone && editing.trim() !== samePhone) || current ? (
          <div style={{ display: 'flex', gap: 12, marginLeft: 28, marginTop: 5 }}>
            {samePhone && editing.trim() !== samePhone && (
              <button type="button" onClick={() => { setEditing(samePhone); inputRef.current?.focus(); }} style={{ padding: 0, border: 'none', background: 'transparent', color: C.muted, fontSize: 11, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>
                Même numéro que le téléphone
              </button>
            )}
            {current && (
              <span style={{ fontSize: 11, color: C.muted }}>Vider le champ pour retirer le numéro</span>
            )}
          </div>
        ) : null}
        {error && <p role="alert" style={{ margin: '5px 0 0 28px', fontSize: 11.5, color: darkMode ? '#f87171' : '#c5221f' }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, padding: '4px 6px', margin: '-4px -6px', transition: 'background 0.15s' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      <div style={iconCell}>{glyph}</div>
      <div onClick={copy} style={{ flex: 1, minWidth: 0, cursor: current ? 'pointer' : 'default' }}>
        <div style={label}>WhatsApp</div>
        <div style={{ fontSize: 12, color: current ? C.text : C.muted, fontFamily: mono, fontWeight: 500 }}>{current ? formatPhoneDisplay(current.value) : '—'}</div>
      </div>
      {copied ? (
        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 500, color: '#10b981', padding: '2px 10px', borderRadius: 50, background: darkMode ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)', animation: 'copiedToastIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both' }}>Copié</span>
      ) : (
        <>
          {!current && !readOnly && (
            <span role="button" tabIndex={0} title="Ajouter le numéro WhatsApp" aria-label="Ajouter le numéro WhatsApp" {...quiet(0.35)}
              onClick={() => setEditing('')} onKeyDown={(e) => { if (e.key === 'Enter') setEditing(''); }}>
              <Plus size={14} color={C.muted} strokeWidth={2} />
            </span>
          )}
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" title="Ouvrir la conversation WhatsApp" aria-label="Ouvrir la conversation WhatsApp" {...quiet(0.5)}>
              <ArrowUpRight size={14} color={C.muted} strokeWidth={2} />
            </a>
          )}
          {current && (
            <span role="button" tabIndex={0} title="Copier" aria-label="Copier le numéro WhatsApp" {...quiet(0.5)} onClick={copy} onKeyDown={(e) => { if (e.key === 'Enter') copy(); }}>
              <Copy size={14} color={C.muted} strokeWidth={2} />
            </span>
          )}
          {current && !readOnly && (
            <span role="button" tabIndex={0} title="Modifier" aria-label="Modifier le numéro WhatsApp" {...quiet(0.35)}
              onClick={() => setEditing(current.value)} onKeyDown={(e) => { if (e.key === 'Enter') setEditing(current.value); }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </span>
          )}
        </>
      )}
    </div>
  );
}
