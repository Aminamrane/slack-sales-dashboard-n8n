import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CloudSun, Sun, Cloud, CloudRain, CloudLightning, FileCheck2, UsersRound, BriefcaseBusiness, ListChecks, LoaderCircle, Check } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { WEATHER_LABELS } from './model';
import './integrationPreview.css';
export { default as SaleDocuments } from './SaleDocuments';

const ICONS = [CloudLightning, CloudRain, Cloud, CloudSun, Sun];
export function SaleIntake({ leadId, onBack, onSaved }) {
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
    if (!draft.personal_situation?.trim() || !draft.professional_situation?.trim() || !draft.weather || !draft.weather_note?.trim()) {
      setError('Complétez les deux situations, choisissez la météo et ajoutez son commentaire.'); return;
    }
    setBusy(true); setError('');
    try {
      const saved = await apiClient.put(`/api/v1/owner-integration/leads/${leadId}/sale-intake`, {
        revision: context.revision, contract_id: context.contract_id,
        personal_situation: draft.personal_situation, professional_situation: draft.professional_situation,
        weather: draft.weather, weather_note: draft.weather_note,
        missions: (draft.missions || []).map(m => m.trim()).filter(Boolean),
      });
      onSaved(saved);
    } catch (e) { setError(e.message || 'La fiche n’a pas pu être enregistrée.'); }
    finally { setBusy(false); }
  }
  const update = (key, value) => setDraft(d => ({...d, [key]: value}));
  const missions = Array.from({length: Math.max(5, draft?.missions?.length || 0)}, (_, i) => draft?.missions?.[i] || '');
  return <section className="integration-preview ip-embedded si-handoff">
    <header className="si-title"><span className="si-title-icon"><FileCheck2 size={26}/></span><div><small>PASSAGE DE RELAIS</small><h2>Finaliser la fiche d’intégration</h2><p>Le contexte et les pistes utiles à l’équipe qui accompagne votre client.</p></div></header>
    {context && <div className="si-client-caption"><Check size={15}/><strong>{context.client_name}</strong><span>Dossier signé</span></div>}
    {!draft && !error && <p role="status"><LoaderCircle size={18} className="ip-spin"/> Chargement de la fiche…</p>}
    {draft && <fieldset disabled={busy}>
      <div className="si-context-grid">
        <label className="ip-field"><span><UsersRound size={17}/> Situation personnelle des dirigeants</span><textarea rows={3} maxLength={2000} value={draft.personal_situation || ''} onChange={e => update('personal_situation', e.target.value)} placeholder="Contexte utile, ou « Non communiqué »."/></label>
        <label className="ip-field"><span><BriefcaseBusiness size={17}/> Situation professionnelle des dirigeants</span><textarea rows={3} maxLength={2000} value={draft.professional_situation || ''} onChange={e => update('professional_situation', e.target.value)} placeholder="Activité, organisation, projets et points d’attention."/></label>
      </div>
      <section className="si-section"><div className="si-section-title"><CloudSun size={19}/><h3>Météo client</h3><span>Votre ressenti à transmettre</span></div>
        <div className="ip-weather-options">{ICONS.map((Icon, i) => <button key={i} type="button" aria-label={`Météo ${i + 1} sur 5 : ${WEATHER_LABELS[i]}`} aria-pressed={draft.weather === i + 1} onClick={() => update('weather', i + 1)}><Icon size={24}/><strong>{i + 1}/5</strong><span>{WEATHER_LABELS[i]}</span></button>)}</div>
        <label className="ip-field"><span>Commentaire de météo · obligatoire</span><textarea rows={2} maxLength={2000} value={draft.weather_note || ''} onChange={e => update('weather_note', e.target.value)} placeholder="Ce qui explique votre appréciation et les points à transmettre."/></label>
      </section>
      <section className="si-section"><div className="si-section-title"><ListChecks size={19}/><h3>Missions potentielles</h3><span>Facultatif</span></div><p>Les sujets identifiés avec le client. Complétez uniquement les pistes utiles au cabinet.</p>
        <div className="si-missions">{missions.map((value, i) => <label key={i}><span>{String(i + 1).padStart(2, '0')}</span><input aria-label={`Mission potentielle ${i + 1}`} value={value} maxLength={200} placeholder={['Ex. Création d’une holding', 'Ex. Optimisation de la rémunération', 'Ex. Accompagnement social', 'Autre mission envisagée', 'Autre mission envisagée'][i] || 'Autre mission envisagée'} onChange={e => { const next = [...missions]; next[i] = e.target.value; update('missions', next); }}/></label>)}</div>
      </section>
    </fieldset>}
    {error && <div className="si-error" role="alert">{error}{!draft && <button onClick={() => setReload(v => v + 1)}>Réessayer</button>}</div>}
    <footer className="si-actions"><button className="ip-secondary" disabled={busy} onClick={onBack}><ArrowLeft size={16}/> Rendez-vous</button><button className="ip-primary" disabled={!draft || busy} onClick={save}>{busy ? 'Enregistrement…' : 'Continuer vers les documents'}<ArrowRight size={17}/></button></footer>
  </section>;
}
