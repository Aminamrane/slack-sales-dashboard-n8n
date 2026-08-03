// src/components/TeamReportView.jsx
//
// Rapport de direction tous-sales, rendu dans le MÊME langage éditorial que le bilan
// de coaching (WeeklyBilanView) : dossier papier/encre, cartes empilées, serif
// Newsreader pour les titres, IBM Plex Mono pour les kickers, pastille ambre. Ce
// n'est pas un dashboard sombre : c'est le « dossier de direction » de la semaine.
// Le contenu reste du pilotage (synthèse, classements closing/pré-audit, alertes,
// actions) mais s'adresse à la direction (pas au sales).
//
// Props :
//   report = { synthese, alertes_r1[], alertes_r2[], ecarts_top[],
//              alertes_individuelles[], alertes_critiques[], actions[] }
//   stats  = [{ email, name, avatar, nb_r1, nb_r2, avg_r1, avg_r2, whisper }]
//   period = "AAAA-Www"

import { useEffect } from "react";

const FONT_ID = "owner-scorecard-fonts";
const FONT_HREF = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap";

const CSS = `
.owner-dr{--paper:#FBFAF7;--ink:#14181C;--ink-soft:#4A5259;--rule:#E1DED5;--deep:#0E4749;--deep-soft:#E6EEEC;--alert:#A4262C;--warn:#B4740B;--good:#2F6B4F;--amber:#E8A317;
  color:var(--ink);font-family:"IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:15.5px;line-height:1.6;}
/* Cartes empilées DERRIÈRE le dossier */
.owner-dr .stack{position:relative;padding-top:16px;}
.owner-dr .stack::before,.owner-dr .stack::after{content:"";position:absolute;left:22px;right:22px;height:26px;top:0;border-radius:16px 16px 0 0;border:2px solid var(--ink);border-bottom:0;z-index:0;}
.owner-dr .stack::before{top:0;background:var(--amber);left:40px;right:40px;}
.owner-dr .stack::after{top:8px;background:#E27BB8;left:31px;right:31px;}
.owner-dr .doc{position:relative;z-index:1;background:var(--paper);border:2px solid var(--ink);border-radius:16px;overflow:hidden;}
.owner-dr .wrap{padding:26px 34px 40px;}
/* Masthead */
.owner-dr .masthead{display:flex;align-items:center;gap:18px;padding-bottom:22px;margin-bottom:6px;border-bottom:1px solid var(--rule);}
.owner-dr .seal{width:58px;height:58px;border-radius:50%;flex-shrink:0;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-family:"Newsreader",serif;font-size:20px;font-weight:600;letter-spacing:.02em;}
.owner-dr .mast-txt{flex:1;min-width:0;}
.owner-dr .kicker{font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-soft);margin:0 0 4px;}
.owner-dr .name{font-family:"Newsreader",Georgia,serif;font-weight:600;font-size:clamp(26px,3.4vw,36px);line-height:1.05;margin:0;letter-spacing:-.015em;}
.owner-dr .pill{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:600;color:#14181C;background:var(--amber);border-radius:999px;padding:7px 15px;white-space:nowrap;flex-shrink:0;}
/* KPI */
.owner-dr .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:22px;}
.owner-dr .kpi{border:1px solid var(--rule);border-radius:13px;padding:15px 17px;background:#fff;}
.owner-dr .kpi .kv{font-family:"Newsreader",Georgia,serif;font-size:34px;font-weight:600;line-height:1;letter-spacing:-.02em;}
.owner-dr .kpi .kl{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);margin-top:9px;line-height:1.4;}
/* Sections */
.owner-dr section{margin-top:34px;}
.owner-dr h2{font-family:"IBM Plex Mono",monospace;font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);font-weight:600;margin:0 0 16px;padding-bottom:8px;border-bottom:1px solid var(--ink);}
.owner-dr .lead{font-family:"Newsreader",Georgia,serif;font-size:19px;line-height:1.6;margin:0;letter-spacing:-.005em;}
/* Classements */
.owner-dr .cols{display:grid;grid-template-columns:1fr 1fr;gap:22px;}
.owner-dr .rk-h{font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;font-weight:600;color:var(--ink-soft);margin:0 0 4px;}
.owner-dr .rk-sub{font-family:"IBM Plex Mono",monospace;font-size:10.5px;color:var(--ink-soft);opacity:.8;margin:0 0 12px;}
.owner-dr .rk-row{display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid var(--rule);}
.owner-dr .rk-row:last-child{border-bottom:0;}
.owner-dr .rk-n{width:16px;font-family:"IBM Plex Mono",monospace;font-size:12.5px;font-weight:600;color:var(--ink-soft);flex-shrink:0;}
.owner-dr .rk-n.top{color:var(--warn);}
.owner-dr .ava{width:27px;height:27px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid var(--rule);}
.owner-dr .ava-fb{width:27px;height:27px;border-radius:50%;flex-shrink:0;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-family:"IBM Plex Sans";font-size:10px;font-weight:700;}
.owner-dr .rk-name{font-size:13.5px;font-weight:600;color:var(--ink);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.owner-dr .rk-wh{font-family:"IBM Plex Mono",monospace;font-size:9.5px;font-weight:600;color:var(--warn);border:1px solid var(--warn);border-radius:4px;padding:0 4px;margin-left:6px;vertical-align:1px;}
.owner-dr .rk-bar{width:74px;height:6px;border-radius:999px;background:#EEEBE3;overflow:hidden;flex-shrink:0;}
.owner-dr .rk-bar i{display:block;height:100%;border-radius:999px;}
.owner-dr .rk-score{font-family:"Newsreader",Georgia,serif;font-size:18px;font-weight:600;width:30px;text-align:right;flex-shrink:0;}
.owner-dr .rk-nb{font-family:"IBM Plex Mono",monospace;font-size:10.5px;color:var(--ink-soft);width:46px;text-align:right;flex-shrink:0;}
.owner-dr .note{font-size:13px;color:var(--ink-soft);line-height:1.55;margin-top:14px;padding-top:12px;border-top:1px dashed var(--rule);}
/* Alertes collectives : blocs numérotés épurés (même traitement que le bilan) */
.owner-dr .blocks{list-style:none;margin:0;padding:0;counter-reset:b;}
.owner-dr .blocks li{position:relative;padding:0 0 0 40px;margin-bottom:22px;counter-increment:b;}
.owner-dr .blocks li:last-child{margin-bottom:0;}
.owner-dr .blocks li::before{content:counter(b,decimal-leading-zero);position:absolute;left:0;top:2px;font-family:"IBM Plex Mono",monospace;font-size:12px;font-weight:600;color:var(--ink-soft);}
.owner-dr .blocks.r1 li::before{color:#2563EB;} .owner-dr .blocks.r2 li::before{color:var(--warn);}
.owner-dr .blocks .bt{font-family:"Newsreader",Georgia,serif;font-size:18px;font-weight:600;line-height:1.28;display:block;margin-bottom:5px;letter-spacing:-.01em;}
.owner-dr .blocks .af{font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.04em;font-weight:600;color:var(--warn);display:block;margin-bottom:6px;overflow-wrap:anywhere;line-height:1.5;}
.owner-dr .blocks .dt{font-size:14px;color:var(--ink-soft);line-height:1.55;display:block;}
.owner-dr .blocks .dt.act{color:var(--deep);margin-top:6px;}
/* Écarts / par-sales : blocs numérotés */
.owner-dr .grid2{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;}
.owner-dr .ecard{border:1px solid var(--rule);border-radius:12px;padding:14px 16px;background:#fff;}
.owner-dr .ecard .et{font-family:"Newsreader",Georgia,serif;font-size:17px;font-weight:600;margin-bottom:7px;letter-spacing:-.01em;}
.owner-dr .ecard .er{font-size:13px;color:var(--ink-soft);line-height:1.5;margin-top:3px;}
.owner-dr .ecard .er b{color:var(--ink);font-weight:600;}
.owner-dr .ecard .er.top b{color:var(--good);}
.owner-dr .ecard .er.std{color:var(--deep);}
.owner-dr .indiv{border-left:2px solid var(--rule);padding-left:14px;}
.owner-dr .indiv .in{font-family:"Newsreader",Georgia,serif;font-size:16px;font-weight:600;}
.owner-dr .indiv .ix{font-size:13px;color:var(--ink-soft);line-height:1.5;}
.owner-dr .indiv .ix .chg{color:var(--deep);}
/* Alertes critiques (encadré alerte) */
.owner-dr .crit{border:2px solid var(--alert);border-radius:14px;padding:18px 20px;background:#FCF4F3;}
.owner-dr .crit h2{color:var(--alert);border-bottom-color:var(--alert);}
.owner-dr .crit .cr{font-size:14px;color:var(--ink);line-height:1.6;margin-bottom:10px;}
.owner-dr .crit .cr:last-child{margin-bottom:0;}
.owner-dr .crit .cr b{color:var(--alert);font-weight:700;}
.owner-dr .crit .cr .chg{color:var(--deep);}
/* Actions (plan) */
.owner-dr .plan{border:2px solid var(--ink);border-radius:14px;padding:20px 22px;background:var(--deep-soft);}
.owner-dr .plan .prow{display:grid;grid-template-columns:34px 1fr;gap:14px;padding:12px 0;border-bottom:1px solid var(--rule);}
.owner-dr .plan .prow:first-child{padding-top:0;} .owner-dr .plan .prow:last-child{border-bottom:0;padding-bottom:0;}
.owner-dr .plan .pn{font-family:"IBM Plex Mono",monospace;font-size:15px;font-weight:700;color:var(--deep);}
.owner-dr .plan .pd{font-family:"Newsreader",Georgia,serif;font-size:17px;font-weight:600;line-height:1.3;letter-spacing:-.01em;}
.owner-dr .plan .pm{font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--ink-soft);margin-top:5px;line-height:1.55;letter-spacing:.02em;}
.owner-dr .empty{border:1px dashed var(--rule);border-radius:14px;padding:26px;text-align:center;color:var(--ink-soft);font-size:14px;background:var(--paper);}
@media (max-width:760px){.owner-dr .cols{grid-template-columns:1fr;}.owner-dr .kpis{grid-template-columns:1fr 1fr;}.owner-dr .wrap{padding:22px 18px 30px;}}
`;

const band = (s) => (s >= 80 ? "#2F6B4F" : s >= 70 ? "#0E4749" : s >= 60 ? "#B4740B" : "#A4262C");
const initials = (n) => (n || "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const weekLabel = (p) => {
  const m = /(\d{4})-W(\d{1,2})/.exec(p || "");
  return m ? `Semaine ${Number(m[2])} · ${m[1]}` : (p || "");
};

function Ava({ url, name }) {
  if (url) return <img className="ava" src={url} alt="" />;
  return <div className="ava-fb">{initials(name)}</div>;
}

function Ranking({ heading, sub, rows, avgKey, nbKey }) {
  if (!rows.length) return null;
  return (
    <div>
      <p className="rk-h">{heading}</p>
      {sub && <p className="rk-sub">{sub}</p>}
      {rows.map((s, i) => {
        const v = s[avgKey], col = band(v);
        return (
          <div key={s.email} className="rk-row">
            <span className={`rk-n${i === 0 ? " top" : ""}`}>{i + 1}</span>
            <Ava url={s.avatar} name={s.name} />
            <span className="rk-name">{s.name}{s.whisper && <span className="rk-wh" title="Transcription Meet coupée, analysé via Whisper (fidélité moindre)">≈</span>}</span>
            <span className="rk-bar"><i style={{ width: `${Math.max(5, Math.min(100, v))}%`, background: col }} /></span>
            <span className="rk-score" style={{ color: col }}>{v}</span>
            <span className="rk-nb">{s[nbKey]} RDV</span>
          </div>
        );
      })}
    </div>
  );
}

function AlertBlocks({ items, tone }) {
  if (!items || !items.length) return null;
  return (
    <ul className={`blocks ${tone}`}>
      {items.map((a, i) => (
        <li key={i}>
          <span className="bt">{a.pratique}</span>
          {a.freq && <span className="af">{a.freq}</span>}
          {a.impact && <span className="dt">{a.impact}</span>}
          {a.action && <span className="dt act">→ {a.action}</span>}
        </li>
      ))}
    </ul>
  );
}

export default function TeamReportView({ report, stats, period }) {
  useEffect(() => {
    if (document.getElementById(FONT_ID)) return;
    const l = document.createElement("link");
    l.id = FONT_ID; l.rel = "stylesheet"; l.href = FONT_HREF;
    document.head.appendChild(l);
  }, []);

  if (!report) {
    return (
      <div className="owner-dr">
        <style>{CSS}</style>
        <div className="empty">Pas encore de rapport de direction pour cette semaine. Il apparaîtra après la génération de l'analyse hebdomadaire.</div>
      </div>
    );
  }

  const st = stats || [];
  const rankedClosing = st.filter((s) => s.nb_r2 > 0 && s.avg_r2 != null).slice().sort((a, b) => b.avg_r2 - a.avg_r2);
  const rankedPre = st.filter((s) => s.nb_r1 > 0 && s.avg_r1 != null).slice().sort((a, b) => b.avg_r1 - a.avg_r1);
  const totR1 = st.reduce((n, s) => n + (s.nb_r1 || 0), 0);
  const totR2 = st.reduce((n, s) => n + (s.nb_r2 || 0), 0);
  const closeNb = rankedClosing.reduce((n, s) => n + s.nb_r2, 0);
  const teamAvg = closeNb ? Math.round(rankedClosing.reduce((n, s) => n + s.avg_r2 * s.nb_r2, 0) / closeNb) : null;
  const noClosing = st.filter((s) => !s.nb_r2).map((s) => s.name);
  const nbCrit = report.alertes_critiques?.length || 0;
  const hasRanks = rankedClosing.length > 0 || rankedPre.length > 0;
  const hasCollec = (report.alertes_r1?.length || 0) + (report.alertes_r2?.length || 0) > 0;

  let _n = 0;
  const num = () => String(++_n).padStart(2, "0");

  return (
    <div className="owner-dr" style={{ marginBottom: 26 }}>
      <style>{CSS}</style>
      <div className="stack">
        <div className="doc">
          <div className="wrap">
            {/* Masthead */}
            <header className="masthead">
              <div className="seal">OT</div>
              <div className="mast-txt">
                <p className="kicker">Rapport de direction · Owner Sales</p>
                <h1 className="name">Pilotage de la semaine</h1>
              </div>
              <span className="pill">{weekLabel(period)}</span>
            </header>

            {/* KPI */}
            <div className="kpis">
              <div className="kpi"><div className="kv">{totR1}</div><div className="kl">Pré-audits analysés</div></div>
              <div className="kpi"><div className="kv">{totR2}</div><div className="kl">Closings analysés</div></div>
              <div className="kpi"><div className="kv" style={{ color: teamAvg != null ? band(teamAvg) : undefined }}>{teamAvg != null ? teamAvg : "—"}</div><div className="kl">Score closing équipe</div></div>
              <div className="kpi"><div className="kv" style={{ color: nbCrit ? "#A4262C" : undefined }}>{nbCrit}</div><div className="kl">Alertes critiques</div></div>
            </div>

            {/* Synthèse */}
            {report.synthese && (
              <section>
                <h2>{num()} — Synthèse de la semaine</h2>
                <p className="lead">{report.synthese}</p>
              </section>
            )}

            {/* Classements séparés closing / pré-audit */}
            {hasRanks && (
              <section>
                <h2>{num()} — Classements · exécution</h2>
                <div className="cols">
                  <Ranking heading="Closing (R2)" sub="prix · offre · demande de signature" rows={rankedClosing} avgKey="avg_r2" nbKey="nb_r2" />
                  <Ranking heading="Pré-audit (R1)" sub="découverte · sécurisation · prochaine étape" rows={rankedPre} avgKey="avg_r1" nbKey="nb_r1" />
                </div>
                {noClosing.length > 0 && (
                  <div className="note">
                    Pas de closing analysé cette semaine (absents du classement closing) : {noClosing.join(", ")}. <span style={{ opacity: 0.85 }}>≈ = analysé via Whisper (transcription Meet coupée), fidélité moindre.</span>
                  </div>
                )}
              </section>
            )}

            {/* Alertes collectives R1 / R2 */}
            {hasCollec && (
              <section>
                <h2>{num()} — Alertes collectives</h2>
                <div className="cols">
                  {report.alertes_r1?.length ? (
                    <div>
                      <p className="rk-h">Pré-audit (R1)</p>
                      <div style={{ marginTop: 16 }}><AlertBlocks items={report.alertes_r1} tone="r1" /></div>
                    </div>
                  ) : <div />}
                  {report.alertes_r2?.length ? (
                    <div>
                      <p className="rk-h">Closing (R2)</p>
                      <div style={{ marginTop: 16 }}><AlertBlocks items={report.alertes_r2} tone="r2" /></div>
                    </div>
                  ) : <div />}
                </div>
              </section>
            )}

            {/* Écarts avec les top sales */}
            {report.ecarts_top?.length ? (
              <section>
                <h2>{num()} — Écarts avec les top sales</h2>
                <div className="grid2">
                  {report.ecarts_top.map((e, i) => (
                    <div key={i} className="ecard">
                      <div className="et">{e.competence}</div>
                      <div className="er top"><b>Top :</b> {e.top}</div>
                      <div className="er"><b>Autres :</b> {e.autres}</div>
                      {e.standard && <div className="er std"><b>Standard :</b> {e.standard}</div>}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Par sales */}
            {report.alertes_individuelles?.length ? (
              <section>
                <h2>{num()} — Par sales</h2>
                <div className="grid2">
                  {report.alertes_individuelles.map((a, i) => (
                    <div key={i} className="indiv">
                      <div className="in">{a.nom}</div>
                      <div className="ix">{a.alerte}{a.a_changer && <span className="chg"> → {a.a_changer}</span>}</div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Alertes critiques */}
            {report.alertes_critiques?.length ? (
              <section className="crit">
                <h2>⚠ Alertes critiques</h2>
                {report.alertes_critiques.map((a, i) => (
                  <div key={i} className="cr">
                    <b>{a.pratique}</b>{a.sales ? ` · ${a.sales}` : ""}{a.risque ? ` — ${a.risque}` : ""}{a.action && <span className="chg"> → {a.action}</span>}
                  </div>
                ))}
              </section>
            ) : null}

            {/* Actions à imposer */}
            {report.actions?.length ? (
              <section>
                <h2>{num()} — Actions à imposer cette semaine</h2>
                <div className="plan">
                  {report.actions.map((a, i) => (
                    <div key={i} className="prow">
                      <span className="pn">{String(i + 1).padStart(2, "0")}</span>
                      <div>
                        <div className="pd">{a.decision}</div>
                        {(a.cible || a.mise_en_oeuvre || a.controle || a.delai) && (
                          <div className="pm">{[a.cible && `Cible : ${a.cible}`, a.mise_en_oeuvre, a.controle && `Contrôle : ${a.controle}`, a.delai].filter(Boolean).join(" · ")}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
