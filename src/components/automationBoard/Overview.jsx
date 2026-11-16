// Le suivi en un coup d'œil (dev 16/11/2026 : « le suivi est pas facile, c'est dur de savoir où en sont les devs, les
// derniers avis des juristes… il faut quelque chose de motion design et de simple »). En tête de la page, avant les chiffres
// et la liste, trois blocs :
//   1. À qui la balle : deux couloirs, Owner (développeurs) et Opti'Lex (juristes). Chaque mission qui attend quelqu'un est
//      dans le couloir de celui qui doit agir, avec depuis quand, qui l'a lancée et le dernier mot ; une bille glisse vers ce
//      côté. Ce qui attend depuis le plus longtemps vient en premier et se signale passé 5 jours.
//   2. Le parcours : les cinq étapes, combien de missions à chacune ; un clic filtre la liste.
//   3. Les dernières nouvelles : livraisons, avis des juristes, points d'avancement, validations du cabinet.
// Tout se lit dans la liste du board (aucune requête de plus). Couleurs : l'encre d'Owner, le taupe d'Opti'Lex.
import { useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion as Motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Code2, FlaskConical, Hammer, Scale, Sparkles, Wrench } from "lucide-react";
import { Num } from "../../pages/TrackingSheetFinance/components/PageKit.jsx";
import { Face } from "./parts";
import { ballOf, newsFeed, pipeline, sinceLabel } from "../../utils/automationBoard";

const LATE = 5;          // jours d'attente au-delà desquels une carte se signale
const SHOWN = 4;         // cartes visibles par couloir avant « voir les autres »
const EASE = [0.22, 1, 0.36, 1];
const STATE_ICON = { test: FlaskConical, asked: Wrench, fixing: Hammer, working: Hammer };
const NEWS_ICON = { deliver: Code2, change: Wrench, start: Hammer, progress: Sparkles, validated: Scale };
const SIDES = {
  owner: { name: "Owner", who: "développeurs", verb: (n) => (n > 1 ? "missions attendent les développeurs" : "mission attend les développeurs"),
    empty: "Rien n’attend les développeurs.", emptyHint: "Dites sur quoi vous travaillez : le cabinet le verra.", view: "devs" },
  optilex: { name: "Opti’Lex", who: "juristes", verb: (n) => (n > 1 ? "versions attendent un test" : "version attend un test"),
    empty: "Aucune version n’attend de test.", emptyHint: "Dès qu’une version est livrée, elle arrive ici.", view: "lawyer" },
};

// La bille : sur le fil Owner ── Opti'Lex, elle glisse vers le côté qui doit agir.
function Ball({ side, delay }) {
  const reduce = useReducedMotion();
  return (
    <span className={`ab-ov-rail is-${side}`} aria-hidden="true">
      <i className="ab-ov-rail-end is-owner" /><i className="ab-ov-rail-line" /><i className="ab-ov-rail-end is-optilex" />
      <Motion.i className="ab-ov-ball" initial={reduce ? false : { left: "50%", scale: 0.4, opacity: 0 }}
        animate={{ left: side === "owner" ? "0%" : "100%", scale: 1, opacity: 1 }}
        transition={{ delay: reduce ? 0 : 0.25 + delay, type: "spring", stiffness: 260, damping: 22 }} />
    </span>
  );
}

function MissionCard({ card, index, onOpen }) {
  const Icon = STATE_ICON[card.state] || Code2;
  const late = card.days != null && card.days >= LATE;
  return (
    <Motion.li layout className={`ab-ov-card is-${card.side}${late ? " is-late" : ""}`}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.45, ease: EASE, delay: 0.08 + index * 0.06 }}>
      <button type="button" className="ab-ov-card-btn" onClick={() => onOpen(card.id)} title="Ouvrir le suivi de la mission">
        <span className="ab-ov-card-top">
          <span className="ab-ov-state"><Icon size={13} strokeWidth={2} aria-hidden="true" />{card.label}</span>
          <span className={`ab-ov-wait${late ? " is-late" : ""}`}>{sinceLabel(card.since) || "—"}</span>
        </span>
        <span className="ab-ov-card-name">{card.name}</span>
        {card.text && <span className="ab-ov-quote">« {card.text} »</span>}
        <span className="ab-ov-card-foot">
          {card.by && <span className="ab-ov-by"><Face name={card.by} size={18} />{card.by}</span>}
          <Ball side={card.side} delay={index * 0.06} />
        </span>
      </button>
    </Motion.li>
  );
}

function Lane({ side, cards, onOpen, onShowAll }) {
  const meta = SIDES[side];
  const [all, setAll] = useState(false);
  const shown = all ? cards : cards.slice(0, SHOWN);
  return (
    <section className={`ab-ov-lane is-${side}`} aria-label={`Chez ${meta.name} : ${meta.who}`}>
      <header className="ab-ov-lane-head">
        <span className="ab-ov-lane-who"><i className="ab-ov-dot" aria-hidden="true" />Chez {meta.name}<small>{meta.who}</small></span>
        <span className="ab-ov-lane-count"><Num value={cards.length} /></span>
      </header>
      <p className="ab-ov-lane-sub">{cards.length ? meta.verb(cards.length) : meta.empty}</p>
      {cards.length === 0 ? (
        <Motion.div className="ab-ov-lane-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <span>{meta.emptyHint}</span>
          <button type="button" className="ab-textlink" onClick={() => onShowAll(meta.view)}>{side === "owner" ? "Suivi des développeurs" : "Voir les missions"} <ArrowRight size={13} /></button>
        </Motion.div>
      ) : (
        <ul className="ab-ov-cards">
          <AnimatePresence initial>
            {shown.map((card, index) => <MissionCard key={card.id} card={card} index={index} onOpen={onOpen} />)}
          </AnimatePresence>
        </ul>
      )}
      {cards.length > SHOWN && (
        <button type="button" className="ab-ov-more" onClick={() => setAll((v) => !v)}>
          {all ? "Réduire" : `Voir les ${cards.length - SHOWN} autres`}
        </button>
      )}
    </section>
  );
}

function Pipeline({ stages, step, onStep }) {
  const max = Math.max(1, ...stages.map((stage) => stage.count));
  return (
    <section className="ab-ov-box" aria-label="Le parcours des missions">
      <header className="ab-ov-box-head">
        <h3>Le parcours</h3>
        <span className="ab-ov-legend"><i className="is-owner" />Owner<i className="is-optilex" />Opti’Lex<i className="is-done" />Approuvé</span>
      </header>
      <ol className="ab-ov-pipe">
        {stages.map((stage, index) => (
          <li key={stage.value}>
            <button type="button" className={`ab-ov-stage is-${stage.side}`} aria-pressed={step === stage.value}
              onClick={() => onStep(step === stage.value ? null : stage.value)} title={step === stage.value ? "Retirer ce filtre" : `Voir les missions à l’étape « ${stage.label} »`}>
              <span className="ab-ov-stage-n"><Num value={stage.count} /></span>
              <span className="ab-ov-stage-bar"><Motion.i initial={{ height: 0 }} animate={{ height: `${Math.max(stage.count ? 8 : 0, (stage.count / max) * 100)}%` }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.15 + index * 0.08 }} /></span>
              <span className="ab-ov-stage-label"><b>{index}</b>{stage.label}</span>
            </button>
          </li>
        ))}
      </ol>
      <Summary stages={stages} />
    </section>
  );
}

// Où en est l'ensemble : une barre en trois parts (chez Owner, chez Opti'Lex, approuvé), qui se remplit à l'arrivée.
function Summary({ stages }) {
  const total = stages.reduce((sum, stage) => sum + stage.count, 0) || 1;
  const parts = ["owner", "optilex", "done"].map((side) => {
    const count = stages.filter((stage) => stage.side === side).reduce((sum, stage) => sum + stage.count, 0);
    return { side, count, share: Math.round((count / total) * 100) };
  });
  const label = { owner: "à construire chez Owner", optilex: "à tester chez Opti’Lex", done: "approuvées" };
  return (
    <div className="ab-ov-sum">
      <div className="ab-ov-sum-bar" role="img" aria-label={parts.map((part) => `${part.count} ${label[part.side]}`).join(", ")}>
        {parts.map((part, index) => (
          <Motion.i key={part.side} className={`is-${part.side}`} initial={{ width: 0 }} animate={{ width: `${part.share}%` }}
            transition={{ duration: 1, ease: EASE, delay: 0.5 + index * 0.12 }} />
        ))}
      </div>
      <div className="ab-ov-sum-legend">
        {parts.map((part) => (
          <span key={part.side} className={`is-${part.side}`}><b><Num value={part.share} /> %</b>{part.count} {label[part.side]}</span>
        ))}
      </div>
    </div>
  );
}

function News({ items, onOpen }) {
  return (
    <section className="ab-ov-box" aria-label="Les dernières nouvelles">
      <header className="ab-ov-box-head"><h3>Dernières nouvelles</h3></header>
      {items.length === 0 ? <p className="ab-ov-none">Rien de neuf : les livraisons, les avis des juristes et les points d’avancement s’afficheront ici.</p> : (
        <ol className="ab-ov-news">
          {items.map((item, index) => {
            const Icon = NEWS_ICON[item.kind] || Sparkles;
            return (
              <Motion.li key={item.key} className={`is-${item.side} is-${item.kind}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, ease: EASE, delay: 0.1 + index * 0.05 }}>
                <span className="ab-ov-news-ic"><Icon size={13} strokeWidth={2} aria-hidden="true" /></span>
                <button type="button" className="ab-ov-news-body" onClick={() => onOpen(item.id)} title="Ouvrir le suivi de la mission">
                  <span className="ab-ov-news-line"><b>{item.who || "Quelqu’un"}</b> {item.verb}</span>
                  <span className="ab-ov-news-meta">{item.name} · {item.ago}</span>
                  {item.text && <span className="ab-ov-news-quote">« {item.text} »</span>}
                </button>
              </Motion.li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default function Overview({ rows, steps, step, onStep, onOpen, onView }) {
  const ball = useMemo(() => ballOf(rows), [rows]);
  const stages = useMemo(() => pipeline(rows, steps), [rows, steps]);
  const news = useMemo(() => newsFeed(rows, 7), [rows]);
  return (
    <LayoutGroup>
      <div className="ab-ov">
        <div className="ab-ov-lanes">
          <Lane side="owner" cards={ball.owner} onOpen={onOpen} onShowAll={onView} />
          <div className="ab-ov-swap" aria-hidden="true"><span>⇄</span></div>
          <Lane side="optilex" cards={ball.optilex} onOpen={onOpen} onShowAll={onView} />
        </div>
        <div className="ab-ov-row">
          <Pipeline stages={stages} step={step} onStep={onStep} />
          <News items={news} onOpen={onOpen} />
        </div>
      </div>
    </LayoutGroup>
  );
}
