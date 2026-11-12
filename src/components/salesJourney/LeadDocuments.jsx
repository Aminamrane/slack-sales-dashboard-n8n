import React, { useEffect, useRef, useState } from 'react';
import { Check, CircleAlert, Clock3, FileText, FolderUp, LoaderCircle } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { FileTypeIcon } from '../BoardClientFiles';
import LeadDocumentDrop from './LeadDocumentDrop';
import { DOCUMENT_LABELS, documentOwner, documentsSummary, shortDocumentStatus } from '../../utils/intakeDocuments';
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

// `fallback` : ce qui s'affiche tant que le dépôt n'est pas ouvert pour ce lead (rien par défaut).
export default function LeadDocuments({ leadId, lead = null, revision = 0, dark = false, fallback = null }) {
  const [data, setData] = useState(null);
  // `open` : la fenêtre de dépôt ; elle peut s'ouvrir avec des fichiers déjà glissés sur la rangée de la fiche.
  const [open, setOpen] = useState(null), [all, setAll] = useState(false);
  const [drag, setDrag] = useState(false);
  const depth = useRef(0);
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
  if (!data?.available) return fallback;

  const files = [...(data.documents || [])].reverse();
  const summary = documentsSummary(files);
  const shown = all ? files : files.slice(0, SHOWN);
  const accountOpen = ['signed', 'prospect'].includes(data.account?.stage);
  // Style Owner (11/11/2026), sur le modèle du dossier de la fiche Finance et du board : un titre en micro-libellé avec
  // le compte, une rangée pour déposer, puis une ligne par pièce (icône du type de fichier, nature et titulaire,
  // nom du fichier, état en étiquette). Les pièces transmises quittent le CRM pour le compte du client : la fiche
  // en garde la trace, pas le contenu.
  return <section className={`lead-docs${dark ? ' is-dark' : ''}`} aria-live="polite">
    <header className="lead-docs__head">
      <span className="lead-docs__title"><FileText size={12} />Documents{summary.total > 0 && <b>{summary.total}</b>}</span>
      {summary.total > 0 && <span className="lead-docs__summary">
        {plural(summary.sent, 'transmise')}
        {summary.pending > 0 && <> · {summary.pending} en attente</>}
        {summary.rejected > 0 && <span className="is-rejected"> · {summary.rejected} à corriger</span>}
      </span>}
    </header>
    <button type="button" className={`lead-docs__drop${drag ? ' is-drag' : ''}`} onClick={() => setOpen({ files: null })}
      onDragEnter={(e) => { e.preventDefault(); depth.current += 1; setDrag(true); }} onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDrag(false); }}
      onDrop={(e) => { e.preventDefault(); depth.current = 0; setDrag(false); setOpen({ files: Array.from(e.dataTransfer.files || []) }); }}>
      <span className="lead-docs__plus"><FolderUp size={16} /></span>
      <span className="lead-docs__drop-text">
        <strong>{drag ? 'Lâchez pour déposer' : summary.total ? 'Déposer une pièce' : 'Déposer un document'}</strong>
        <small>{drag ? 'Vous direz ensuite ce que c’est' : summary.total ? 'Glissez un fichier ici, ou cliquez' : (EMPTY[data.phase] || 'Glissez un fichier ici, ou cliquez')}</small>
      </span>
    </button>
    {shown.length > 0 && <ul className="lead-docs__list">
      {shown.map((file, i) => {
        const Icon = ICONS[file.status] || Clock3;
        return <li key={file.id} className="lead-docs__item" style={{ '--i': i }} title={file.last_error || file.file_name}>
          <span className="lead-docs__file"><FileTypeIcon name={file.file_name || ''} mime={file.mime_type || ''} size={22} /></span>
          <span className="lead-docs__text">
            <strong>{DOCUMENT_LABELS[file.document_type] || 'Document'}</strong>
            <small>{[documentOwner(file, data.draft), file.file_name].filter(Boolean).join(' · ')}</small>
          </span>
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
    {open && <LeadDocumentDrop leadId={leadId} lead={lead} dark={dark} initialFiles={open.files} onClose={() => { setOpen(null); setReload(v => v + 1); }} />}
  </section>;
}
