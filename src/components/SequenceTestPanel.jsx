// Tester une séquence depuis la page « Séquences email » : on reçoit tout de
// suite, sur l'adresse (et le numéro) saisis, exactement ce que reçoit un
// prospect, sans les délais. Côté serveur, rien n'est écrit : pas d'envoi
// compté, pas de clic, pas d'attribution.
import { useEffect, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import apiClient from '../services/apiClient';

const CONF_KEY = '__confirmation__';
const NOSHOW_KEY = '__noshow__';

function target(active) {
  if (active === CONF_KEY) return { url: '/api/v1/tracking/confirmation-email/test', what: 'le mail de confirmation, une version par niche (4 emails)', phone: false };
  if (active === NOSHOW_KEY) return { url: '/api/v1/tracking/noshow-relance/test', what: 'les 4 emails du parcours de RDV (confirmation R1, confirmation R2, relance 2, no-show) et, avec un mobile, les 4 SMS (répondeur, Lapin, rappel la veille, rappel 15 min avant), signés à votre nom avec votre numéro Allo', phone: true };
  return { url: `/api/v1/tracking/broad-sequence/${encodeURIComponent(active)}/test`, what: 'les 10 emails de la séquence, dans l’ordre', phone: false };
}

export default function SequenceTestPanel({ active, label, C }) {
  const [email, setEmail] = useState(() => apiClient.getUser()?.email || '');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const t = target(active);

  useEffect(() => { setResult(null); setError(''); }, [active]);

  const send = async () => {
    if (busy || !email.trim()) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const body = t.phone ? { email: email.trim(), phone: phone.trim() || null } : { email: email.trim() };
      setResult(await apiClient.post(t.url, body));
    } catch (e) {
      setError(e?.message || 'Le test n’a pas pu être envoyé.');
    } finally {
      setBusy(false);
    }
  };

  const input = { flex: '1 1 220px', minWidth: 0, padding: '8px 11px', borderRadius: 9, border: '1px solid ' + C.border, background: C.bg, color: C.text, fontSize: 13, fontFamily: 'inherit' };
  const results = result?.results || [];
  const okCount = results.filter((r) => r.sent).length;

  return (
    <div style={{ background: C.bg, border: '1px solid ' + C.border, borderRadius: 14, boxShadow: C.shadow, padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>Tester « {label} »</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Vous recevez tout de suite {t.what}, sans les délais. Aucun prospect n’est touché, rien n’est compté.</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <input style={input} type="email" placeholder="votre@email.fr" value={email} onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }} aria-label="Email de test" />
        {t.phone && <input style={input} type="tel" placeholder="Mobile pour les SMS (facultatif)" value={phone} onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }} aria-label="Mobile de test" />}
        <button type="button" onClick={send} disabled={busy || !email.trim()}
          style={{ padding: '8px 16px', borderRadius: 9, border: 'none', background: busy || !email.trim() ? C.border : C.text, color: busy || !email.trim() ? C.muted : C.bg, fontSize: 13, fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          {busy ? 'Envoi en cours…' : 'Envoyer le test'}
        </button>
      </div>
      {error && <div role="alert" style={{ marginTop: 10, fontSize: 12.5, color: '#b42318' }}>{error}</div>}
      <AnimatePresence>
        {result && (
          <Motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{ marginTop: 12 }}>
            <div role="status" style={{ fontSize: 12.5, fontWeight: 700, color: okCount === results.length ? C.ok : '#b45309', marginBottom: 6 }}>
              {okCount}/{results.length} envoyé{okCount > 1 ? 's' : ''} à {result.to}
            </div>
            {'sales_phone' in result && (
              <div style={{ fontSize: 12, color: result.sales_phone ? C.text2 : '#b45309', marginBottom: 6 }}>
                {result.sales_phone ? `Numéro Allo écrit dans les SMS : ${result.sales_phone}` : 'Aucun numéro Allo trouvé pour votre compte : les SMS partent sans la ligne « Pour me joindre ».'}
              </div>
            )}
            <div style={{ display: 'grid', gap: 3 }}>
              {results.map((r) => (
                <div key={r.step} style={{ display: 'flex', gap: 8, fontSize: 12, color: C.text2 }}>
                  <span style={{ color: r.sent ? C.ok : '#b42318', fontWeight: 800, width: 14 }}>{r.sent ? '✓' : '✕'}</span>
                  <span style={{ color: C.muted, width: 22 }}>#{r.step}</span>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subject}{r.to ? ` · ${r.to}` : ''}</span>
                </div>
              ))}
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
