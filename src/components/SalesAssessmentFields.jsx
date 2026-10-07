import { Check, Minus, AlertTriangle, ClipboardList } from 'lucide-react';
import { SALES_QUESTIONS, SALES_COLORS, SALES_LEVELS, salesAssessmentResult, salesScore } from '../utils/salesAssessment';
import './salesAssessment.css';
const ICONS = [Check,Minus,AlertTriangle];
export default function SalesAssessmentFields({value={},onChange}) {
  const result=salesAssessmentResult(value);
  const answered=SALES_QUESTIONS.filter(({key})=>SALES_COLORS.includes(value?.[key])).length;
  return <div className="sales-assessment">
    <div className="sales-assessment-intro"><ClipboardList size={20}/><div><strong>Préparer l’onboarding</strong><p>Cinq réponses rapides pour transmettre l’état du client à l’entrée. Cette note reste indépendante de la météo client.</p></div><span>{answered}/5</span></div>
    {SALES_QUESTIONS.map((q,index)=><fieldset className="sales-question" key={q.key}><legend>{index+1}. {q.title}</legend>{q.help&&<p>{q.help}</p>}<div className="sales-answers">{SALES_COLORS.map((color,i)=>{const Icon=ICONS[i];return <label key={color} className={`sales-answer sales-${color} ${value?.[q.key]===color?'is-selected':''}`}><input type="radio" name={`sales-${q.key}`} value={color} checked={value?.[q.key]===color} onChange={()=>onChange({...value,[q.key]:color})}/><Icon size={16}/><span>{q.options[i]}</span></label>;})}</div></fieldset>)}
    <label className="sales-vigilance"><strong>6. Points de vigilance pour le CSM <small>Facultatif</small></strong><span>Y a-t-il un élément particulier à connaître avant l’onboarding ?</span><textarea rows={3} maxLength={4000} value={value?.vigilance_note||''} onChange={e=>onChange({...value,vigilance_note:e.target.value})} placeholder="Attente particulière, objection, sujet sensible, engagement spécifique, risque de rendez-vous manqué…"/></label>
    <div className={`sales-result ${result?`sales-level-${result.level}`:''}`} aria-live="polite"><strong>{result?`${salesScore(result.score)} / 5 · ${SALES_LEVELS[result.level]}`:'Répondez aux cinq questions pour obtenir la note'}</strong><span>Vert : 1 point · Orange : 0,5 point · Rouge : 0 point</span></div>
  </div>;
}
