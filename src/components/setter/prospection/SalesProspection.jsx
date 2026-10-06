// Prospection dans la tracking sheet des commerciaux (demande dev 06/10/2026) : le même outil que les
// setters (« Trouver des contacts » par code NAF et département, « Mes listes » réservées), avec ses
// propres notifications. Différence : pas de prise de RDV depuis une liste ; « Exporter vers CRM » crée
// les leads dans « Nouveaux leads » de la sheet du commercial (origine cold call), où il pose son R1.
import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import ProspectSearch from './ProspectSearch.jsx';
import ProspectLists from './ProspectLists.jsx';

export default function SalesProspection({ view, C, darkMode, onNavigate, onOpenLeads }) {
  const [listId, setListId] = useState(null);
  const [toast, setToast] = useState(null);
  const onToast = useCallback((text, kind = 'ok') => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 2800);
  }, []);
  const search = view === 'prospect_search';

  return (
    <div style={{ flex: 1, padding: '32px 32px', overflowY: 'auto', animation: 'tabFadeIn 0.3s ease-out both' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
        {search ? 'Trouver des contacts' : 'Mes listes'}
      </h2>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>
        {search
          ? "Saisissez un code NAF, puis réservez les entreprises dans une liste : personne d'autre ne les appellera."
          : "Suivez votre prospection entreprise par entreprise. « Exporter vers CRM » crée les leads dans vos Nouveaux leads, où vous posez le R1."}
      </p>
      {search ? (
        <ProspectSearch C={C} darkMode={darkMode} onToast={onToast} nafOnly
          onOpenList={(id) => { setListId(id); onNavigate('prospect_lists'); }} />
      ) : (
        <ProspectLists C={C} darkMode={darkMode} onToast={onToast} canBook={false}
          openListId={listId} onOpenList={setListId} onOpenLeads={onOpenLeads} />
      )}
      {toast && createPortal(
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', padding: '10px 18px', borderRadius: 10,
          background: toast.kind === 'err' ? '#ef4444' : '#10b981', color: '#fff', fontSize: 13, fontWeight: 600,
          boxShadow: '0 12px 32px rgba(0,0,0,0.25)', zIndex: 10000,
        }}>
          {toast.text}
        </div>,
        document.body,
      )}
    </div>
  );
}
