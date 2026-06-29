// src/pages/Variables.jsx
// Calcul des variables Sales / Heads of Sales — page ADDITIVE, lecture seule sur les ventes.
// Objectif : TRANSPARENCE TOTALE. Le CEO vient d'un Google Sheets, il doit pouvoir verifier
// chaque euro lui-meme. Tout est trace : base x coef = commission, override decompose, barme
// visible (= les regles de son fichier), build-up du net affiche. Donnees REELLES uniquement
// (aucune demo) via /api/v1/variables (gate admin/ceo).

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import apiClient from "../services/apiClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
import { makeCharte } from "../styles/charte.js";
import "../index.css";

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';
const MOIS = ["Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin", "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre"];

const eur = (n) => (Number(n) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " EUR";
const coefFmt = (n) => (Number(n) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const planLabel = (p) => (p === "A" ? "Annuel" : "Mensuel");
const monthLabel = (m) => { const [y, mm] = m.split("-"); return `${MOIS[parseInt(mm, 10) - 1]} ${y}`; };
const shiftMonth = (m, delta) => {
  const [y, mm] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mm - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export default function Variables({ embed = false }) {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
    document.documentElement.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);
  const C = makeCharte(darkMode);

  useEffect(() => {
    if (embed) return;  // en embed (shell CEO), l'acces est garanti par le parent
    const u = apiClient.getUser();
    if (!u || (u.role !== "admin" && u.role !== "ceo" && u.role !== "hr")) navigate("/login");
  }, [navigate, embed]);

  const nowMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const [month, setMonth] = useState(nowMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [showRules, setShowRules] = useState(false);

  const load = async (m) => {
    setLoading(true); setError(null);
    try {
      const res = await apiClient.get(`/api/v1/variables/monthly?month=${m}`);
      setData(res);
    } catch (e) {
      setData(null);
      setError(e?.message || "Impossible de charger les donnees.");
    }
    setLoading(false);
  };
  useEffect(() => { load(month); /* eslint-disable-next-line */ }, [month]);

  const people = data?.people || [];
  const totals = useMemo(() => {
    const t = { fixe: 0, variable: 0, net: 0, n_deals: 0 };
    for (const p of people) { t.fixe += p.fixe; t.variable += p.variable; t.net += p.net; t.n_deals += p.n_deals; }
    return t;
  }, [people]);

  return (
    <div style={{ minHeight: embed ? "auto" : "100vh", background: embed ? "transparent" : C.surface, fontFamily: FONT, color: C.text }}>
      <style>{`
        @keyframes vFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes vRowIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
      `}</style>
      {!embed && <SharedNavbar darkMode={darkMode} setDarkMode={setDarkMode} />}

      <div style={{ maxWidth: embed ? "100%" : 1180, margin: "0 auto", padding: embed ? "6px 6px 48px" : "26px 24px 80px", animation: "vFadeUp 0.4s ease both" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.accentText, letterSpacing: 0.3 }}>Paie · confidentiel</div>
            <h1 style={{ margin: "4px 0 2px", fontSize: 26, fontWeight: 700, letterSpacing: -0.4 }}>Calcul des variables</h1>
          </div>
          <MonthPicker C={C} month={month} setMonth={setMonth} />
        </div>

        {/* Bandeau de confiance + toggle regles */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", margin: "14px 0 18px", padding: "10px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10 }}>
          <div style={{ fontSize: 12.5, color: C.text2 }}>
            Aucune saisie manuelle : la source, ce sont les <b style={{ color: C.text }}>ventes signées du CRM</b>.
          </div>
          <button onClick={() => setShowRules((v) => !v)}
            style={{ flexShrink: 0, padding: "7px 13px", borderRadius: 8, border: `1px solid ${C.border}`, background: showRules ? C.accentSoft : "transparent", color: showRules ? C.accentText : C.text2, fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
            {showRules ? "Masquer les regles" : "Comment c'est calcule ?"}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {showRules && data?.bareme && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} style={{ overflow: "hidden" }}>
              <BaremePanel C={C} bareme={data.bareme} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* KPI */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 22 }}>
          <Kpi C={C} label="Total a verser (net)" value={eur(totals.net)} strong title="Somme des nets de tous les commerciaux ce mois." />
          <Kpi C={C} label="Dont variable" value={eur(totals.variable)} title="Commissions + commission d'équipe + primes exceptionnelles." />
          <Kpi C={C} label="Dont fixe" value={eur(totals.fixe)} title="Salaires fixes (barme RH)." />
          <Kpi C={C} label="Ventes du mois" value={`${totals.n_deals}`} title="Contrats signes pris en compte." />
        </div>

        {/* Table / etats */}
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: C.shadow, overflow: "hidden" }}>
          <TableHeader C={C} />
          {loading && <div style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 14 }}>Chargement…</div>}
          {error && !loading && (
            <div style={{ padding: 34, textAlign: "center" }}>
              <div style={{ fontSize: 14, color: C.text, marginBottom: 10 }}>Impossible de charger les donnees.</div>
              <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 14 }}>{error}</div>
              <button onClick={() => load(month)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: C.primary, color: C.onPrimary, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Reessayer</button>
            </div>
          )}
          {!loading && !error && people.map((p, i) => (
            <PersonRow key={p.email} C={C} p={p} index={i}
              open={expanded === p.email}
              onToggle={() => setExpanded(expanded === p.email ? null : p.email)}
              month={month} onChanged={() => load(month)} />
          ))}
          {!loading && !error && people.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 14 }}>Aucune donnee pour ce mois.</div>
          )}
        </div>

        {/* Hors bareme : transparence sur ce qui n'est PAS paye */}
        {data?.unmapped?.length > 0 && (
          <div style={{ marginTop: 18, fontSize: 12.5, color: C.muted }}>
            <b style={{ color: C.text2 }}>Hors barme</b> (closers non rattaches au roster Sales/Heads, donc non payes ici) :{" "}
            {data.unmapped.map((u) => `${u.name} (${u.n_deals} vente${u.n_deals > 1 ? "s" : ""})`).join(", ")}.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Panneau "regles de calcul" = le barme du fichier RH, expose tel quel ──
function BaremePanel({ C, bareme }) {
  const card = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, boxShadow: C.shadow };
  const head = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: C.muted, marginBottom: 10 };
  const bases = Object.entries(bareme.bases || {});
  const coefRows = [
    ["Sales", "Cold call (CC)", bareme.coefs?.Sales?.["CC-M"], bareme.coefs?.Sales?.["CC-A"]],
    ["Sales", "ADS / autres", bareme.coefs?.Sales?.["ADS-M"], bareme.coefs?.Sales?.["ADS-A"]],
    ["Head of Sales", "Cold call (CC)", bareme.coefs?.Head?.["CC-M"], bareme.coefs?.Head?.["CC-A"]],
    ["Head of Sales", "ADS / autres", bareme.coefs?.Head?.["ADS-M"], bareme.coefs?.Head?.["ADS-A"]],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
      {/* Principe + sources */}
      <div style={card}>
        <div style={head}>Le principe</div>
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>
          <div><b>Commission</b> = base (tranche du client) <b>×</b> coefficient (poste · CC/ADS · Mensuel/Annuel).</div>
          <div style={{ marginTop: 6 }}><b>Commission d'équipe</b> du head = base <b>×</b> {coefFmt(bareme.override?.CC)} (CC) ou {coefFmt(bareme.override?.ADS)} (ADS), sur chaque vente de son équipe.</div>
          <div style={{ marginTop: 6 }}><b>Net à verser</b> = Fixe + Variable (commissions + commission d'équipe + primes).</div>
        </div>
        <div style={{ ...head, marginTop: 16 }}>D'ou vient chaque donnee</div>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: C.text2, lineHeight: 1.7 }}>
          <li>Tranche : {bareme.sources?.tranche}</li>
          <li>CC / ADS : {bareme.sources?.cc_ads}</li>
          <li>Mensuel / Annuel : {bareme.sources?.plan}</li>
        </ul>
      </div>

      {/* Coefs + bases */}
      <div style={card}>
        <div style={head}>Coefficients (× base)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.7fr 0.7fr", gap: 4, fontSize: 12.5 }}>
          <div style={{ color: C.muted, fontWeight: 600 }}>Poste</div>
          <div style={{ color: C.muted, fontWeight: 600 }}>Type</div>
          <div style={{ color: C.muted, fontWeight: 600, textAlign: "right" }}>Mens.</div>
          <div style={{ color: C.muted, fontWeight: 600, textAlign: "right" }}>Ann.</div>
          {coefRows.map(([poste, type, m, a], i) => (
            <Frag key={i}>
              <div style={{ color: C.text }}>{poste}</div>
              <div style={{ color: C.text2 }}>{type}</div>
              <div style={{ textAlign: "right", color: C.text, fontVariantNumeric: "tabular-nums" }}>{coefFmt(m)}</div>
              <div style={{ textAlign: "right", color: C.text, fontVariantNumeric: "tabular-nums" }}>{coefFmt(a)}</div>
            </Frag>
          ))}
        </div>
        <div style={{ ...head, marginTop: 16 }}>Base par tranche (salaries client)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {bases.map(([t, b]) => (
            <span key={t} style={{ fontSize: 11.5, color: C.text2, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: "2px 7px", fontVariantNumeric: "tabular-nums" }}>
              {t} <b style={{ color: C.text }}>{b}</b>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthPicker({ C, month, setMonth }) {
  const btn = { width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button style={btn} onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mois precedent">‹</button>
      <div style={{ minWidth: 150, textAlign: "center", fontSize: 15, fontWeight: 600, color: C.text, padding: "6px 12px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.bg }}>{monthLabel(month)}</div>
      <button style={btn} onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mois suivant">›</button>
    </div>
  );
}

function Kpi({ C, label, value, strong, title }) {
  return (
    <div title={title} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px", boxShadow: C.shadow }}>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: strong ? 22 : 18, fontWeight: 700, color: strong ? C.accentText : C.text, letterSpacing: -0.3 }}>{value}</div>
    </div>
  );
}

const COLS = "minmax(180px,1.6fr) 70px 1fr 1fr 1fr 1fr 1.1fr 36px";

function TableHeader({ C }) {
  const cell = { fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 };
  return (
    <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "11px 16px", borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt, alignItems: "center" }}>
      <div style={cell}>Commercial</div>
      <div style={{ ...cell, textAlign: "center" }}>Ventes</div>
      <div style={{ ...cell, textAlign: "right" }}>Commissions</div>
      <div style={{ ...cell, textAlign: "right" }} title="Commission que le head touche sur chaque vente de son équipe">Comm. équipe</div>
      <div style={{ ...cell, textAlign: "right" }}>Except.</div>
      <div style={{ ...cell, textAlign: "right" }}>Fixe</div>
      <div style={{ ...cell, textAlign: "right" }}>Net a verser</div>
      <div />
    </div>
  );
}

function PersonRow({ C, p, index, open, onToggle, month, onChanged }) {
  const isHead = p.role_type === "Heads of Sales";
  const num = { fontSize: 13.5, color: C.text, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  return (
    <div style={{ borderBottom: `1px solid ${C.border}`, animation: "vRowIn 0.35s ease both", animationDelay: `${index * 0.025}s` }}>
      <div onClick={onToggle}
        style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "13px 16px", alignItems: "center", cursor: "pointer", background: open ? C.surfaceAlt : "transparent", transition: "background 0.15s" }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = C.surface; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = "transparent"; }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          <Avatar C={C} src={p.avatar_url} name={p.name} isHead={isHead} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
            <div style={{ fontSize: 11.5, color: C.muted }}>{isHead ? "Head of Sales" : "Sales"}</div>
          </div>
        </div>
        <div style={{ fontSize: 13.5, color: p.n_deals ? C.text : C.muted, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{p.n_deals}</div>
        <div style={num}>{p.own_commission ? eur(p.own_commission) : "·"}</div>
        <div style={{ ...num, color: p.override_received ? C.accentText : C.muted }}>{p.override_received ? eur(p.override_received) : "·"}</div>
        <div style={{ ...num, color: p.exceptional_total ? (p.exceptional_total < 0 ? C.warn : C.ok) : C.muted }}>{p.exceptional_total ? eur(p.exceptional_total) : "·"}</div>
        <div style={{ ...num, color: C.text2 }}>{eur(p.fixe)}</div>
        <div style={{ ...num, fontSize: 15, fontWeight: 700 }} title="Fixe + Variable">{eur(p.net)}</div>
        <div style={{ textAlign: "center", color: C.muted, fontSize: 13, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }} style={{ overflow: "hidden", background: C.surface }}>
            <PersonDetail C={C} p={p} month={month} onChanged={onChanged} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PersonDetail({ C, p, month, onChanged }) {
  return (
    <div style={{ padding: "16px 20px 22px", display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 24 }}>
      {/* Colonne gauche : la PREUVE (deals + override, chacun avec son calcul) */}
      <div style={{ minWidth: 0 }}>
        <SectionTitle C={C}>Commissions · {p.n_deals} vente{p.n_deals > 1 ? "s" : ""}</SectionTitle>
        {p.deals?.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {p.deals.map((d, i) => <DealLine key={i} C={C} d={d} />)}
            <SubTotal C={C} label="Total commissions" value={p.own_commission} />
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: C.muted }}>Aucune vente ce mois.</div>
        )}

        {p.override_breakdown?.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <SectionTitle C={C}>Commission d'équipe · d'où elle vient</SectionTitle>
            {p.override_breakdown.map((o, i) => <OverrideLine key={i} C={C} o={o} />)}
            <SubTotal C={C} label="Total commission d'équipe" value={p.override_received} />
          </div>
        )}
      </div>

      {/* Colonne droite : build-up du net + primes */}
      <div>
        <SectionTitle C={C}>Du calcul au net</SectionTitle>
        <BuildUp C={C} p={p} />

        <div style={{ marginTop: 18 }}>
          <SectionTitle C={C}>Primes exceptionnelles</SectionTitle>
          {p.exceptions?.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {p.exceptions.map((ex) => (
                <div key={ex.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12.5, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px" }}>
                  <span style={{ color: C.text, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.label}</span>
                  <span style={{ ...mono(C), color: ex.amount < 0 ? C.warn : C.ok }}>{ex.amount > 0 ? "+" : ""}{eur(ex.amount)}</span>
                  <DeleteExc C={C} id={ex.id} onChanged={onChanged} />
                </div>
              ))}
            </div>
          )}
          <AddExceptionForm C={C} email={p.email} month={month} onChanged={onChanged} />
        </div>
      </div>
    </div>
  );
}

// Une vente, montree comme une formule : tranche (base) × coef [CC · Mensuel] = commission
function DealLine({ C, d }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "7px 0", borderBottom: `1px dashed ${C.border}` }}>
      <span style={{ color: C.text, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`Origine : ${d.origin || "non renseignee"}`}>{d.client || "·"}</span>
      <Tag C={C} title="Tranche de salaries du client (a la vente)">{d.tranche || "?"}</Tag>
      <Tag C={C} accent={d.cat === "CC"} title="CC = cold call ; ADS = autre origine">{d.cat}</Tag>
      <Tag C={C} title="Mode de paiement declare">{planLabel(d.plan)}</Tag>
      {d.tranche_unknown ? (
        <span style={{ ...mono(C), color: C.warn, minWidth: 120, textAlign: "right" }}>tranche inconnue</span>
      ) : (
        <span style={{ ...mono(C), minWidth: 138, textAlign: "right", color: C.text2 }}>
          {eur(d.base)} × {coefFmt(d.coef)} = <b style={{ color: C.text }}>{eur(d.commission)}</b>
        </span>
      )}
    </div>
  );
}

function OverrideLine({ C, o }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "6px 0", borderBottom: `1px dashed ${C.border}` }}>
      <span style={{ color: C.text2, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {o.from}{o.client ? ` · ${o.client}` : ""}
      </span>
      <Tag C={C}>{o.tranche || "?"}</Tag>
      <Tag C={C} accent={o.cat === "CC"}>{o.cat}</Tag>
      <span style={{ ...mono(C), minWidth: 130, textAlign: "right", color: C.text2 }}>
        {eur(o.base)} × {coefFmt(o.coef)} = <b style={{ color: C.accentText }}>{eur(o.amount)}</b>
      </span>
    </div>
  );
}

function BuildUp({ C, p }) {
  const line = (label, value, opts = {}) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0", fontSize: opts.big ? 14.5 : 13 }}>
      <span style={{ color: opts.big ? C.text : C.text2, fontWeight: opts.big ? 700 : 500 }}>{label}</span>
      <span style={{ ...mono(C), fontSize: opts.big ? 15 : 13, fontWeight: opts.big ? 700 : 600, color: opts.accent ? C.accentText : C.text }}>
        {opts.sign && value > 0 ? "+" : ""}{eur(value)}
      </span>
    </div>
  );
  const rule = <div style={{ height: 1, background: C.border, margin: "4px 0" }} />;
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px" }}>
      {line("Commissions propres", p.own_commission)}
      {line("Commission d'équipe", p.override_received, { sign: true, accent: !!p.override_received })}
      {line("Primes exceptionnelles", p.exceptional_total, { sign: true })}
      {rule}
      {line("Variable", p.variable, { big: false })}
      {line("Fixe", p.fixe, { sign: true })}
      {rule}
      {line("Net a verser", p.net, { big: true })}
    </div>
  );
}

function SubTotal({ C, label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", fontSize: 12.5, fontWeight: 600, color: C.text }}>
      <span>{label}</span><span style={mono(C)}>{eur(value)}</span>
    </div>
  );
}

function AddExceptionForm({ C, email, month, onChanged }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const submit = async () => {
    const amt = parseFloat(String(amount).replace(",", "."));
    if (!label.trim() || isNaN(amt)) { setMsg("Motif + montant requis."); return; }
    setBusy(true); setMsg("");
    try {
      await apiClient.post("/api/v1/variables/exceptions", { period: month, person_email: email, label: label.trim(), amount: amt });
      setLabel(""); setAmount(""); onChanged?.();
    } catch (e) { setMsg(e?.message || "Erreur lors de l'ajout."); }
    setBusy(false);
  };
  const inp = { width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input style={inp} placeholder="Motif (ex: prime closing, rattrapage…)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <div style={{ display: "flex", gap: 8 }}>
        <input style={{ ...inp, flex: 1 }} placeholder="Montant EUR (+/-)" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
        <button onClick={submit} disabled={busy}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: C.primary, color: C.onPrimary, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, whiteSpace: "nowrap" }}>
          {busy ? "…" : "Ajouter"}
        </button>
      </div>
      {msg && <div style={{ fontSize: 11.5, color: C.muted }}>{msg}</div>}
    </div>
  );
}

function DeleteExc({ C, id, onChanged }) {
  const [busy, setBusy] = useState(false);
  const del = async () => { setBusy(true); try { await apiClient.delete(`/api/v1/variables/exceptions/${id}`); onChanged?.(); } catch { /* noop */ } setBusy(false); };
  return (
    <button onClick={del} disabled={busy} title="Supprimer"
      style={{ width: 22, height: 22, borderRadius: 6, border: "none", background: "transparent", color: C.muted, cursor: "pointer", fontSize: 15, lineHeight: 1 }}>×</button>
  );
}

// Photo de profil ronde ; fallback initiales. Le head garde un anneau accent pour rester distinguable.
function Avatar({ C, src, name, isHead }) {
  const [err, setErr] = useState(false);
  const size = 30;
  const ring = isHead ? C.accent : C.borderStrong;
  const base = { width: size, height: size, borderRadius: "50%", flexShrink: 0, border: `1.5px solid ${ring}`, boxSizing: "border-box" };
  if (src && !err) {
    return <img src={src} alt={name} onError={() => setErr(true)} style={{ ...base, objectFit: "cover", background: C.surfaceAlt }} />;
  }
  const initials = (name || "?").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div style={{ ...base, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: isHead ? C.accentText : C.text2, background: C.surfaceAlt }}>{initials}</div>
  );
}

function SectionTitle({ C, children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>{children}</div>;
}
function Tag({ C, children, accent, title }) {
  return (
    <span title={title} style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 6, whiteSpace: "nowrap", color: accent ? C.accentText : C.text2, background: accent ? C.accentSoft : C.surfaceAlt, border: `1px solid ${C.border}` }}>{children}</span>
  );
}
function Frag({ children }) { return <>{children}</>; }
const mono = (C) => ({ fontVariantNumeric: "tabular-nums", color: C.text, fontSize: 12.5 });
