import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Clock3,
  X,
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import apiClient from "../../services/apiClient";
import {
  TYPES,
  PERIODS,
  STATUSES,
  todayParis,
  restrictedFinance,
  duration,
  daysLabel,
  rangeLabel,
} from "./absenceDates";
import "./absences.css";

const message = (e) =>
  e?.message || "Impossible de charger les absences. Réessayez.";
export function StatusBadge({ status = "declared" }) {
  return (
    <span className={`abs-status abs-status-${status}`}>
      {STATUSES[status] || status}
    </span>
  );
}

export function AbsenceForm({ userId, initial, onSaved, onCancel }) {
  const id = useId();
  const [policy, setPolicy] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() =>
    initial
      ? {
          ...initial,
          description: initial.description || "",
          exceptional: false,
        }
      : {
          start_date: todayParis(),
          end_date: todayParis(),
          period: "full",
          absence_type: "conge",
          description: "",
          exceptional: false,
        },
  );
  useEffect(() => {
    let active = true;
    setPolicy(null);
    apiClient
      .get(`/api/v1/users/${userId}/absence-policy`)
      .then((p) => {
        if (active) {
          setPolicy(p);
          if (!initial && p.today)
            setForm((f) => ({ ...f, start_date: p.today, end_date: p.today }));
        }
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [userId]);
  const scheduleChanged =
    !initial ||
    ["start_date", "end_date", "period", "absence_type"].some(
      (key) => form[key] !== initial[key],
    );
  const restricted =
    scheduleChanged &&
    policy?.finance &&
    restrictedFinance(form.start_date, form.end_date);
  const vacationBlocked = restricted && form.absence_type === "conge";
  const exceptional = restricted && !vacationBlocked;
  const set = (key, value) =>
    setForm((f) => ({
      ...f,
      [key]: value,
      ...(key === "start_date" && (f.period !== "full" || value > f.end_date)
        ? { end_date: value }
        : {}),
      ...(key === "period" && value !== "full"
        ? { end_date: f.start_date }
        : {}),
    }));
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!policy || saving) return;
    if (form.end_date < form.start_date) {
      setError("La fin doit être après le début.");
      return;
    }
    if (vacationBlocked) {
      setError(
        "Les congés vacances ne sont pas autorisés pendant cette période Finance.",
      );
      return;
    }
    if (exceptional && (!form.exceptional || !form.description.trim())) {
      setError("Confirmez le caractère exceptionnel et renseignez le motif.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        start_date: form.start_date,
        end_date: form.end_date,
        period: form.period,
        absence_type: form.absence_type,
        description: form.description?.trim() || null,
      };
      if (initial)
        await apiClient.patch(
          `/api/v1/users/${userId}/unavailability/${initial.id}`,
          payload,
        );
      else if (exceptional)
        await apiClient.post(`/api/v1/users/${userId}/absence-requests`, {
          ...payload,
          exceptional: true,
        });
      else
        await apiClient.post(`/api/v1/users/${userId}/unavailability`, payload);
      await onSaved(
        exceptional && !initial
          ? "Demande envoyée à la direction/RH. Elle ne sera effective qu’après validation."
          : "Absence enregistrée.",
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form className="abs-form" onSubmit={submit}>
      <div className="abs-section-title">
        <Plus size={17} />{" "}
        {initial ? "Modifier l’absence" : "Déclarer une absence"}
      </div>
      <fieldset disabled={saving || !policy}>
        <legend className="abs-sr">Période et motif de l’absence</legend>
        <div
          className="abs-segments"
          role="group"
          aria-label="Durée de l’absence"
        >
          {Object.entries(PERIODS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={form.period === value}
              onClick={() => set("period", value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="abs-form-grid">
          <label htmlFor={`${id}-start`}>
            {form.period === "full" ? "Du" : "Le"}
            <input
              id={`${id}-start`}
              type="date"
              required
              value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)}
            />
          </label>
          {form.period === "full" ? (
            <label htmlFor={`${id}-end`}>
              Au
              <input
                id={`${id}-end`}
                type="date"
                required
                min={form.start_date}
                value={form.end_date}
                onChange={(e) => set("end_date", e.target.value)}
              />
            </label>
          ) : (
            <div className="abs-duration">
              <Clock3 size={17} />
              <strong>0,5 journée</strong>
              <small>
                {form.period === "am" ? "Avant 13 h" : "À partir de 13 h"} ·
                heure de Paris
              </small>
            </div>
          )}
        </div>
        <label htmlFor={`${id}-type`}>
          Type d’absence
          <select
            id={`${id}-type`}
            value={form.absence_type}
            onChange={(e) => set("absence_type", e.target.value)}
          >
            {Object.entries(TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {policy?.finance && (
          <div
            className={`abs-notice ${restricted ? "abs-notice-warning" : ""}`}
          >
            <ShieldCheck size={18} />
            <div>
              <strong>Périodes sensibles Finance</strong>
              <p>
                Du 1er au 5 et les 5 derniers jours du mois : pas de congés
                vacances. Une urgence nécessite un motif et une validation
                direction/RH.
              </p>
            </div>
          </div>
        )}
        {exceptional && (
          <label className="abs-check">
            <input
              type="checkbox"
              checked={form.exceptional}
              onChange={(e) => set("exceptional", e.target.checked)}
              required
            />{" "}
            Je confirme qu’il s’agit d’une demande exceptionnelle, hors
            vacances.
          </label>
        )}
        <label htmlFor={`${id}-description`}>
          {exceptional ? "Motif obligatoire" : "Commentaire (facultatif)"}
          <textarea
            id={`${id}-description`}
            rows={3}
            maxLength={2000}
            required={exceptional}
            value={form.description || ""}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Précisez le contexte utile à l’équipe RH, sans détail médical confidentiel."
          />
        </label>
        <div className="abs-form-footer">
          <span>
            <strong>{daysLabel(duration(form, policy?.working_days))}</strong>{" "}
            selon les jours de travail déclarés
          </span>
          <div>
            {onCancel && (
              <button type="button" className="abs-button" onClick={onCancel}>
                Annuler
              </button>
            )}
            <button
              className="abs-button abs-primary"
              disabled={vacationBlocked || saving}
            >
              {saving
                ? "Enregistrement…"
                : exceptional && !initial
                  ? "Soumettre à validation"
                  : initial
                    ? "Enregistrer"
                    : "Ajouter l’absence"}
            </button>
          </div>
        </div>
      </fieldset>
      {!policy && !error && <p role="status">Chargement des règles…</p>}
      {error && (
        <div className="abs-error" role="alert">
          {error}
        </div>
      )}
    </form>
  );
}

export default function AbsencePanel({
  allowManage = false,
  onChanged,
  dark = false,
}) {
  const self = apiClient.getUser();
  const [users, setUsers] = useState([]);
  const [target, setTarget] = useState(self?.id || "");
  const [rows, setRows] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (allowManage)
      apiClient
        .get("/api/v1/users/manageable")
        .then(setUsers)
        .catch((e) => setError(message(e)));
  }, [allowManage]);
  useEffect(() => {
    let active = true;
    if (!target) return;
    setLoading(true);
    setError("");
    Promise.all([
      apiClient.get(`/api/v1/users/${target}/unavailability`),
      apiClient.get(`/api/v1/users/${target}/absence-requests`),
      apiClient.get(`/api/v1/users/${target}/absence-policy`),
    ])
      .then(([absences, requests, p]) => {
        if (!active) return;
        setRows(
          [
            ...absences.map((a) => ({
              ...a,
              kind: "absence",
              status: a.validated_at ? "approved" : "declared",
            })),
            ...requests
              .filter((r) => r.status !== "approved")
              .map((r) => ({ ...r, kind: "request" })),
          ].sort((a, b) => b.created_at.localeCompare(a.created_at)),
        );
        setPolicy(p);
      })
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [target, revision]);
  const changed = async (text) => {
    setSuccess(text);
    setEditing(null);
    setRevision((r) => r + 1);
    onChanged?.();
  };
  const remove = async (row) => {
    if (
      !window.confirm(
        row.kind === "request"
          ? "Annuler cette demande en attente ?"
          : "Supprimer cette absence ? Cette période sera de nouveau disponible.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      if (row.kind === "request")
        await apiClient.post(`/api/v1/absence-requests/${row.id}/cancel`, {});
      else
        await apiClient.delete(
          `/api/v1/users/${target}/unavailability/${row.id}`,
        );
      await changed("Annulation enregistrée.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={`abs-ui abs-panel ${dark ? "abs-dark" : ""}`}>
      <header className="abs-heading">
        <span className="abs-icon">
          <CalendarDays size={25} />
        </span>
        <div>
          <h2>Mes absences</h2>
          <p>Journées, demi-journées et demandes exceptionnelles.</p>
        </div>
      </header>
      {allowManage && users.length > 1 && (
        <label className="abs-target">
          Pour qui ?
          <select
            disabled={busy}
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setEditing(null);
              setSuccess("");
            }}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.is_self ? "Moi-même" : u.full_name}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <div className="abs-error" role="alert">
          {error}
          <button
            className="abs-button"
            onClick={() => setRevision((r) => r + 1)}
          >
            Réessayer
          </button>
        </div>
      )}
      {success && (
        <div className="abs-success" role="status">
          {success}
        </div>
      )}
      {loading ? (
        <div className="abs-empty" role="status">
          Chargement des absences…
        </div>
      ) : (
        <div className="abs-list">
          {rows.length === 0 ? (
            <div className="abs-empty">
              <CalendarDays size={28} />
              <strong>Aucune absence à venir</strong>
              <span>Planifiez une journée ou une demi-journée ci-dessous.</span>
            </div>
          ) : (
            rows.map((row) => (
              <article key={row.id} className="abs-row">
                <div className="abs-row-main">
                  <div className="abs-row-title">
                    <strong>{rangeLabel(row)}</strong>
                    <StatusBadge status={row.status} />
                  </div>
                  <span>
                    {TYPES[row.absence_type]} · {PERIODS[row.period || "full"]}{" "}
                    · {daysLabel(duration(row, policy?.working_days))}
                  </span>
                  {row.description && <p>{row.description}</p>}
                  {row.review_comment && (
                    <p>
                      <strong>Décision RH :</strong> {row.review_comment}
                    </p>
                  )}
                </div>
                <div className="abs-row-actions">
                  {row.kind === "absence" && (
                    <button
                      className="abs-icon-button"
                      disabled={busy}
                      aria-label={`Modifier l’absence du ${rangeLabel(row)}`}
                      onClick={() => setEditing(row)}
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                  {(row.kind === "absence" || row.status === "pending") && (
                    <button
                      className="abs-icon-button"
                      disabled={busy}
                      aria-label={`Annuler la période du ${rangeLabel(row)}`}
                      onClick={() => remove(row)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      )}
      {target && (
        <AbsenceForm
          key={`${target}-${editing?.id || "new"}-${revision}`}
          userId={target}
          initial={editing}
          onSaved={changed}
          onCancel={editing ? () => setEditing(null) : undefined}
        />
      )}
      <p className="abs-footnote">
        Les demandes Finance en attente ne modifient ni les disponibilités, ni
        le décompte des absences.
      </p>
    </section>
  );
}

export function AbsenceDialog({ onClose, onChanged, dark = false }) {
  const dialog = useRef(null);
  useEffect(() => {
    const prev = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const key = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab") return;
      const focusable = [
        ...dialog.current.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ),
      ].filter(
        (el) => el.getClientRects().length && !el.closest("fieldset[disabled]"),
      );
      const first = focusable[0],
        last = focusable.at(-1);
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      prev?.focus();
    };
  }, [onClose]);
  return createPortal(
    <div
      className={`abs-ui abs-overlay ${dark ? "abs-dark" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="abs-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Mes absences"
        tabIndex={-1}
        ref={dialog}
      >
        <button
          className="abs-dialog-close abs-icon-button"
          onClick={onClose}
          aria-label="Fermer"
        >
          <X />
        </button>
        <AbsencePanel allowManage onChanged={onChanged} dark={dark} />
      </div>
    </div>,
    document.body,
  );
}
