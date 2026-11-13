import { TriangleAlert } from 'lucide-react';

// Case « Client compliqué » cochée par le sales à la déclaration de vente (dev 13/11/2026) : dit à l'équipe d'intégration
// que le dossier est difficile et que son lancement fiscal se fait avec le responsable du pôle fiscal.
// (Des <div>, pas des <p> : en mode sombre `body.dark-mode p` impose un texte presque blanc, illisible sur ce fond clair.)
export default function ComplicatedClientNote({ flagged, compact = false, margin }) {
  if (!flagged) return null;
  return <aside role="note" aria-label="Client compliqué" style={{ margin: margin || (compact ? '8px 0 0' : '12px 0 0'), padding: compact ? '8px 10px' : '10px 12px', border: '1px solid #f0d9a8', borderRadius: 10, background: '#fff8ea', color: '#5f3b05' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 500 }}><TriangleAlert size={15} style={{ color: '#b45309', flexShrink: 0 }}/>Client compliqué</div>
    <div style={{ margin: '5px 0 0', fontSize: 12, lineHeight: 1.5 }}>Signalé par le commercial à la déclaration de vente. Son lancement fiscal se fait avec le responsable du pôle fiscal.</div>
  </aside>;
}
