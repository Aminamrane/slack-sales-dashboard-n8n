import { useEffect, useRef, useState } from 'react';
import { Download, FileText, LoaderCircle } from 'lucide-react';
import apiClient from '../services/apiClient';

const buttonStyle = { display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7, padding:'9px 12px', borderRadius:9, fontSize:12, fontWeight:650, cursor:'pointer', textDecoration:'none' };

export default function BoardIntegrationSheet({ numero }) {
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
  if (!numero) return null;
  return <section aria-label="Fiche d’intégration" style={{ marginBottom:22, padding:16, border:'1px solid #e9ebf0', borderRadius:12, background:'#f8faf9', color:'#1e2330' }}>
    <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
      <FileText size={21} style={{ color:'#526b68', flexShrink:0, marginTop:2 }}/>
      <div><h3 style={{ margin:0, fontSize:14 }}>Fiche d’intégration</h3>
        <p style={{ margin:'5px 0 0', fontSize:12, lineHeight:1.5, color:'#687483' }}>
          {state?.available ? 'Le périmètre validé et le passage de relais du commercial.' : state ? state.message : error ? '' : 'Chargement de la fiche…'}
        </p>
      </div>
    </div>
    {state?.available && <>
      {state.author_name && <p style={{ margin:'10px 0', fontSize:11, color:'#687483' }}>Finalisée par {state.author_name}{state.updated_at ? ` · ${new Date(state.updated_at).toLocaleDateString('fr-FR')}` : ''}</p>}
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:12 }}>
        <button type="button" disabled={busy} onClick={openPdf} style={{ ...buttonStyle, background:'#253f3d', color:'#fff', border:'1px solid #253f3d', opacity:busy ? .65 : 1 }}>
          {busy ? <LoaderCircle size={15}/> : <FileText size={15}/>}{busy ? 'Préparation…' : 'Voir le PDF'}
        </button>
        {pdf && <a href={pdf} download={`fiche-integration-${numero.replace(/[^0-9]/g, '')}.pdf`} style={{ ...buttonStyle, border:'1px solid #dce3e1', color:'#253f3d', background:'#fff' }}><Download size={15}/>Télécharger</a>}
      </div>
      {pdf && <a href={pdf} target="_blank" rel="noopener noreferrer" style={{ display:'inline-block', fontSize:11, color:'#526b68', marginTop:9 }}>Ouvrir si le nouvel onglet a été bloqué</a>}
    </>}
    {error && <p role="alert" style={{ margin:'10px 0 0', fontSize:12, color:'#b42318' }}>{error}</p>}
  </section>;
}
