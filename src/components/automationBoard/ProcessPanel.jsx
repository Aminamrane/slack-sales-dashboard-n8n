// Fiche d'un process : utilisation du logiciel, classement et avancement, documents, fil des notes.
// Une note ou un classement posé ici est enregistré dans Opti'Lex au nom de la personne connectée.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import apiClient from "../../services/apiClient";
import { countLabel, filterHistory, periodHint, periodLabel, sizeLabel } from "../../utils/automationBoard";
import { ExternalIcon, Pill, Steps, Usage } from "./parts";
import { number } from "./theme";

const API = "/api/v1/optilex/automation-board";
const FILTERS = [["", "Tout"], ["comments", "Notes"], ["decisions", "Décisions"], ["files", "Documents"]];
const NOTE_MAX = 2000;

function Section({ title, aside, children, P }) {
  return (
    <section style={{ padding: "20px 0", borderTop: `1px solid ${P.line}` }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 650, letterSpacing: "0.06em", textTransform: "uppercase", color: P.faint }}>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export default function ProcessPanel({ id, period, frame, onClose, onOpen, onChanged, P, dark }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [note, setNote] = useState("");
  const [noteState, setNoteState] = useState({ busy: false, error: "" });
  const [form, setForm] = useState(null);
  const [formState, setFormState] = useState({ busy: false, error: "", saved: false });
  const closeRef = useRef(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const next = await apiClient.get(`${API}/${id}${period ? `?periode=${period}` : ""}`);
      if (mine !== seq.current) return;
      setData(next);
      setError("");
    } catch (e) {
      if (mine !== seq.current) return;
      setError(e?.status === 404 ? "Ce process n'est plus dans le board." : (e?.message || "Fiche indisponible."));
    }
  }, [id, period]);

  // Changement de process : la fiche repart de zéro (pas de note à moitié écrite posée sur un autre process).
  useEffect(() => {
    setData(null); setError(""); setFilter(""); setNote(""); setForm(null);
    setNoteState({ busy: false, error: "" }); setFormState({ busy: false, error: "", saved: false });
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) load(); }, 60000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const row = data?.row;
  const classifications = frame?.classifications || data?.classifications || [];
  const steps = frame?.steps || data?.steps || [];
  const history = useMemo(() => filterHistory(data?.history, filter), [data, filter]);
  const current = form || (row ? { classification: row.classification, step: row.step, comment: "" } : null);
  const dirty = Boolean(row && form && (form.classification !== row.classification || form.step !== row.step || form.comment.trim()));

  const sendNote = async (e) => {
    e.preventDefault();
    const text = note.trim();
    if (!text || noteState.busy) return;
    setNoteState({ busy: true, error: "" });
    try {
      await apiClient.post(`${API}/${id}/comments`, { text });
      setNote("");
      setNoteState({ busy: false, error: "" });
      await load();
      onChanged();
    } catch (err) {
      setNoteState({ busy: false, error: err?.message || "La note n'a pas été enregistrée." });
    }
  };

  const sendClassification = async (e) => {
    e.preventDefault();
    if (!dirty || formState.busy) return;
    setFormState({ busy: true, error: "", saved: false });
    try {
      await apiClient.post(`${API}/${id}/classification`, { classification: form.classification, step: form.step, comment: form.comment.trim() || null });
      setForm(null);
      setFormState({ busy: false, error: "", saved: true });
      await load();
      onChanged();
    } catch (err) {
      setFormState({ busy: false, error: err?.message || "Le classement n'a pas été enregistré.", saved: false });
      if (err?.status === 409) load();
    }
  };

  const field = {
    width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: `1px solid ${P.line}`,
    background: P.card, color: P.text, fontSize: 13, fontFamily: "inherit", outline: "none",
  };
  const primary = (enabled) => ({
    padding: "8px 14px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
    background: enabled ? P.accent : P.track, color: enabled ? "#fff" : P.faint, cursor: enabled ? "pointer" : "default",
  });

  return (
    <div className="ab-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: "fixed", inset: 0, zIndex: 60, background: dark ? "rgba(0,0,0,0.55)" : "rgba(20,24,36,0.28)", display: "flex", justifyContent: "flex-end",
    }}>
      <aside role="dialog" aria-modal="true" aria-label={row?.name || "Fiche du process"} className="ab-panel" style={{
        width: "min(660px, 100vw)", height: "100%", background: P.page, borderLeft: `1px solid ${P.line}`, overflowY: "auto",
        boxShadow: "-12px 0 40px rgba(0,0,0,0.12)", color: P.text,
      }}>
        <header style={{ position: "sticky", top: 0, zIndex: 2, background: P.page, padding: "18px 28px 16px", borderBottom: `1px solid ${P.line}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: P.faint, marginBottom: 4 }}>
                {data?.parent ? (
                  <button type="button" className="ab-link" onClick={() => onOpen(data.parent.id)} style={{ color: P.accent }}>{data.parent.name}</button>
                ) : row?.isParent ? `Process · ${countLabel(row.members, "mission regroupée", "missions regroupées")}` : "Mission de la nomenclature"}
              </div>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 650, letterSpacing: "-0.01em", lineHeight: 1.3 }}>{row?.name || (error ? "Fiche indisponible" : "Chargement…")}</h2>
            </div>
            <button ref={closeRef} type="button" className="ab-icon" onClick={onClose} aria-label="Fermer la fiche" style={{ color: P.faint }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>
          {row && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 }}>
              <Pill classification={row.classification} classifications={classifications} dark={dark} long />
              <span style={{ fontSize: 12, color: P.faint }}>{row.pole?.label}</span>
              {row.validated && <span style={{ fontSize: 12, fontWeight: 600, color: P.good }}>Validé par la direction</span>}
              {!row.validated && row.toConfirm && <span style={{ fontSize: 12, fontWeight: 600, color: P.warn }}>Classement à confirmer</span>}
              <a href={row.url} target="_blank" rel="noopener noreferrer" className="ab-link" style={{ marginLeft: "auto", color: P.accent, display: "inline-flex", alignItems: "center", gap: 5 }}>
                Ouvrir dans Opti&apos;Lex <ExternalIcon />
              </a>
            </div>
          )}
        </header>

        <div style={{ padding: "4px 28px 40px" }}>
          {error && <p role="alert" style={{ margin: "20px 0", padding: "10px 12px", borderRadius: 8, background: P.soft, color: P.bad, fontSize: 13 }}>{error}</p>}
          {!row && !error && <p style={{ margin: "24px 0", color: P.faint, fontSize: 13 }}>Chargement de la fiche…</p>}

          {row && (
            <>
              <section style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 20, padding: "20px 0" }}>
                <div>
                  <div style={{ fontSize: 12, color: P.faint, marginBottom: 6 }}>Utilisation du logiciel · {periodLabel(data.period).toLowerCase()}</div>
                  <Usage usage={row.usage} P={P} large />
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: P.faint, lineHeight: 1.45 }}>
                    {row.usage ? row.usage.detail : `Aucun module du logiciel ne couvre cette mission : rien à mesurer sur les ${periodHint(data.period)}.`}
                  </p>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: P.faint, marginBottom: 6 }}>Missions réalisées</div>
                  <div style={{ fontSize: 26, fontWeight: 650, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{number(row.total)}</div>
                  <div style={{ fontSize: 12, color: P.faint, marginTop: 6 }}>dont {number(row.recent)} sur 90 jours</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: P.faint, marginBottom: 6 }}>Depuis la messagerie client</div>
                  <div style={{ fontSize: 26, fontWeight: 650, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{number(row.messaging?.total)}</div>
                  <div style={{ fontSize: 12, color: P.faint, marginTop: 6 }}>{row.messaging?.total ? `${row.messaging.share} % des demandes` : "aucune demande"}</div>
                </div>
              </section>

              {data.dates?.length > 0 && (
                <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px 20px", margin: 0, padding: "14px 0", borderTop: `1px solid ${P.line}` }}>
                  {data.dates.map((item) => (
                    <div key={item.label} style={{ minWidth: 0 }}>
                      <dt style={{ fontSize: 12, color: P.faint }}>{item.label}</dt>
                      <dd style={{ margin: "2px 0 0", fontSize: 13.5, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{item.date}</dd>
                      {item.text && <dd title={item.text} style={{ margin: 0, fontSize: 12, color: P.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.text}</dd>}
                    </div>
                  ))}
                </dl>
              )}

              <Section title="Classement et avancement" P={P} aside={row.reviewed && (
                <span style={{ fontSize: 12, color: P.faint }}>Revu par {row.reviewed.by}, le {row.reviewed.at}</span>
              )}>
                <div style={{ marginBottom: 14 }}><Steps value={row.step} steps={steps} P={P} /></div>
                {row.validated ? (
                  <p style={{ margin: 0, padding: "10px 12px", borderRadius: 8, background: P.soft, fontSize: 13, lineHeight: 1.5 }}>
                    <strong style={{ color: P.good }}>Validé par la direction du cabinet</strong> ({row.validated.by}, le {row.validated.at}). Le classement ne change plus. La direction peut lever la validation dans Opti&apos;Lex.
                  </p>
                ) : (
                  <form onSubmit={sendClassification}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <label style={{ fontSize: 12, color: P.faint }}>Classement
                        <select value={current.classification} onChange={(e) => { setForm({ ...current, classification: e.target.value }); setFormState({ busy: false, error: "", saved: false }); }} style={{ ...field, marginTop: 5 }}>
                          {classifications.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                      </label>
                      <label style={{ fontSize: 12, color: P.faint }}>Étape de l&apos;automatisation
                        <select value={current.step} onChange={(e) => { setForm({ ...current, step: Number(e.target.value) }); setFormState({ busy: false, error: "", saved: false }); }} style={{ ...field, marginTop: 5 }}>
                          {steps.map((item) => <option key={item.value} value={item.value}>{item.value}/{steps.length - 1} · {item.label}</option>)}
                        </select>
                      </label>
                    </div>
                    {form && (
                      <input type="text" value={form.comment} maxLength={NOTE_MAX} onChange={(e) => setForm({ ...form, comment: e.target.value })}
                        placeholder="Pourquoi ce changement ? (facultatif)" aria-label="Raison du changement" style={{ ...field, marginTop: 10 }} />
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, minHeight: 34 }}>
                      {form && <button type="submit" disabled={!dirty || formState.busy} style={primary(dirty && !formState.busy)}>{formState.busy ? "Enregistrement…" : "Enregistrer le classement"}</button>}
                      {form && !formState.busy && <button type="button" className="ab-link" onClick={() => { setForm(null); setFormState({ busy: false, error: "", saved: false }); }} style={{ color: P.faint }}>Annuler</button>}
                      {formState.error && <span role="alert" style={{ fontSize: 12.5, color: P.bad }}>{formState.error}</span>}
                      {formState.saved && !form && <span style={{ fontSize: 12.5, color: P.good }}>Classement enregistré dans Opti&apos;Lex.</span>}
                    </div>
                  </form>
                )}
              </Section>

              {(data.software?.length > 0 || data.notes?.length > 0) && (
                <Section title="Dans le logiciel" P={P}>
                  {data.software.map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, alignItems: "baseline", marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 650, padding: "2px 7px", borderRadius: 5, background: P.soft, color: item.usable ? P.text : P.faint, flexShrink: 0 }}>{item.kindLabel}</span>
                      <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                        <div style={{ fontWeight: 600 }}>{item.label}</div>
                        <div style={{ color: P.faint, fontSize: 12.5 }}>{[item.dates, item.usage].filter(Boolean).join(" · ")}</div>
                      </div>
                    </div>
                  ))}
                  {data.notes.map((text, i) => <p key={i} style={{ margin: "6px 0 0", fontSize: 12.5, color: P.faint, lineHeight: 1.5 }}>{text}</p>)}
                </Section>
              )}

              {data.poles?.length > 0 && (
                <Section title="Par pôle" P={P} aside={data.leader && (
                  <span style={{ fontSize: 12, color: P.faint }}>{data.leader.used ? "Le plus utilisateur" : "Le plus demandeur"} : <strong style={{ color: P.text }}>{data.leader.pole}</strong></span>
                )}>
                  {data.poles.map((item) => (
                    <div key={item.pole} style={{ display: "grid", gridTemplateColumns: "150px 90px 1fr", gap: 14, alignItems: "center", padding: "6px 0", fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{item.pole}</span>
                      <span style={{ color: P.faint, fontVariantNumeric: "tabular-nums" }}>{countLabel(item.missions, "mission", "missions")}</span>
                      <Usage usage={item.usage} P={P} />
                    </div>
                  ))}
                </Section>
              )}

              {data.months?.length > 0 && data.monthsMax > 0 && (
                <Section title="Mois par mois" P={P} aside={(
                  <span style={{ fontSize: 12, color: P.faint, display: "inline-flex", gap: 12 }}>
                    <span><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: P.track, marginRight: 5 }} />missions</span>
                    <span><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: P.accent, marginRight: 5 }} />passées par le logiciel</span>
                  </span>
                )}>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.months.length}, 1fr)`, gap: 6, alignItems: "end", height: 96 }}>
                    {data.months.map((month) => (
                      <div key={month.label} title={`${month.label} : ${countLabel(month.missions, "mission", "missions")}, dont ${month.used} par le logiciel`}
                        style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                        <div style={{ position: "relative", height: `${Math.max(month.missions > 0 ? 4 : 0, (month.missions / data.monthsMax) * 100)}%`, background: P.track, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${month.missions > 0 ? (month.used / month.missions) * 100 : 0}%`, background: P.accent }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.months.length}, 1fr)`, gap: 6, marginTop: 6 }}>
                    {data.months.map((month) => <span key={month.label} style={{ fontSize: 10, color: P.faint, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden" }}>{month.label.split(" ")[0]}</span>)}
                  </div>
                </Section>
              )}

              {data.family?.length > 0 && (
                <Section title="Missions du process" P={P}>
                  {data.family.map((item) => (
                    <button key={item.id} type="button" className="ab-row" onClick={() => onOpen(item.id)} style={{
                      display: "grid", gridTemplateColumns: "1fr 90px 190px", gap: 14, alignItems: "center", width: "100%", textAlign: "left",
                      padding: "8px 8px", margin: "0 -8px", borderRadius: 8, border: "none", background: "transparent", color: P.text, fontFamily: "inherit", fontSize: 13, cursor: "pointer",
                    }}>
                      <span style={{ fontWeight: 600 }}>{item.name}</span>
                      <span style={{ color: P.faint, fontVariantNumeric: "tabular-nums" }}>{number(item.missions)}</span>
                      <Usage usage={item.usage} P={P} />
                    </button>
                  ))}
                </Section>
              )}

              <Section title="Cahier des charges et documents" P={P} aside={(
                <a href={row.url} target="_blank" rel="noopener noreferrer" className="ab-link" style={{ color: P.accent, display: "inline-flex", alignItems: "center", gap: 5 }}>
                  Ajouter ou ouvrir dans Opti&apos;Lex <ExternalIcon />
                </a>
              )}>
                {data.attachments?.length > 0 ? data.attachments.map((file, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "6px 0", fontSize: 13 }}>
                    <span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{file.name}</span>
                    <span style={{ color: P.faint, fontSize: 12, flexShrink: 0 }}>{[sizeLabel(file.size), file.by, file.at].filter(Boolean).join(" · ")}</span>
                  </div>
                )) : <p style={{ margin: 0, fontSize: 13, color: P.faint }}>Aucun document pour ce process. Le cahier des charges (images, Excel, PDF) se dépose dans Opti&apos;Lex.</p>}
              </Section>

              <Section title="Fil du process" P={P}>
                <form onSubmit={sendNote} style={{ marginBottom: 16 }}>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} rows={3}
                    placeholder="Ajouter une note : comment automatiser ce process, ce qui bloque, ce qui a été décidé…" aria-label="Nouvelle note"
                    style={{ ...field, resize: "vertical", lineHeight: 1.5 }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                    <button type="submit" disabled={!note.trim() || noteState.busy} style={primary(Boolean(note.trim()) && !noteState.busy)}>{noteState.busy ? "Envoi…" : "Ajouter la note"}</button>
                    {noteState.error && <span role="alert" style={{ fontSize: 12.5, color: P.bad }}>{noteState.error}</span>}
                  </div>
                </form>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  {FILTERS.map(([value, label]) => {
                    const count = value ? data.counts?.[value] ?? 0 : null;
                    const active = filter === value;
                    return (
                      <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={active} className="ab-chip" style={{
                        padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
                        border: `1px solid ${active ? P.accent : P.line}`, background: active ? P.accent : "transparent", color: active ? "#fff" : P.faint,
                      }}>{label}{count != null ? ` ${count}` : ""}</button>
                    );
                  })}
                </div>

                {history.length === 0 && <p style={{ margin: 0, fontSize: 13, color: P.faint }}>Rien dans cette vue pour l&apos;instant.</p>}
                {history.map((day) => (
                  <div key={day.day} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 650, color: P.faint, marginBottom: 6 }}>{day.label}</div>
                    {day.items.map((item, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 10, padding: "7px 0", fontSize: 13, lineHeight: 1.5 }}>
                        <span style={{ color: P.faint, fontSize: 12, fontVariantNumeric: "tabular-nums", paddingTop: 1 }}>{item.time}</span>
                        <div style={{ minWidth: 0 }}>
                          <div><span style={{ fontWeight: 600 }}>{item.what}</span>{item.who ? <span style={{ color: P.faint }}> · {item.who}</span> : null}</div>
                          {item.detail && <div style={{ color: P.faint, fontSize: 12.5 }}>{item.detail}</div>}
                          {item.text && <div style={{ marginTop: 3, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.text}</div>}
                          {item.note && <div style={{ marginTop: 3, color: P.faint, fontSize: 12.5 }}>{item.note}</div>}
                          {item.file && (
                            <div style={{ marginTop: 4, fontSize: 12.5, color: item.file.removed ? P.faint : P.text, textDecoration: item.file.removed ? "line-through" : "none" }}>
                              {item.file.name} · {sizeLabel(item.file.size)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </Section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
