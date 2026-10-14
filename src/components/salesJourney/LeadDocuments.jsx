import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, CircleAlert, Clock3, FileText, FolderUp, LoaderCircle } from 'lucide-react';
import apiClient from '../../services/apiClient';
import SaleDocuments from '../integrationPreview/SaleDocuments';
import { useDialogFocus } from './QualificationDialog';
import { DOCUMENT_LABELS, documentOwner, documentsSummary, shortDocumentStatus } from '../../utils/intakeDocuments';
import '../integrationPreview/integrationPreview.css';
import './leadDocuments.css';

// Pièces du client dans la fiche du lead (dev 14/10/2026) : le sales dépose dès le NDA rempli,
// et encore après la déclaration ; il voit ce qu'il a déjà donné. Même circuit que la déclaration.
const ICONS = { sent: Check, sending: LoaderCircle, rejected: CircleAlert };
const SHOWN = 4;
const EMPTY = {
  before_signature: 'Vous pouvez déjà déposer les avis d’imposition et les bilans.',
  signed: 'Au moins une pièce sera demandée à la déclaration de vente.',
  declared: 'Ajoutez des pièces : elles partent directement dans le compte du client.',
};

const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

export default function LeadDocuments({ leadId, revision = 0, dark = false }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false), [all, setAll] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true, timer;
    const read = async () => {
      try {
        // Lecture du CRM seulement : l'état côté plateforme ne se lit qu'à l'ouverture du dépôt.
        const value = await apiClient.get(`/api/v1/owner-integration/leads/${leadId}/sale-documents`);
        if (!active) return;
        setData(value);
        if (value.documents?.some(f => f.status === 'sending')) timer = setTimeout(read, 15000);
      } catch { if (active) setData(null); }
    };
    read();
    return () => { active = false; clearTimeout(timer); };
  }, [leadId, revision, reload]);
  if (!data?.available) return null;

  const files = [...(data.documents || [])].reverse();
  const summary = documentsSummary(files);
  const shown = all ? files : files.slice(0, SHOWN);
  const accountOpen = ['signed', 'prospect'].includes(data.account?.stage);
  return <section className={`lead-docs${dark ? ' is-dark' : ''}`} aria-live="polite">
    <div className="lead-docs__icon"><FileText size={20} /></div>
    <div className="lead-docs__body">
      <div className="lead-docs__head">
        <strong>Documents du client</strong>
        <button type="button" className="lead-docs__add" onClick={() => setOpen(true)}>
          <FolderUp size={14} />{summary.total ? 'Voir et ajouter' : 'Ajouter'}
        </button>
      </div>
      <p className="lead-docs__summary">
        {summary.total ? <>
          {plural(summary.total, 'pièce')} · {plural(summary.sent, 'transmise')}
          {summary.pending > 0 && <> · {summary.pending} en attente</>}
          {summary.rejected > 0 && <span className="is-rejected"> · {summary.rejected} à corriger</span>}
        </> : `Aucune pièce pour l’instant. ${EMPTY[data.phase] || ''}`}
      </p>
      {shown.length > 0 && <ul className="lead-docs__list">
        {shown.map((file, i) => {
          const Icon = ICONS[file.status] || Clock3;
          return <li key={file.id} className="lead-docs__item" style={{ '--i': i }} title={file.last_error || file.file_name}>
            <span>{DOCUMENT_LABELS[file.document_type] || 'Document'} · {documentOwner(file, data.draft)}</span>
            <span className={`lead-docs__status is-${file.status}`}>
              <Icon size={11} className={file.status === 'sending' ? 'lead-docs__spin' : ''} />{shortDocumentStatus(file)}
            </span>
          </li>;
        })}
      </ul>}
      {files.length > SHOWN && <button type="button" className="lead-docs__more" onClick={() => setAll(v => !v)}>
        {all ? 'Réduire' : `Voir les ${files.length} pièces`}
      </button>}
      {summary.pending > 0 && !accountOpen && <small className="lead-docs__hint"><Clock3 size={12} />
        Les pièces en attente partiront à l’ouverture du compte client.</small>}
    </div>
    {open && <DocumentsDialog leadId={leadId} onClose={() => { setOpen(false); setReload(v => v + 1); }} />}
  </section>;
}

function DocumentsDialog({ leadId, onClose }) {
  const ref = useRef(null);
  useDialogFocus(ref, onClose);
  return createPortal(<div className="sj-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section ref={ref} tabIndex={-1} className="sj-dialog lead-docs__dialog" role="dialog" aria-modal="true" aria-label="Documents du client">
      <SaleDocuments leadId={leadId} standalone onClose={onClose} />
    </section>
  </div>, document.body);
}
