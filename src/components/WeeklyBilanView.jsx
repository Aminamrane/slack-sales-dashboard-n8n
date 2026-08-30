// src/components/WeeklyBilanView.jsx
//
// Bilan hebdomadaire d'un sales, rendu comme un DOSSIER DE COACHING ÉDITORIAL
// adressé directement au sales (« tu »), écrit par la direction. Modèle visuel :
// cartes empilées + serif d'affichage + pastille (réf design fournie par Youcef),
// cohérent avec le style papier/encre des scorecards. Payload « OWNER WEEKLY
// SALES COACH » (BILAN_SCHEMA).
//
// Payload : { sales, periode, nb_r1, nb_r2, resultats, bilan,
//   bien_fait:[{competence,statut,detail}], progression:[{competence,statut,detail}],
//   perd_opportunites:[{faiblesse,statut,detail}], r1_semaine, r2_semaine,
//   comportemental, action:{objectif,pourquoi,avant,pendant,formulation,apres,mesure} }

import { useEffect } from "react";

const FONT_ID = "owner-scorecard-fonts";
const FONT_HREF = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap";

const CSS = `
.owner-wb{--paper:#FBFAF7;--ink:#14181C;--ink-soft:#4A5259;--rule:#E1DED5;--deep:#0E4749;--deep-soft:#E6EEEC;--alert:#A4262C;--warn:#B4740B;--good:#2F6B4F;--amber:#E8A317;
  color:var(--ink);font-family:"IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:15.5px;line-height:1.6;}
/* Effet cartes empilées DERRIÈRE le dossier (z-index : bandes sous la carte) */
.owner-wb .stack{position:relative;padding-top:16px;}
.owner-wb .stack::before,.owner-wb .stack::after{content:"";position:absolute;left:22px;right:22px;height:26px;top:0;border-radius:16px 16px 0 0;border:2px solid var(--ink);border-bottom:0;z-index:0;}
.owner-wb .stack::before{top:0;background:var(--amber);left:40px;right:40px;}
.owner-wb .stack::after{top:8px;background:#E27BB8;left:31px;right:31px;}
.owner-wb .doc{position:relative;z-index:1;background:var(--paper);border:2px solid var(--ink);border-radius:16px;overflow:hidden;}
.owner-wb .wrap{padding:26px 34px 40px;}
/* Masthead */
.owner-wb .masthead{display:flex;align-items:center;gap:18px;padding-bottom:22px;margin-bottom:6px;border-bottom:1px solid var(--rule);}
.owner-wb .ava{width:58px;height:58px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid var(--rule);}
.owner-wb .ava-fb{width:58px;height:58px;border-radius:50%;flex-shrink:0;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-family:"Newsreader",serif;font-size:24px;font-weight:600;}
.owner-wb .mast-txt{flex:1;min-width:0;}
.owner-wb .kicker{font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-soft);margin:0 0 4px;}
.owner-wb .name{font-family:"Newsreader",Georgia,serif;font-weight:600;font-size:clamp(26px,3.4vw,36px);line-height:1.05;margin:0;letter-spacing:-.015em;}
.owner-wb .pill{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:600;color:#14181C;background:var(--amber);border-radius:999px;padding:7px 15px;white-space:nowrap;flex-shrink:0;}
.owner-wb .meta{display:flex;flex-wrap:wrap;gap:5px 22px;font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--ink-soft);margin:16px 0 0;}
.owner-wb .meta b{color:var(--ink);font-weight:600;}
.owner-wb .meta .res{color:var(--deep);}
/* Sections */
.owner-wb section{margin-top:34px;}
.owner-wb h2{font-family:"IBM Plex Mono",monospace;font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);font-weight:600;margin:0 0 16px;padding-bottom:8px;border-bottom:1px solid var(--ink);}
.owner-wb .lead{font-family:"Newsreader",Georgia,serif;font-size:19px;line-height:1.6;margin:0;letter-spacing:-.005em;}
.owner-wb .blocks{list-style:none;margin:0;padding:0;counter-reset:b;}
.owner-wb .blocks li{position:relative;padding:0 0 0 40px;margin-bottom:20px;counter-increment:b;}
.owner-wb .blocks li::before{content:counter(b,decimal-leading-zero);position:absolute;left:0;top:1px;font-family:"IBM Plex Mono",monospace;font-size:12px;font-weight:600;color:var(--ink-soft);}
.owner-wb .blocks .bt{font-family:"Newsreader",Georgia,serif;font-size:19px;font-weight:600;line-height:1.25;display:block;margin-bottom:3px;letter-spacing:-.01em;}
.owner-wb .blocks.alert .bt{color:var(--alert);}
.owner-wb .chip{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;padding:2px 8px;border-radius:999px;border:1px solid currentColor;margin-left:9px;vertical-align:2px;white-space:nowrap;}
.owner-wb .blocks .dt{font-size:14.5px;color:var(--ink-soft);line-height:1.55;}
.owner-wb .cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.owner-wb .rdv{border:1px solid var(--rule);border-radius:12px;padding:16px 18px;background:#fff;}
.owner-wb .rdv .rl{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:600;margin:0 0 8px;}
.owner-wb .rdv.r1 .rl{color:#2563EB;} .owner-wb .rdv.r2 .rl{color:var(--warn);}
.owner-wb .rdv p{margin:0;font-size:14.5px;line-height:1.55;color:var(--ink);}
.owner-wb .psy{background:#fff;border:1px solid var(--rule);border-radius:12px;padding:18px 22px;font-family:"Newsreader",Georgia,serif;font-size:17px;font-style:italic;line-height:1.65;}
/* Plan (action) */
.owner-wb .plan{border:2px solid var(--ink);border-radius:14px;padding:22px 24px;background:var(--deep-soft);}
.owner-wb .plan .obj{font-family:"Newsreader",Georgia,serif;font-size:22px;font-weight:600;line-height:1.25;margin:0 0 6px;letter-spacing:-.01em;}
.owner-wb .plan .why{font-size:14.5px;color:var(--ink-soft);line-height:1.55;margin:0 0 16px;}
.owner-wb .plan .steps{display:grid;gap:0;border-top:1px solid var(--rule);}
.owner-wb .plan .step{display:grid;grid-template-columns:110px 1fr;gap:14px;padding:11px 0;border-bottom:1px solid var(--rule);}
.owner-wb .plan .step:last-child{border-bottom:0;}
.owner-wb .plan .sl{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:600;color:var(--deep);}
.owner-wb .plan .sv{font-size:14.5px;line-height:1.5;color:var(--ink);}
.owner-wb .plan .sv.quote{font-family:"Newsreader",Georgia,serif;font-style:italic;font-size:16.5px;color:var(--ink);}
.owner-wb .empty{border:1px dashed var(--rule);border-radius:14px;padding:26px;text-align:center;color:var(--ink-soft);font-size:14px;background:var(--paper);}
@media (max-width:760px){.owner-wb .cols{grid-template-columns:1fr;}.owner-wb .wrap{padding:22px 18px 30px;}.owner-wb .plan .step{grid-template-columns:1fr;gap:2px;}}
`;

const initials = (n) => (n || "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const chipColor = (s) => {
  const t = (s || "").toLowerCase();
  if (/confirm|acquis|maîtris|solide/.test(t)) return "#2F6B4F";
  if (/récurr|à corr|risque|perd|urgen/.test(t)) return "#A4262C";
  if (/progress|en cours|émerg/.test(t)) return "#2563EB";
  return "#4A5259";
};

function Blocks({ items, keyTitle, alert }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className={`blocks${alert ? " alert" : ""}`}>
      {items.map((it, i) => (
        <li key={i}>
          <span className="bt">
            {it[keyTitle]}
            {it.statut ? <span className="chip" style={{ color: chipColor(it.statut) }}>{it.statut}</span> : null}
          </span>
          {it.detail && <span className="dt">{it.detail}</span>}
        </li>
      ))}
    </ul>
  );
}

export default function WeeklyBilanView({ bilan, salesName, avatarUrl, team }) {
  useEffect(() => {
    if (document.getElementById(FONT_ID)) return;
    const l = document.createElement("link");
    l.id = FONT_ID; l.rel = "stylesheet"; l.href = FONT_HREF;
    document.head.appendChild(l);
  }, []);

  const name = (bilan && bilan.sales) || salesName || "";

  if (!bilan) {
    return (
      <div className="owner-wb" style={{ marginBottom: 24 }}>
        <style>{CSS}</style>
        <div className="empty">Pas encore de bilan de coaching pour ce sales cette semaine. Il apparaîtra après le prochain passage d'analyse.</div>
      </div>
    );
  }

  const a = bilan.action || {};
  const hasSteps = a.avant || a.pendant || a.formulation || a.apres || a.mesure;

  return (
    <div className="owner-wb" style={{ marginBottom: 26 }}>
      <style>{CSS}</style>
      <div className="stack">
        <div className="doc">
          <div className="wrap">
            {/* Masthead façon carte empilée */}
            <header className="masthead">
              {avatarUrl ? <img className="ava" src={avatarUrl} alt="" /> : <div className="ava-fb">{initials(name)}</div>}
              <div className="mast-txt">
                <p className="kicker">Bilan de coaching · Owner Sales</p>
                <h1 className="name">{name}</h1>
              </div>
              <span className="pill">Semaine</span>
            </header>
            <div className="meta">
              {bilan.periode && <span>Période <b>{bilan.periode}</b></span>}
              {bilan.nb_r1 != null && <span><b>{bilan.nb_r1}</b> R1</span>}
              {bilan.nb_r2 != null && <span><b>{bilan.nb_r2}</b> R2</span>}
              {team && <span>Équipe <b>{team}</b></span>}
              {bilan.resultats && <span className="res">{bilan.resultats}</span>}
            </div>

            {/* 01 — Le mot de la semaine */}
            {bilan.bilan && (
              <section style={{ marginTop: 30 }}>
                <h2>01 — Le mot de la semaine</h2>
                <p className="lead">{bilan.bilan}</p>
              </section>
            )}

            {/* 02 — Ce que tu maîtrises */}
            {bilan.bien_fait?.length ? (
              <section>
                <h2>02 — Ce que tu maîtrises</h2>
                <Blocks items={bilan.bien_fait} keyTitle="competence" />
              </section>
            ) : null}

            {/* 03 — Où tu progresses */}
            {bilan.progression?.length ? (
              <section>
                <h2>03 — Où tu progresses</h2>
                <Blocks items={bilan.progression} keyTitle="competence" />
              </section>
            ) : null}

            {/* 04 — Ce qui te fait perdre des ventes */}
            {bilan.perd_opportunites?.length ? (
              <section>
                <h2>04 — Ce qui te fait perdre des ventes</h2>
                <Blocks items={bilan.perd_opportunites} keyTitle="faiblesse" alert />
              </section>
            ) : null}

            {/* Bloc « Tes rendez-vous cette semaine » supprimé (dev 2026-08-31). */}

            {/* Bloc « Ce que ta façon de vendre révèle » déplacé au rapport direction (dev 2026-08-31). */}

            {/* 05 — Ton plan pour la semaine */}
            {(a.objectif || hasSteps) && (
              <section>
                <h2>05 — Ton plan pour la semaine</h2>
                <div className="plan">
                  {a.objectif && <p className="obj">{a.objectif}</p>}
                  {a.pourquoi && <p className="why">{a.pourquoi}</p>}
                  {hasSteps && (
                    <div className="steps">
                      {a.avant && <div className="step"><span className="sl">Avant le RDV</span><span className="sv">{a.avant}</span></div>}
                      {a.pendant && <div className="step"><span className="sl">Pendant</span><span className="sv">{a.pendant}</span></div>}
                      {a.formulation && <div className="step"><span className="sl">À dire</span><span className="sv quote">« {a.formulation} »</span></div>}
                      {a.apres && <div className="step"><span className="sl">Après</span><span className="sv">{a.apres}</span></div>}
                      {a.mesure && <div className="step"><span className="sl">On mesure</span><span className="sv">{a.mesure}</span></div>}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
