import { useEffect, useState } from 'react';
import apiClient from '../services/apiClient';
import { signedContractPaymentMode } from '../utils/contractPayment';

export default function SalePaymentMode({ leadId, value, onChange }) {
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
  const style = { padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, marginBottom: 14 };
  if (policy.leadId !== leadId || policy.loading) return <div style={style}>Vérification des modalités du contrat…</div>;
  if (policy.error) return <div style={style} role="alert">Modalités indisponibles. <button type="button" onClick={() => setRetry(n => n + 1)}>Réessayer</button></div>;
  if (monthly) return <div style={style}><strong>Paiement mensuel</strong><div style={{ marginTop: 4 }}>Prévu au contrat signé.</div></div>;
  return <fieldset style={style}><legend>Mode de paiement du contrat existant</legend>
    <div style={{ display: 'flex', gap: 8 }}>{[{ key: 'M', label: 'Mensuel' }, { key: 'A', label: 'Annuel' }].map(option =>
      <button type="button" key={option.key} aria-pressed={value === option.key} onClick={() => onChange(option.key)}
        style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #cbd0d9', background: value === option.key ? '#202432' : '#fff', color: value === option.key ? '#fff' : '#202432', cursor: 'pointer' }}>{option.label}</button>)}</div>
  </fieldset>;
}
