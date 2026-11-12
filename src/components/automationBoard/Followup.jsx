// Suivi d'une mission côté Owner (dev 12/11/2026 : « d'abord on fait chez Owner ») : ce que la page ajoute à ce qu'Opti'Lex
// sait déjà. Un compositeur (texte, pièces jointes, émojis) sur le modèle du fil d'échanges, les pièces jointes en
// pastilles, et sous chaque entrée de l'historique ou chaque commentaire : les réactions, les réponses, « Commenter ».
// Rien d'ici n'est envoyé à Opti'Lex ; les routes sont celles de `/optilex/automation-board/{id}/followup`.
import React, { useRef, useState } from "react";
import { FileText, MessageCircle, Paperclip, Smile, Trash2 } from "lucide-react";
import { EmojiPalette, Reactions } from "../BoardReactions.jsx";
import { ComposerFiles } from "../BoardClientFiles.jsx";
import { countLabel, repliesTo, sizeLabel } from "../../utils/automationBoard";
import { Face } from "./parts";
import { BODY_MAX, FILE_ACCEPT, followupApi, pickFiles } from "./followupApi.js";

// Zone d'écriture : une carte, le texte, les pièces jointes choisies, puis les outils et l'envoi dans la carte.
// `onSend(texte, fichiers)` enregistre et lève une erreur en cas d'échec ; la carte se vide quand c'est fait.
export function Composer({ placeholder, label, sendLabel = "Envoyer", onSend, allowFiles = true, compact = false, tools = null, note = null, autoFocus = false }) {
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const field = useRef(null), input = useRef(null);
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform || "");
  const attach = (incoming) => { const [list, refused] = pickFiles(files, incoming); setFiles(list); setError(refused); };
  const insert = (text) => {
    const at = field.current ? [field.current.selectionStart, field.current.selectionEnd] : [draft.length, draft.length];
    setDraft((value) => (value.slice(0, at[0]) + text + value.slice(at[1])).slice(0, BODY_MAX));
    requestAnimationFrame(() => { field.current?.focus(); field.current?.setSelectionRange(at[0] + text.length, at[0] + text.length); });
  };
  const kept = allowFiles ? files : [];
  const off = busy || (!draft.trim() && !kept.length);
  const submit = async (event) => {
    event?.preventDefault();
    if (off) return;
    setBusy(true); setError("");
    try { await onSend(draft.trim(), kept.map((item) => item.file)); setDraft(""); setFiles([]); }
    catch (failure) { setError(failure?.message || "L’enregistrement n’a pas abouti. Réessayez."); }
    finally { setBusy(false); }
  };
  return (
    <div className="fx">
      <form className={`fx-composer${dragging ? " is-drag" : ""}`} onSubmit={submit}
        onDragEnter={(e) => { if (allowFiles && e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setDragging(true); } }}
        onDragOver={(e) => { if (allowFiles && e.dataTransfer?.types?.includes("Files")) e.preventDefault(); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
        onDrop={(e) => { if (!allowFiles || !e.dataTransfer?.files?.length) return; e.preventDefault(); setDragging(false); attach(e.dataTransfer.files); }}>
        <textarea ref={field} className="fx-ta" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={BODY_MAX} rows={compact ? 1 : 2}
          placeholder={placeholder} aria-label={label || placeholder} autoFocus={autoFocus} style={compact ? { minHeight: 44 } : undefined}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(e); }} />
        <ComposerFiles files={kept} disabled={busy} onRemove={(key) => setFiles((list) => list.filter((item) => item.key !== key))} />
        <div className="fx-bar">
          {allowFiles && <button type="button" className="fx-tool" onClick={() => input.current?.click()} disabled={busy} aria-label="Joindre des fichiers"
            title="Joindre des fichiers (PDF, image, Excel, Word, PowerPoint, CSV · 20 Mo au plus) ou les glisser ici"><Paperclip size={16} /></button>}
          <EmojiPalette label="Insérer un emoji" className="fx-tool" onPick={insert}><Smile size={16} /></EmojiPalette>
          <input ref={input} type="file" hidden multiple accept={FILE_ACCEPT} onChange={(e) => { attach(e.target.files); e.target.value = ""; }} />
          {tools}
          <span className="fx-hint" aria-hidden="true">{isMac ? "⌘" : "Ctrl"} Entrée</span>
          <button type="submit" className="fx-send" disabled={off}>{busy ? "Envoi…" : sendLabel}</button>
        </div>
      </form>
      {(error || note) && <p className="fx-scope" role={error ? "alert" : undefined} style={error ? { color: "#c5221f" } : undefined}>{error || note}</p>}
    </div>
  );
}

// Pièces jointes d'une entrée, en pastilles : un clic télécharge.
export function Files({ processId, files }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  if (!files?.length) return null;
  const open = async (file) => {
    setBusy(file.id); setError("");
    try { await followupApi.download(processId, file); } catch (failure) { setError(failure?.message || "Le fichier n’a pas pu être chargé."); } finally { setBusy(null); }
  };
  return (
    <div className="ab-files">
      {files.map((file) => (
        <button key={file.id} type="button" className="ab-chip is-file" onClick={() => open(file)} disabled={busy === file.id} title="Télécharger">
          <FileText size={13} />{file.file_name}<span style={{ color: "var(--muted)" }}>{busy === file.id ? "…" : sizeLabel(file.byte_size)}</span>
        </button>
      ))}
      {error && <span role="alert" style={{ fontSize: 12, color: "#c5221f" }}>{error}</span>}
    </div>
  );
}

// Sous une entrée de l'historique ou un commentaire : les réactions, les réponses, et « Commenter ».
// `itemKey` désigne l'entrée ; `entryId` et `mine` : une entrée d'Owner que son auteur peut retirer.
export function Feedback({ processId, itemKey, follow, onChanged, entryId = null, mine = false, replyLabel = "Commenter" }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  if (!follow?.available) return null;
  const replies = repliesTo(follow.entries, itemKey);
  const run = async (action) => { setError(""); try { await action(); await onChanged(); } catch (failure) { setError(failure?.message || "L’action n’a pas abouti."); } };
  const react = (key) => (emoji) => run(() => followupApi.react(processId, key, emoji));
  const remove = (id, what) => { if (window.confirm(`Retirer ${what} ?`)) run(() => followupApi.remove(processId, id)); };
  return (
    <div className="ab-feedback">
      <div className="ab-feedback-bar">
        <Reactions list={follow.reactions?.[itemKey] || []} onToggle={react(itemKey)} />
        <button type="button" className="ab-quiet" aria-expanded={open} onClick={() => setOpen((value) => !value)}><MessageCircle size={13} />{replyLabel}</button>
        {mine && entryId && <button type="button" className="ab-quiet" onClick={() => remove(entryId, "cette entrée et ses commentaires")}><Trash2 size={13} />Retirer</button>}
        {error && <span role="alert" style={{ fontSize: 12, color: "#c5221f" }}>{error}</span>}
      </div>
      {(replies.length > 0 || open) && (
        <div className="ab-replies">
          {replies.length > 0 && <div className="ab-replies-count">{countLabel(replies.length, "commentaire", "commentaires")}</div>}
          {replies.map((reply) => (
            <div key={reply.key} className="ab-reply">
              <Face name={reply.who} size={22} />
              <div style={{ minWidth: 0 }}>
                <div className="ab-reply-head"><span>{reply.who}</span><time>{reply.time}</time>
                  {reply.mine && <button type="button" className="ab-quiet" onClick={() => remove(reply.id, "ce commentaire")} aria-label="Retirer ce commentaire"><Trash2 size={12} /></button>}</div>
                {reply.text && <div className="ab-reply-text">{reply.text}</div>}
                <Files processId={processId} files={reply.files} />
                <div className="ab-feedback-bar"><Reactions list={follow.reactions?.[reply.key] || []} onToggle={react(reply.key)} /></div>
              </div>
            </div>
          ))}
          {open && <Composer compact autoFocus placeholder="Écrire un commentaire sur cette entrée…" sendLabel="Commenter"
            onSend={async (body, files) => { await followupApi.add(processId, { kind: "comment", body, targetKey: itemKey, files }); await onChanged(); setOpen(false); }} />}
        </div>
      )}
    </div>
  );
}
