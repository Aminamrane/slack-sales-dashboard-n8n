// Appels Allo d'un setter dans la fiche de ses RDV (page CEO « Setters », ticket du 23/10/2026 : « tout savoir, daté et rattaché au
// prospect »). Deux endroits :
//   · un cadre d'ensemble sous les tuiles de la fiche : appels sortants, prospects appelés et joints, répondus, répondeurs (messages laissés),
//     sans réponse, entrants, temps de conversation, combien de fois chaque prospect a été appelé, étiquettes d'Allo ;
//   · sous CHAQUE RDV, une ligne (« Appels Allo vers ce prospect ×5 · 2 répondus… ») qui ouvre le panneau latéral des appels de ce prospect
//     (CallsPanel.jsx : faits d'ensemble, puis tous les appels jour par jour avec les repères « RDV posé » et « RDV prévu », et l'écoute).
// Lecture seule : rien n'est écrit. Ajout pur : si la route n'existe pas (backend pas livré) ou refuse, rien ne s'affiche de plus.
// Logique pure et textes : ./setterCalls.js (testée). Données : GET /api/v1/ceo-dashboard/setters/{id}/prospect-calls.
import { ChevronRight, Headphones, Phone } from "lucide-react";
import "./CallsPanel.css";
import { lineOf, noteOf, overviewOf, recordedOf, tagTone } from "./setterCalls.js";

const smallLabel = (C) => ({ fontSize: 10.5, fontWeight: 600, color: C.secondary, textTransform: "uppercase", letterSpacing: "0.05em" });

// ── Cadre d'ensemble de la fiche d'un setter ──────────────────────────────────────────────────────────────
export function CallsOverview({ calls, C, dark = false, styles }) {
  const note = { marginTop: 12, fontSize: 12.5, color: C.secondary, lineHeight: 1.5 };
  if (calls.state === "loading") return <div style={note} role="status">Lecture des appels Allo…</div>;
  if (calls.state !== "ready") return null;
  const view = overviewOf(calls.data);
  if (!view) return null;
  if (view.kind !== "ready") return <div style={note}>{view.text}</div>;
  const { card, pill } = styles;
  const label = smallLabel(C);
  const figure = (f) => (
    <div key={f.key} style={{ minWidth: 0 }}>
      <div style={label}>{f.label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{f.value}</div>
      {f.note && <div style={{ fontSize: 12, color: C.secondary, marginTop: 2, lineHeight: 1.45 }}>{f.note}</div>}
    </div>
  );
  const title = (text) => <h4 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: "0 0 14px" }}>{text}</h4>;
  const section = { marginTop: 24, paddingTop: 24, borderTop: `1px solid ${C.border}` };
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "22px 24px" };
  return (
    <section aria-label="Appels Allo de ce setter" style={{ ...card, padding: "20px 22px", marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>Appels Allo vers les prospects</h3>
        {view.since && <span style={{ fontSize: 12, color: C.secondary }}>depuis le {view.since}</span>}
      </div>
      <div>
        {title("Activité")}
        <div style={grid}>{view.stats.map(figure)}</div>
      </div>
      <div style={section}>
        {title("Temps passé au téléphone")}
        <div style={grid}>{view.times.map(figure)}</div>
      </div>
      <div style={{ ...section, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "28px 36px" }}>
        <div>
          {title("Combien de fois chaque prospect a été appelé")}
          <div style={{ display: "grid", gap: 10 }}>
            {view.attempts.map((a) => (
              <div key={a.key} style={{ display: "grid", gridTemplateColumns: "104px minmax(0, 1fr) 48px", alignItems: "center", gap: 12, fontSize: 12.5, color: C.text }}>
                <span>{a.label}</span>
                <span aria-hidden style={{ height: 8, borderRadius: 999, background: C.subtle, overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${a.pct}%`, background: C.accent, borderRadius: 999 }} />
                </span>
                <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{a.n}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          {title("Issues relevées par Allo sur ses appels")}
          {view.tags.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {view.tags.map((t) => <span key={t.tag}>{pill(tagTone(t.tag, dark), `${t.label} · ${t.n}`)}</span>)}
            </div>
          ) : <div style={{ fontSize: 12.5, color: C.secondary }}>Aucune étiquette relevée.</div>}
        </div>
      </div>
    </section>
  );
}

// ── Sous un RDV : la ligne d'appels du prospect ───────────────────────────────────────────────────────────
// Posée sous le prospect (colonnes 2 à 6 de la ligne du RDV) : les colonnes existantes ne bougent pas. Le détail s'ouvre dans le panneau latéral.
export function RdvCallsPanel({ view, C, onOpen }) {
  const wrap = { gridColumn: "2 / -1", marginTop: -2, minWidth: 0, fontSize: 12.5, color: C.secondary };
  if (view.kind === "none" || view.kind === "before_allo" || view.kind === "no_phone") return <div style={wrap}>{noteOf(view)}</div>;
  if (view.kind !== "calls") return null;
  const recorded = recordedOf(view.entry);
  return (
    <div style={wrap}>
      <button type="button" className="sc-trigger" onClick={onOpen} aria-haspopup="dialog"
        style={{ color: C.secondary, "--sc-line": C.border, "--sc-hover": C.subtle, "--sc-accent": C.accent }}
        title="Voir le détail des appels de ce setter vers ce prospect">
        <Phone size={13} aria-hidden className="sc-phone" />
        <span style={{ color: C.text }}>Appels Allo vers ce prospect</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{lineOf(view.entry)}</span>
        {recorded > 0 && <span className="sc-rec"><Headphones size={13} aria-hidden />{recorded} enregistrement{recorded > 1 ? "s" : ""} à écouter</span>}
        <ChevronRight size={13} aria-hidden className="sc-chev" />
      </button>
    </div>
  );
}
