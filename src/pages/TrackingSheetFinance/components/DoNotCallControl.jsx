import React, { useState, useEffect, useRef } from 'react';
import { PhoneOff, Phone } from 'lucide-react';
import apiClient from '../../../services/apiClient.js';

export default function DoNotCallControl({ clientId, value, loaded, canEdit, onChanged, compact = false }) {
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const change = async () => {
    if (!loaded || busy) return;
    setBusy(true); setError('');
    try {
      const result = await apiClient.put(`/api/v1/finance-periods/client/${clientId}/do-not-call`, { enabled: !value });
      if (mounted.current) onChanged?.(result.do_not_call);
    } catch (e) {
      setError(e?.data?.detail || 'La consigne de rappel n’a pas été enregistrée. Réessayez.');
    } finally { setBusy(false); }
  };
  const Icon = value ? Phone : PhoneOff;
  return <div style={{ marginTop: compact ? 0 : -16, marginBottom: compact ? 0 : 24, fontSize: 12.5 }}>
    {value && !compact && <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#92400e', marginBottom: 8 }}>
      <PhoneOff size={15}/><strong>Client à ne pas rappeler</strong><span>· Consigne partagée avec l’équipe Finance</span>
    </div>}
    {canEdit && <button type="button" disabled={busy || !loaded} onClick={change}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #e3e2e0', borderRadius: 7,
        padding: '6px 12px', background: '#fff', color: '#37352f', font: 'inherit', fontWeight: 600,
        cursor: busy || !loaded ? 'default' : 'pointer', opacity: busy || !loaded ? 0.5 : 1 }}>
      <Icon size={14}/>{busy ? 'Enregistrement…' : value ? 'Retirer « Ne pas rappeler »' : 'Ne pas rappeler'}
    </button>}
    {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}
  </div>;
}
