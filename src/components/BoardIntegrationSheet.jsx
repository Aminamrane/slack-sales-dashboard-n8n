import { useEffect, useRef, useState } from 'react';
import { Download, FileText, LoaderCircle } from 'lucide-react';
import apiClient from '../services/apiClient';
import { METEO_MEANING, MeteoPicker, MeteoMeaning } from './meteo.jsx';

const buttonStyle = { display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7, padding:'9px 12px', borderRadius:9, fontSize:12, fontWeight:650, cursor:'pointer', textDecoration:'none' };
// Météo d'onboarding : le Client Success (et admin/CEO en support) finalise la fiche. Les sales
// ne la posent jamais ici, le cabinet ne fait que la lire.
const RATING_ROLES = ['customer_success_manager', 'admin', 'ceo'];
const fmtDate = (iso) => { try { return iso ? new Date(iso).toLocaleDateString('fr-FR') : ''; } catch { return ''; } };

// Notation d'onboarding : 5 niveaux + description obligatoire. Réutilisé par le parcours
// « Faire l'onboarding » ; ici il apparaît dès que la partie commerciale est terminée.
export function OnboardingRatingForm({ numero, onSaved, compact = false }) {
  const [weather, setWeather] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canSave = !!weather && note.trim().length > 0 && !busy;
  async function save() {
    if (!canSave) return;
    setBusy(true); setError('');
    try {
      const data = await apiClient.put('/api/v1/optilex/integration-sheet/onboarding', { numero_client: numero, weather, weather_note: note.trim() });
      onSaved?.(data);
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.data?.detail || e?.message;
      setError(typeof detail === 'string' ? detail : 'Enregistrement impossible, réessayez.');
    } finally { setBusy(false); }
  }
  return <div style={{ marginTop: compact ? 0 : 12, padding: compact ? 0 : 12, borderRadius:10, border: compact ? 'none' : '1px dashed #b9c9c6', background: compact ? 'transparent' : '#fff' }}>
    {!compact && <div style={{ fontSize:12.5, fontWeight:700, color:'#1e2330', marginBottom:6 }}>Votre météo d’onboarding</div>}
    {/* Même sélecteur, mêmes icônes et couleurs que la météo client du board : c'est la même météo. */}
    <MeteoPicker value={weather} onChange={setWeather} />
    <div style={{ margin:'8px 0' }}><MeteoMeaning value={weather} /></div>
    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000}
      placeholder="Ce que vous retenez de l’onboarding : situation, points d’attention, prochaines étapes (obligatoire)"
      style={{ width:'100%', boxSizing:'border-box', padding:'8px 10px', borderRadius:8, border:'1px solid #dce3e1', fontSize:12.5, fontFamily:'inherit', resize:'vertical', marginBottom:8 }} />
    <button type="button" disabled={!canSave} onClick={save}
      style={{ ...buttonStyle, width:'100%', background: canSave ? '#253f3d' : '#e9ebf0', color: canSave ? '#fff' : '#8a93a4', border:'none', cursor: canSave ? 'pointer' : 'default' }}>
      {busy ? <LoaderCircle size={15}/> : <FileText size={15}/>}{busy ? 'Enregistrement…' : 'Enregistrer et finaliser la fiche'}
    </button>
    {error && <p role="alert" style={{ margin:'8px 0 0', fontSize:12, color:'#b42318' }}>{error}</p>}
  </div>;
}

export default function BoardIntegrationSheet({ numero, onRated }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState('');
  const url = useRef('');
  const alive = useRef(true);
  const endpoint = `/api/v1/optilex/integration-sheet?numero_client=${encodeURIComponent(numero || '')}`;
  useEffect(() => {
    alive.current = true;
    if (numero) apiClient.get(endpoint).then(data => { if (alive.current) setState(data); })
      .catch(() => { if (alive.current) setError('Impossible de charger la fiche. Rouvrez les détails pour réessayer.'); });
    return () => { alive.current = false; if (url.current) URL.revokeObjectURL(url.current); };
  }, [endpoint, numero]);

  async function openPdf() {
    // Open synchronously so browsers do not block the PDF after the authenticated fetch.
    const tab = window.open('about:blank', '_blank');
    if (tab) { tab.opener = null; tab.document.title = 'Fiche d’intégration'; tab.document.body.textContent = 'Préparation du PDF…'; }
    if (pdf) { if (tab) tab.location.replace(pdf); return; }
    setBusy(true); setError('');
    try {
      const response = await apiClient._authenticatedFetch(`${apiClient.baseUrl}/api/v1/optilex/integration-sheet/pdf?numero_client=${encodeURIComponent(numero)}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || 'Le PDF n’a pas pu être préparé. Réessayez.');
      }
      if (!response.headers.get('content-type')?.includes('application/pdf')) throw new Error('Le document reçu n’est pas un PDF. Réessayez.');
      const blob = await response.blob();
      if (!alive.current) { tab?.close(); return; }
      url.current = URL.createObjectURL(blob); setPdf(url.current);
      if (tab && !tab.closed) tab.location.replace(url.current);
    } catch (e) { tab?.close(); if (alive.current) setError(e.message); }
    finally { if (alive.current) setBusy(false); }
  }
  function onRatingSaved(data) {
    // Le PDF déjà préparé ne contient pas la nouvelle météo : on repart de zéro.
    if (url.current) { URL.revokeObjectURL(url.current); url.current = ''; }
    setPdf(''); setState(data); onRated?.(data);
  }
  if (!numero) return null;
  const role = (apiClient.getUser() || {}).role;
  const onboarding = state?.onboarding;
  const canRate = state?.available && !onboarding?.completed && RATING_ROLES.includes(role);
  const description = state?.available
    ? (state.final ? 'Fiche finalisée : périmètre, passage de relais du commercial et météo d’onboarding.' : state.message)
    : state ? state.message : error ? '' : 'Chargement de la fiche…';
  return <section aria-label="Fiche d’intégration" style={{ marginBottom:22, padding:16, border:'1px solid #e9ebf0', borderRadius:12, background:'#f8faf9', color:'#1e2330' }}>
    <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
      <FileText size={21} style={{ color:'#526b68', flexShrink:0, marginTop:2 }}/>
      <div><h3 style={{ margin:0, fontSize:14 }}>Fiche d’intégration{state?.available && <span style={{ marginLeft:8, fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:999, background: state.final ? '#e3f4ea' : '#fff4e0', color: state.final ? '#15794a' : '#b45309' }}>{state.final ? 'Finalisée' : 'À finaliser'}</span>}</h3>
        <p style={{ margin:'5px 0 0', fontSize:12, lineHeight:1.5, color:'#687483' }}>{description}</p>
      </div>
    </div>
    {state?.available && <>
      <div style={{ margin:'10px 0 0', fontSize:11.5, lineHeight:1.6, color:'#687483' }}>
        <div>Partie commerciale : {state.author_name || 'commercial'}{state.updated_at ? ` · ${fmtDate(state.updated_at)}` : ''}</div>
        <div>Onboarding : {onboarding?.completed
          ? <>{onboarding.author_name || 'Client Success'}{onboarding.completed_at ? ` · ${fmtDate(onboarding.completed_at)}` : ''}{onboarding.weather ? ` · météo ${onboarding.weather}/5, ${METEO_MEANING[onboarding.weather]?.txt || ''}` : ''}</>
          : <span style={{ color:'#b45309', fontWeight:600 }}>météo d’onboarding en attente</span>}</div>
      </div>
      {canRate && <OnboardingRatingForm numero={numero} onSaved={onRatingSaved} />}
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:12 }}>
        <button type="button" disabled={busy} onClick={openPdf} style={{ ...buttonStyle, background:'#253f3d', color:'#fff', border:'1px solid #253f3d', opacity:busy ? .65 : 1 }}>
          {busy ? <LoaderCircle size={15}/> : <FileText size={15}/>}{busy ? 'Préparation…' : state.final ? 'Voir le PDF' : 'Voir le PDF provisoire'}
        </button>
        {pdf && <a href={pdf} download={`fiche-integration-${numero.replace(/[^0-9]/g, '')}.pdf`} style={{ ...buttonStyle, border:'1px solid #dce3e1', color:'#253f3d', background:'#fff' }}><Download size={15}/>Télécharger</a>}
      </div>
      {pdf && <a href={pdf} target="_blank" rel="noopener noreferrer" style={{ display:'inline-block', fontSize:11, color:'#526b68', marginTop:9 }}>Ouvrir si le nouvel onglet a été bloqué</a>}
    </>}
    {error && <p role="alert" style={{ margin:'10px 0 0', fontSize:12, color:'#b42318' }}>{error}</p>}
  </section>;
}
