import { useEffect, useState } from 'react';
import apiClient from '../services/apiClient';
import { signedContractPaymentMode } from '../utils/contractPayment';

export default function SalePaymentMode({ leadId, value, onChange, dark = false }) {
  const [policy, setPolicy] = useState({ leadId: null, loading: true });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setPolicy({ leadId, loading: true });
    apiClient.get(`/api/v1/contracts/lead/${leadId}`).then(data => {
      if (active) setPolicy({ leadId, mode: signedContractPaymentMode(data.contracts) });
    }).catch(() => { if (active) setPolicy({ leadId, error: true }); });
    return () => { active = false; };
  }, [leadId, retry]);
  const monthly = policy.leadId === leadId && policy.mode === 'MONTHLY';
  useEffect(() => { if (monthly && value !== 'M') onChange('M'); }, [monthly, value, onChange]);
  // Style Owner (11/11/2026) : une question en gris, une bascule à pouce blanc. `dark` : thème de la fenêtre.
  const ink = dark ? '#f2f2f2' : '#1c1b19', muted = dark ? '#7d7d7d' : '#9d9890', rail = dark ? '#262626' : '#f4f2ee';
  const label = { fontSize: 13, color: muted, marginBottom: 7 };
  const note = { padding: '10px 12px', borderRadius: 12, background: rail, color: dark ? '#a3a3a3' : '#55514b', fontSize: 13, lineHeight: 1.5, marginBottom: 14 };
  if (policy.leadId !== leadId || policy.loading) return <div style={note}>Vérification des modalités du contrat…</div>;
  if (policy.error) return <div style={note} role="alert">Modalités indisponibles. <button type="button" onClick={() => setRetry(n => n + 1)} style={{ border: 0, background: 'none', padding: 0, color: ink, font: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer' }}>Réessayer</button></div>;
  if (monthly) return <div style={note}><strong style={{ fontWeight: 500, color: ink }}>Paiement mensuel</strong><div style={{ marginTop: 2 }}>Prévu au contrat signé.</div></div>;
  return <fieldset style={{ border: 0, padding: 0, margin: '0 0 14px', minWidth: 0 }}><legend style={{ ...label, padding: 0 }}>Mode de paiement du contrat existant</legend>
    <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 14, background: rail }}>{[{ key: 'M', label: 'Mensuel' }, { key: 'A', label: 'Annuel' }].map(option =>
      <button type="button" key={option.key} aria-pressed={value === option.key} onClick={() => onChange(option.key)}
        style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 0, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', transition: 'background .18s ease, color .18s ease',
          background: value === option.key ? (dark ? '#3a3a3a' : '#fff') : 'transparent', color: value === option.key ? ink : muted, boxShadow: value === option.key && !dark ? '0 1px 2px rgba(28,27,25,.08)' : 'none' }}>{option.label}</button>)}</div>
  </fieldset>;
}
