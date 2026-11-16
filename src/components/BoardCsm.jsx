// Portefeuille client (dev 13/11/2026) : le CSM attitré d'une fiche du board. `CsmFace` montre sa photo (ligne du
// tableau, fiche, menu Affiner) ; `CsmValue` est la ligne « CSM » des propriétés de la fiche, d'où un CSM se rattache
// le client ou le confie à un collègue. La liste et le droit d'attribuer viennent du serveur (BoardCsmContext).
import { createContext, useContext, useEffect, useRef, useState } from "react";
import apiClient from "../services/apiClient";
import { assignableCsms, initials } from "../utils/boardCsm.js";

export const BoardCsmContext = createContext({ csms: [], byId: {}, canAssign: false });
export const useBoardCsm = () => useContext(BoardCsmContext);

const photoUrl = (u) => (u ? (/^https?:\/\//i.test(u) ? u : apiClient.baseUrl + u) : null);

export function CsmFace({ csm, size = 22, ring = false, title }) {
  const [broken, setBroken] = useState(false);
  const src = !broken ? photoUrl(csm?.avatar_url) : null;
  const style = {
    width: size, height: size, borderRadius: "50%", flexShrink: 0, objectFit: "cover",
    boxShadow: ring ? "0 0 0 2px #fff, 0 0 0 3px #e8e4de" : "inset 0 0 0 1px rgba(28,27,25,.08)",
  };
  const label = title ?? (csm ? `CSM : ${csm.name}` : undefined);
  if (src) return <img src={src} alt="" title={label} style={style} onError={() => setBroken(true)} />;
  return (
    <span title={label} aria-hidden style={{ ...style, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#efedf9", color: "#4a3fc4", fontSize: Math.round(size * 0.4), fontWeight: 600, letterSpacing: "-.02em" }}>
      {initials(csm?.name)}
    </span>
  );
}

export function CsmValue({ row, onAssign }) {
  const { byId, csms, canAssign } = useBoardCsm();
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const me = (apiClient.getUser() || {}).id;
  const current = row.csm_user_id ? byId[row.csm_user_id] : null;
  const choices = assignableCsms(csms);
  const editable = canAssign && !!row.numero_client && choices.length > 0;
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const pick = (id) => { setOpen(false); if (id !== (row.csm_user_id || null)) onAssign(id); };
  const mine = me && choices.some((c) => c.id === me) && row.csm_user_id !== me;
  return (
    <span ref={boxRef} className="ob-pv-line csm-value" style={{ position: "relative", gap: 8 }}>
      {current ? (
        <span className="ob-pv-line" style={{ gap: 7 }}>
          <CsmFace csm={current} size={22} />
          <span className="ob-pv-text" title={current.name}>{current.name}</span>
          {!current.active && <span className="ob-pv-none">· plus CSM</span>}
        </span>
      ) : <span className="ob-pv-none">Aucun</span>}
      {editable && mine && !current && (
        <button type="button" className="ob-prop-edit" onClick={() => pick(me)}>Me l’attribuer</button>
      )}
      {editable && (
        <button type="button" className="ob-prop-edit" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {current ? "Changer" : "Choisir"}
        </button>
      )}
      {open && (
        <div className="csm-pop" role="listbox" aria-label="CSM attitré">
          {choices.map((c) => (
            <button key={c.id} type="button" role="option" aria-selected={c.id === row.csm_user_id}
              className={`csm-opt${c.id === row.csm_user_id ? " is-on" : ""}`} onClick={() => pick(c.id)}>
              <CsmFace csm={c} size={22} title="" />
              <span>{c.name}{c.id === me ? <small> · vous</small> : null}</span>
            </button>
          ))}
          {row.csm_user_id && (
            <button type="button" className="csm-opt is-remove" onClick={() => pick(null)}>Retirer du portefeuille</button>
          )}
        </div>
      )}
    </span>
  );
}

export const CSM_CSS = `
  .ob-prop:has(.csm-pop){position:relative;z-index:31}
  .csm-pop{position:absolute;top:calc(100% + 6px);left:0;z-index:40;min-width:220px;background:#fff;border:1px solid #e8e4de;border-radius:12px;box-shadow:0 14px 34px rgba(28,27,25,.10),0 2px 6px rgba(28,27,25,.04);padding:5px;animation:obMenuIn .15s cubic-bezier(.16,1,.3,1) both}
  .csm-opt{display:flex;align-items:center;gap:9px;width:100%;border:0;background:transparent;border-radius:8px;padding:7px 9px;font:inherit;font-size:12.5px;font-weight:500;color:#1c1b19;text-align:left;cursor:pointer;white-space:nowrap}
  .csm-opt:hover,.csm-opt.is-on{background:#f7f5f2}
  .csm-opt small{font-size:11px;color:#8a857d;font-weight:500}
  .csm-opt.is-remove{color:#c5221f;justify-content:flex-start;margin-top:2px;border-top:1px solid #f0ede8;border-radius:0 0 8px 8px}
`;
