import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, FileUp, FileText, UsersRound, Building2, Check, Clock3, LoaderCircle, RefreshCw, Trash2, CircleAlert } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { validateIntakeFile, documentStatus, hasRequiredSaleDocuments } from '../../utils/intakeDocuments';

export default function SaleDocuments({ leadId, draft, onBack, onContinue }) {
  const [files, setFiles] = useState([]), [platform, setPlatform] = useState(null);
  const [account, setAccount] = useState(null);
  const uploading = useRef(false);
  const [busy, setBusy] = useState(''), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [otherType, setOtherType] = useState('other'), [otherCompany, setOtherCompany] = useState('');
  const companies = draft?.companies?.filter(c => c.selected) || [];
  const directors = draft?.directors?.filter(d => d.companies?.some(id => companies.some(c => c.id === id))) || [];
  const root = `/api/v1/owner-integration/leads/${leadId}/sale-documents`;
  useEffect(() => {
    let live = true;
    apiClient.get(root + '?remote=true').then(result => {if (live) {setFiles(result.documents);setPlatform(result.platform);setAccount(result.account);}})
      .catch(e => {if(live) setError(e.message);}).finally(() => {if(live) setLoading(false);});
    return () => {live = false;};
  }, [root]);
  async function refresh() {
    if (busy) return;setLoading(true);setError('');
    try {const result = await apiClient.get(root + '?remote=true');setFiles(result.documents);setPlatform(result.platform);setAccount(result.account);}
    catch(e) {setError(e.message);} finally {setLoading(false);}
  }
  async function upload(selection, meta) {
    if (busy || uploading.current) return;
    setError('');
    const selected = Array.from(selection || []);
    if (selected.length > 5) {setError('Ajoutez au maximum cinq fichiers à la fois.');return;}
    uploading.current = true;
    try {
      for (const file of selected) {
        validateIntakeFile(file);setBusy(file.name);
        const result = await apiClient.uploadFile(root, file, 'file', meta);
        setFiles(result.documents);
      }
    } catch(e) {setError(e.message || 'Le fichier n’a pas pu être enregistré.');}
    finally {setBusy('');uploading.current = false;}
  }
  async function remove(id) {
    setBusy('Retrait du fichier');setError('');
    try {const result = await apiClient.delete(`${root}/${id}`);setFiles(result.documents);}
    catch(e) {setError(e.message);} finally {setBusy('');}
  }
  async function continueToBilling() {
    if (busy || loading) return;
    setBusy('Vérification des documents'); setError('');
    try {
      const result = await apiClient.get(root);
      setFiles(result.documents);
      if (!hasRequiredSaleDocuments(result.documents)) {setError('Ajoutez au moins un document avant de poursuivre la déclaration de vente.'); return;}
      onContinue();
    } catch(e) {setError(e.message || 'Impossible de vérifier les documents. Réessayez.');}
    finally {setBusy('');}
  }
  function drop(label, meta, icon) {
    const Icon = icon;
    return <label className={`si-drop ${busy ? 'is-busy' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => {e.preventDefault();if(!busy) upload(e.dataTransfer.files, meta);}}>
      <Icon size={23}/><strong>{label}</strong><span>Glisser vos fichiers ou <b>parcourir</b></span><small>PDF, JPG, PNG · 20 Mo par fichier</small>
      <input type="file" multiple accept="application/pdf,image/png,image/jpeg" aria-label={label} disabled={!!busy} onChange={e => {upload(e.target.files, meta);e.target.value = '';}}/>
    </label>;
  }
  return <section className="integration-preview ip-embedded si-documents">
    <header className="si-title"><span className="si-title-icon"><FileUp size={26}/></span><div><small>PIÈCES DU DOSSIER</small><h2>Ajouter les documents</h2><p>Étape obligatoire : ajoutez au moins un document pour poursuivre la déclaration de vente.</p></div></header>
    {account && <div className="si-account-state"><UsersRound size={20}/><div><strong>{account.label}</strong><p>{account.detail}</p></div></div>}
    <div className="si-section-title"><UsersRound size={19}/><h3>Pour chaque dirigeant</h3></div>
    <div className="si-upload-grid">{directors.map(d => <article key={d.id}><h4>{d.name}</h4>{drop('Avis d’imposition', {document_type:'tax_notice', director_id:d.id}, FileText)}</article>)}</div>
    <div className="si-section-title"><Building2 size={19}/><h3>Pour chaque société</h3></div>
    <div className="si-upload-grid">{companies.map(c => <article key={c.id}><h4>{c.name}</h4>{drop('Dernier bilan', {document_type:'balance_sheet', company_id:c.id}, FileText)}</article>)}</div>
    <details className="si-other-docs"><summary>Ajouter d’autres pièces</summary><div className="si-context-grid">
      <label className="ip-field"><span>Type de pièce</span><select value={otherType} disabled={!!busy} onChange={e => setOtherType(e.target.value)}>{[['other','Autre document'],['payslip','Bulletin de paie'],['dsn','DSN'],['employment_contract','Contrat de travail'],['duerp','DUERP']].map(([v,l]) => <option value={v} key={v}>{l}</option>)}</select></label>
      <label className="ip-field"><span>Société concernée</span><select disabled={!!busy} value={otherCompany || (companies.length===1 ? companies[0].id : '')} onChange={e => setOtherCompany(e.target.value)}><option value="">Choisir une société</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    </div>{drop('Pièces complémentaires', {document_type:otherType, company_id:otherCompany || (companies.length===1 ? companies[0].id : '')}, FileUp)}</details>
    <section className="si-files"><div className="si-section-title"><FileCheckIcon/><h3>Vos dépôts</h3><button type="button" className="si-refresh" disabled={loading || !!busy} onClick={refresh}><RefreshCw size={15} className={loading ? 'ip-spin' : ''}/> Actualiser</button></div>
      {files.length === 0 && <p>{loading ? 'Chargement…' : 'Aucun fichier ajouté pour le moment.'}</p>}
      {files.map(file => {const status = documentStatus(file, platform?.items?.find(item => item.id === file.document_id));const Icon = file.status === 'sent' ? Check : file.status === 'rejected' ? CircleAlert : Clock3;
        return <div className="si-file" key={file.id}><FileText size={21}/><div><strong>{file.file_name}</strong><small>{directors.find(d=>d.id===file.director_id)?.name || companies.find(c=>c.siren===file.company_siren)?.name || 'Dossier client'}</small><span className={`si-file-status is-${file.status}`}><Icon size={13}/>{status}</span>{file.last_error && <small role="status">{file.last_error}</small>}</div>{!['sent','sending'].includes(file.status) && <button className="si-remove" aria-label={`Retirer ${file.file_name}`} disabled={!!busy} onClick={()=>remove(file.id)}><Trash2 size={16}/></button>}</div>;})}
      {busy && <p className="si-uploading" role="status"><LoaderCircle size={17} className="ip-spin"/> Enregistrement : {busy}</p>}
      {platform?.reason && <p className="si-delivery-note">{platform.reason}</p>}
    </section>
    {platform?.available && <details className="si-other-docs"><summary>État dans l’espace client · {platform.documents?.total || 0} document(s)</summary><p>Une pièce est complète lorsque son analyse est terminée.</p>{platform.expected?.map((piece,i) => <div className="si-checklist" key={`${piece.key}-${i}`}><span>{piece.label}{piece.company?.name ? ` · ${piece.company.name}` : ''}</span><small>{piece.status==='received' ? 'Analysé' : 'À compléter / analyse en attente'}</small></div>)}</details>}
    {!loading && !hasRequiredSaleDocuments(files) && <p role="status">Un document doit être enregistré avant de continuer. Les dépôts refusés doivent être corrigés.</p>}
    {error && <div className="si-error" role="alert">{error}</div>}
    <footer className="si-actions"><button className="ip-secondary" disabled={!!busy} onClick={onBack}><ArrowLeft size={16}/> Fiche</button><button className="ip-primary" disabled={!!busy || loading || !hasRequiredSaleDocuments(files)} onClick={continueToBilling}>Continuer vers la facturation<ArrowRight size={17}/></button></footer>
  </section>;
}
function FileCheckIcon(){return <FileText size={19}/>;}
