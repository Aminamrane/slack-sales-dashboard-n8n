import SalesAssessmentFields from '../SalesAssessmentFields';
import { salesAssessmentResult } from '../../utils/salesAssessment';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CloudSun, FileCheck2, UsersRound, BriefcaseBusiness, ListChecks, LoaderCircle, Check } from 'lucide-react';
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
      setContext(value); setDraft(value.draft);
    }).catch(e => { if (live) setError(e.message || 'Impossible de charger la fiche.'); });
    return () => { live = false; };
  }, [leadId, reload]);
  async function save() {
    if (busy) return;
    if (!draft.personal_situation?.trim() || !draft.professional_situation?.trim() || !salesAssessmentResult(draft.sales_assessment)) {
      setError('Complétez les deux situations et les cinq questions de préparation à l’onboarding.'); return;
    }
    setBusy(true); setError('');
    try {
      const saved = await apiClient.put(`/api/v1/owner-integration/leads/${leadId}/sale-intake`, {
        revision: context.revision, contract_id: context.contract_id,
        personal_situation: draft.personal_situation, professional_situation: draft.professional_situation,
        sales_assessment: draft.sales_assessment,
        missions: (draft.missions || []).map(m => m.trim()).filter(Boolean),
      });
      onSaved(saved);
    } catch (e) { setError(e.message || 'La fiche n’a pas pu être enregistrée.'); }
    finally { setBusy(false); }
  }
  const update = (key, value) => setDraft(d => ({...d, [key]: value}));
  const missions = Array.from({length: Math.max(5, draft?.missions?.length || 0)}, (_, i) => draft?.missions?.[i] || '');
  return <section className="integration-preview ip-embedded si-handoff">
    <header className="si-title"><span className="si-title-icon"><FileCheck2 size={26}/></span><div><small>PASSAGE DE RELAIS</small><h2>Finaliser la fiche d’intégration</h2><p>Complétez chaque rubrique obligatoire. Les points de vigilance et les missions potentielles sont facultatifs.</p></div></header>
    {context && <div className="si-client-caption"><Check size={15}/><strong>{context.client_name}</strong><span>Dossier signé</span></div>}
    {!draft && !error && <p role="status"><LoaderCircle size={18} className="ip-spin"/> Chargement de la fiche…</p>}
    {draft && <fieldset disabled={busy}>
      <div className="si-context-grid">
        <label className="ip-field"><span><UsersRound size={17}/> Situation personnelle des dirigeants · obligatoire</span><textarea required rows={3} maxLength={2000} value={draft.personal_situation || ''} onChange={e => update('personal_situation', e.target.value)} placeholder="Contexte utile, ou « Non communiqué »."/></label>
        <label className="ip-field"><span><BriefcaseBusiness size={17}/> Situation professionnelle des dirigeants · obligatoire</span><textarea required rows={3} maxLength={2000} value={draft.professional_situation || ''} onChange={e => update('professional_situation', e.target.value)} placeholder="Activité, organisation, projets et points d’attention."/></label>
      </div>
      <section className="si-section"><div className="si-section-title"><CloudSun size={19}/><h3>État du client à l’entrée</h3><span>Obligatoire</span></div>
        <SalesAssessmentFields value={draft.sales_assessment || {}} onChange={value=>update('sales_assessment',value)}/>
      </section>
      <section className="si-section"><div className="si-section-title"><ListChecks size={19}/><h3>Missions potentielles</h3><span>Facultatif</span></div><p>Les sujets identifiés avec le client. Complétez uniquement les pistes utiles au cabinet.</p>
        <div className="si-missions">{missions.map((value, i) => <label key={i}><span>{String(i + 1).padStart(2, '0')}</span><input aria-label={`Mission potentielle ${i + 1}`} value={value} maxLength={200} placeholder={['Ex. Création d’une holding', 'Ex. Optimisation de la rémunération', 'Ex. Accompagnement social', 'Autre mission envisagée', 'Autre mission envisagée'][i] || 'Autre mission envisagée'} onChange={e => { const next = [...missions]; next[i] = e.target.value; update('missions', next); }}/></label>)}</div>
      </section>
    </fieldset>}
    {error && <div className="si-error" role="alert">{error}{!draft && <button onClick={() => setReload(v => v + 1)}>Réessayer</button>}</div>}
    <footer className="si-actions"><button className="ip-secondary" disabled={busy} onClick={onBack}><ArrowLeft size={16}/> {backLabel}</button><button className="ip-primary" disabled={!draft || busy} onClick={save}>{busy ? 'Enregistrement…' : 'Continuer vers les documents'}<ArrowRight size={17}/></button></footer>
  </section>;
}
