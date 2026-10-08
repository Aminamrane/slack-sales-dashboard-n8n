import { useId } from 'react';
import { BookOpen, UsersRound, Smile, Clock3, Route, Target, MessageSquareText, Check } from 'lucide-react';
import { SALES_QUESTIONS, SALES_COLORS, SALES_LEVELS, salesAssessmentResult, salesScore } from '../utils/salesAssessment';
import './salesAssessment.css';

const QUESTION_ICONS = [BookOpen, UsersRound, Smile, Clock3, Route];

function AnswerGlyph({ tone }) {
  return <svg className="sales-answer-glyph" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <circle className="sales-glyph-disc" cx="20" cy="20" r="18" fill="currentColor" opacity=".08"/>
    <circle className="sales-glyph-orbit" cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="1.4" opacity=".3"/>
    <g className="sales-glyph-mark" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {tone === 'green' ? <path pathLength="1" d="m13 20 5 5 9-10"/> : tone === 'orange' ? <><path d="M20 10a10 10 0 0 0 0 20Z" fill="currentColor" stroke="none" opacity=".23"/><path pathLength="1" d="M20 10a10 10 0 0 0 0 20" strokeWidth="2.2"/><path d="M20 10a10 10 0 0 1 0 20" strokeWidth="1.5" strokeDasharray="2 3" opacity=".65"/></> : <><path pathLength="1" d="M20 12v10"/><circle cx="20" cy="27" r="1" fill="currentColor" stroke="none"/></>}
    </g>
  </svg>;
}

function HandoffGlyph() {
  return <svg className="sales-handoff-glyph" viewBox="0 0 72 72" fill="none" aria-hidden="true">
    <circle cx="36" cy="36" r="34" fill="currentColor" opacity=".07"/>
    <rect x="12" y="17" width="26" height="34" rx="7" fill="white" stroke="currentColor" strokeWidth="1.5" opacity=".65"/>
    <path d="M19 26h12m-12 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".5"/>
    <rect x="33" y="25" width="26" height="34" rx="7" fill="white" stroke="currentColor" strokeWidth="1.5"/>
    <path className="sales-handoff-check" pathLength="1" d="m40 41 4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M42 15h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

export default function SalesAssessmentFields({ value = {}, onChange }) {
  const id = useId();
  const result = salesAssessmentResult(value);
  const scoredAnswers = SALES_QUESTIONS.filter(({ key }) => SALES_COLORS.includes(value?.[key])).length;
  const answered = scoredAnswers + (value?.priority_missions?.trim() ? 1 : 0);
  const set = (key, answer) => onChange({ ...value, [key]: answer });

  return <div className="sales-assessment">
    <div className={`sales-assessment-intro ${answered === 6 ? 'is-complete' : ''}`}>
      <HandoffGlyph/>
      <div className="sales-intro-copy"><strong>Un relais clair pour un bon départ</strong><p>Transmettez votre échange à Vincent : ce qui est clair, les points à préciser et la priorité du client.</p></div>
      <div className="sales-progress" role="progressbar" aria-label="Questions obligatoires complétées" aria-valuemin={0} aria-valuemax={6} aria-valuenow={answered}>
        <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20"/><circle className="sales-progress-fill" cx="24" cy="24" r="20" pathLength="6" strokeDasharray={`${answered} 6`}/></svg>
        <span>{answered}<small>/6</small></span>
      </div>
    </div>
    <p className="sales-assessment-guidance">Choisissez la réponse fidèle à votre échange. Un point à clarifier est une information utile.</p>
    {SALES_QUESTIONS.map((q, index) => {
      const Icon = QUESTION_ICONS[index];
      return <fieldset className="sales-question" key={q.key}>
        <legend><span className="sales-question-icon"><Icon size={19} strokeWidth={1.6}/></span><span><small>QUESTION {String(index + 1).padStart(2, '0')} <span>· Obligatoire</span></small>{q.title}</span></legend>
        {q.help && <p id={`${id}-${q.key}-help`}>{q.help}</p>}
        <div className="sales-answers">{SALES_COLORS.map((color, i) => <label key={color} className={`sales-answer sales-${color} ${value?.[q.key] === color ? 'is-selected' : ''}`}>
          <input type="radio" required name={`${id}-sales-${q.key}`} value={color} checked={value?.[q.key] === color} aria-describedby={q.help ? `${id}-${q.key}-help` : undefined} onChange={() => set(q.key, color)}/>
          <AnswerGlyph tone={color}/><span className="sales-answer-label">{q.options[i]}</span><span className="sales-selection" aria-hidden="true"><Check size={11} strokeWidth={2.5}/></span>
        </label>)}</div>
      </fieldset>;
    })}
    <div className="sales-written-question sales-priority">
      <label htmlFor={`${id}-priority`} className="sales-written-title"><span className="sales-question-icon"><Target size={20} strokeWidth={1.6}/></span><span><small>QUESTION 06 <span>· Obligatoire</span></small>Quelles missions le client souhaite-t-il prioriser ?</span></label>
      <p id={`${id}-priority-help`}>Avec ses mots, précisez ce qu’il souhaite traiter en premier et pourquoi. Cela guidera son onboarding.</p>
      <textarea id={`${id}-priority`} required rows={3} maxLength={4000} aria-describedby={`${id}-priority-help`} value={value?.priority_missions || ''} onChange={e => set('priority_missions', e.target.value)} placeholder="Ex. Sécuriser l’embauche de son premier salarié avant la fin du mois, puis revoir sa rémunération."/>
    </div>
    <div className="sales-written-question sales-vigilance">
      <label htmlFor={`${id}-vigilance`} className="sales-written-title"><span className="sales-question-icon"><MessageSquareText size={19} strokeWidth={1.6}/></span><span><small>QUESTION 07 <span>· Facultatif</span></small>Points de vigilance pour le CSM</span></label>
      <p id={`${id}-vigilance-help`}>Y a-t-il un élément particulier à connaître avant l’onboarding ?</p>
      <textarea id={`${id}-vigilance`} rows={3} maxLength={4000} aria-describedby={`${id}-vigilance-help`} value={value?.vigilance_note || ''} onChange={e => set('vigilance_note', e.target.value)} placeholder="Attente particulière, objection, sujet sensible, engagement spécifique, risque de rendez-vous manqué…"/>
    </div>
    <div className={`sales-result ${result ? `sales-level-${result.level}` : ''}`} aria-live="polite"><strong>{result ? `${salesScore(result.score)} / 5 · ${SALES_LEVELS[result.level]}` : 'La note se calcule à partir des cinq premières réponses'}</strong><span>Évaluation Sales indépendante de la météo client. La priorité et les points de vigilance ne modifient pas la note.</span></div>
  </div>;
}
