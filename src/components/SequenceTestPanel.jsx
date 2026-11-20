// Tester une séquence depuis la page « Séquences email » : on reçoit tout de
// suite, sur l'adresse (et le numéro) saisis, exactement ce que reçoit un
// prospect, sans les délais. Côté serveur, rien n'est écrit : pas d'envoi
// compté, pas de clic, pas d'attribution.
import { useEffect, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import apiClient from '../services/apiClient';
import { READ_ONLY_PROPS } from '../utils/readOnlyRoles.js';
import { Hint } from './sequences/parts.jsx';

const CONF_KEY = '__confirmation__';
const NOSHOW_KEY = '__noshow__';

function target(active) {
  if (active === CONF_KEY) return { url: '/api/v1/tracking/confirmation-email/test', what: 'le mail de confirmation, une version par niche (4 emails)', phone: false };
  if (active === NOSHOW_KEY || active === '__sms__') return { url: '/api/v1/tracking/noshow-relance/test', what: 'les 4 emails du parcours de RDV (confirmation R1, confirmation R2, relance 2, no-show) et, avec un mobile, les 4 SMS (répondeur, Lapin, rappel la veille, rappel 15 min avant), signés à votre nom avec votre numéro Allo', phone: true };
  return { url: `/api/v1/tracking/broad-sequence/${encodeURIComponent(active)}/test`, what: 'les 10 emails de la séquence, dans l’ordre', phone: false };
}

// `readOnly` (rôles en lecture seule) : le panneau reste visible, champs et envoi désactivés.
export default function SequenceTestPanel({ active, label, readOnly = false }) {
  const [email, setEmail] = useState(() => apiClient.getUser()?.email || '');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const t = target(active);

  useEffect(() => { setResult(null); setError(''); }, [active]);

  const ro = readOnly ? READ_ONLY_PROPS : {};
  const send = async () => {
    if (readOnly || busy || !email.trim()) return;
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

  const results = result?.results || [];
  const okCount = results.filter((r) => r.sent).length;

  return (
    <section className="seq-card seq-in seq-test" aria-label={`Tester « ${label} »`} style={{ '--i': 1 }}>
      <div className="seq-test-row">
        <h2 className="seq-h2 seq-test-title">
          Tester « {label} »
          <Hint label="Détail : test d’une séquence">Vous recevez tout de suite {t.what}, sans les délais. Aucun prospect n’est touché, rien n’est compté.</Hint>
        </h2>
        <div className="seq-test-form">
          <input className="seq-input" type="email" placeholder="votre@email.fr" value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }} aria-label="Email de test" {...ro} />
          {t.phone && <input className="seq-input" type="tel" placeholder="Mobile pour les SMS (facultatif)" value={phone} onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }} aria-label="Mobile de test" {...ro} />}
          <button type="button" className="seq-btn" onClick={send} disabled={busy || !email.trim()} {...ro}>
            {busy ? 'Envoi en cours…' : 'Envoyer le test'}
          </button>
        </div>
      </div>
      {error && <div role="alert" className="seq-msg" data-tone="low" style={{ marginTop: 12 }}>{error}</div>}
      <AnimatePresence>
        {result && (
          <Motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="seq-test-result">
            <div role="status" className="seq-msg" data-tone={okCount === results.length ? 'good' : 'warn'}>
              {okCount}/{results.length} envoyé{okCount > 1 ? 's' : ''} à {result.to}
            </div>
            {'sales_phone' in result && (
              <div className="seq-msg" data-tone={result.sales_phone ? undefined : 'warn'} style={{ fontWeight: 400, color: result.sales_phone ? 'var(--soft)' : undefined }}>
                {result.sales_phone ? `Numéro Allo écrit dans les SMS : ${result.sales_phone}` : 'Aucun numéro Allo trouvé pour votre compte : les SMS partent sans la ligne « Pour me joindre ».'}
              </div>
            )}
            <div style={{ display: 'grid', gap: 4 }}>
              {results.map((r) => (
                <div key={r.step} className="seq-test-line">
                  <span className={r.sent ? 'seq-ok' : 'seq-ko'}>{r.sent ? '✓' : '✕'}</span>
                  <span style={{ color: 'var(--muted)' }}>#{r.step}</span>
                  <span>{r.subject}{r.to ? ` · ${r.to}` : ''}</span>
                </div>
              ))}
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
