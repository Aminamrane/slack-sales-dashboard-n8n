// E-mails et téléphones du client par rang dans la fiche du board (dev 29/10/2026 : « primaire, secondaire, etc. ») :
// le contact principal de la table partagée avec la finance (client_contact.is_primary) est la primaire, les autres
// suivent dans leur ordre. On peut en ajouter et passer n'importe lequel en primaire : rien de nouveau côté serveur.
import { useEffect, useRef, useState } from "react";
// eslint-disable-next-line no-unused-vars -- motion utilisé via JSX (faux positif)
import { AnimatePresence, motion } from "framer-motion";
import apiClient from "../services/apiClient";
import { contactEntries } from "../utils/boardContacts.js";
import "./BoardContactLine.css";

export const RankTag = ({ entry }) => <span className={`bcl-tag${entry.primary ? " is-primary" : ""}`}>{entry.rank}</span>;
const STAR = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z" /></svg>;

// Bouton « + » de la ligne : la liste par rang, « Mettre en primaire », et l'ajout d'un contact (il prend le rang
// suivant). Affichage immédiat, puis rechargement de la fiche.
export function ContactMore({ kind, numero, entries, displayed, editable, onChanged, onLocal }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key, true); };
  }, [open]);
  const run = async (fn) => {
    setBusy(true); setError("");
    try { await fn(); onChanged?.(); return true; }
    catch (e) { setError(e?.message || "La modification n'a pas pu être enregistrée."); return false; }
    finally { setBusy(false); }
  };
  // Primaire : le contact partagé devient principal (le serveur retire l'ancien) ; une valeur venue du seul board
  // devient d'abord un contact partagé.
  const makePrimary = (entry) => {
    onLocal({ primary: entry.value });
    return run(async () => {
      let id = entry.id;
      if (!id) id = (await apiClient.post("/api/v1/optilex/contacts", { numero_client: numero, kind, value: entry.value }))?.id;
      if (id) await apiClient.patch(`/api/v1/optilex/contacts/${id}`, { is_primary: true });
    });
  };
  const add = async () => {
    const v = value.trim();
    if (!v || busy) return;
    if (await run(() => apiClient.post("/api/v1/optilex/contacts", { numero_client: numero, kind, value: v }))) {
      onLocal({ added: v });
      setValue("");
    }
  };
  const others = entries.length - 1;
  return (
    <span ref={ref} className="bcl-anchor">
      <button type="button" className="bcl-more" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        title={kind === "email" ? "Tous les e-mails du client" : "Tous les numéros du client"}>
        {others > 0 ? `+${others}` : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="dialog" aria-label={kind === "email" ? "E-mails du client" : "Téléphones du client"} className="bcl-pop"
            initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}>
            <div className="bcl-pop-title">{kind === "email" ? "E-mails" : "Téléphones"}</div>
            <ul className="bcl-list">
              {entries.map((e) => (
                <motion.li key={e.value} layout="position" transition={{ type: "spring", stiffness: 500, damping: 36 }}>
                  <RankTag entry={e} />
                  <span className="bcl-val">{e.value}</span>
                  {displayed && e.value.toLowerCase() === String(displayed).toLowerCase() && <span className="bcl-first">affiché</span>}
                  {editable && !e.primary && (
                    <button type="button" className="bcl-star" disabled={busy} onClick={() => makePrimary(e)} title="Mettre en primaire" aria-label={`Mettre ${e.value} en primaire`}>{STAR}</button>
                  )}
                </motion.li>
              ))}
              {!entries.length && <li className="bcl-none">Aucun pour le moment</li>}
            </ul>
            {editable && (
              <div className="bcl-add">
                <input value={value} onChange={(e) => setValue(e.target.value)} type={kind === "email" ? "email" : "tel"}
                  placeholder={kind === "email" ? "Ajouter un e-mail" : "Ajouter un numéro"}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
                <button type="button" className="bcl-go" disabled={!value.trim() || busy} onClick={add}>{busy ? "…" : "Ajouter"}</button>
              </div>
            )}
            {error && <p role="alert" className="bcl-error">{error}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

// Les contacts d'un type tels qu'affichés : ceux de la fiche, plus les changements faits ici (un contact ajouté,
// une nouvelle primaire), gardés jusqu'au changement de client : un rechargement qui arrive avant l'écriture ne les
// efface pas, et une fois écrits ils se confondent avec ceux du serveur.
export function useContactEntries(kind, numero, boardValue, shared) {
  const [local, setLocal] = useState({ added: [], primary: null });
  useEffect(() => { setLocal({ added: [], primary: null }); }, [numero]);
  let merged = [...(shared || []), ...local.added.filter((v) => !(shared || []).some((c) => c.value === v)).map((v) => ({ value: v, id: null }))];
  if (local.primary) {
    const known = merged.some((c) => c.value === local.primary);
    merged = [...(known ? [] : [{ value: local.primary, id: null }]), ...merged].map((c) => ({ ...c, is_primary: c.value === local.primary }));
  }
  return [contactEntries(kind, boardValue, merged), (change) => setLocal((prev) => ({
    added: change.added ? [...prev.added.filter((v) => v !== change.added), change.added] : prev.added,
    primary: change.primary ?? prev.primary,
  }))];
}
