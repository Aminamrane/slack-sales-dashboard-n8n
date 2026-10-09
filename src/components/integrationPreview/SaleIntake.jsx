import SalesAssessmentFields from '../SalesAssessmentFields';
import { salesAssessmentComplete, rankedMissions } from '../../utils/salesAssessment';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CloudSun, FileCheck2, LoaderCircle, Check, UserCheck } from 'lucide-react';
import { eligibleHandoffDirectors, prepareHandoffAccess, handoffAccountAccesses, handoffAccessError } from './handoffAccess';
import apiClient from '../../services/apiClient';
import './integrationPreview.css';
export { default as SaleDocuments } from './SaleDocuments';

export function SaleIntake({ leadId, onBack, onSaved, backLabel = "Rendez-vous" }) {
  const [context, setContext] = useState(null), [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [reload, setReload] = useState(0);
  useEffect(() => {
    let live = true; setError('');
    apiClient.get(`/api/v1/owner-integration/leads/${leadId}/sale-intake`).then(value => {
      if (!live) return;
      if (!value.required || !value.draft) { setError('Le parcours de ce dossier a changé. Fermez puis rouvrez la déclaration.'); return; }
      setContext(value);
      const assessment = value.draft.sales_assessment || {};
      const priorities = rankedMissions(assessment.priority_missions);
      const missions = priorities.length ? priorities : rankedMissions(value.draft.missions);
      setDraft(prepareHandoffAccess({...value.draft, missions, sales_assessment: {...assessment, priority_missions: missions}}, value.account_access_required));
    }).catch(e => { if (live) setError(e.message || 'Impossible de charger la fiche.'); });
    return () => { live = false; };
  }, [leadId, reload]);
  async function save() {
    if (busy) return;
    const accessError = context.account_access_required && handoffAccessError(draft);
    if (accessError) { setError(accessError); return; }
    if (!salesAssessmentComplete(draft.sales_assessment)) {
      setError('Répondez aux cinq premières questions et renseignez au moins une mission à la question 6.'); return;
    }
    setBusy(true); setError('');
    try {
      const saved = await apiClient.put(`/api/v1/owner-integration/leads/${leadId}/sale-intake`, {
        revision: context.revision, contract_id: context.contract_id,
        ...(context.account_access_required ? {account_accesses: handoffAccountAccesses(draft)} : {}),
        sales_assessment: {...draft.sales_assessment, priority_missions: rankedMissions(draft.sales_assessment.priority_missions)},
        missions: rankedMissions(draft.sales_assessment.priority_missions),
      });
      onSaved(saved);
    } catch (e) { setError(e.message || 'La fiche n’a pas pu être enregistrée.'); }
    finally { setBusy(false); }
  }
  const update = (key, value) => { setError(''); setDraft(d => ({...d, [key]: value})); };
  const updateDirector = (id, fields) => update('directors', draft.directors.map(d => d.id === id ? {...d, ...fields} : d));
  return <section className="integration-preview ip-embedded si-handoff">
    <header className="si-title"><span className="si-title-icon"><FileCheck2 size={26}/></span><div><small>PASSAGE DE RELAIS</small><h2>Finaliser la fiche d’intégration</h2><p>Complétez chaque rubrique obligatoire. Seuls les points de vigilance sont facultatifs.</p></div></header>
    {context && <div className="si-client-caption"><Check size={15}/><strong>{context.client_name}</strong><span>Dossier signé</span></div>}
    {!draft && !error && <p role="status"><LoaderCircle size={18} className="ip-spin"/> Chargement de la fiche…</p>}
    {draft && <fieldset disabled={busy}>
      {context.account_access_required && <section className="si-section si-account-access">
        <div className="si-section-title"><UserCheck size={19}/><h3>Accès à la plateforme</h3><span>Obligatoire</span></div>
        <p>Choisissez au moins un dirigeant qui recevra son accès.</p>
        {eligibleHandoffDirectors(draft).map(d => <div className="si-account-holder" key={d.id}>
          <label className="si-account-choice"><input type="checkbox" checked={!!d.provisional_access}
            disabled={eligibleHandoffDirectors(draft).length === 1}
            onChange={e => updateDirector(d.id, {provisional_access: e.target.checked})}/><strong>{d.name}</strong></label>
          {d.provisional_access && <label className="ip-field"><span>Email de connexion</span><input type="email" autoComplete="off" value={d.email || ''}
            onChange={e => updateDirector(d.id, {email: e.target.value})}/></label>}
        </div>)}
      </section>}
      <section className="si-section"><div className="si-section-title"><CloudSun size={19}/><h3>État du client à l’entrée</h3><span>Obligatoire</span></div>
        <SalesAssessmentFields value={draft.sales_assessment || {}} onChange={value=>update('sales_assessment',value)}/>
      </section>
    </fieldset>}
    {error && <div className="si-error" role="alert">{error}{!draft && <button onClick={() => setReload(v => v + 1)}>Réessayer</button>}</div>}
    <footer className="si-actions"><button className="ip-secondary" disabled={busy} onClick={onBack}><ArrowLeft size={16}/> {backLabel}</button><button className="ip-primary" disabled={!draft || busy} onClick={save}>{busy ? 'Enregistrement…' : 'Continuer vers les documents'}<ArrowRight size={17}/></button></footer>
  </section>;
}
