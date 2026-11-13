import SalesEntryCard from './SalesEntryCard';
import WeatherCaseComposer from './WeatherCaseComposer';
import { WEATHER, weatherPresentation, weatherRatingLabel } from '../utils/weatherCase';
import { SALES_LEVELS, salesScore } from '../utils/salesAssessment';
import './integrationWallet.css';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Download, FileText, LoaderCircle } from 'lucide-react';
import apiClient from '../services/apiClient';
import EarlyDeclarationNote from './EarlyDeclarationNote';
import ComplicatedClientNote from './ComplicatedClientNote';
import { METEO_MEANING, MeteoIcon, MeteoPicker, MeteoMeaning } from './meteo.jsx';

const buttonStyle = { display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7, padding:'9px 12px', borderRadius:9, fontSize:12, fontWeight:500, cursor:'pointer', textDecoration:'none' };
// Météo d'onboarding : le Client Success (et admin/CEO en support) finalise la fiche. Les sales
// ne la posent jamais ici, le cabinet ne fait que la lire.
const RATING_ROLES = ['customer_success_manager', 'admin', 'ceo'];
const fmtDate = (iso) => { try { return iso ? new Date(iso).toLocaleDateString('fr-FR') : ''; } catch { return ''; } };

// Notation d'onboarding : 5 niveaux + description obligatoire. Réutilisé par le parcours
// « Faire l'onboarding » ; ici il apparaît dès que la partie commerciale est terminée.
export function OnboardingRatingForm({ numero, onSaved, controlRef }) {
  return <WeatherCaseComposer requireNote controlRef={controlRef} saveLabel="Enregistrer et finaliser la fiche" onSave={async payload=>{
    const data=await apiClient.put('/api/v1/optilex/integration-sheet/onboarding', {
      numero_client:numero, weather:payload.score, weather_note:payload.note,
      weather_context:{version:2,qualification:payload.qualification},request_key:payload.request_key,mentions:payload.mentions,
    });
    onSaved?.(data);
    return true;
  }}/>;
}

// `compact` (onglet Détails du board, dev 25/09) : une ligne statut + PDF. La météo
// d'onboarding se saisit dans le parcours « Faire l'onboarding », plus ici.
export default function BoardIntegrationSheet({ numero, onRated, compact = false }) {
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
  // Portefeuille de la fiche (refonte board) + la note « vente déclarée sans documents » de main (24ac545).
  if (compact) return <><IntegrationWallet state={state} error={error} busy={busy} pdf={pdf} onPdf={openPdf} /><ComplicatedClientNote flagged={state?.client_complique} compact/><EarlyDeclarationNote documents={state?.documents} compact/></>;
  return <section aria-label="Fiche d’intégration" style={{ marginBottom:22, padding:16, border:'1px solid #ece9e4', borderRadius:12, background:'#f8faf9', color:'#1c1b19' }}>
    <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
      <FileText size={21} style={{ color:'#526b68', flexShrink:0, marginTop:2 }}/>
      <div><h3 style={{ margin:0, fontSize:14 }}>Fiche d’intégration{state?.available && <span style={{ marginLeft:8, fontSize:11, fontWeight:500, padding:'2px 8px', borderRadius:999, background: state.final ? '#e3f4ea' : '#fde9da', color: state.final ? '#0b7a4b' : '#c2500e' }}>{state.final ? 'Finalisée' : 'À finaliser'}</span>}</h3>
        <p style={{ margin:'5px 0 0', fontSize:12, lineHeight:1.5, color:'#8b867e' }}>{description}</p>
      </div>
    </div>
    {state && <SalesEntryCard entry={state.sales_entry}/> }
    <ComplicatedClientNote flagged={state?.client_complique}/>
    <EarlyDeclarationNote documents={state?.documents}/>
    {state?.available && <>
      <div style={{ margin:'10px 0 0', fontSize:11.5, lineHeight:1.6, color:'#8b867e' }}>
        <div>Partie commerciale : {state.author_name || 'commercial'}{state.updated_at ? ` · ${fmtDate(state.updated_at)}` : ''}</div>
        <div>Onboarding : {onboarding?.completed
          ? <>{onboarding.author_name || 'Client Success'}{onboarding.completed_at ? ` · ${fmtDate(onboarding.completed_at)}` : ''}{onboarding.weather ? ` · météo ${weatherRatingLabel(onboarding.weather,onboarding.weather_context)}` : ''}</>
          : <span style={{ color:'#c2500e', fontWeight:500 }}>météo d’onboarding en attente</span>}</div>
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
    {error && <p role="alert" style={{ margin:'10px 0 0', fontSize:12, color:'#c5221f' }}>{error}</p>}
  </section>;
}

// ── Fiche d'intégration en portefeuille (dev 29/10/2026, réf. de portefeuille à cartes : « small svg nice ») ─────
// Une poche marine et trois cartes qui en dépassent : la partie commerciale, l'état du client à l'entrée (Sales),
// la météo d'onboarding. À l'ouverture les cartes glissent dans la poche ; au survol elles remontent ; la carte
// « État du client » s'ouvre sur la transmission commerciale. La poche porte le statut et le PDF.
const WALLET_TONES = {
  sky: ['#e4f0fd', '#1b6fd0'], sage: ['#d6ead4', '#3f7f4b'], lemon: ['#fef3b0', '#8f6f00'],
  coral: ['#ffc1b6', '#bf4436'], peach: ['#ffd6a5', '#b45d14'], mist: ['#f1eee9', '#6b665f'],
};
const LEVEL_TONE = { favorable: 'sage', vigilance: 'lemon', risk: 'coral' };
const WIco = ({ children }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
const W_ICONS = {
  sales: <WIco><rect x="3" y="7.5" width="18" height="12.5" rx="2.6" fill="currentColor" fillOpacity=".14" /><path d="M9 7.5V6a1.8 1.8 0 0 1 1.8-1.8h2.4A1.8 1.8 0 0 1 15 6v1.5M3 12.8h18" /></WIco>,
  gauge: <WIco><path d="M4.2 17.5a8 8 0 1 1 15.6 0" /><path className="iw-needle" d="m12 17 3.6-4.6" /><circle cx="12" cy="17" r="1.4" fill="currentColor" stroke="none" /></WIco>,
  wait: <WIco><circle cx="12" cy="12" r="8.5" fill="currentColor" fillOpacity=".14" /><path className="iw-hand" d="M12 7.5V12l3 2" /></WIco>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>,
  eye: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><g className="iw-lid"><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></g></svg>,
};
// Poche : bords relevés aux coins (« oreilles ») et creux au milieu, comme sur la réf ; couture en pointillé.
const pocketPath = (w, h, i = 0) => {
  const top = 18 + i, ear = i, r = 22 - i * 0.7;
  return `M${i} ${ear + 12}Q${i} ${ear} ${i + 12} ${ear}H${i + 24}C${i + 36} ${ear} ${i + 38} ${top} ${i + 54} ${top}H${w - i - 54}`
    + `C${w - i - 38} ${top} ${w - i - 36} ${ear} ${w - i - 24} ${ear}H${w - i - 12}Q${w - i} ${ear} ${w - i} ${ear + 12}`
    + `V${h - i - r}Q${w - i} ${h - i} ${w - i - r} ${h - i}H${i + r}Q${i} ${h - i} ${i} ${h - i - r}Z`;
};
const fmtShort = (iso) => { try { return iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' }) : ''; } catch { return ''; } };

function IntegrationWallet({ state, error, busy, pdf, onPdf }) {
  const pocket = useRef(null);
  const [w, setW] = useState(0);
  const [open, setOpen] = useState(false);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  useLayoutEffect(() => {
    const el = pocket.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [state?.available]);
  if (!state) return <section className="iw is-loading" aria-label="Fiche d’intégration">{error ? <p role="alert" className="iw-error">{error}</p> : <div className="iw-skel" />}</section>;
  if (!state.available) return <section className="iw is-empty" aria-label="Fiche d’intégration"><strong>Fiche d’intégration</strong><span>{state.message}</span></section>;
  const entry = state.sales_entry;
  const current = entry?.version === 1;
  const ob = state.onboarding;
  const obWeather = ob?.completed && ob.weather ? weatherPresentation(ob.weather, ob.weather_context) : null;
  const cards = [
    { key: 'sales', tone: 'sky', icon: W_ICONS.sales, title: 'Partie commerciale',
      sub: [state.author_name, fmtShort(state.updated_at)].filter(Boolean).join(' · '), right: <span className="iw-done">{W_ICONS.check}Faite</span> },
    { key: 'entry', tone: entry ? (current ? LEVEL_TONE[entry.level] : 'mist') : 'mist', icon: W_ICONS.gauge, title: 'État du client à l’entrée',
      sub: entry ? `Sales · ${entry.author_name || 'le commercial'}` : 'Questionnaire non renseigné',
      right: entry ? <span className="iw-badge">{current ? `${salesScore(entry.score)}/5 · ${SALES_LEVELS[entry.level]}` : `${salesScore(entry.legacy_score)}/5 · ancienne note`}</span> : null,
      onClick: entry ? () => setOpen((v) => !v) : null },
    obWeather
      ? { key: 'onboarding', tone: null, tile: WEATHER[ob.weather]?.tile, ink: WEATHER[ob.weather]?.ink, icon: <MeteoIcon score={ob.weather} size={18} color={WEATHER[ob.weather]?.ink} />,
          title: 'Météo d’onboarding', sub: [ob.author_name, fmtShort(ob.completed_at)].filter(Boolean).join(' · '), right: <span className="iw-badge">{weatherRatingLabel(ob.weather, ob.weather_context)}</span> }
      : { key: 'onboarding', tone: 'peach', icon: W_ICONS.wait, title: 'Météo d’onboarding', sub: 'À saisir dans « Faire l’onboarding »', right: <span className="iw-badge">En attente</span> },
  ];
  return (
    <section className={`iw${open ? ' is-open' : ''}`} aria-label="Fiche d’intégration">
      <div className="iw-stack">
        {cards.map((c, i) => {
          const [tile, ink] = c.tone ? WALLET_TONES[c.tone] : [c.tile, c.ink];
          const Tag = c.onClick ? 'button' : 'div';
          return (
            <Tag key={c.key} type={c.onClick ? 'button' : undefined} className={`iw-card is-c${i + 1}${c.onClick ? ' is-click' : ''}`} onClick={c.onClick || undefined}
              aria-expanded={c.onClick ? open : undefined} style={{ '--iw-tile': tile, '--iw-ink': ink, '--iw-i': i }}>
              <span className="iw-ic">{c.icon}</span>
              <span className="iw-tx"><strong>{c.title}</strong><small>{c.sub}</small></span>
              {c.right}
            </Tag>
          );
        })}
        <div ref={pocket} className="iw-pocket">
          {w > 0 && (
            <svg className="iw-pocket-svg" width={w} height="104" viewBox={`0 0 ${w} 104`} aria-hidden="true">
              <defs>
                <linearGradient id={`iwl-${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4a4540" /><stop offset="1" stopColor="#1c1b19" /></linearGradient>
                <filter id={`iws-${uid}`} x="-10%" y="-20%" width="120%" height="160%"><feGaussianBlur stdDeviation="9" /></filter>
              </defs>
              <rect x="18" y="40" width={w - 36} height="64" rx="24" fill="rgba(43,41,39,.196)" filter={`url(#iws-${uid})`} />
              <path d={pocketPath(w, 104)} fill={`url(#iwl-${uid})`} />
              <path d={pocketPath(w, 104)} fill="none" stroke="#fff" strokeOpacity=".09" />
              <path d={pocketPath(w, 104, 7)} fill="none" stroke="#fff" strokeOpacity=".16" strokeDasharray="4 4" />
            </svg>
          )}
          <div className="iw-pocket-in">
            <div className="iw-pocket-tx">
              <span>Fiche d’intégration</span>
              <strong>{state.final ? 'Finalisée' : 'À finaliser'}</strong>
              <small>{state.final ? `Météo d’onboarding posée${ob?.completed_at ? ` le ${fmtShort(ob.completed_at)}` : ''}` : 'La météo d’onboarding la finalisera'}</small>
            </div>
            <button type="button" className="iw-eye" disabled={busy} onClick={onPdf} title={state.final ? 'Voir le PDF' : 'Voir le PDF provisoire'} aria-label={state.final ? 'Voir le PDF' : 'Voir le PDF provisoire'}>
              {busy ? <LoaderCircle size={17} className="iw-spin" /> : W_ICONS.eye}
              <span>{state.final ? 'PDF' : 'PDF provisoire'}</span>
            </button>
          </div>
        </div>
      </div>
      {open && entry && <div className="iw-detail"><SalesEntryCard entry={entry} /></div>}
      {pdf && <a className="iw-link" href={pdf} target="_blank" rel="noopener noreferrer">Ouvrir le PDF si le nouvel onglet a été bloqué</a>}
      {error && <p role="alert" className="iw-error">{error}</p>}
    </section>
  );
}
