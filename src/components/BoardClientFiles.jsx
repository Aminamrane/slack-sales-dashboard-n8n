// Documents et appels du client dans la fiche du board (dev 29/10/2026 : réf. de fiche de tâche, pièces jointes
// en cartes, joindre un e-mail, onglet « Appels » avec toutes les communications). La fiche client de la page
// Finance montre les mêmes blocs (onglets Documents et Contrats), pour que le dossier soit le même des deux côtés :
//   /client-history     pièces jointes et appels partagés au dossier (CSM, finance, direction) ;
//   /finance-calls      lire n'importe quel appel Allo du client (liste nominative des personnes autorisées) ;
//   /contracts/{id}/download/{owner|optilex}   PDF des conventions, montrées en dossiers (ContractFolders, onglet Intégration).
//                       La page Finance donne sa propre route de lecture (option `source`) et n'appelle jamais celle-ci.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
// eslint-disable-next-line no-unused-vars -- motion utilisé via JSX (faux positif)
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import apiClient from "../services/apiClient.js";
import { isReadOnlyViewer, READ_ONLY_PROPS } from "../utils/readOnlyRoles.js";
import "./BoardClientFiles.css";

const HISTORY_ROLES = ["admin", "ceo", "finance_director", "finance_team", "customer_success_manager"];
const MAX_BYTES = 20 * 1024 * 1024;
const DOC_ACCEPT = ".pdf,.png,.jpg,.jpeg,.mp3,.wav,.m4a";
const EMAIL_ACCEPT = ".eml,.html,.htm";

const TZ = { timeZone: "Europe/Paris" };
const fmtDay = (v) => (v ? new Date(v).toLocaleDateString("fr-FR", { ...TZ, day: "2-digit", month: "2-digit", year: "numeric" }) : "");
const fmtWhen = (v) => {
  if (!v) return "";
  const time = new Date(v).toLocaleTimeString("fr-FR", { ...TZ, hour: "2-digit", minute: "2-digit" }).replace(":", "h");
  return `${fmtDay(v)} · ${time}`;
};
const fmtSize = (b) => (b == null ? "" : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} Ko` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`);
const fmtDuration = (s) => (s == null ? "" : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(Math.floor(s % 60)).padStart(2, "0")}`);
const RESULTS = { ANSWERED: "Répondu", CLOSED: "Non abouti", MISSED: "Manqué", NO_ANSWER: "Sans réponse", BUSY: "Occupé", FAILED: "Échoué", VOICEMAIL: "Messagerie", TRANSFERRED: "Transféré" };
const resultLabel = (r) => RESULTS[r] || r || "Non renseigné";
const SOURCES = { AGENT: "Équipe", USER: "Équipe", CONTACT: "Client", CUSTOMER: "Client" };

async function binary(path, options = {}) {
  const response = await apiClient._authenticatedFetch(apiClient.baseUrl + path, options);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Le fichier n’a pas pu être chargé.");
  }
  return response;
}

// URL locales des fichiers ouverts, libérées quand la fiche se ferme.
function useObjectUrls() {
  const urls = useRef(new Set());
  useEffect(() => () => { for (const u of urls.current) URL.revokeObjectURL(u); }, []);
  return useCallback((blob) => { const u = URL.createObjectURL(blob); urls.current.add(u); return u; }, []);
}

// Dossier du client : une seule lecture partagée par les onglets Documents et Appels.
// Options (page Finance) : `clientId` déjà connu, la recherche par numéro est sautée ; `viewers` ouvre le dossier
// aux rôles en lecture seule, qui consultent et téléchargent sans rien ajouter (`readOnly`).
export function useClientFiles(numero, { clientId: knownId = null, viewers = false } = {}) {
  const role = apiClient.getUser()?.role;
  const readOnly = viewers && isReadOnlyViewer(role);
  const allowed = HISTORY_ROLES.includes(role) || readOnly;
  const [clientId, setClientId] = useState(knownId);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(allowed && !!(numero || knownId));
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [canBrowseCalls, setCanBrowseCalls] = useState(false);
  useEffect(() => {
    if (!allowed || !(numero || knownId)) { setLoading(false); return undefined; }
    let live = true;
    setClientId(knownId); setError("");
    if (!knownId) apiClient.get(`/api/v1/client-history/resolve?numero_client=${encodeURIComponent(numero)}`)
      .then((r) => { if (live) setClientId(r.client_id); })
      .catch(() => { if (live) { setLoading(false); setError("Dossier indisponible : le client doit être rattaché."); } });
    apiClient.get("/api/v1/finance-calls/access").then((r) => { if (live) setCanBrowseCalls(!!r.allowed); }).catch(() => {});
    return () => { live = false; };
  }, [allowed, numero, knownId]);
  const base = clientId ? `/api/v1/client-history/${clientId}` : null;
  useEffect(() => {
    if (!base) return undefined;
    let live = true;
    setLoading(true); setError("");
    apiClient.get(base).then((r) => { if (live) setItems(r.items || []); })
      .catch((e) => { if (live) setError(e.message || "Dossier indisponible."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [base, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { allowed, readOnly, base, items, loading, error, setError, reload, canBrowseCalls };
}

// ── Icônes ─────────────────────────────────────────────────────────────────────────────────────────────
const FILE_TYPES = {
  pdf: { badge: "PDF", color: "#d64545", label: "PDF" },
  email: { badge: "MAIL", color: "#2f6fde", label: "E-mail" },
  image: { badge: "IMG", color: "#1f9d6b", label: "Image" },
  audio: { badge: "AUDIO", color: "#7c4ddb", label: "Audio" },
  file: { badge: "FICHIER", color: "#8b867e", label: "Fichier" },
};
const typeOf = (item) => {
  if (item.kind === "email") return "email";
  const m = item.mime_type || "";
  if (m === "application/pdf" || /\.pdf$/i.test(item.file_name || "")) return "pdf";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/")) return "audio";
  return "file";
};
const Ico = ({ d, size = 15, sw = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const I = {
  clip: <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  in: <path d="M17 7 7 17M16 17H7V8" />,
  out: <path d="M7 17 17 7M8 7h9v9" />,
  missed: <><path d="m16 2 6 6M22 2l-6 6" /><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></>,
  play: <path d="M7 4.5v15l12-7.5Z" />,
  share: <><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" /><path d="m16 6-4-4-4 4" /><path d="M12 2v13" /></>,
};

// Icône de type de fichier (dev 29/10/2026, réf. de pièces jointes) : une page à coin plié et une étiquette de
// couleur avec l'extension (« pdf », « png », « eml »…). La couleur suit la famille du fichier.
const EXT_COLORS = { pdf: "#e5484d", doc: "#2f6fde", docx: "#2f6fde", xls: "#1f9d55", xlsx: "#1f9d55", csv: "#1f9d55",
  ppt: "#e5591c", pptx: "#e5591c", eml: "#3e63dd", msg: "#3e63dd", zip: "#8b867e" };
const familyColor = (mime, ext) => EXT_COLORS[ext] || (mime.startsWith("image/") ? "#12a594" : mime.startsWith("audio/") ? "#8e4ec6"
  : mime === "message/rfc822" ? "#3e63dd" : "#8b867e");
// Logo Gmail (dev 06/11/2026) : un e-mail joint se reconnaît d'un coup d'œil. Même boîte que l'icône de fichier,
// pour que puces et listes ne bougent pas.
function GmailMark({ size }) {
  return (
    <svg className="bcf-ft" width={size} height={Math.round(size * 32 / 28)} viewBox="0 0 28 32" aria-hidden="true">
      <g transform="translate(1.5 6.6) scale(.2841) translate(-52 -42)">
        <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
        <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
        <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
        <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" />
        <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
      </g>
    </svg>
  );
}
export function FileTypeIcon({ name = "", mime = "", size = 28 }) {
  const ext = (name.match(/\.([a-z0-9]{1,5})$/i)?.[1] || "").toLowerCase();
  if (ext === "eml" || mime === "message/rfc822") return <GmailMark size={size} />;
  const label = (ext || (mime.split("/")[1] || "doc")).slice(0, 4);
  const color = familyColor(mime || "", ext);
  return (
    <svg className="bcf-ft" width={size} height={Math.round(size * 32 / 28)} viewBox="0 0 28 32" aria-hidden="true">
      <path d="M7 1.5h10.2l6.8 6.8v20.2a2.5 2.5 0 0 1-2.5 2.5H7a2.5 2.5 0 0 1-2.5-2.5V4A2.5 2.5 0 0 1 7 1.5Z" fill="#fff" stroke="#e3ded6" strokeWidth="1.1" />
      <path d="M17.2 1.5v4.6a2.2 2.2 0 0 0 2.2 2.2H24" fill="#f4f2ee" stroke="#e3ded6" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M8.5 7.5h5M8.5 11h10" stroke="#e8e4de" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="1" y="16.5" width={label.length > 3 ? 19 : 16.5} height="9" rx="2.6" fill={color} />
      <text x={label.length > 3 ? 10.5 : 9.25} y="23.1" textAnchor="middle" fontSize="6.4" fontWeight="500" fill="#fff"
        fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" letterSpacing=".1">{label}</text>
    </svg>
  );
}
const previewKind = (f) => (f.kind === "email" || /\.eml$/i.test(f.file_name || "") ? "email" : typeOf(f));

// E-mail lu dans le CRM, présenté comme dans Gmail (dev 06/11/2026) : l'objet en grand, l'expéditeur avec son avatar,
// « à moi » ou les destinataires, la date à droite, puis le message en entier sous le nom, avec sa mise en forme (assainie
// par le serveur). La date (« Thu, 05 Nov 2026 10:14:00 +0100 ») est lue à l'heure de Paris, suivie de son ancienneté
// sous 30 jours (« il y a 2 h ») ; illisible, elle reste telle quelle.
const mailDate = (v) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const at = d.toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit" }).replace(", ", " à ").replace(":", " h ");
  const since = ago(d.toISOString());
  return since.startsWith("le ") ? at : `${at} (${since})`;
};
// « Nom <adresse> » ou « adresse » ; une liste se coupe aux virgules hors guillemets.
const mailbox = (v) => {
  const m = String(v || "").trim().match(/^"?([^"<]*?)"?\s*<([^>]+)>$/);
  return m ? { name: m[1].trim(), address: m[2].trim() } : { name: "", address: String(v || "").trim() };
};
const mailboxes = (v) => String(v || "").split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(mailbox).filter((b) => b.address);
const AVATAR_COLORS = ["#e8710a", "#1a73e8", "#188038", "#d93025", "#9334e6", "#e52592", "#12b5cb", "#b06000"];
const avatarColor = (s) => AVATAR_COLORS[[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVATAR_COLORS.length];
// Police et marges par défaut du lecteur, comme Gmail : les styles de l'e-mail, écrits après, gardent la main.
const MAIL_BASE = "<style>html{color-scheme:light}body{margin:0;padding:2px 0 24px;overflow:hidden;font:14px/1.5 Arial,Helvetica,sans-serif;"
  + "color:#222;word-wrap:break-word}img{max-width:100%;height:auto}</style>";
function MailPreview({ headers = {}, html }) {
  const frame = useRef(null);
  const from = mailbox(headers.from);
  const me = (apiClient.getUser?.()?.email || "").toLowerCase();
  const to = mailboxes(headers.to).map((b) => (me && b.address.toLowerCase() === me ? "moi" : b.name || b.address)).join(", ");
  // Le message s'affiche en entier (pas de barre de défilement dans la fenêtre) et ses liens s'ouvrent dans un nouvel onglet.
  const fit = useCallback(() => {
    const el = frame.current;
    const doc = el?.contentDocument;
    if (!doc?.documentElement) { if (el) el.style.height = "60vh"; return; }
    doc.querySelectorAll("a[href]").forEach((a) => { a.target = "_blank"; a.rel = "noopener noreferrer"; });
    el.style.height = `${doc.documentElement.scrollHeight}px`;
  }, []);
  useEffect(() => { window.addEventListener("resize", fit); return () => window.removeEventListener("resize", fit); }, [fit]);
  return (
    <article className="bcf-mail">
      <h2 className="bcf-mail-subject">{headers.subject || "(sans objet)"}</h2>
      <header className="bcf-mail-from">
        <span className="bcf-mail-av" style={{ background: avatarColor(from.address || from.name || "?") }} aria-hidden="true">
          {(from.name || from.address || "?").replace(/^[^\p{L}\p{N}]+/u, "").charAt(0).toUpperCase() || "?"}
        </span>
        <div className="bcf-mail-who">
          <div><strong>{from.name || from.address || "Expéditeur inconnu"}</strong>{from.name && from.address && <span>&lt;{from.address}&gt;</span>}</div>
          {to && <small title={headers.to}>à {to}</small>}
        </div>
        {headers.date && <time>{mailDate(headers.date)}</time>}
      </header>
      {html && <iframe ref={frame} className="bcf-mail-body" title="Message" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={html.replace("<head>", `<head>${MAIL_BASE}`)} onLoad={fit} />}
    </article>
  );
}

// Pièces jointes d'un message (réf. de commentaire) : un bloc gris « 2 fichiers », une puce par fichier. Un clic
// ouvre l'aperçu (PDF, image, son, e-mail lu dans le CRM) ou télécharge le fichier.
export function MessageFiles({ files }) {
  const objectUrl = useObjectUrls();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  if (!files?.length) return null;
  const url = async (f) => objectUrl(await (await binary(`/api/v1/optilex/comments/attachments/${f.id}/file`)).blob());
  const download = async (f, u) => { const a = document.createElement("a"); a.href = u || await url(f); a.download = f.file_name; a.click(); };
  const open = async (f) => {
    if (busyId) return;
    setBusyId(f.id); setError("");
    try {
      const type = previewKind(f);
      if (type === "email") { setPreview({ f, type, ...(await apiClient.get(`/api/v1/optilex/comments/attachments/${f.id}/email`)) }); return; }
      const u = await url(f);
      if (["pdf", "image", "audio"].includes(type)) setPreview({ f, type, url: u }); else await download(f, u);
    } catch (e) { setError(e.message || "Le fichier n’a pas pu être ouvert."); }
    finally { setBusyId(null); }
  };
  return (
    <div className="bcf-mf">
      <div className="bcf-mf-n">{files.length} fichier{files.length > 1 ? "s" : ""}</div>
      <div className="bcf-mf-list">
        {files.map((f) => (
          <button key={f.id} type="button" className="bcf-mf-chip" disabled={busyId === f.id} onClick={() => open(f)} title={`${f.file_name}${f.byte_size ? ` · ${fmtSize(f.byte_size)}` : ""}`}>
            <FileTypeIcon name={f.file_name} mime={previewKind(f) === "email" ? "message/rfc822" : f.mime_type || ""} size={18} />
            <span>{f.file_name}</span>
          </button>
        ))}
      </div>
      {error && <p role="alert" className="bcf-error" style={{ margin: "8px 0 0" }}>{error}</p>}
      <AnimatePresence>
        {preview && (
          <PreviewModal key="mf" title={(preview.type === "email" && preview.headers?.subject) || preview.f.file_name}
            wide={preview.type === "pdf"} mail={preview.type === "email"} subtitle={[FILE_TYPES[preview.type]?.label, fmtSize(preview.f.byte_size)].filter(Boolean).join(" · ")}
            onClose={() => setPreview(null)}
            actions={preview.type === "email"
              ? <button type="button" className="bcf-icon-btn" aria-label="Télécharger l’e-mail" title="Télécharger l’e-mail" onClick={() => download(preview.f)}><Ico d={I.download} size={18} /></button>
              : <button type="button" className="bcf-btn" onClick={() => download(preview.f, preview.url)}><Ico d={I.download} size={14} />Télécharger</button>}>
            {preview.type === "email" && <MailPreview headers={preview.headers} html={preview.html} />}
            {preview.type === "pdf" && <iframe className="bcf-frame" title={preview.f.file_name} src={preview.url} />}
            {preview.type === "image" && <img className="bcf-img" alt={preview.f.file_name} src={preview.url} />}
            {preview.type === "audio" && <audio className="bcf-audio" controls src={preview.url} />}
          </PreviewModal>
        )}
      </AnimatePresence>
    </div>
  );
}
// Fichiers choisis dans la saisie d'un message, avant l'envoi.
export function ComposerFiles({ files, onRemove, disabled }) {
  return (
    <AnimatePresence initial={false}>
      {files.length > 0 && (
        <motion.div key="cf" className="bcf-cf" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
          <AnimatePresence initial={false}>
            {files.map((f) => (
              <motion.span key={f.key} layout className="bcf-cf-chip" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 500, damping: 32 }}>
                {f.thumb ? <img className="bcf-cf-thumb" src={f.thumb} alt="" /> : <FileTypeIcon name={f.file.name} mime={f.file.type} size={22} />}
                <span className="bcf-cf-tx"><strong>{f.file.name}</strong><small>{fmtSize(f.file.size)}</small></span>
                <button type="button" aria-label={`Retirer ${f.file.name}`} disabled={disabled} onClick={() => onRemove(f.key)}><Ico d={I.close} size={12} /></button>
              </motion.span>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
export const MESSAGE_FILE_MAX = MAX_BYTES;
export const MESSAGE_FILE_ACCEPT = `${DOC_ACCEPT},${EMAIL_ACCEPT}`;
export async function uploadMessageFile(numero, file) {
  const form = new FormData(); form.append("numero_client", numero); form.append("file", file);
  return (await binary("/api/v1/optilex/comments/attachments", { method: "POST", body: form })).json();
}

// ── Fenêtre d'aperçu (PDF, image, e-mail, appel) ───────────────────────────────────────────────────────
// `mail` : lecture d'un e-mail, comme Gmail. Pas de bandeau de document : l'objet est écrit par MailPreview, les
// actions restent des icônes discrètes en haut à droite, et la fenêtre prend la hauteur du message.
function PreviewModal({ title, subtitle, actions, onClose, wide = false, mail = false, children }) {
  const box = useRef(null);
  // Fermeture lue par référence : l'écouteur et le focus ne sont posés qu'une fois, à l'ouverture.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    box.current?.querySelector("button")?.focus();
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close.current(); } };
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("keydown", onKey, true); previous?.focus?.(); };
  }, []);
  return createPortal(
    <motion.div className="bcf-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div ref={box} role="dialog" aria-modal="true" aria-label={title} className={`bcf-modal${mail ? " is-mail" : wide ? " is-wide" : ""}`}
        initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 36 }}>
        {mail ? (
          <div className="bcf-mail-tools">
            {actions}
            <button type="button" className="bcf-icon-btn" aria-label="Fermer" title="Fermer" onClick={onClose}><Ico d={I.close} size={18} /></button>
          </div>
        ) : (
          <header className="bcf-modal-head">
            <div style={{ minWidth: 0 }}><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
            <div className="bcf-modal-actions">
              {actions}
              <button type="button" className="bcf-icon-btn" aria-label="Fermer" onClick={onClose}><Ico d={I.close} size={17} /></button>
            </div>
          </header>
        )}
        <div className="bcf-modal-body">{children}</div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

// ── Documents (dev 29/10/2026, réfs : pièces jointes en pastilles au-dessus d'un champ « + », liste « Derniers »
// avec une miniature à droite) ─────────────────────────────────────────────────────────────────────────────
const ago = (iso) => {
  if (!iso) return "";
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return min <= 1 ? "à l'instant" : `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return d < 30 ? `il y a ${d} j` : `le ${fmtDay(iso)}`;
};
const DOC_VERBS = { pdf: "ajouté", image: "ajoutée", email: "e-mail ajouté", audio: "enregistrement ajouté", file: "ajouté" };
// Miniature du document, comme une page posée : lignes de texte, en-tête d'e-mail, onde sonore ou photo.
function DocThumb({ type }) {
  if (type === "image") {
    return (
      <span className="bcf-th is-photo" aria-hidden="true">
        <svg viewBox="0 0 40 30"><rect width="40" height="30" fill="#9fb7d8" /><path d="M0 30 13 14l9 10 6-6 12 12Z" fill="#8b867e" /><circle cx="30" cy="8" r="4" fill="#f3d27a" /></svg>
      </span>
    );
  }
  return (
    <span className={`bcf-th is-${type}`} aria-hidden="true">
      <svg viewBox="0 0 28 36">
        {type === "email" && <><rect x="5" y="5" width="18" height="7" rx="1.2" fill="#e8eefb" /><path d="m5.6 5.6 8.4 4.6 8.4-4.6" fill="none" stroke="#5b8def" strokeWidth=".9" /></>}
        {type === "audio" && <path d="M6 18v2M9 15v8M12 12v14M15 16v6M18 13v12M21 17v4" stroke="#7c4ddb" strokeWidth="1.4" strokeLinecap="round" />}
        {type !== "audio" && [16, 19.5, 23, 26.5].map((y, i) => <rect key={y} x="5" y={type === "email" ? y : y - 7} width={i === 3 ? 11 : 18} height="1.6" rx=".8" fill="#e3ded6" />)}
        {type === "pdf" && <><rect x="5" y="25" width="18" height="1.6" rx=".8" fill="#e3ded6" /><rect x="5" y="29" width="9" height="3.4" rx="1" fill="#d64545" /></>}
      </svg>
    </span>
  );
}

// `sharedWith` : avec qui le dossier est partagé, vu de la page qui l'affiche (« la finance » depuis le board).
export function BoardDocuments({ files, sharedWith = "la finance" }) {
  const { allowed, readOnly, base, items, loading, error, setError, reload } = files;
  const ro = readOnly ? READ_ONLY_PROPS : {};
  const writable = allowed && !!base && !readOnly;
  const objectUrl = useObjectUrls();
  const [pending, setPending] = useState([]);        // fichiers choisis, en pastilles, pas encore joints
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState(null);
  const [removeId, setRemoveId] = useState(null);
  const input = useRef(null);
  const dragDepth = useRef(0);
  const docs = items.filter((i) => i.kind !== "call");

  const run = async (fn) => {
    if (busy) return;
    setBusy(true); setError("");
    try { await fn(); } catch (e) { setError(e.message || "L’action n’a pas été enregistrée."); } finally { setBusy(false); }
  };
  const add = (list) => {
    const next = [...(list || [])];
    const big = next.find((f) => f.size > MAX_BYTES);
    if (big) setError(`« ${big.name} » dépasse 20 Mo.`); else setError("");
    const ok = next.filter((f) => f.size <= MAX_BYTES).map((f) => ({ id: `${f.name}-${f.size}-${f.lastModified}`, file: f,
      thumb: f.type.startsWith("image/") ? objectUrl(f) : null }));
    setPending((p) => [...p, ...ok.filter((f) => !p.some((x) => x.id === f.id))]);
  };
  const attach = () => run(async () => {
    for (const p of pending) {
      const form = new FormData(); form.append("file", p.file); form.append("note", note.trim());
      await binary(`${base}/files`, { method: "POST", body: form });
    }
    setPending([]); setNote(""); reload();
  });
  const fileUrl = async (item) => objectUrl(await (await binary(`${base}/${item.id}/file`)).blob());
  const download = (item) => run(async () => {
    const a = document.createElement("a"); a.href = await fileUrl(item); a.download = item.file_name; a.click();
  });
  const open = (item) => run(async () => {
    const type = typeOf(item);
    if (type === "email") { const data = await apiClient.get(`${base}/${item.id}/email`); setPreview({ item, type, ...data }); return; }
    setPreview({ item, type, url: await fileUrl(item) });
  });
  const remove = (id) => run(async () => { await apiClient.delete(`${base}/${id}`); setRemoveId(null); reload(); });
  const drop = {
    onDragEnter: (e) => { if (!writable) return; e.preventDefault(); dragDepth.current += 1; setDrag(true); },
    onDragOver: (e) => { if (writable) e.preventDefault(); },
    onDragLeave: () => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDrag(false); },
    onDrop: (e) => { if (!writable) return; e.preventDefault(); dragDepth.current = 0; setDrag(false); add(e.dataTransfer.files); },
  };
  const previewTitle = preview ? (preview.type === "email" ? (preview.item.metadata?.subject || preview.item.file_name) : preview.item.file_name) : "";
  if (!allowed) return null;

  return (
    <div className="bcf" {...drop}>
      {/* Joindre : les fichiers choisis en pastilles, un mot de contexte, puis « Joindre ». */}
      <div className={`bcf-compose${drag ? " is-drag" : ""}${pending.length ? " has-files" : ""}`}>
        <AnimatePresence initial={false}>
          {pending.length > 0 && (
            <motion.div key="chips" className="bcf-atts" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <AnimatePresence initial={false}>
                {pending.map((p) => {
                  const type = /\.(eml|html?)$/i.test(p.file.name) ? "email" : typeOf({ file_name: p.file.name, mime_type: p.file.type });
                  return (
                    <motion.div key={p.id} layout className="bcf-att" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 500, damping: 32 }}>
                      <span className={`bcf-att-th${p.thumb ? "" : " is-type"}`}>{p.thumb ? <img src={p.thumb} alt="" /> : <FileTypeIcon name={p.file.name} mime={type === "email" ? "message/rfc822" : p.file.type} size={24} />}</span>
                      <span className="bcf-att-tx"><strong>{p.file.name}</strong><small>{fmtSize(p.file.size)}</small></span>
                      <button type="button" className="bcf-att-x" aria-label={`Retirer ${p.file.name}`} disabled={busy}
                        onClick={() => setPending((list) => list.filter((x) => x.id !== p.id))}><Ico d={I.close} size={13} /></button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="bcf-compose-row">
          <button type="button" className="bcf-plus" disabled={busy || !base || loading} onClick={() => input.current?.click()}
            aria-label="Choisir des documents ou des e-mails" title="Documents, images, e-mails (.eml : dans Mail, glissez le message sur le bureau ; dans Gmail, ⋮ puis Télécharger le message), audio" {...ro}>
            <Ico d={I.plus} size={19} sw={1.9} />
          </button>
          <input className="bcf-compose-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} disabled={busy}
            placeholder={pending.length ? "Un mot de contexte pour l'équipe (facultatif)" : "Joindre un document ou un e-mail…"}
            onKeyDown={(e) => { if (e.key === "Enter" && pending.length) { e.preventDefault(); attach(); } }}
            onFocus={() => { if (!pending.length && !note) input.current?.click(); }} readOnly={!pending.length} {...ro} />
          <AnimatePresence>
            {pending.length > 0 && (
              <motion.button key="go" type="button" className="bcf-go" disabled={busy} onClick={attach}
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                {busy ? "Envoi…" : `Joindre${pending.length > 1 ? ` (${pending.length})` : ""}`}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <input ref={input} type="file" hidden multiple accept={`${DOC_ACCEPT},${EMAIL_ACCEPT}`} onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </div>
      {error && <p role="alert" className="bcf-error">{error} <button type="button" onClick={reload}>Actualiser</button></p>}

      {/* Derniers documents : l'action, l'auteur, l'ancienneté, et la miniature à droite. */}
      <section className="bcf-latest">
        <header><Ico d={<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.5 12 3.5 3.5 0 0 0 6 19Z" />} size={20} sw={1.7} /><span>Dossier partagé avec {sharedWith}</span></header>
        <div className="bcf-latest-in">
          <div className="bcf-latest-title">Derniers</div>
          {loading ? [0, 1].map((i) => <div key={i} className="bcf-doc is-skeleton" />)
            : !docs.length ? <p className="bcf-empty">Aucun document pour le moment.</p>
            : (
              <AnimatePresence initial={false}>
                {docs.map((item) => {
                  const type = typeOf(item);
                  const title = type === "email" ? (item.metadata?.subject || item.file_name) : item.file_name;
                  return (
                    <motion.div key={item.id} layout className="bcf-doc" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
                      <button type="button" className="bcf-doc-main" disabled={busy} onClick={() => open(item)} title={item.note || title}>
                        <span className="bcf-doc-ic"><FileTypeIcon name={item.file_name || (type === "email" ? "message.eml" : "")} mime={type === "email" ? "message/rfc822" : item.mime_type || ""} size={24} /></span>
                        <span className="bcf-doc-tx">
                          <span className="bcf-doc-title"><b>{title}</b> {DOC_VERBS[type]}</span>
                          <span className="bcf-doc-sub">{[ago(item.created_at), item.author_name].filter(Boolean).join(" · ")}</span>
                          {item.note && <span className="bcf-doc-note">{item.note}</span>}
                        </span>
                        <DocThumb type={type} />
                      </button>
                      <span className="bcf-doc-tools">
                        <button type="button" className="bcf-icon-btn" disabled={busy} onClick={() => download(item)} aria-label={`Télécharger ${title}`} title="Télécharger"><Ico d={I.download} /></button>
                        {(item.can_remove || readOnly) && <button type="button" className="bcf-icon-btn is-danger" disabled={busy} onClick={() => setRemoveId(item.id)} aria-label={`Retirer ${title}`} title="Retirer" {...ro}><Ico d={I.trash} /></button>}
                      </span>
                      <AnimatePresence>
                        {removeId === item.id && (
                          <motion.div className="bcf-doc-confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <span>Retirer ce document du dossier ?</span>
                            <button type="button" className="bcf-btn" onClick={() => setRemoveId(null)}>Annuler</button>
                            <button type="button" className="bcf-btn is-danger" disabled={busy} onClick={() => remove(item.id)}>Retirer</button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
        </div>
      </section>

      <AnimatePresence>
        {preview && (
          <PreviewModal key="preview" title={previewTitle} wide={preview.type === "pdf"} mail={preview.type === "email"}
            subtitle={[FILE_TYPES[preview.type]?.label, preview.item?.author_name, fmtDay(preview.item?.created_at)].filter(Boolean).join(" · ")}
            onClose={() => setPreview(null)}
            actions={preview.type === "email"
              ? <button type="button" className="bcf-icon-btn" aria-label="Télécharger l’e-mail" title="Télécharger l’e-mail" disabled={busy} onClick={() => download(preview.item)}><Ico d={I.download} size={18} /></button>
              : <button type="button" className="bcf-btn" disabled={busy} onClick={() => download(preview.item)}><Ico d={I.download} size={14} />Télécharger</button>}>
            {preview.type === "email" && <MailPreview headers={preview.headers} html={preview.html} />}
            {preview.type === "pdf" && <iframe className="bcf-frame" title={previewTitle} src={preview.url} />}
            {preview.type === "image" && <img className="bcf-img" alt={previewTitle} src={preview.url} />}
            {preview.type === "audio" && <audio className="bcf-audio" controls src={preview.url} />}
            {preview.type === "file" && <p className="bcf-hint">Aperçu indisponible pour ce type de fichier : utilisez « Télécharger ».</p>}
          </PreviewModal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Appels ─────────────────────────────────────────────────────────────────────────────────────────────
// Tous les appels Allo avec le client (personnes autorisées), sinon ceux partagés au dossier. Un appel s'ouvre
// avec son enregistrement, son résumé et sa transcription.
export function BoardCalls({ files, active }) {
  const { base, items, canBrowseCalls, reload } = files;
  const ro = files.readOnly ? READ_ONLY_PROPS : {};
  const objectUrl = useObjectUrls();
  const shared = items.filter((i) => i.kind === "call");
  const [allo, setAllo] = useState(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);     // { call, shared, detail?, url?, loadingAudio? }
  const run = async (fn) => {
    if (busy) return;
    setBusy(true); setError("");
    try { await fn(); } catch (e) { setError(e.message || "Allo ne répond pas pour le moment."); } finally { setBusy(false); }
  };
  const load = (p) => run(async () => {
    const r = await apiClient.get(`${base}/calls?page=${p}`);
    setAllo((prev) => (p === 1 ? r.calls : [...(prev || []), ...r.calls].filter((c, i, all) => all.findIndex((o) => o.id === c.id) === i)));
    setPage(p); setMore(!!r.has_more);
  });
  useEffect(() => {
    if (active && canBrowseCalls && base && allo === null) load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, canBrowseCalls, base]);

  const list = (canBrowseCalls && allo
    ? allo.map((c) => ({ call: c, shared: shared.find((i) => i.metadata?.id === c.id) || null }))
    : shared.map((i) => ({ call: { ...i.metadata, id: i.metadata?.id || i.id }, shared: i })))
    .sort((a, b) => String(b.call.date || "").localeCompare(String(a.call.date || "")));

  const share = (call) => run(async () => { await apiClient.post(`${base}/calls`, { call_id: call.id, note: "" }); reload(); });
  const openCall = (entry) => run(async () => {
    const detail = canBrowseCalls ? await apiClient.get(`/api/v1/finance-calls/calls/${encodeURIComponent(entry.call.id)}`) : {};
    setOpen({ ...entry, detail: { ...entry.call, ...detail } });
  });
  const listen = () => run(async () => {
    const path = canBrowseCalls ? `/api/v1/finance-calls/calls/${encodeURIComponent(open.call.id)}/recording` : `${base}/${open.shared.id}/recording`;
    const url = objectUrl(await (await binary(path)).blob());
    setOpen((o) => (o ? { ...o, url } : o));
  });

  const icon = (c) => (["MISSED", "NO_ANSWER", "BUSY", "FAILED", "CLOSED"].includes(c.result) ? "missed" : c.direction === "INBOUND" ? "in" : "out");
  const d = open?.detail || open?.call;
  const loadingList = canBrowseCalls ? allo === null : files.loading;

  return (
    <div className="bcf">
      <section className="bcf-sec">
        <header className="bcf-head">
          <h4>Appels{list.length > 0 && <span className="bcf-count">{list.length}{more ? "+" : ""}</span>}</h4>
          <span className="bcf-head-note">{canBrowseCalls ? "Allo · toutes les lignes de l’équipe" : "Appels partagés au dossier"}</span>
        </header>
        {error && <p role="alert" className="bcf-error">{error} <button type="button" onClick={() => (canBrowseCalls ? load(1) : reload())}>Réessayer</button></p>}
        {loadingList ? <div className="bcf-calls">{[0, 1, 2].map((i) => <div key={i} className="bcf-call is-skeleton" />)}</div>
          : !list.length ? <p className="bcf-empty">Aucun appel avec ce client pour le moment.</p> : (
            <ol className="bcf-calls">
              {list.map((entry) => {
                const c = entry.call; const k = icon(c);
                return (
                  <li key={c.id} className="bcf-call">
                    <span className={`bcf-call-ic is-${k}`}><Ico d={I[k]} size={15} sw={2.2} /></span>
                    <button type="button" className="bcf-call-main" disabled={busy} onClick={() => openCall(entry)}>
                      <span className="bcf-call-title">
                        Appel {c.direction === "INBOUND" ? "entrant" : "sortant"}
                        <span className={`bcf-chip${c.result === "ANSWERED" ? " is-ok" : k === "missed" ? " is-ko" : ""}`}>{resultLabel(c.result)}</span>
                      </span>
                      <span className="bcf-call-sub">{[fmtWhen(c.date), c.duration ? fmtDuration(c.duration) : null, c.operator_name].filter(Boolean).join(" · ")}</span>
                      {entry.shared?.note && <span className="bcf-card-by">{entry.shared.note}</span>}
                    </button>
                    {entry.shared
                      ? <span className="bcf-tag" title="Partagé au dossier : écoute et transcription visibles par le Client Success et la finance">Au dossier</span>
                      : canBrowseCalls && <button type="button" className="bcf-btn" disabled={busy} onClick={() => share(c)} title="Le partager au dossier rend son écoute et sa transcription visibles par le Client Success et la finance" {...ro}><Ico d={I.share} size={13} />Partager</button>}
                  </li>
                );
              })}
            </ol>
          )}
        {canBrowseCalls && more && <button type="button" className="bcf-more" disabled={busy} onClick={() => load(page + 1)}>Voir les appels précédents</button>}
      </section>

      <AnimatePresence>
        {open && (
          <PreviewModal key="call" title={`Appel ${d.direction === "INBOUND" ? "entrant" : "sortant"} · ${fmtWhen(d.date)}`}
            subtitle={[resultLabel(d.result), d.duration ? fmtDuration(d.duration) : null, d.operator_name].filter(Boolean).join(" · ")}
            onClose={() => setOpen(null)}>
            <dl className="bcf-call-meta">
              <div><dt>Client</dt><dd>{d.contacts?.join(", ") || "Non renseigné"}<small>{d.contact_number}</small></dd></div>
              <div><dt>Ligne de l’équipe</dt><dd>{d.operator_name || "—"}<small>{d.allo_number}</small></dd></div>
            </dl>
            {d.has_recording !== false && (open.url
              ? <audio className="bcf-audio" controls autoPlay src={open.url} aria-label="Enregistrement de l’appel" />
              : <button type="button" className="bcf-listen" disabled={busy} onClick={listen}><span><Ico d={I.play} size={13} sw={0} /></span>{busy ? "Chargement de l’enregistrement…" : "Écouter l’enregistrement"}</button>)}
            {d.summary && <div className="bcf-summary"><h5>Résumé</h5><p>{d.summary}</p></div>}
            {d.transcript?.length > 0 && (
              <div className="bcf-transcript">
                <h5>Transcription</h5>
                {d.transcript.map((line, i) => (
                  <p key={i} className={/CONTACT|CUSTOMER/i.test(line.source || "") ? "is-client" : ""}>
                    <strong>{SOURCES[String(line.source || "").toUpperCase()] || line.source || "—"}</strong>
                    {line.time != null && <time>{typeof line.time === "number" ? fmtDuration(Math.round(line.time)) : line.time}</time>}
                    <span>{line.text}</span>
                  </p>
                ))}
              </div>
            )}
            {!d.summary && !d.transcript?.length && <p className="bcf-hint">Pas de résumé ni de transcription pour cet appel.</p>}
          </PreviewModal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Contrats en dossiers (dev 29/10/2026, réfs de dossiers en verre dépoli) ────────────────────────────────
// Chaque convention est un dossier dessiné, son nom et son statut dessous. Au survol les feuilles montent ; au clic
// la première sort du dossier et s'agrandit jusqu'à devenir le lecteur PDF (élément partagé), puis y retourne.
// Onglet du lecteur et teinte du dossier (Owner sombre, Opti'Lex rose) : une par convention.
const FOLDER_TONES = {
  owner: { ink: "#123a6e", soft: "#d9e7fb", glass: "night" },
  optilex: { ink: "#174b33", soft: "#d8f0e3", glass: "rose" },
};
// Envol de la feuille : court et sans traîne (une sortie douce plutôt qu'un ressort qui met longtemps à se poser).
const SHEET_SPRING = { type: "tween", duration: 0.42, ease: [0.22, 1, 0.36, 1] };
// La feuille dessinée : titre, lignes de texte, et la signature avec son sceau quand le contrat est signé.
// `ink` et `line` : teintes du titre et des lignes (les feuilles d'un dossier prennent la teinte du dossier).
function SheetLines({ signed, ink = "#1c1b19", line = "#e8e4de" }) {
  return (
    <>
      <rect x="18" y="20" width="82" height="9" rx="4" fill={ink} opacity=".78" />
      <rect x="18" y="36" width="54" height="5" rx="2.5" fill="#d8d3cb" />
      {[56, 66, 76, 86, 104, 114, 124, 134, 152, 162, 172].map((y, i) => (
        <rect key={y} x="18" y={y} width={i % 4 === 3 ? 110 : 164} height="4" rx="2" fill={line} />
      ))}
      {signed && <>
        <path d="M112 214c6-12 12-16 13-6s-4 14 3 9 7-15 12-9 3 11 9 4 6-3 13 1" fill="none" stroke="#2b2927" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M110 226h72" stroke="#d8d3cb" strokeWidth="1.5" />
        <circle cx="44" cy="214" r="15" fill="#e2f6ea" stroke="#0b7a4b" strokeWidth="2" />
        <path d="M37.5 214.5l4.5 4.5 8.5-9" fill="none" stroke="#0b7a4b" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </>}
    </>
  );
}
function SheetArt(props) {
  return <svg className="cf-art" viewBox="0 0 200 260" preserveAspectRatio="xMidYMin meet" aria-hidden="true"><SheetLines {...props} /></svg>;
}

// Le dossier en verre dépoli, dessiné en SVG (réfs du dev, dossier sombre et dossier rose) : le dos, trois feuilles
// en éventail, la façade en verre qui laisse voir les feuilles floutées. Une seule géométrie, en pixels, sert au SVG
// et aux feuilles HTML (la première est l'élément partagé qui s'envole vers le lecteur) : le flou suit les feuilles.
const FOLDER_W = 168, FOLDER_H = 152;
const F_BACK = { x: 8, y: 12, w: 152, h: 134, r: 14 };
// rot : inclinaison au repos ; hx, hy, hr : position au survol (les feuilles montent et s'écartent).
const F_LEAVES = [
  { key: "c", x: 96, y: 27, w: 60, h: 84, rot: 9, hx: 6, hy: -6, hr: 14 },
  { key: "b", x: 60, y: 15, w: 70, h: 96, rot: 4, hx: 2, hy: -10, hr: 7 },
  { key: "a", x: 16, y: 4, w: 84, h: 110, rot: -6, hx: -3, hy: -15, hr: -10 },
];
// Façade : onglet haut à gauche, pente douce, puis le corps ; plus large que le dos, comme sur les réfs.
const F_FRONT = (() => {
  const x0 = 1, x1 = 167, tab = 46, top = 70, bot = 149, r = 13, tabEnd = 78, slopeEnd = 100;
  return `M${x0} ${tab + r}Q${x0} ${tab} ${x0 + r} ${tab}H${tabEnd}C${tabEnd + 9} ${tab} ${slopeEnd - 10} ${top} ${slopeEnd} ${top}`
    + `H${x1 - r}Q${x1} ${top} ${x1} ${top + r}V${bot - r}Q${x1} ${bot} ${x1 - r} ${bot}H${x0 + r}Q${x0} ${bot} ${x0} ${bot - r}Z`;
})();
// Teintes : dos (haut, bas), fond de la façade là où elle dépasse du dos, ombre portée, givre de la façade (haut, milieu, bas), lignes des feuilles.
const GLASS_TONES = {
  night: { back: ["#55514b", "#2b2927"], base: "#4a4540", shadow: "rgba(28,27,25,.22)", frost: [["#ebe6f7", 0.52], ["#e3ded6", 0.3], ["#2b2927", 0.34]], ink: "#9d9890", line: "#e3ded6" },
  rose: { back: ["#f8b2d0", "#ea7fae"], base: "#f09cc1", shadow: "rgba(232,108,160,.4)", frost: [["#fff4f9", 0.62], ["#ffd6e8", 0.36], ["#f08fba", 0.42]], ink: "#e3a6c1", line: "#f3d6e3" },
  empty: { back: ["#ece9e4", "#d8d3cb"], base: "#e3ded6", shadow: "rgba(43,41,39,.098)", frost: [["#ffffff", 0.7], ["#f7f5f2", 0.5], ["#e8e4de", 0.5]], ink: "#cfc9c0", line: "#e8e4de" },
};
const leafStyle = (l) => ({ "--r": `${l.rot}deg`, "--hx": `${l.hx}px`, "--hy": `${l.hy}px`, "--hr": `${l.hr}deg` });

function FolderBack({ tone, uid }) {
  const t = GLASS_TONES[tone];
  return (
    <svg className="cf-svg" width={FOLDER_W} height={FOLDER_H} viewBox={`0 0 ${FOLDER_W} ${FOLDER_H}`} aria-hidden="true">
      <defs>
        <linearGradient id={`fb-${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={t.back[0]} /><stop offset="1" stopColor={t.back[1]} /></linearGradient>
        <filter id={`fs-${uid}`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7" /></filter>
      </defs>
      <rect className="cf-shadow" x="14" y={FOLDER_H - 30} width={FOLDER_W - 28} height="22" rx="11" fill={t.shadow} filter={`url(#fs-${uid})`} />
      <rect x={F_BACK.x} y={F_BACK.y} width={F_BACK.w} height={F_BACK.h} rx={F_BACK.r} fill={`url(#fb-${uid})`} />
      <rect x={F_BACK.x + 0.5} y={F_BACK.y + 0.5} width={F_BACK.w - 1} height={F_BACK.h - 1} rx={F_BACK.r - 0.5} fill="none" stroke="#fff" strokeOpacity=".16" />
    </svg>
  );
}

// La façade : le dos et les feuilles recopiés et floutés, découpés à sa forme, puis le givre et le liseré de lumière.
function FolderFront({ tone, uid, leaves, out, signed }) {
  const t = GLASS_TONES[tone];
  return (
    <svg className="cf-svg cf-glass" width={FOLDER_W} height={FOLDER_H} viewBox={`0 0 ${FOLDER_W} ${FOLDER_H}`} aria-hidden="true">
      <defs>
        <clipPath id={`fc-${uid}`}><path d={F_FRONT} /></clipPath>
        <filter id={`fz-${uid}`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4.5" /></filter>
        <linearGradient id={`ff-${uid}`} x1="0" y1="0" x2="0" y2="1">
          {t.frost.map(([c, o], i) => <stop key={i} offset={i / (t.frost.length - 1)} stopColor={c} stopOpacity={o} />)}
        </linearGradient>
        <linearGradient id={`fe-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".85" /><stop offset=".45" stopColor="#fff" stopOpacity=".18" /><stop offset="1" stopColor="#fff" stopOpacity=".4" />
        </linearGradient>
        <linearGradient id={`fl-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".2" /><stop offset=".35" stopColor="#fff" stopOpacity="0" /><stop offset=".8" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#fff" stopOpacity=".12" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#fc-${uid})`}>
        <rect width={FOLDER_W} height={FOLDER_H} fill={t.base} />
        <g className="cf-behind" filter={`url(#fz-${uid})`}>
          <rect x={F_BACK.x} y={F_BACK.y} width={F_BACK.w} height={F_BACK.h} rx={F_BACK.r} fill={t.back[1]} />
          {leaves && F_LEAVES.map((l) => (
            <g key={l.key} className={`cf-leaf${l.key === "a" && out ? " is-out" : ""}`} style={{ ...leafStyle(l), transformOrigin: `${l.x + l.w / 2}px ${l.y + l.h / 2}px` }}>
              <g transform={`translate(${l.x} ${l.y}) scale(${l.w / 200})`}>
                <rect width="200" height={l.h * 200 / l.w} rx="12" fill="#faf9f7" />
                <SheetLines signed={l.key === "a" && signed} ink={t.ink} line={t.line} />
              </g>
            </g>
          ))}
        </g>
        <rect width={FOLDER_W} height={FOLDER_H} fill={`url(#ff-${uid})`} />
        <rect width={FOLDER_W} height={FOLDER_H} fill={`url(#fl-${uid})`} />
      </g>
      <path d={F_FRONT} fill="none" stroke={`url(#fe-${uid})`} strokeWidth="1.2" />
    </svg>
  );
}

function ContractViewer({ it, url, error, onClose }) {
  const tone = FOLDER_TONES[it.key] || FOLDER_TONES.owner;
  // Le lecteur PDF (lourd à démarrer) n'est monté qu'une fois la feuille posée : l'envol reste fluide.
  const [landed, setLanded] = useState(false);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close.current(); } };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);
  const download = () => {
    if (!url) return;
    const a = document.createElement("a"); a.href = url; a.download = `${it.title.replace(/[^\w]+/g, "_")}.pdf`; a.click();
  };
  return createPortal(
    <motion.div className="cf-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.18 } }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div layoutId={`cf-sheet-${it.key}`} className="cf-paper" role="dialog" aria-modal="true" aria-label={it.title}
        transition={SHEET_SPRING} style={{ borderRadius: 22 }} onLayoutAnimationComplete={() => setLanded(true)}>
        <motion.header className="cf-paper-head" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.12, duration: 0.2 } }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}>
          <span className="cf-paper-tab" style={{ background: tone.soft, color: tone.ink }}>{it.label}</span>
          <div className="cf-paper-title"><h3>{it.title}</h3>{it.statusText && <p>{it.statusText}</p>}</div>
          <div className="cf-paper-actions">
            <button type="button" className="bcf-btn" disabled={!url} onClick={download}><Ico d={I.download} size={14} />Télécharger</button>
            <button type="button" className="bcf-icon-btn" aria-label="Ranger le contrat" autoFocus onClick={onClose}><Ico d={I.close} size={17} /></button>
          </div>
        </motion.header>
        <div className="cf-paper-body">
          {/* Pendant le chargement, la feuille garde son dessin ; le PDF arrive en fondu. */}
          {!(url && landed) && !error && <div className="cf-paper-placeholder"><SheetArt signed={it.signed} /></div>}
          {error && <p role="alert" className="bcf-error" style={{ padding: 24 }}>{error}</p>}
          {url && landed && <motion.iframe className="cf-frame" title={it.title} src={url} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.05, duration: 0.2 } }} />}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

// items : [{ key: "owner" | "optilex", label, title, status (nœud), statusText, sub, signed, available, empty, openLabel? }]
// `source(key)` : chemin du PDF quand la page a sa propre route de lecture (fiche Finance) ; sans elle, la route des contrats.
export function ContractFolders({ contractId, items, group, source = null }) {
  const objectUrl = useObjectUrls();
  const [open, setOpen] = useState(null);
  const [urls, setUrls] = useState({});
  const [errors, setErrors] = useState({});
  const loading = useRef(new Set());
  const load = async (key) => {
    if (urls[key] || loading.current.has(key)) return;
    loading.current.add(key);
    setErrors((x) => ({ ...x, [key]: "" }));
    try {
      const url = objectUrl(await (await binary(source ? source(key) : `/api/v1/contracts/${contractId}/download/${key}`)).blob());
      setUrls((u) => ({ ...u, [key]: url }));
    } catch (e) { setErrors((x) => ({ ...x, [key]: e.message || "PDF introuvable." })); }
    finally { loading.current.delete(key); }
  };
  const current = items.find((i) => i.key === open);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <LayoutGroup id={`contracts-${group}`}>
      <div className="cf-row">
        {items.map((it) => {
          const clickable = (!!contractId || !!source) && it.available;
          const tone = it.empty ? "empty" : (FOLDER_TONES[it.key] || FOLDER_TONES.owner).glass;
          const t = GLASS_TONES[tone];
          return (
            <button key={it.key} type="button" className={`cf${clickable ? " is-clickable" : ""}${it.empty ? " is-empty" : ""}`} disabled={!clickable}
              onClick={() => { setOpen(it.key); load(it.key); }} aria-label={clickable ? (it.openLabel || `Ouvrir la ${it.title}`) : it.title}
              onPointerEnter={() => { if (clickable) load(it.key); }} onFocus={() => { if (clickable) load(it.key); }}>
              <span className="cf-ic">
                <FolderBack tone={tone} uid={`${uid}${it.key}`} />
                {!it.empty && F_LEAVES.map((l) => (
                  <span key={l.key} className={`cf-leaf cf-leaf-${l.key}`} style={{ ...leafStyle(l), left: l.x, top: l.y, width: l.w, height: l.h }}>
                    {l.key !== "a" ? <span className="cf-sheet"><SheetArt ink={t.ink} line={t.line} /></span>
                      : open !== it.key && (
                        <motion.span layoutId={`cf-sheet-${it.key}`} className="cf-sheet" transition={SHEET_SPRING} style={{ borderRadius: 5 }}>
                          <SheetArt signed={it.signed} ink={t.ink} line={t.line} />
                        </motion.span>
                      )}
                  </span>
                ))}
                <FolderFront tone={tone} uid={`${uid}${it.key}`} leaves={!it.empty} out={open === it.key} signed={it.signed} />
              </span>
              <span className="cf-meta">
                <span className="cf-title">{it.title}</span>
                <span className="cf-status">{it.status}</span>
                {it.sub && <span className="cf-sub">{it.sub}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <AnimatePresence>
        {current && <ContractViewer key={current.key} it={current} url={urls[current.key]} error={errors[current.key]} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </LayoutGroup>
  );
}

// Miniature d'un contrat au bout de sa ligne dans les propriétés (dev 29/10/2026, réf. de liste avec miniatures) :
// la page du contrat (signature et sceau quand il est signé) ; au clic elle s'envole et devient le lecteur PDF.
export function ContractThumb({ contractId, it, group }) {
  const objectUrl = useObjectUrls();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(null);
  const [error, setError] = useState("");
  const loading = useRef(false);
  const clickable = !!contractId && it.available;
  const load = async () => {
    if (!clickable || url || loading.current) return;
    loading.current = true; setError("");
    try { setUrl(objectUrl(await (await binary(`/api/v1/contracts/${contractId}/download/${it.key}`)).blob())); }
    catch (e) { setError(e.message || "PDF introuvable."); }
    finally { loading.current = false; }
  };
  if (it.empty) return null;
  return (
    <LayoutGroup id={`contract-thumb-${group}-${it.key}`}>
      <button type="button" className={`ct${clickable ? " is-clickable" : ""}`} disabled={!clickable}
        onPointerEnter={load} onFocus={load} onClick={() => { setOpen(true); load(); }}
        aria-label={`Ouvrir la ${it.title}`} title={clickable ? `Ouvrir la ${it.title}` : it.title}>
        {open ? <span className="ct-page is-ghost" /> : (
          <motion.span layoutId={`cf-sheet-${it.key}`} className="ct-page" transition={SHEET_SPRING} style={{ borderRadius: 3 }}>
            <SheetArt signed={it.signed} />
          </motion.span>
        )}
      </button>
      <AnimatePresence>
        {open && <ContractViewer key="viewer" it={it} url={url} error={error} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </LayoutGroup>
  );
}
