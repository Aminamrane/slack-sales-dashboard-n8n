// Réactions emoji des échanges du board (dev 29/10/2026, réf. de carte de commentaire : « they should be able to
// react, with emojis »). Une pastille par emoji avec son compteur ; la sienne est surlignée ; le survol dit qui a
// réagi. Le bouton « ajouter » ouvre une palette de 8 emojis, la même liste que celle acceptée par l'API.
import { useEffect, useRef, useState } from "react";
// eslint-disable-next-line no-unused-vars -- motion utilisé via JSX (faux positif)
import { AnimatePresence, motion } from "framer-motion";
import "./BoardReactions.css";

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "🙏", "✅", "🔥"];

const SMILE_PLUS = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.9 13.2A9 9 0 1 1 10.8 3.1" />
    <path d="M8 14.5s1.4 2 4 2 4-2 4-2" />
    <path d="M9 9.5h.01M15 9.5h.01" strokeWidth="2.6" />
    <path className="br-plus" d="M19 2v6M16 5h6" />
  </svg>
);
const who = (names = []) => (names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} et ${names.length - 3} autre${names.length - 3 > 1 ? "s" : ""}`);

// Palette : s'ouvre au-dessus du bouton, se ferme au clic dehors ou sur Échap. `onPick(emoji)`.
export function EmojiPalette({ onPick, label = "Ajouter une réaction", className = "br-add", children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key, true); };
  }, [open]);
  return (
    <span ref={ref} className="br-anchor">
      <button type="button" className={className} aria-label={label} title={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {children || SMILE_PLUS}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" aria-label={label} className="br-pal" initial={{ opacity: 0, y: 6, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96, transition: { duration: 0.1 } }} transition={{ type: "spring", stiffness: 520, damping: 32 }}>
            {REACTION_EMOJIS.map((e, i) => (
              <motion.button key={e} type="button" role="menuitem" className="br-pal-e" aria-label={e}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.02 * i } }}
                onClick={() => { setOpen(false); onPick(e); }}>{e}</motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

// list : [{ emoji, count, mine, names }] ; onToggle(emoji).
export function Reactions({ list = [], onToggle }) {
  return (
    <div className="br">
      <AnimatePresence initial={false}>
        {list.map((r) => (
          <motion.button key={r.emoji} layout type="button" className={`br-pill${r.mine ? " is-mine" : ""}`} aria-pressed={r.mine}
            title={r.names?.length ? `${who(r.names)} ${r.names.length > 1 ? "ont" : "a"} réagi ${r.emoji}` : r.emoji}
            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 600, damping: 30 }} onClick={() => onToggle(r.emoji)}>
            <span className="br-e">{r.emoji}</span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={r.count} className="br-n" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.18 }}>{r.count}</motion.span>
            </AnimatePresence>
          </motion.button>
        ))}
      </AnimatePresence>
      <EmojiPalette onPick={onToggle} />
    </div>
  );
}

// Bascule locale (affichage immédiat avant la réponse du serveur) : ajoute ou retire la réaction de `me`.
export function toggledReactions(list = [], emoji, me) {
  const hit = list.find((r) => r.emoji === emoji);
  if (!hit) return [...list, { emoji, count: 1, mine: true, names: [me] }];
  if (hit.mine) {
    return list.map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, mine: false, names: (r.names || []).filter((n) => n !== me) } : r))
      .filter((r) => r.count > 0);
  }
  return list.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true, names: [...(r.names || []), me] } : r));
}
