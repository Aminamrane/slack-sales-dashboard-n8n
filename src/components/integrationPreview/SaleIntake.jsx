import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CloudSun, Sun, Cloud, CloudRain, CloudLightning, FileCheck2, FileUp, UsersRound, LoaderCircle } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { WEATHER_LABELS } from './model';
import './integrationPreview.css';

const ICONS = [CloudLightning, CloudRain, Cloud, CloudSun, Sun];
export function SaleIntake({ leadId, onBack, onSaved }) {
  const [context, setContext] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    apiClient.get(`/api/v1/owner-integration/leads/${leadId}/sale-intake`).then(value => {
      if (live) {
        if (!value.required || !value.draft) {
          setError('Le parcours de ce dossier a changé. Fermez puis rouvrez la déclaration.');
          return;
        }
        setContext(value); setDraft(value.draft);
      }
    }).catch(e => { if (live) setError(e.message || 'Impossible de charger la fiche.'); });
    return () => { live = false; };
  }, [leadId]);
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
      });
      onSaved(saved);
    } catch (e) { setError(e.message || 'La fiche n’a pas pu être enregistrée.'); }
    finally { setBusy(false); }
  }
  const update = (key, value) => setDraft(d => ({...d, [key]: value}));
  return <section className="integration-preview ip-embedded si-handoff">
    <header className="si-title"><FileCheck2 size={30} /><div><h2>Finalisation de la fiche d’intégration</h2><p>Transmettez le contexte utile à Vincent, à la facturation et au cabinet.</p></div></header>
    {!draft && !error && <p role="status"><LoaderCircle size={18} className="ip-spin" /> Chargement de la fiche…</p>}
    {draft && <fieldset disabled={busy}>
      <label className="ip-field"><span>Situation personnelle des dirigeants</span><textarea rows={3} maxLength={2000} value={draft.personal_situation || ''} onChange={e => update('personal_situation', e.target.value)} placeholder="Les informations personnelles utiles à l’accompagnement, ou « Non communiqué »." /></label>
      <label className="ip-field"><span>Situation professionnelle des dirigeants</span><textarea rows={3} maxLength={2000} value={draft.professional_situation || ''} onChange={e => update('professional_situation', e.target.value)} placeholder="Activité, organisation, projets et points d’attention." /></label>
      <h3>Météo client</h3><div className="ip-weather-options">{ICONS.map((Icon, i) => <button key={i} type="button" aria-pressed={draft.weather === i + 1} onClick={() => update('weather', i + 1)}><Icon size={25} /><strong>{i + 1}/5</strong><span>{WEATHER_LABELS[i]}</span></button>)}</div>
      <label className="ip-field"><span>Commentaire de météo · obligatoire</span><textarea rows={2} maxLength={2000} value={draft.weather_note || ''} onChange={e => update('weather_note', e.target.value)} placeholder="Ce qui explique votre appréciation et les points à transmettre." /></label>
    </fieldset>}
    {error && <p className="ti-field-error" role="alert">{error}</p>}
    <footer className="si-actions"><button className="ip-secondary" disabled={busy} onClick={onBack}><ArrowLeft size={16} /> Rendez-vous</button><button className="ip-primary" disabled={!draft || busy} onClick={save}>{busy ? 'Enregistrement…' : 'Continuer vers les documents'}<ArrowRight size={17} /></button></footer>
  </section>;
}

export function SaleDocuments({ draft, onBack, onContinue }) {
  const companies = draft?.companies?.filter(c => c.selected) || [];
  const directors = draft?.directors?.filter(d => d.companies.some(id => companies.some(c => c.id === id))) || [];
  return <section className="integration-preview ip-embedded si-documents">
    <header className="si-title"><FileUp size={30} /><div><h2>Documents des dirigeants</h2><p>Un espace distinct pour chaque dirigeant du dossier.</p></div></header>
    <p className="ip-soft-note">Le dépôt sera disponible après le branchement de la plateforme et la confirmation des pièces demandées. Aucun document n’est demandé ni transmis à cette étape pour le moment.</p>
    {directors.map(d => <article className="si-director-documents" key={d.id}><h3><UsersRound size={18} />{d.name}</h3><div className="si-document-slots">{['Avis d’imposition', 'Deuxième pièce · à préciser', 'Troisième pièce · à préciser'].map(label => <div className="si-document-slot" key={label} aria-disabled="true"><FileUp size={20} /><span>{label}</span><small>Dépôt à venir</small></div>)}</div></article>)}
    <footer className="si-actions"><button className="ip-secondary" onClick={onBack}><ArrowLeft size={16} /> Fiche</button><button className="ip-primary" onClick={onContinue}>Continuer vers la facturation<ArrowRight size={17} /></button></footer>
  </section>;
}
