import { FileX2 } from 'lucide-react';
import { frenchDate, parisInstantLabel } from '../utils/parisDates';
import { EARLY_OTHER_REASON } from '../utils/earlySaleDeclaration';

// Vente déclarée sans documents (à toute échéance avant l'onboarding) : dit à l'équipe d'intégration pourquoi le dossier est incomplet.
// Le commercial n'est pas en faute : c'est le client qui n'a pas transmis ses pièces, ou trop tard.
// (Des <div>, pas des <p> : en mode sombre `body.dark-mode p` impose un texte presque blanc, illisible sur ce fond clair.)
export default function EarlyDeclarationNote({ documents, compact = false, margin }) {
  if (!documents?.early) return null;
  const days = documents.days_before;
  const when = days > 0 ? `J-${days}` : days === 0 ? 'jour J' : 'date déjà passée';
  const at = String(documents.onboarding_at || '');
  const onboarding = at.length >= 16 ? `${frenchDate(at.slice(0, 10))} à ${at.slice(11, 16)}` : '';
  const declared = parisInstantLabel(documents.declared_at);
  return <aside role="note" aria-label="Vente déclarée sans documents" style={{ margin: margin || (compact ? '8px 0 0' : '12px 0 0'), padding: compact ? '8px 10px' : '10px 12px', border: '1px solid #f0d9a8', borderRadius: 10, background: '#fff8ea', color: '#5f3b05' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700 }}><FileX2 size={15} style={{ color: '#b45309', flexShrink: 0 }}/>Vente déclarée avant réception des documents</div>
    <div style={{ margin: '5px 0 0', fontSize: 12, lineHeight: 1.5 }}>Le commercial n’a pas pu récupérer les documents du client avant l’onboarding : déclaration anticipée, {documents.reason === EARLY_OTHER_REASON ? 'dont il précise le motif ci-dessous.' : 'rendue nécessaire par l’absence ou le retard de transmission côté client.'}</div>
    <div style={{ margin: '5px 0 0', fontSize: 12, lineHeight: 1.5 }}><strong>Motif :</strong> {documents.label}.</div>
    {documents.note && <div style={{ margin: '5px 0 0', fontSize: 12, lineHeight: 1.5, overflowWrap: 'anywhere' }}><strong>Précision du commercial :</strong> « {documents.note} »</div>}
    <div style={{ margin: '5px 0 0', fontSize: 11.5, color: '#8a5a1b' }}>{onboarding ? `Onboarding prévu le ${onboarding} (${when})` : 'Onboarding'}{documents.declared_by ? ` · Déclaré par ${documents.declared_by}` : ''}{declared ? ` le ${declared}` : ''}</div>
  </aside>;
}
