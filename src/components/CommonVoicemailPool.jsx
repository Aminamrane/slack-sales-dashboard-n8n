// src/components/CommonVoicemailPool.jsx
//
// « Barrage répondeur commun » — les DEUX pools du chantier réactivité :
//   · Pool RÉACTIVITÉ : leads chauds jamais appelés (SLA raté). Premier arrivé,
//     premier servi : « Je le prends » suffit, puis 3 jours pour poser un RDV.
//   · Pool TRAITEMENT : leads à J+3 sans RDV + ancien pool 2 mois. VERROUILLÉ :
//     récupérable uniquement en positionnant un R1 (le barrage anti « je prends
//     d'abord, j'appelle après »). Compteur d'appels PARTAGÉ + date du dernier
//     appel pour éviter le gérant harcelé.
// Auto-alimenté via GET /tracking/pools (les props legacy leads/claimingId/
// onClaim sont acceptées mais ignorées : TrackingSheet reste intact).

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import apiClient from "../services/apiClient";
import { leadAvatar } from "../utils/leadAvatar";

const ORIGIN_TONE = { bg: "rgba(100,116,139,0.12)", text: "#64748b" };

const fmtAge = (iso) => {
  if (!iso) return null;
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 60) return `il y a ${d} j`;
  return `il y a ${Math.floor(d / 30)} mois`;
};
// Valeurs slugifiées selon le canal (« 3_-_5 », « entre_100_000_€… ») -> lisible.
const clean = (v) => (v ? String(v).replace(/_/g, " ").replace(/\s+/g, " ").trim() : null);
const fmtDate = (v) => { const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : null; };
// Créneaux RDV en 24h, bornés aux heures d'appel (9h-19h, heure de Paris) :
// évite le sélecteur natif AM/PM localisé et interdit un RDV hors ouverture.
const RDV_SLOTS = (() => {
  const a = [];
  for (let h = 9; h <= 19; h++) {
    a.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 19) a.push(`${String(h).padStart(2, "0")}:30`);
  }
  return a;
})();

// ── Coordonnées « à copier » ────────────────────────────────────────────────
// Le téléphone et l'email sont les deux infos qu'un sales attrape pour agir :
// on les sort du texte gris qualifiant pour en faire des puces cliquables, avec
// une icône qui dit « copie-moi ». Aucune logique métier ici — copie presse-
// papier + flash « Copié », c'est le même geste que la tracking sheet.
const IC_PHONE = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);
const IC_MAIL = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" />
  </svg>
);
const IC_COPY = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const IC_CHECK = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

function CopyChip({ kind, value, C, darkMode }) {
  const [copied, setCopied] = useState(false);
  const [hover, setHover] = useState(false);
  if (!value) return null;
  const isPhone = kind === "phone";
  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  const accent = "#0891b2"; // teal (cohérent avec « Prendre avec un RDV »)
  const bg = copied
    ? (darkMode ? "rgba(62,125,90,0.20)" : "#e7f5ee")
    : hover ? (darkMode ? "rgba(8,145,178,0.16)" : "#e6f6fa")
            : (darkMode ? "rgba(255,255,255,0.05)" : "#f4f6f9");
  const border = copied ? "#3e7d5a" : hover ? accent : (darkMode ? "rgba(255,255,255,0.10)" : "#e2e6ee");
  return (
    <button
      onClick={copy}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={copied ? "Copié" : `Copier ${isPhone ? "le numéro" : "l'email"}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: isPhone ? "4px 9px" : "4px 9px",
        borderRadius: 8, border: `1px solid ${border}`, background: bg,
        cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s, border-color 0.15s",
        maxWidth: isPhone ? 160 : 190,
      }}
    >
      <span style={{ display: "flex", color: copied ? "#3e7d5a" : accent, flexShrink: 0 }}>
        {isPhone ? IC_PHONE : IC_MAIL}
      </span>
      <span style={{
        fontSize: isPhone ? 12.5 : 12, fontWeight: isPhone ? 700 : 600,
        color: copied ? "#3e7d5a" : C.text, whiteSpace: "nowrap",
        overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums",
      }}>
        {copied ? "Copié" : value}
      </span>
      <span style={{ display: "flex", color: copied ? "#3e7d5a" : (hover ? accent : C.muted), flexShrink: 0 }}>
        {copied ? IC_CHECK : IC_COPY}
      </span>
    </button>
  );
}

// Rangée de coordonnées cliquables, posée sous le nom. S'adapte aux proportions
// existantes (wrap), ne déforme rien autour.
function ContactRow({ lead, C, darkMode }) {
  if (!lead.phone && !lead.email) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 8, paddingLeft: 18 }}>
      <CopyChip kind="phone" value={lead.phone} C={C} darkMode={darkMode} />
      <CopyChip kind="email" value={lead.email} C={C} darkMode={darkMode} />
    </div>
  );
}

// ── Chip « secteur » pastel ──────────────────────────────────────────────────
// Une teinte douce par origine, déterministe (même origine => même couleur).
// PALETTE PLACEHOLDER : à remplacer par les couleurs du dev (un seul endroit).
const TAG_PALETTES = [
  { bg: "#f2ecfd", dbg: "rgba(124,77,214,0.20)", fg: "#7c4dd6" },
  { bg: "#e9f0fe", dbg: "rgba(59,111,212,0.20)", fg: "#3b6fd4" },
  { bg: "#e3f5f2", dbg: "rgba(44,156,143,0.20)", fg: "#2c9c8f" },
  { bg: "#fdf2e2", dbg: "rgba(191,122,30,0.20)", fg: "#bf7a1e" },
  { bg: "#fdeaf2", dbg: "rgba(219,39,119,0.20)", fg: "#db2777" },
  { bg: "#eaf6e9", dbg: "rgba(47,122,83,0.20)", fg: "#2f7a53" },
  { bg: "#eef1f5", dbg: "rgba(105,117,136,0.20)", fg: "#697588" },
];
function tagPalette(s) {
  let h = 0; const str = String(s || "");
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return TAG_PALETTES[h % TAG_PALETTES.length];
}
function OriginTag({ origin, darkMode }) {
  if (!origin) return null;
  const p = tagPalette(origin);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", background: darkMode ? p.dbg : p.bg, color: p.fg }}>
      {origin}
    </span>
  );
}

// Avatar du lead : visage dessiné selon le genre déduit du prénom, stable par
// lead. Décoratif — ne porte aucune logique.
function LeadFace({ lead }) {
  return (
    <img src={leadAvatar(lead.full_name, lead.id, lead.origin, lead.campaign_name)} alt="" width={44} height={44}
      loading="lazy"
      style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, display: "block", objectFit: "cover" }} />
  );
}

// Barre de pages : « Précédent · page X / Y · Suivant ». Masquée s'il n'y a
// qu'une page. Changer de page remonte en haut de la liste.
function Pager({ page, pages, total, onPage, C, darkMode }) {
  if (pages <= 1) return null;
  const chev = (d) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {d === "l" ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
    </svg>
  );
  const btn = (dis) => ({
    display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px",
    borderRadius: 9, border: `1px solid ${C.border}`,
    background: darkMode ? "rgba(255,255,255,0.04)" : "#fff",
    color: dis ? C.muted : C.text, fontSize: 12.5, fontWeight: 650,
    cursor: dis ? "default" : "pointer", fontFamily: "inherit", opacity: dis ? 0.5 : 1,
    transition: "background 0.15s",
  });
  const go = (n) => { onPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 14 }}>
      <button disabled={page <= 1} onClick={() => go(page - 1)} style={btn(page <= 1)}>{chev("l")} Précédent</button>
      <span style={{ fontSize: 12.5, color: C.muted, whiteSpace: "nowrap" }}>
        page <b style={{ color: C.text }}>{page}</b> / {pages} · {total} leads
      </span>
      <button disabled={page >= pages} onClick={() => go(page + 1)} style={btn(page >= pages)}>Suivant {chev("r")}</button>
    </div>
  );
}

// Cellule « taille » : la tranche d'effectif seule (décision dev : pas de CA).
function SizeCell({ lead, C }) {
  const head = clean(lead.headcount || lead.employee_range);
  if (!head) return <span style={{ color: C.muted }}>—</span>;
  return <b style={{ fontSize: 12, color: C.text, fontWeight: 600, whiteSpace: "nowrap" }}>{head}</b>;
}

// Bouton « ne souhaite pas être rappelé » — corbeille discrète, rouge au survol.
function OptOutX({ lead, C, busy, onOptOut }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={() => onOptOut(lead.id, lead.full_name)} disabled={busy}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      title="Ne souhaite pas être rappelé : mettre ce lead à la corbeille (archivé, plus jamais rappelé)"
      style={{ width: 28, height: 28, borderRadius: 7, border: "none",
        background: h ? (C.muted && C.text ? "rgba(180,35,24,0.10)" : "transparent") : "transparent",
        color: h ? "#b42318" : C.muted, cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        transition: "background 0.15s, color 0.15s" }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    </button>
  );
}

// Ligne d'infos qualifiantes (mêmes données que le lead détail).
function InfoLine({ lead, C }) {
  const bits = [
    clean(lead.headcount || lead.employee_range) ? `${clean(lead.headcount || lead.employee_range)} salariés` : null,
    clean(lead.revenue) ? `CA ${clean(lead.revenue)}` : null,
    clean(lead.sector) || null,
    lead.siren ? `SIREN ${lead.siren}` : null,
    fmtDate(lead.created_at) ? `entré le ${fmtDate(lead.created_at)}` : null,
  ].filter(Boolean);
  if (!bits.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", marginTop: 6, paddingLeft: 18, fontSize: 11.5, color: C.muted }}>
      {bits.map((b, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          {i > 0 && <span style={{ opacity: 0.4 }}>·</span>}{b}
        </span>
      ))}
    </div>
  );
}

// Compteur d'appels PARTAGÉ du pool (« appelé 5 fois, la dernière il y a 2 h »).
function PoolCallsBadge({ lead, C, darkMode }) {
  const n = lead.pool_calls || 0;
  if (!n) return <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>jamais appelé depuis le pool</span>;
  const hot = n >= 6;
  return (
    <span title="Appels passés par l'équipe depuis le pool" style={{
      fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", padding: "2px 9px", borderRadius: 20,
      color: hot ? "#b42318" : "#b45309",
      background: hot ? (darkMode ? "rgba(180,35,24,0.16)" : "#fdecea") : (darkMode ? "rgba(180,83,9,0.16)" : "#fff3e3"),
    }}>
      {n} appel{n > 1 ? "s" : ""} pool{lead.pool_last_call_at ? ` · ${fmtAge(lead.pool_last_call_at)}` : ""}
    </span>
  );
}

// Mes propres appels sur ce lead : le compteur d'équipe ne dit pas si MOI je
// l'ai déjà eu au téléphone, ni quand. C'est ce qui manquait pour ne pas
// rappeler deux fois le même la même semaine.
function MyCallsBadge({ lead, C, darkMode }) {
  const n = lead.my_calls || 0;
  if (!n) return null;
  return (
    <span title="Vos appels à vous sur ce lead" style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", padding: "2px 9px", borderRadius: 20,
      color: "#1d4ed8",
      background: darkMode ? "rgba(29,78,216,0.18)" : "#e8effd",
    }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      vous : {n} appel{n > 1 ? "s" : ""}{lead.my_last_call_at ? ` · ${fmtAge(lead.my_last_call_at)}` : ""}
    </span>
  );
}

// ── Fil de messages PARTAGÉ par lead ────────────────────────────────────────
// Enveloppe sur chaque carte : clic -> popup avec les messages laissés par les
// autres sales (promesse de RDV impossible à placer, « ne pas rappeler avant
// telle date »…) + zone d'ajout. Append-only : l'auteur vient du JWT côté
// backend, le contexte se transmet d'un sales à l'autre sans s'écraser.

function initialsOf(name) {
  return String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

function EnvelopeButton({ lead, C, darkMode, onOpen }) {
  const [h, setH] = useState(false);
  const n = lead.pool_comments || 0;
  const accent = "#0891b2";
  return (
    <button onClick={() => onOpen(lead)}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      title={n ? `${n} message${n > 1 ? "s" : ""} laissé${n > 1 ? "s" : ""} sur ce lead — cliquer pour lire ou répondre` : "Laisser un message sur ce lead pour les autres sales"}
      style={{ position: "relative", width: 30, height: 28, borderRadius: 7, border: "none",
        background: h ? (darkMode ? "rgba(8,145,178,0.16)" : "#e6f6fa") : "transparent",
        color: n ? accent : (h ? accent : C.muted), cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        transition: "background 0.15s, color 0.15s" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" />
      </svg>
      {n > 0 && (
        <span style={{ position: "absolute", top: -4, right: -4, minWidth: 15, height: 15, padding: "0 4px",
          borderRadius: 8, background: accent, color: "#fff", fontSize: 9.5, fontWeight: 800,
          display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
          {n > 99 ? "99+" : n}
        </span>
      )}
    </button>
  );
}

// Popup du fil : messages du plus ancien au plus récent (lecture naturelle),
// saisie en bas, Cmd/Ctrl+Entrée pour publier, Échap ou clic dehors pour fermer.
function PoolCommentsModal({ lead, C, darkMode, onClose, onPosted }) {
  const [comments, setComments] = useState(null);   // null = chargement
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [loadErr, setLoadErr] = useState(false);
  const listRef = useRef(null);
  const accent = "#0891b2";

  useEffect(() => {
    let alive = true;
    apiClient.get(`/api/v1/tracking/pools/${lead.id}/comments`)
      .then((r) => { if (alive) setComments(r.comments || []); })
      .catch(() => { if (alive) { setComments([]); setLoadErr(true); } });
    return () => { alive = false; };
  }, [lead.id]);

  // Toujours montrer le dernier message : au chargement et après chaque ajout.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const created = await apiClient.post(`/api/v1/tracking/pools/${lead.id}/comments`, { body });
      setComments((prev) => [...(prev || []), created]);
      setDraft("");
      onPosted(lead.id, created.pool_comments);
    } catch {
      setLoadErr(true);
    } finally { setPosting(false); }
  };

  return createPortal(
    <>
      <style>{`@keyframes cvpModalIn{from{opacity:0;transform:translateY(10px) scale(0.97)}to{opacity:1;transform:none}}
        @keyframes cvpFadeIn{from{opacity:0}to{opacity:1}}
        @keyframes cvpMsgIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
        @keyframes cvpSpin{to{transform:rotate(360deg)}}`}</style>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 10070, background: "rgba(15,20,30,0.45)", backdropFilter: "blur(2px)", animation: "cvpFadeIn 0.16s ease both" }} />
      <div role="dialog" aria-modal="true" style={{ position: "fixed", zIndex: 10071, top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(480px, calc(100vw - 32px))", maxHeight: "min(600px, calc(100vh - 48px))", display: "flex", flexDirection: "column",
        background: darkMode ? "#1c1f26" : "#fff", border: `1px solid ${C.border}`, borderRadius: 16,
        boxShadow: "0 24px 64px rgba(10,14,22,0.35)", animation: "cvpModalIn 0.2s cubic-bezier(0.16,1,0.3,1) both", overflow: "hidden" }}>

        {/* En-tête : qui est ce lead */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
          <LeadFace lead={lead} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {lead.full_name || lead.company_name || "Sans nom"}
            </div>
            <div style={{ fontSize: 11.5, color: C.muted }}>Messages de l'équipe sur ce lead</div>
          </div>
          <button onClick={onClose} title="Fermer (Échap)"
            style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: C.muted, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.06)" : "#f1f3f7"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Fil */}
        <div ref={listRef} style={{ flex: 1, minHeight: 120, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {comments === null ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "28px 0" }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", border: `2.5px solid ${C.border}`, borderTopColor: accent, animation: "cvpSpin 0.7s linear infinite" }} />
            </div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: "center", color: C.muted, fontSize: 12.5, padding: "24px 12px", lineHeight: 1.5 }}>
              Aucun message pour l'instant.<br />
              Promesse de RDV, « ne veut pas être rappelé avant… » : laissez le contexte aux autres sales.
            </div>
          ) : comments.map((c, i) => (
            <div key={c.id} style={{ display: "flex", gap: 9, animation: `cvpMsgIn 0.22s ease ${Math.min(i * 0.03, 0.3)}s both` }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: darkMode ? "rgba(8,145,178,0.22)" : "#e6f6fa", color: accent, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 800 }}>
                {initialsOf(c.author_name || c.author_email)}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{c.author_name || c.author_email || "—"}</span>
                  <span style={{ fontSize: 10.5, color: C.muted }}>{fmtAge(c.created_at)}</span>
                </div>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.45, marginTop: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{c.body}</div>
              </div>
            </div>
          ))}
          {loadErr && (
            <div style={{ fontSize: 11.5, color: "#b42318", textAlign: "center" }}>
              Un envoi ou un chargement a échoué. Vérifiez votre connexion et réessayez.
            </div>
          )}
        </div>

        {/* Saisie */}
        <div style={{ padding: "12px 16px 14px", borderTop: `1px solid ${C.border}`, background: darkMode ? "rgba(255,255,255,0.02)" : "#fafbfc" }}>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} autoFocus
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
            placeholder="Votre message pour les autres sales…"
            style={{ width: "100%", resize: "vertical", padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.border}`,
              background: darkMode ? "rgba(255,255,255,0.04)" : "#fff", color: C.text, fontSize: 13, fontFamily: "inherit",
              lineHeight: 1.45, outline: "none", boxSizing: "border-box" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 10.5, color: C.muted }}>Cmd/Ctrl + Entrée pour publier</span>
            <button onClick={submit} disabled={!draft.trim() || posting}
              style={{ padding: "7px 16px", borderRadius: 8, border: "none", fontSize: 12.5, fontWeight: 700, fontFamily: "inherit",
                cursor: draft.trim() && !posting ? "pointer" : "default",
                background: draft.trim() ? accent : (darkMode ? "rgba(255,255,255,0.08)" : "#e5e7eb"),
                color: draft.trim() ? "#fff" : C.muted, transition: "background 0.2s" }}>
              {posting ? "…" : "Publier"}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

const MINE_FILTERS = [
  {
    key: "all", label: "Tous",
    icon: <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>,
  },
  {
    key: "mine", label: "Appelés par moi",
    icon: <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.4 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z" /><path d="M17 3.5l1.6 1.6L22 1.8" /></>,
  },
  {
    key: "not_mine", label: "Jamais appelés par moi",
    icon: <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.4 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z" /><path d="M2 2l20 20" /></>,
  },
];

// `salesOptions` : liste [{email, name}] des commerciaux auxquels confier le
// lead. Fournie pour un setter, qui ne garde pas de leads mais pose un RDV POUR
// quelqu'un ; absente pour un sales, qui récupère le lead pour lui-même.
export default function CommonVoicemailPool({ leads = [], loading = false, claimingId = null, onClaim, canClaim = true, salesOptions = null, C, darkMode }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);      // claim en cours
  const [calledFlash, setCalledFlash] = useState({}); // feedback bouton « j'ai appelé »
  const [rdvFor, setRdvFor] = useState(null);      // lead_id du mini-formulaire RDV ouvert
  const [rdvDate, setRdvDate] = useState("");
  const [rdvKind, setRdvKind] = useState("r1"); // le sales choisit R1 ou R2 au claim
  const [rdvSales, setRdvSales] = useState("");   // setter : commercial destinataire
  const [claimedMsg, setClaimedMsg] = useState(null);
  const [commentsFor, setCommentsFor] = useState(null); // lead dont le fil de messages est ouvert
  const [q, setQ] = useState("");
  // Un seul pool affiché à la fois : le sales choisit son mode de travail.
  const [pool, setPool] = useState("traitement");
  // Filtre « mes appels » : appliqué à l'affichage, le tri global (dernier
  // appel de l'équipe, du plus récent) reste celui du serveur.
  const [mine, setMine] = useState("all");
  // Pagination : 100 leads par page, les plus récents d'abord (ordre serveur).
  // Toutes les pages découpent le MÊME instantané chargé en une fois : l'ordre
  // est figé pendant la navigation, un lead ne change pas de page en cours de
  // route. Changer de pool, de filtre ou de recherche ramène à la page 1.
  const PAGE_SIZE = 100;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [pool, q, mine]);
  useEffect(() => { if (pool !== "traitement") setMine("all"); }, [pool]);

  const fetchPools = async (search) => {
    try {
      const term = (search !== undefined ? search : q).trim();
      const d = await apiClient.get(`/api/v1/tracking/pools${term ? `?q=${encodeURIComponent(term)}` : ""}`);
      if (d && d.reactivite) { setData(d); setErr(null); }
    } catch (e) { setErr("Impossible de charger les pools."); }
  };
  useEffect(() => {
    fetchPools("");
    const t = setInterval(() => fetchPools(), 60000);
    return () => clearInterval(t);
  }, []);
  // La recherche interroge la base (un lead hors des premiers chargés doit
  // rester trouvable), avec un délai pour ne pas requêter à chaque frappe.
  useEffect(() => {
    const t = setTimeout(() => fetchPools(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const keepMine = (l) => mine === "all" ? true
    : mine === "mine" ? (l.my_calls || 0) > 0
    : (l.my_calls || 0) === 0;
  const reaAll = (data?.reactivite || []).filter(keepMine);
  const trtAll = (data?.traitement || []).filter(keepMine);
  const activeAll = pool === "reactivite" ? reaAll : trtAll;
  const pages = Math.max(1, Math.ceil(activeAll.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const pageSlice = (arr, isActive) =>
    isActive ? arr.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE) : arr.slice(0, PAGE_SIZE);
  const rea = pageSlice(reaAll, pool === "reactivite");
  const trt = pageSlice(trtAll, pool === "traitement");
  // Compteurs = totaux RÉELS du pool, pas le nombre de leads chargés.
  const totRea = data?.totals?.reactivite ?? reaAll.length;
  const totTrt = data?.totals?.traitement ?? trtAll.length;

  const claimRea = async (id) => {
    setBusyId(id);
    try {
      await apiClient.post(`/api/v1/tracking/pools/reactivite/${id}/claim`);
      setClaimedMsg("Lead récupéré — appelez-le maintenant, il est dans vos leads (3 jours pour poser un RDV).");
      fetchPools();
    } catch (e) {
      setClaimedMsg(e?.message?.includes("409") || e?.status === 409 ? "Trop tard — quelqu'un vient de le prendre." : "Récupération impossible.");
      fetchPools();
    } finally { setBusyId(null); setTimeout(() => setClaimedMsg(null), 5000); }
  };

  const claimTrt = async (id) => {
    if (!rdvDate) return;
    setBusyId(id);
    try {
      await apiClient.post(`/api/v1/tracking/pools/traitement/${id}/claim`,
        salesOptions ? { r1_date: rdvDate, rdv_kind: rdvKind, sales_email: rdvSales }
                     : { r1_date: rdvDate, rdv_kind: rdvKind });
      setClaimedMsg(`Lead récupéré avec son RDV, il est dans vos ${rdvKind === "r2" ? "R2" : "R1"} placés.`);
      setRdvFor(null); setRdvDate("");
      fetchPools();
    } catch (e) {
      const detail = e?.detail || e?.message || "";
      setClaimedMsg(String(detail).includes("futur") ? "Le RDV doit être dans le futur." : "Trop tard — quelqu'un vient de le prendre.");
      fetchPools();
    } finally { setBusyId(null); setTimeout(() => setClaimedMsg(null), 5000); }
  };

  // Le prospect a demandé à ne plus être contacté : on le sort du pool et on
  // l'archive, pour qu'aucun autre sales ne le rappelle après son refus.
  const optOut = async (id, name) => {
    if (!window.confirm(`Retirer ${name || "ce lead"} du pool commun ?\n\nÀ utiliser quand la personne a dit qu'elle ne souhaite pas être rappelée : le lead est archivé et personne ne le rappellera.`)) return;
    setBusyId(id);
    try {
      await apiClient.post(`/api/v1/tracking/pools/${id}/opt-out`);
      setClaimedMsg("Lead retiré du pool et archivé — il ne sera plus rappelé.");
      fetchPools();
    } catch {
      setClaimedMsg("Retrait impossible — le lead n'est peut-être plus dans le pool.");
      fetchPools();
    } finally { setBusyId(null); setTimeout(() => setClaimedMsg(null), 5000); }
  };

  const markCalled = async (id) => {
    try {
      const r = await apiClient.post(`/api/v1/tracking/pools/${id}/called`);
      setCalledFlash((p) => ({ ...p, [id]: true }));
      setTimeout(() => setCalledFlash((p) => ({ ...p, [id]: false })), 1800);
      setData((d) => !d ? d : {
        ...d,
        traitement: d.traitement.map((l) => l.id === id ? { ...l, pool_calls: r.pool_calls, pool_last_call_at: r.pool_last_call_at, my_calls: r.my_calls, my_last_call_at: r.my_last_call_at } : l),
        reactivite: d.reactivite.map((l) => l.id === id ? { ...l, pool_calls: r.pool_calls, pool_last_call_at: r.pool_last_call_at, my_calls: r.my_calls, my_last_call_at: r.my_last_call_at } : l),
      });
    } catch {}
  };

  // Un message vient d'être publié : le badge de l'enveloppe suit sans refetch.
  const onCommentPosted = (leadId, newCount) => {
    setData((d) => !d ? d : {
      ...d,
      traitement: d.traitement.map((l) => l.id === leadId ? { ...l, pool_comments: newCount } : l),
      reactivite: d.reactivite.map((l) => l.id === leadId ? { ...l, pool_comments: newCount } : l),
    });
    setCommentsFor((c) => (c && c.id === leadId ? { ...c, pool_comments: newCount } : c));
  };

  const card = (extra = {}) => ({
    borderRadius: 14, border: `1px solid ${C.border}`,
    background: darkMode ? "rgba(255,255,255,0.03)" : "#fff", ...extra,
  });
  // Styles de tableau (partagés par les deux pools).
  const thS = { fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: C.muted, textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", background: darkMode ? "rgba(255,255,255,0.02)" : "#fcfcfd" };
  const tdS = { padding: "7px 10px", borderBottom: `1px solid ${darkMode ? "rgba(255,255,255,0.06)" : "#f2f4f7"}`, verticalAlign: "middle", fontSize: 12.5, color: C.text };
  // Variante « serrée » : la colonne se réduit à son contenu, tout se rapproche
  // du bord gauche, l'espace libre s'accumule en fin de ligne (demande dev).
  const thT = { ...thS };
  const tdT = { ...tdS, whiteSpace: "nowrap" };

  if (!data && !err) {
    return <div style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>Chargement des pools…</div>;
  }
  if (err) {
    return <div style={{ padding: 32, textAlign: "center", color: "#b42318", fontSize: 13 }}>{err}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {claimedMsg && (
        <div style={{ padding: "10px 16px", borderRadius: 10, background: darkMode ? "rgba(62,125,90,0.18)" : "#e7f0eb", color: "#3e7d5a", fontSize: 12.5, fontWeight: 650 }}>
          {claimedMsg}
        </div>
      )}
      {/* Switch entre les deux pools */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 12, background: darkMode ? "rgba(255,255,255,0.05)" : "#f1f3f7" }}>
          {[
            { key: "reactivite", label: "Réactivité", n: totRea, color: "#ef4444" },
            { key: "traitement", label: "Traitement", n: totTrt, color: "#0891b2" },
          ].map((p) => {
            const on = pool === p.key;
            return (
              <button key={p.key} type="button" onClick={() => setPool(p.key)}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit",
                  fontSize: 13, fontWeight: 700, transition: "background 0.15s, color 0.15s",
                  background: on ? (darkMode ? "rgba(255,255,255,0.10)" : "#fff") : "transparent",
                  color: on ? C.text : C.muted,
                  boxShadow: on ? "0 1px 3px rgba(17,24,39,0.10)" : "none" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: on ? p.color : C.muted, opacity: on ? 1 : 0.5 }} />
                {p.label}
                <span style={{ fontSize: 11.5, fontWeight: 700, color: on ? p.color : C.muted }}>{p.n}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: pool === "traitement" ? "inline-flex" : "none", gap: 4, padding: 4, borderRadius: 12, background: darkMode ? "rgba(255,255,255,0.05)" : "#f1f3f7" }}>
          {MINE_FILTERS.map((f) => {
            const on = mine === f.key;
            return (
              <button key={f.key} type="button" onClick={() => setMine(f.key)} title={f.label}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit",
                  fontSize: 12.5, fontWeight: 650, transition: "background 0.15s, color 0.15s",
                  background: on ? (darkMode ? "rgba(255,255,255,0.10)" : "#fff") : "transparent",
                  color: on ? C.text : C.muted,
                  boxShadow: on ? "0 1px 3px rgba(17,24,39,0.10)" : "none" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {f.icon}
                </svg>
                {f.label}
              </button>
            );
          })}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (nom, société, téléphone)…"
          style={{ flex: 1, minWidth: 240, maxWidth: 420, padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: darkMode ? "rgba(255,255,255,0.04)" : "#fff", color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
      </div>

      {/* ── POOL RÉACTIVITÉ ── */}
      <div style={{ display: pool === "reactivite" ? "block" : "none" }}>
        {rea.length === 0 ? (
          <div style={{ ...card({ padding: "14px 16px" }), color: C.muted, fontSize: 12.5 }}>
            Aucun lead en attente de premier appel — c'est bon signe.
          </div>
        ) : (
          <div style={{ ...card(), overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead><tr>
                  <th style={thS}>Lead</th>
                  <th style={thT}>Secteur</th>
                  <th style={thT}>Téléphone</th>
                  <th style={thT}>Email</th>
                  <th style={thT}>Taille</th>
                  {canClaim && <th style={{ ...thS, textAlign: "right" }} aria-label="Actions" />}
                </tr></thead>
                <tbody>
                  {rea.map((lead) => (
                    <tr key={lead.id} style={{ transition: "background 0.12s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.03)" : "#f8fafc"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                      <td style={tdS}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <LeadFace lead={lead} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 650, color: C.text, whiteSpace: "nowrap" }}>{lead.full_name || lead.company_name || "Sans nom"}</div>
                            {lead.pool_entered_at && <div style={{ fontSize: 10.5, color: "#ef4444", fontWeight: 600 }}>arrivé {fmtAge(lead.pool_entered_at)}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={tdT}><OriginTag origin={lead.origin} darkMode={darkMode} /></td>
                      <td style={tdT}><CopyChip kind="phone" value={lead.phone} C={C} darkMode={darkMode} /></td>
                      <td style={tdT}><CopyChip kind="email" value={lead.email} C={C} darkMode={darkMode} /></td>
                      <td style={tdT}><SizeCell lead={lead} C={C} /></td>
                      {canClaim && (
                        <td style={{ ...tdS, whiteSpace: "nowrap", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                            <button onClick={() => claimRea(lead.id)} disabled={busyId === lead.id}
                              style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: busyId === lead.id ? C.muted : "#3e7d5a", color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: busyId === lead.id ? "wait" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                              {busyId === lead.id ? "…" : "Je le prends"}
                            </button>
                            <EnvelopeButton lead={lead} C={C} darkMode={darkMode} onOpen={setCommentsFor} />
                            <OptOutX lead={lead} C={C} busy={busyId === lead.id} onOptOut={optOut} />
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {pool === "reactivite" && (
          <Pager page={cur} pages={pages} total={activeAll.length} onPage={setPage} C={C} darkMode={darkMode} />
        )}
      </div>

      {/* ── POOL TRAITEMENT ── */}
      <div style={{ display: pool === "traitement" ? "block" : "none" }}>
        {trt.length === 0 ? (
          <div style={{ ...card({ padding: "14px 16px" }), color: C.muted, fontSize: 12.5 }}>Pool vide.</div>
        ) : (
          <div style={{ ...card(), overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
                <thead><tr>
                  <th style={thS}>Lead</th>
                  <th style={thT}>Secteur</th>
                  <th style={thT}>Téléphone</th>
                  <th style={thT}>Email</th>
                  <th style={thT}>Taille</th>
                  {canClaim && <th style={{ ...thS, textAlign: "right" }} aria-label="Actions" />}
                </tr></thead>
                <tbody>
                  {trt.map((lead) => (
                    <Fragment key={lead.id}>
                      <tr style={{ transition: "background 0.12s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.03)" : "#f8fafc"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                        <td style={tdS}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <LeadFace lead={lead} />
                          <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>{lead.full_name || lead.company_name || "Sans nom"}</span>
                            <span title="Appels passés par l'équipe depuis le pool"
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, whiteSpace: "nowrap", flexShrink: 0,
                                color: (lead.pool_calls || 0) >= 6 ? "#b42318" : (lead.pool_calls || 0) > 0 ? "#b45309" : C.muted }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                              <b style={{ fontWeight: 700 }}>{lead.pool_calls || 0}</b>
                              {lead.pool_last_call_at && <span style={{ color: C.muted, fontWeight: 400 }}>· {fmtAge(lead.pool_last_call_at)}</span>}
                            </span>
                          </div>
                          <div style={{ fontSize: 10.5, color: C.muted }}>
                            {lead.company_name && lead.full_name ? lead.company_name : (fmtDate(lead.created_at) ? `entré le ${fmtDate(lead.created_at)}` : "")}
                          </div>
                          </div>
                          </div>
                        </td>
                        <td style={tdT}><OriginTag origin={lead.origin} darkMode={darkMode} /></td>
                        <td style={tdT}><CopyChip kind="phone" value={lead.phone} C={C} darkMode={darkMode} /></td>
                        <td style={tdT}><CopyChip kind="email" value={lead.email} C={C} darkMode={darkMode} /></td>
                        <td style={tdT}><SizeCell lead={lead} C={C} /></td>
                        {canClaim && (
                          <td style={{ ...tdS, whiteSpace: "nowrap", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                              <button onClick={() => markCalled(lead.id)}
                                style={{ padding: "5px 9px", borderRadius: 7, border: `1px solid ${C.border}`, background: calledFlash[lead.id] ? "#3e7d5a" : "transparent", color: calledFlash[lead.id] ? "#fff" : C.text, fontSize: 11, fontWeight: 650, cursor: "pointer", fontFamily: "inherit", transition: "background 0.2s, color 0.2s", whiteSpace: "nowrap" }}>
                                {calledFlash[lead.id] ? "Noté ✓" : "J'ai appelé"}
                              </button>
                              <button onClick={() => { setRdvFor(rdvFor === lead.id ? null : lead.id); setRdvDate(""); setRdvSales(""); setRdvKind("r1"); }}
                                style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${rdvFor === lead.id ? "#3e7d5a" : "#cfe8d9"}`, background: rdvFor === lead.id ? "#3e7d5a" : "#e9f5ee", color: rdvFor === lead.id ? "#fff" : "#2f7a53", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                                Prendre avec un RDV
                              </button>
                              <EnvelopeButton lead={lead} C={C} darkMode={darkMode} onOpen={setCommentsFor} />
                              <OptOutX lead={lead} C={C} busy={busyId === lead.id} onOptOut={optOut} />
                            </div>
                          </td>
                        )}
                      </tr>
                      {rdvFor === lead.id && (
                        <tr>
                          <td colSpan={canClaim ? 6 : 5} style={{ padding: "0 14px 12px", borderBottom: `1px solid ${darkMode ? "rgba(255,255,255,0.06)" : "#f2f4f7"}`, background: darkMode ? "rgba(255,255,255,0.02)" : "#fafbfc" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 10 }}>
                              <div style={{ display: "inline-flex", gap: 3, padding: 3, borderRadius: 8, background: darkMode ? "rgba(255,255,255,0.05)" : "#eef1f5" }}>
                                {["r1", "r2"].map((k) => (
                                  <button key={k} type="button" onClick={() => setRdvKind(k)}
                                    style={{ padding: "4px 11px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit",
                                      fontSize: 11.5, fontWeight: 700, transition: "background 0.15s, color 0.15s",
                                      background: rdvKind === k ? (darkMode ? "rgba(255,255,255,0.12)" : "#fff") : "transparent",
                                      color: rdvKind === k ? C.text : C.muted,
                                      boxShadow: rdvKind === k ? "0 1px 2px rgba(17,24,39,0.10)" : "none" }}>
                                    {k.toUpperCase()}
                                  </button>
                                ))}
                              </div>
                              <span style={{ fontSize: 12, color: C.muted }}>le</span>
                              {salesOptions && (
                                <select value={rdvSales} onChange={(e) => setRdvSales(e.target.value)}
                                  style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: darkMode ? "rgba(255,255,255,0.04)" : "#fff", color: C.text, fontSize: 12.5, fontFamily: "inherit", outline: "none" }}>
                                  <option value="">Pour quel commercial ?</option>
                                  {salesOptions.map((s) => (
                                    <option key={s.email} value={s.email}>{s.name || s.email}</option>
                                  ))}
                                </select>
                              )}
                              {(() => {
                                const rdvDay = (rdvDate || "").slice(0, 10);
                                const rdvTime = (rdvDate || "").length >= 16 ? rdvDate.slice(11, 16) : "";
                                const inp = { padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: darkMode ? "rgba(255,255,255,0.04)" : "#fff", color: C.text, fontSize: 12.5, fontFamily: "inherit", outline: "none" };
                                return (
                                  <>
                                    <input type="date" value={rdvDay}
                                      onChange={(e) => setRdvDate(e.target.value ? `${e.target.value}T${rdvTime || "09:00"}` : "")}
                                      style={inp} />
                                    <select value={rdvTime} disabled={!rdvDay}
                                      onChange={(e) => rdvDay && setRdvDate(`${rdvDay}T${e.target.value}`)}
                                      style={{ ...inp, cursor: rdvDay ? "pointer" : "not-allowed" }}>
                                      <option value="">Heure…</option>
                                      {RDV_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>heure de Paris</span>
                                  </>
                                );
                              })()}
                              <button onClick={() => claimTrt(lead.id)} disabled={!rdvDate || rdvDate.length < 16 || (salesOptions && !rdvSales) || busyId === lead.id}
                                style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: (!rdvDate || (salesOptions && !rdvSales)) ? C.muted : "#3e7d5a", color: "#fff", fontSize: 12, fontWeight: 700, cursor: (!rdvDate || (salesOptions && !rdvSales)) ? "default" : "pointer", fontFamily: "inherit" }}>
                                {busyId === lead.id ? "…" : "Confirmer le RDV et récupérer"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {pool === "traitement" && (
          <Pager page={cur} pages={pages} total={activeAll.length} onPage={setPage} C={C} darkMode={darkMode} />
        )}
      </div>

      {/* Popup du fil de messages du lead sélectionné */}
      {commentsFor && (
        <PoolCommentsModal lead={commentsFor} C={C} darkMode={darkMode}
          onClose={() => setCommentsFor(null)} onPosted={onCommentPosted} />
      )}
    </div>
  );
}
