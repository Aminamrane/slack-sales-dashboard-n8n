import { MeteoIcon } from './meteo';
import { WEATHER, QUALIFICATION_FIELDS, weatherPresentation } from '../utils/weatherCase';
import './weatherCase.css';

// Controlled fields: publication remains part of declaring the sale, never a second request.
export default function WeatherIntakeFields({ draft, onChange }) {
  const context=draft.weather_context;
  const form=context?.qualification || {reason:'',expectation:'',actions:''};
  const select=score=>onChange({weather:score,weather_context:{version:2,qualification:score<=3?form:null},weather_note:score<=3?formNote(form):draft.weather_note});
  const update=(key,value)=>{const next={...form,[key]:value};onChange({weather_context:{version:2,qualification:next},weather_note:formNote(next)});};
  return <div className="wc-composer">
    {draft.weather && !context && <p className="wc-description">Note enregistrée avec l’ancienne échelle : {draft.weather}/5 · {weatherPresentation(draft.weather)?.label}. Choisissez une note pour la mettre à jour.</p>}
    <div className="wc-choices" role="group" aria-label="Météo client">{[5,4,3,2,1].map(n=><button type="button" key={n} aria-pressed={context?.version===2&&draft.weather===n} onClick={()=>select(n)} style={{'--wc-color':WEATHER[n].color,'--wc-bg':WEATHER[n].bg}}><MeteoIcon score={n} size={24} color={WEATHER[n].color}/><strong>{n} · {WEATHER[n].label}</strong></button>)}</div>
    {context?.version===2 && draft.weather<=3 ? <div className="wc-form">{QUALIFICATION_FIELDS.map(([key,label,question])=><label key={key}>{label} · obligatoire<textarea rows={2} required maxLength={1000} value={form[key]} placeholder={question} onChange={e=>update(key,e.target.value)}/></label>)}</div> : <label className="ip-field"><span>Commentaire de météo · obligatoire</span><textarea required rows={2} maxLength={2000} value={draft.weather_note||''} onChange={e=>onChange({weather_note:e.target.value})}/></label>}
  </div>;
}
export function formNote(form){return QUALIFICATION_FIELDS.map(([key,label])=>`${label} :\n${form[key]||''}`).join('\n\n');}
