// src/components/ScorecardView.jsx
//
// Rend une scorecard d'analyse de RDV (R1/R2) dans la mise en page éditoriale
// du modèle scorecard-r1-david-dubois.html (fonts IBM Plex + Newsreader, palette
// papier/encre). Prend le `payload` structuré (généré par l'analyse IA) et rend
// les sections présentes. Document autonome (palette claire) affiché dans le modal.
//
// Schéma du payload (toutes les clés optionnelles sauf score/score_label) :
// {
//   rdv_type:"R1"|"R2", sales, prospect, date, duration,
//   score:0..100, score_label:"Excellent|Très bon|Correct|Fragile|Insuffisant",
//   summary, verdict,
//   points_forts:[{title, detail}],
//   alerts:[{title, ts?, detail, fix?}],
//   issue:[{label, value, tone:"yes|no|part|note", note?}],
//   qualification:{ niveau, rows:[{label,value,tone,note?}], conclusion? },   // R1
//   criteria:[{name, score:0..5, constat, preuves:[{ts?,text}], action, question?}],
//   psychologie:{ text, confiance:"faible|moyenne|élevée" },
//   r2_prep:{ infos_manquantes:[...], rows:[{label,value,tone}], niveau, decideur? }, // R1 si R2 posé
//   coaching:{ priorite, exercice, mesure },
//   glossaire:[{from, to, confiance?}]
// }

import { useEffect } from "react";

const FONT_ID = "owner-scorecard-fonts";
const FONT_HREF = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap";

const CSS = `
.owner-sc{--paper:#FBFAF7;--ink:#14181C;--ink-soft:#4A5259;--rule:#E1DED5;--deep:#0E4749;--deep-soft:#E6EEEC;--alert:#A4262C;--warn:#B4740B;--good:#2F6B4F;
  background:var(--paper);color:var(--ink);font-family:"IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:15.5px;line-height:1.6;}
.owner-sc .wrap{max-width:840px;margin:0 auto;padding:0 30px 44px;}
.owner-sc .masthead{border-bottom:2px solid var(--ink);padding:34px 0 20px;margin-bottom:34px;}
.owner-sc .kicker{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-soft);margin:0 0 12px;}
.owner-sc .masthead h1{font-family:"Newsreader",Georgia,serif;font-weight:500;font-size:clamp(26px,4vw,38px);line-height:1.12;margin:0 0 16px;letter-spacing:-.01em;}
.owner-sc .meta{display:flex;flex-wrap:wrap;gap:6px 26px;font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--ink-soft);}
.owner-sc .meta b{color:var(--ink);font-weight:500;}
.owner-sc .score-panel{display:grid;grid-template-columns:minmax(0,210px) 1fr;gap:32px;align-items:start;}
.owner-sc .score-box{border:1px solid var(--rule);background:#fff;padding:20px 18px;}
.owner-sc .score-num{font-family:"Newsreader",Georgia,serif;font-weight:600;font-size:60px;line-height:1;letter-spacing:-.02em;}
.owner-sc .score-num span{font-size:22px;color:var(--ink-soft);font-weight:400;}
.owner-sc .score-label{font-family:"IBM Plex Mono",monospace;font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin-top:8px;font-weight:600;}
.owner-sc .meter{display:flex;gap:3px;margin-top:15px;}
.owner-sc .meter i{height:8px;flex:1;background:var(--rule);border-radius:1px;}
.owner-sc .summary{font-size:16px;line-height:1.7;margin:0;}
.owner-sc .summary strong{font-weight:600;}
.owner-sc .verdict{margin-top:16px;padding:13px 17px;border-left:3px solid var(--ink);background:#fff;font-family:"Newsreader",Georgia,serif;font-size:16.5px;font-style:italic;line-height:1.5;}
.owner-sc section{margin-top:44px;}
.owner-sc h2{font-family:"IBM Plex Mono",monospace;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);font-weight:600;margin:0 0 18px;padding-bottom:9px;border-bottom:1px solid var(--ink);display:flex;align-items:baseline;gap:12px;}
.owner-sc h2 em{font-style:normal;color:var(--ink-soft);font-weight:400;}
.owner-sc ul.items{list-style:none;margin:0;padding:0;}
.owner-sc ul.items li{border-left:2px solid var(--rule);padding:2px 0 2px 18px;margin-bottom:16px;}
.owner-sc ul.items li b{font-weight:600;}
.owner-sc ul.items.strong li{border-left-color:var(--good);}
.owner-sc ul.items.alert li{border-left-color:var(--alert);}
.owner-sc .ts{font-family:"IBM Plex Mono",monospace;font-size:12.5px;color:var(--ink-soft);}
.owner-sc .fix{display:block;margin-top:6px;font-size:14.5px;color:var(--deep);}
.owner-sc .fix b{font-weight:600;}
.owner-sc .facts{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--rule);}
.owner-sc .facts td{padding:10px 15px;border-bottom:1px solid var(--rule);vertical-align:top;}
.owner-sc .facts tr:last-child td{border-bottom:0;}
.owner-sc .facts td:first-child{width:52%;color:var(--ink-soft);}
.owner-sc .facts td:last-child{font-family:"IBM Plex Mono",monospace;font-size:13.5px;}
.owner-sc .yes{color:var(--good);font-weight:600;}
.owner-sc .no{color:var(--alert);font-weight:600;}
.owner-sc .part{color:var(--warn);font-weight:600;}
.owner-sc .note{color:var(--ink-soft);font-weight:400;}
.owner-sc .after{margin-top:13px;color:var(--ink-soft);font-size:14.5px;}
.owner-sc .badge{display:inline-block;font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:600;padding:5px 11px;border:1px solid var(--good);color:var(--good);margin-bottom:15px;}
.owner-sc .crit{border-top:1px solid var(--rule);padding:20px 0;}
.owner-sc .crit:first-of-type{border-top:0;}
.owner-sc .crit-head{display:flex;align-items:baseline;gap:14px;margin-bottom:11px;}
.owner-sc .crit-head h3{font-family:"Newsreader",Georgia,serif;font-weight:500;font-size:20px;margin:0;flex:1;letter-spacing:-.01em;}
.owner-sc .chip{font-family:"IBM Plex Mono",monospace;font-size:13px;font-weight:600;padding:3px 10px;border:1px solid currentColor;white-space:nowrap;}
.owner-sc .dots{display:flex;gap:4px;margin-bottom:11px;}
.owner-sc .dots i{width:26px;height:4px;background:var(--rule);}
.owner-sc .crit p{margin:0 0 9px;}
.owner-sc .crit .lbl{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);font-weight:600;}
.owner-sc .crit ul{margin:0 0 11px;padding-left:18px;}
.owner-sc .crit ul li{margin-bottom:5px;}
.owner-sc .action{background:var(--deep-soft);padding:10px 15px;font-size:14.5px;}
.owner-sc .action .lbl{color:var(--deep);}
.owner-sc .qreco{border-left:2px solid var(--warn);padding:2px 0 2px 14px;margin-top:11px;font-size:14.5px;}
.owner-sc .qreco q{font-family:"Newsreader",Georgia,serif;font-size:16px;font-style:italic;}
.owner-sc .psy{background:#fff;border:1px solid var(--rule);padding:20px 22px;line-height:1.7;}
.owner-sc .psy .conf{display:block;margin-top:11px;font-family:"IBM Plex Mono",monospace;font-size:12.5px;color:var(--ink-soft);}
.owner-sc .cols{display:grid;grid-template-columns:1fr 1fr;gap:26px;}
.owner-sc .coach{border:1px solid var(--ink);padding:22px;}
.owner-sc .coach div+div{margin-top:15px;}
.owner-sc .coach .lbl{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);font-weight:600;display:block;margin-bottom:4px;}
.owner-sc .glossary{font-family:"IBM Plex Mono",monospace;font-size:13.5px;list-style:none;padding:0;margin:0;}
.owner-sc .glossary li{padding:9px 0;border-bottom:1px solid var(--rule);}
.owner-sc .glossary li:last-child{border-bottom:0;}
.owner-sc .arrow{color:var(--deep);padding:0 8px;}
@media (max-width:720px){.owner-sc .score-panel,.owner-sc .cols{grid-template-columns:1fr;gap:22px;}.owner-sc .wrap{padding:0 18px 32px;}}
`;

const band = (s) => (s >= 80 ? "#2F6B4F" : s >= 70 ? "#0E4749" : s >= 60 ? "#B4740B" : "#A4262C");
const critColor = (s) => (s >= 4 ? "#2F6B4F" : s === 3 ? "#B4740B" : "#A4262C");
const toneClass = (t) => (t === "yes" ? "yes" : t === "no" ? "no" : t === "part" ? "part" : "note");

// Ne rendre que du texte : tout objet/tableau inattendu devient vide (jamais un
// « Objects are not valid as a React child »).
const asText = (v) => (v == null || typeof v === "object" ? "" : v);
const asPreuves = (arr) => (Array.isArray(arr) ? arr : []).map((p) =>
  typeof p === "string" ? { text: p } : { ts: p?.ts, text: asText(p?.text != null ? p.text : p?.texte) }
);
const asRows = (arr) => (Array.isArray(arr) ? arr : []).map((r) => ({
  label: asText(r?.label), value: asText(r?.value != null ? r.value : r?.valeur), tone: r?.tone, note: asText(r?.note),
}));

// Normalise un payload de scorecard : accepte les deux jeux de clés (title|titre,
// name|nom, score|note, value|valeur, preuves string|objet, psychologie
// text|analyse|moteur, qualification.details→rows) pour un rendu toujours propre.
function normalize(sc) {
  const out = { ...sc, summary: asText(sc.summary), verdict: asText(sc.verdict) };

  if (sc.points_forts) out.points_forts = sc.points_forts.map((p) => ({ title: p?.title || p?.titre, detail: asText(p?.detail) }));
  if (sc.alerts) out.alerts = sc.alerts.map((a) => ({ title: a?.title || a?.titre, ts: a?.ts, detail: asText(a?.detail), fix: asText(a?.fix) }));
  if (sc.issue) out.issue = asRows(sc.issue);

  if (sc.qualification) {
    const q = sc.qualification;
    let rows = q.rows;
    if (!rows && q.details && typeof q.details === "object") {
      rows = Object.entries(q.details).map(([k, v]) => ({ label: k.replace(/_/g, " "), value: asText(v) }));
    }
    out.qualification = { niveau: asText(q.niveau), rows: asRows(rows), conclusion: asText(q.conclusion) };
  }

  if (sc.criteria) out.criteria = sc.criteria.map((c) => ({
    name: c?.name || c?.nom,
    score: typeof c?.score === "number" ? c.score : (typeof c?.note === "number" ? c.note : undefined),
    constat: asText(c?.constat),
    preuves: asPreuves(c?.preuves),
    action: asText(c?.action),
    question: c?.question || c?.question_recommandee,
  }));

  if (sc.psychologie != null) {
    const ps = sc.psychologie;
    out.psychologie = typeof ps === "string"
      ? { text: ps }
      : { text: asText(ps.text || ps.analyse || ps.moteur), confiance: asText(ps.confiance) };
  }

  if (sc.coaching && typeof sc.coaching === "object") out.coaching = {
    priorite: asText(sc.coaching.priorite || sc.coaching.axe),
    exercice: asText(sc.coaching.exercice),
    mesure: asText(sc.coaching.mesure || sc.coaching.indicateur),
  };

  if (sc.r2_prep && typeof sc.r2_prep === "object") out.r2_prep = {
    ...sc.r2_prep,
    infos_manquantes: (sc.r2_prep.infos_manquantes || []).map(asText),
    rows: asRows(sc.r2_prep.rows),
    niveau: asText(sc.r2_prep.niveau),
    decideur: asText(sc.r2_prep.decideur),
  };

  return out;
}

function FactsTable({ rows }) {
  return (
    <table className="facts"><tbody>
      {rows.map((r, i) => (
        <tr key={i}>
          <td>{r.label}</td>
          <td className={toneClass(r.tone)}>{r.value}{r.note ? <span className="note"> {r.note}</span> : null}</td>
        </tr>
      ))}
    </tbody></table>
  );
}

export default function ScorecardView({ sc: rawSc }) {
  useEffect(() => {
    if (document.getElementById(FONT_ID)) return;
    const l = document.createElement("link");
    l.id = FONT_ID; l.rel = "stylesheet"; l.href = FONT_HREF;
    document.head.appendChild(l);
  }, []);

  if (!rawSc) return null;
  const sc = normalize(rawSc);
  const on = Math.max(0, Math.min(10, Math.round((sc.score || 0) / 10)));
  const scColor = band(sc.score || 0);

  // Sections numérotées présentes.
  const sections = [];
  sections.push({ h: "Score global", body: (
    <div className="score-panel">
      <div className="score-box">
        <div className="score-num" style={{ color: scColor }}>{sc.score}<span>/100</span></div>
        <div className="score-label" style={{ color: scColor }}>{sc.score_label}</div>
        <div className="meter">
          {Array.from({ length: 10 }).map((_, i) => (
            <i key={i} style={i < on ? { background: scColor } : undefined} />
          ))}
        </div>
      </div>
      <div>
        {sc.summary && <p className="summary">{sc.summary}</p>}
        {sc.verdict && <p className="verdict">{sc.verdict}</p>}
      </div>
    </div>
  )});

  if (sc.points_forts?.length) sections.push({ h: "Points forts", body: (
    <ul className="items strong">
      {sc.points_forts.map((p, i) => <li key={i}><b>{p.title}</b>{p.detail ? <> — {p.detail}</> : null}</li>)}
    </ul>
  )});

  if (sc.alerts?.length) sections.push({ h: "Points d’alerte immédiate", em: "classés par impact", body: (
    <ul className="items alert">
      {sc.alerts.map((a, i) => (
        <li key={i}>
          <b>{a.title}</b>{a.ts ? <> — <span className="ts">{a.ts}</span></> : null}{a.detail ? <>. {a.detail}</> : null}
          {a.fix && <span className="fix"><b>Correction immédiate :</b> {a.fix}</span>}
        </li>
      ))}
    </ul>
  )});

  if (sc.issue?.length) sections.push({ h: "Issue du rendez-vous", body: <FactsTable rows={sc.issue} /> });

  if (sc.qualification) sections.push({ h: "Qualification du prospect", body: (
    <>
      {sc.qualification.niveau && <span className="badge">Niveau : {sc.qualification.niveau}</span>}
      {sc.qualification.rows?.length ? <FactsTable rows={sc.qualification.rows} /> : null}
      {sc.qualification.conclusion && <p className="after">{sc.qualification.conclusion}</p>}
    </>
  )});

  if (sc.criteria?.length) sections.push({ h: "Scorecard détaillée", body: (
    <>
      {sc.criteria.map((c, i) => {
        const col = critColor(c.score);
        return (
          <div className="crit" key={i}>
            <div className="crit-head"><h3>{c.name}</h3><span className="chip" style={{ color: col }}>{c.score}/5</span></div>
            <div className="dots">{Array.from({ length: 5 }).map((_, k) => <i key={k} style={k < c.score ? { background: col } : undefined} />)}</div>
            {c.constat && <p><span className="lbl">Constat</span> — {c.constat}</p>}
            {c.preuves?.length ? (
              <ul>{c.preuves.map((pr, k) => <li key={k}>{pr.ts ? <span className="ts">{pr.ts}</span> : null}{pr.ts ? " " : ""}{pr.text}</li>)}</ul>
            ) : null}
            {c.action && <p className="action"><span className="lbl">Action prioritaire</span> — {c.action}</p>}
            {c.question && <p className="qreco"><span className="lbl">Question recommandée</span><br /><q>{c.question}</q></p>}
          </div>
        );
      })}
    </>
  )});

  if (sc.psychologie) sections.push({ h: "Analyse psychologique", body: (
    <div className="psy">
      {sc.psychologie.text}
      {sc.psychologie.confiance && <span className="conf">Conclusion à confiance {sc.psychologie.confiance}.</span>}
    </div>
  )});

  if (sc.r2_prep) sections.push({ h: "Préparation du R2", body: (
    <>
      <div className="cols">
        <div>
          <p><span className="lbl" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "#4A5259", fontWeight: 600 }}>Informations critiques manquantes</span></p>
          <ul>{(sc.r2_prep.infos_manquantes || []).map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
        <div>{sc.r2_prep.rows?.length ? <FactsTable rows={sc.r2_prep.rows} /> : null}
          {sc.r2_prep.niveau && <p className="after"><b>Niveau de préparation :</b> {sc.r2_prep.niveau}</p>}
        </div>
      </div>
      {sc.r2_prep.decideur && <p className="after"><b>Décideur à sécuriser :</b> {sc.r2_prep.decideur}</p>}
    </>
  )});

  if (sc.coaching) sections.push({ h: "Priorité de coaching", body: (
    <div className="coach">
      {sc.coaching.priorite && <div><span className="lbl">Priorité</span>{sc.coaching.priorite}</div>}
      {sc.coaching.exercice && <div><span className="lbl">Exercice</span>{sc.coaching.exercice}</div>}
      {sc.coaching.mesure && <div><span className="lbl">Mesure</span>{sc.coaching.mesure}</div>}
    </div>
  )});

  if (sc.glossaire?.length) sections.push({ h: "Nouveaux termes à ajouter au glossaire", body: (
    <ul className="glossary">
      {sc.glossaire.map((g, i) => <li key={i}>{g.from} <span className="arrow">→</span> {g.to}{g.confiance ? ` — Confiance : ${g.confiance}` : ""}</li>)}
    </ul>
  )});

  if (sc.signature) {
    const sig = sc.signature;
    const col = sig.signed === true ? "#2F6B4F" : sig.signed === false ? "#B4740B" : "#4A5259";
    sections.push({ h: "Résultat commercial (CRM)", body: (
      <div className="psy" style={{ borderLeft: `3px solid ${col}` }}>
        <b style={{ color: col, fontSize: 16 }}>{sig.status_label}</b>{sig.date ? ` — ${sig.date}` : ""}
        {sig.note && <div style={{ marginTop: 8, color: "var(--ink-soft)" }}>{sig.note}</div>}
      </div>
    )});
  }

  const kicker = `Owner Technology — Scorecard ${sc.rdv_type || ""}`.trim();
  const title = sc.rdv_type === "R2" ? "Analyse d’un rendez-vous de restitution" : "Analyse d’un rendez-vous de pré-audit";

  return (
    <div className="owner-sc">
      <style>{CSS}</style>
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">{kicker}</p>
          <h1>{title}</h1>
          <div className="meta">
            {sc.sales && <span>Sales <b>{sc.sales}</b></span>}
            {sc.prospect && <span>Prospect <b>{sc.prospect}</b></span>}
            {sc.date && <span>Date <b>{sc.date}</b></span>}
            {sc.duration && <span>Durée <b>{sc.duration}</b></span>}
          </div>
        </header>
        {sections.map((s, i) => (
          <section key={i} style={i === 0 ? { marginTop: 0 } : undefined}>
            <h2>{String(i + 1).padStart(2, "0")} — {s.h}{s.em ? <em>{s.em}</em> : null}</h2>
            {s.body}
          </section>
        ))}
      </div>
    </div>
  );
}
