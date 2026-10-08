import { ClipboardList, ChevronDown } from 'lucide-react';
import { SALES_QUESTIONS, SALES_COLORS, SALES_LEVELS, salesScore, rankedMissions } from '../utils/salesAssessment';
import './salesAssessment.css';
export default function SalesEntryCard({entry}) {
  const current=entry?.version===1;
  const missions=rankedMissions(entry?.answers?.priority_missions);
  const date=entry?.recorded_at?new Date(entry.recorded_at):null;
  const dateLabel=date&&!Number.isNaN(date.getTime())?new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Paris'}).format(date):'';
  return <section className="sales-entry" aria-label="État du client à l’entrée">
    <header><ClipboardList size={19}/><strong>État du client à l’entrée · Sales</strong>{entry&&<span className={`sales-entry-badge ${current?`sales-level-${entry.level}`:''}`}>{current?`${salesScore(entry.score)} / 5 · ${SALES_LEVELS[entry.level]}`:`${salesScore(entry.legacy_score)} / 5 · Ancienne note`}</span>}</header>
    <p className="sales-entry-caption">{entry?`Par ${entry.author_name||'le commercial'}${dateLabel?` · ${dateLabel}`:''}`:'Questionnaire non renseigné pour ce dossier.'}</p>
    {entry&&<details><summary>Consulter la transmission commerciale<ChevronDown size={15}/></summary><div className="sales-entry-content">
      <p>Évaluation à l’entrée, conservée indépendamment des météos CSM et cabinet.</p>
      {current?<dl>{SALES_QUESTIONS.map(q=><div key={q.key}><dt>{q.title}</dt><dd className={`sales-${entry.answers[q.key]}`}><span className="sales-dot"/>{q.options[SALES_COLORS.indexOf(entry.answers[q.key])]}</dd></div>)}</dl>:<p>Ancienne note Sales conservée sans recalcul. Les réponses au questionnaire ne sont pas disponibles.</p>}
      {current&&<><strong>Missions à prioriser</strong><>{missions.length ? <ol className="sales-entry-note">{missions.map((mission, index)=><li key={index}>{mission}</li>)}</ol> : <p>Non renseignées dans ce questionnaire historique.</p>}</></>}
      <strong>Points de vigilance pour le CSM</strong><p className="sales-entry-note">{(current?entry.answers.vigilance_note:entry.legacy_note)||'Aucun point particulier signalé.'}</p>
    </div></details>}
  </section>;
}
