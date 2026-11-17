// En-tête de la fiche d'une mission (dev 16/11/2026 : « la fiche, c'est le truc le plus important », « aspect très
// basique », « c'est dur de savoir où en sont les devs, les derniers avis des juristes »).
//   - `Hero` : l'étape en grand, depuis quand et par qui, la frise des étapes (elle se clique toujours pour changer
//     d'étape, l'enregistrement apparaît dessous) et les chiffres clés de la mission, qui défilent jusqu'à leur valeur.
//   - `Voices` : les deux voix de la mission, côte à côte. Où en sont les développeurs (version livrée, travail en
//     cours, point d'avancement) et le dernier avis du juriste (modification demandée, version validée, commentaire),
//     chacun avec qui, quand et ses mots.
import { motion as Motion, useReducedMotion } from "framer-motion";
import { Check, FlaskConical, Hammer, MessageSquareQuote, Wrench } from "lucide-react";
import { Num } from "../../pages/TrackingSheetFinance/components/PageKit.jsx";
import { Face } from "./parts";
import { whenLabel } from "../../utils/automationBoard";

const EASE = [0.22, 1, 0.36, 1];

function Track({ value, steps, onPick, picked }) {
  const reduce = useReducedMotion();
  const list = Array.isArray(steps) ? steps : [];
  const last = Math.max(1, list.length - 1);
  return (
    <ol className={`ab-hero-track${onPick ? " is-pick" : ""}`} style={{ "--n": list.length }} aria-label={`Étape ${value} sur ${last}`}>
      <span className="ab-hero-rail" aria-hidden="true">
        <Motion.i initial={reduce ? false : { width: 0 }} animate={{ width: `${(Math.min(value, last) / last) * 100}%` }} transition={{ duration: 1.1, ease: EASE, delay: 0.2 }} />
      </span>
      {list.map((step, index) => {
        const state = step.value < value ? "done" : step.value === value ? "now" : "next";
        const inner = (
          <>
            <Motion.span className="ab-hero-node" aria-hidden="true" initial={reduce ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15 + index * 0.12, type: "spring", stiffness: 420, damping: 24 }}>
              {state === "done" && <Check size={12} strokeWidth={3} />}
              {state === "now" && <i className="ab-hero-pulse" />}
            </Motion.span>
            <span className="ab-hero-step">{step.label}</span>
          </>
        );
        return (
          <li key={step.value} className={`is-${state}${picked === step.value ? " is-picked" : ""}`} aria-current={state === "now" ? "step" : undefined}>
            {onPick ? (
              <button type="button" aria-pressed={picked === step.value} onClick={() => onPick(step.value === value ? null : step.value)}
                title={step.value === value ? "Étape actuelle" : `Passer à « ${step.label} »`}>{inner}</button>
            ) : inner}
          </li>
        );
      })}
    </ol>
  );
}

// Les chiffres clés d'une mission : part passée par le logiciel, réalisées, demandées par la messagerie.
function kpisOf(row) {
  return [
    { key: "usage", label: "passées par le logiciel", value: row.usage ? row.usage.bar : null, unit: " %", note: row.usage?.short || "pas dans le logiciel", title: row.usage?.detail },
    { key: "done", label: "réalisées", value: row.total, unit: "", note: `dont ${Number(row.recent || 0).toLocaleString("fr-FR")} sur 90 jours` },
    { key: "msg", label: "via la messagerie", value: row.messaging?.total ?? 0, unit: "", note: row.messaging?.total ? `${row.messaging.share} % des demandes` : "aucune demande" },
  ];
}

// Les mêmes chiffres, pour la rubrique « Chiffres » de la fiche (17/11/2026 : l'en-tête ne garde que l'étape et la frise).
export function Kpis({ row }) {
  return (
    <dl className="ab-kpis">
      {kpisOf(row).map((kpi) => (
        <div key={kpi.key} title={kpi.title || undefined}>
          <dd>{kpi.value == null ? "–" : <><Num value={kpi.value} />{kpi.unit}</>}</dd>
          <dt>{kpi.label}</dt>
          <span>{kpi.note}</span>
        </div>
      ))}
    </dl>
  );
}

export function Hero({ row, steps, stepNow, last, since, tags, onPick, picked, pickBar, footnote }) {
  const kpis = kpisOf(row);
  return (
    <section className="ab-hero" aria-label="Où en est la mission">
      <div className="ab-hero-top">
        <div className="ab-hero-now">
          <Motion.span className="ab-hero-kicker" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
            Étape {row.step} sur {last}
          </Motion.span>
          <Motion.h3 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE, delay: 0.05 }}>{stepNow?.label || "Étape inconnue"}</Motion.h3>
          {since && <Motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>{since}</Motion.p>}
          {tags && <div className="ab-hero-tags">{tags}</div>}
        </div>
        <dl className="ab-hero-kpis">
          {kpis.map((kpi, index) => (
            <Motion.div key={kpi.key} title={kpi.title || undefined} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE, delay: 0.1 + index * 0.07 }}>
              <dd>{kpi.value == null ? "–" : <><Num value={kpi.value} />{kpi.unit}</>}</dd>
              <dt>{kpi.label}</dt>
              <span>{kpi.note}</span>
            </Motion.div>
          ))}
        </dl>
      </div>
      <Track value={row.step} steps={steps} onPick={onPick} picked={picked} />
      {pickBar}
      {footnote}
    </section>
  );
}

const DEV_ICON = { deliver: Hammer, work: Hammer };
const LAWYER_ICON = { change: Wrench, approve: Check, comment: MessageSquareQuote };

function Voice({ side, voice, title, empty, state }) {
  const Icon = side === "devs" ? DEV_ICON[voice?.tone] || Hammer : LAWYER_ICON[voice?.tone] || FlaskConical;
  return (
    <Motion.article className={`ab-voice is-${side}${voice ? ` is-${voice.tone}` : " is-empty"}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: side === "devs" ? 0.1 : 0.18 }}>
      <header>
        <span className="ab-voice-ic"><Icon size={15} strokeWidth={2} /></span>
        <span className="ab-voice-title">{title}</span>
        {state && <span className="ab-voice-state">{state}</span>}
      </header>
      {voice ? (
        <>
          <p className="ab-voice-line"><Face name={voice.who} size={22} /><span><b>{voice.who || "Quelqu’un"}</b> {voice.what}</span><time>{whenLabel(voice.at)}</time></p>
          {voice.text ? <blockquote>{voice.text}</blockquote> : <p className="ab-voice-none">Sans un mot.</p>}
        </>
      ) : <p className="ab-voice-none">{empty}</p>}
    </Motion.article>
  );
}

export function Voices({ voices: v, turn }) {
  const devState = turn?.working ? "Y travaillent" : turn?.who === "dev" || turn?.who === "build" ? "À eux de jouer" : null;
  const lawyerState = turn?.who === "lawyer" ? "À lui de jouer" : null;
  return (
    <div className="ab-voices">
      <Voice side="devs" voice={v.devs} title="Où en sont les développeurs" state={devState}
        empty="Les développeurs n’ont encore rien livré ni signalé sur cette mission." />
      <Voice side="lawyer" voice={v.lawyer} title="Dernier avis du juriste" state={lawyerState}
        empty="Le juriste ne s’est pas encore prononcé sur cette mission." />
    </div>
  );
}
