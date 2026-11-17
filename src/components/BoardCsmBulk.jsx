// Attribution groupée de CSM (dev 16/11/2026), depuis l'étiquette « Sans CSM » du board : appui long sur un client =
// mode sélection (ligne bleue), puis ce panneau entre à droite de l'étiquette : les CSM, un seul choisi (les autres se
// rangent en pastilles), puis « Attribuer à N clients ». La liste des CSM et le droit d'attribuer viennent du serveur
// (même source que la fiche) ; l'enregistrement est celui de la fiche (PATCH /optilex/board-tracking, un client à la fois).
import { LayoutGroup, AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CsmFace } from "./BoardCsm.jsx";
import { assignLabel } from "../utils/boardCsm.js";

const BLUE = "#2563eb", BLUE_INK = "#1e40af", BLUE_TILE = "#eaf1fd", GREEN = "#15794a";
const SPRING = { type: "spring", stiffness: 520, damping: 38, mass: 0.8 };

const Check = ({ size = 12, stroke = 3 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
);

// phase : "idle" | "saving" | "done" | "leaving". `failed` : nombre de clients restés en échec au dernier essai.
export default function CsmBulkBar({ count, csms, chosenId, onChoose, onAssign, onCancel, phase = "idle", failed = 0, doneCount = 0 }) {
  const reduce = useReducedMotion();
  const busy = phase === "saving";
  const finished = phase === "done" || phase === "leaving";
  const chosen = csms.find((c) => c.id === chosenId) || null;
  // Le CSM choisi passe en tête ; les autres restent à sa suite, réduits à leur photo.
  const ordered = chosen ? [chosen, ...csms.filter((c) => c.id !== chosen.id)] : csms;
  // Le panneau garde sa largeur et sa hauteur naturelles dès la première image (il se dévoile de gauche à droite par
  // un masque) : animer sa largeur le faisait passer à la ligne puis se redresser, « trop gros puis à la bonne taille ».
  const enter = reduce ? { opacity: 0 } : { opacity: 0, x: -18, clipPath: "inset(0 100% 0 0 round 14px)" };
  const shown = reduce ? { opacity: 1 } : { opacity: 1, x: 0, clipPath: "inset(0 0% 0 0 round 14px)" };
  const tween = reduce ? { duration: 0.12 } : SPRING;
  return (
    <motion.div className="bk" role="group" aria-label="Attribuer un CSM aux clients sélectionnés" initial={enter} animate={shown}
      exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, x: -18, clipPath: "inset(0 100% 0 0 round 14px)", transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } }}
      transition={tween}>
      <div className="bk-in">
        <span className="bk-count" aria-live="polite">
          {finished ? <><Check size={12} />Attribué</> : <><span className="bk-dot" aria-hidden="true" />{count} sélectionné{count > 1 ? "s" : ""}</>}
        </span>
        <LayoutGroup>
          {finished ? (
            <motion.span key="done" className="bk-done" initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={tween}>
              {chosen && <CsmFace csm={chosen} size={20} title="" />}
              <span>{doneCount} client{doneCount > 1 ? "s" : ""} · {chosen ? chosen.name : "CSM"}</span>
            </motion.span>
          ) : csms.length === 0 ? (
            <span className="bk-none">Aucun CSM actif à qui attribuer</span>
          ) : (
            <div className="bk-csms" role="radiogroup" aria-label="CSM à attribuer">
              {ordered.map((c) => {
                const on = chosen && c.id === chosen.id;
                const rest = chosen && !on;
                return (
                  <motion.button key={c.id} layout={!reduce} transition={tween} type="button" role="radio" aria-checked={!!on} aria-label={c.name} disabled={busy}
                    title={rest ? `Choisir ${c.name}` : on ? "Revenir à la liste" : undefined}
                    className={`bk-csm${on ? " is-on" : ""}${rest ? " is-rest" : ""}`} onClick={() => onChoose(on ? null : c.id)}>
                    <CsmFace csm={c} size={20} title="" />
                    <AnimatePresence initial={false}>
                      {!rest && (
                        <motion.span key="name" className="bk-name" initial={reduce ? false : { opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }}
                          exit={reduce ? { opacity: 0 } : { opacity: 0, width: 0 }} transition={tween}>{c.name}</motion.span>
                      )}
                    </AnimatePresence>
                    {on && <span className="bk-tick" aria-hidden="true"><Check size={10} stroke={3.4} /></span>}
                  </motion.button>
                );
              })}
            </div>
          )}
        </LayoutGroup>
        <AnimatePresence initial={false}>
          {chosen && !finished && (
            <motion.button key="go" type="button" className="bk-go" disabled={busy || count === 0} onClick={onAssign}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: -16, width: 0 }} animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0, width: "auto" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -10, width: 0 }} transition={tween} whileTap={reduce || busy ? undefined : { scale: 0.97 }}>
              <span className="bk-go-in">
                {busy ? <><span className="bk-spin" aria-hidden="true" />Attribution…</>
                  : failed ? `Réessayer pour ${failed} client${failed > 1 ? "s" : ""}` : assignLabel(count)}
              </span>
            </motion.button>
          )}
        </AnimatePresence>
        {!finished && (
          <button type="button" className="bk-x" onClick={onCancel} disabled={busy} aria-label="Annuler la sélection" title="Annuler la sélection (Échap)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        )}
      </div>
    </motion.div>
  );
}

// Lignes du tableau : sélection bleue, confirmation verte, retrait. Les couleurs sont celles de l'état « En cours » du board.
export const BULK_CSS = `
  .ob-row.is-pickable{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
  .ob-row.is-pressing{background:#f1f6fe}
  .ob-row.is-picked,.ob-row.is-saving{background:${BLUE_TILE}}
  .ob-row.is-picked:hover{background:#e2ecfc}
  .ob-row.is-picked>td:first-child,.ob-row.is-saving>td:first-child{box-shadow:inset 3px 0 0 ${BLUE}}
  .ob-row.is-saving{cursor:progress}
  .ob-row.is-done,.ob-row.is-leaving{background:#e9f9f0;cursor:default}
  .ob-row.is-done>td:first-child,.ob-row.is-leaving>td:first-child{box-shadow:inset 3px 0 0 #22c55e}
  .ob-row.is-leaving>td{opacity:0;transition:opacity .2s ease}
  .ob-row.is-failed{background:#fdecec}
  .ob-row.is-failed>td:first-child{box-shadow:inset 3px 0 0 #e0504c}
  .bk-badge{position:absolute;left:-5px;top:-5px;width:17px;height:17px;border-radius:50%;display:grid;place-items:center;color:#fff;background:${BLUE};box-shadow:0 0 0 2px #fff;animation:bkPop .28s cubic-bezier(.34,1.56,.64,1) both}
  .bk-badge.is-done{background:#22c55e}
  .bk-badge.is-failed{background:#e0504c}
  @keyframes bkPop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}
  .bk{flex:0 1 auto;max-width:100%;min-width:0;overflow:hidden;border-radius:14px}
  .bk-in{display:flex;align-items:center;gap:8px;flex-wrap:nowrap;padding:3px 4px 3px 10px;border:1px solid #cfe0fb;border-radius:14px;background:#f5f9ff}
  .bk-count{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:${BLUE_INK};white-space:nowrap}
  .bk-dot{width:6px;height:6px;border-radius:50%;background:${BLUE}}
  .bk-csms{display:flex;align-items:center;gap:5px;min-width:0;max-width:100%;overflow-x:auto;scrollbar-width:none;padding:2px}
  .bk-csms::-webkit-scrollbar{display:none}
  .bk-csm{display:inline-flex;align-items:center;gap:7px;flex-shrink:0;border:1px solid #e8e4de;background:#fff;color:#1c1b19;border-radius:999px;padding:3px 10px 3px 4px;font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .14s,border-color .14s,box-shadow .14s,opacity .14s}
  .bk-csm:hover:not(:disabled){background:#f7f5f2;border-color:#d8d3cb}
  .bk-csm:focus-visible,.bk-go:focus-visible,.bk-x:focus-visible{outline:2px solid ${BLUE};outline-offset:2px}
  .bk-csm.is-on{background:${BLUE_TILE};border-color:#9dbdf3;color:${BLUE_INK};box-shadow:0 0 0 3px rgba(37,99,235,.10)}
  .bk-csm.is-rest{padding:3px;opacity:.6}
  .bk-csm.is-rest:hover:not(:disabled){opacity:1}
  .bk-csm:disabled,.bk-x:disabled{cursor:default}
  .bk-name{overflow:hidden;display:inline-block}
  .bk-tick{display:grid;place-items:center;width:16px;height:16px;border-radius:50%;background:${BLUE};color:#fff;flex-shrink:0;margin-right:-4px;animation:bkPop .26s cubic-bezier(.34,1.56,.64,1) both}
  .bk-go{border:0;border-radius:999px;background:${BLUE};color:#fff;font:inherit;font-size:12.5px;font-weight:600;padding:0;cursor:pointer;overflow:hidden;white-space:nowrap;box-shadow:0 1px 2px rgba(37,99,235,.35);transition:background .14s,box-shadow .14s}
  .bk-go-in{display:inline-flex;align-items:center;gap:7px;padding:6px 13px}
  .bk-go:hover:not(:disabled){background:#1d4ed8;box-shadow:0 4px 12px rgba(37,99,235,.28)}
  .bk-go:disabled{cursor:progress;background:#6e9bf0}
  .bk-spin{width:12px;height:12px;border-radius:50%;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;animation:bkSpin .7s linear infinite}
  @keyframes bkSpin{to{transform:rotate(360deg)}}
  .bk-x{display:grid;place-items:center;width:22px;height:22px;border:0;border-radius:50%;background:transparent;color:#8a93a4;cursor:pointer;transition:background .14s,color .14s}
  .bk-x:hover:not(:disabled){background:#dfe9fb;color:#1c1b19}
  .bk-done{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:${GREEN};padding-right:8px;white-space:nowrap}
  .bk-none{font-size:12.5px;color:#8a93a4;padding:4px 8px 4px 0}
  /* Avec le panneau, la barre d'outils passe à la ligne si la place manque (fenêtre étroite, mobile) : tag et panneau d'abord, recherche dessous. */
  .ob-toolbar:has(.bk){flex-wrap:wrap;row-gap:10px}
  .ob-toolbar:has(.bk) .ob-active{flex:1 1 560px}
  @media (max-width:680px){.bk{flex:1 1 100%}.bk-in{flex-wrap:wrap}}
  @media (prefers-reduced-motion:reduce){.bk-badge,.bk-tick{animation:none}.bk-spin{animation-duration:1.6s}.ob-row.is-leaving>td{transition:none}}
`;
