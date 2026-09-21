import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, ShieldCheck, RefreshCw } from "lucide-react";
import apiClient from "../../services/apiClient";
import { AbsenceDialog, AbsenceForm, StatusBadge } from "./AbsencePanel";
import {
  TYPES,
  PERIODS,
  STATUSES,
  todayParis,
  nextDay,
  dateObject,
  rangeLabel,
  daysLabel,
  periodOnDay,
  duration,
} from "./absenceDates";
import "./absences.css";

export default function LeaveManagement({ dark = false }) {
  const [month, setMonth] = useState(todayParis().slice(0, 7));
  const [rows, setRows] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [team, setTeam] = useState("all");
  const [revision, setRevision] = useState(0),
    [dialog, setDialog] = useState(false),
    [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(""),
    [rejecting, setRejecting] = useState(""),
    [reason, setReason] = useState("");
  const self = apiClient.getUser();
  const start = `${month}-01`;
  const end = useMemo(() => {
    const d = dateObject(start);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12))
      .toISOString()
      .slice(0, 10);
  }, [start]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    apiClient
      .get(`/api/v1/absence-management?start=${start}&end=${end}`)
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [start, end, revision]);
  const refresh = () => setRevision((r) => r + 1);
  const filtered = rows.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      (team !== "finance" ||
        ["finance_team", "finance_director"].includes(r.role)) &&
      `${r.full_name} ${r.email}`
        .toLocaleLowerCase("fr")
        .includes(search.toLocaleLowerCase("fr")),
  );
  const effective = filtered.filter((r) => r.kind === "absence");
  const days = [];
  for (let day = start; day <= end; day = nextDay(day)) days.push(day);
  const today = todayParis();
  const current = effective.filter(
    (r) => r.start_date <= today && r.end_date >= today,
  );
  const totals = new Map();
  // Count AM+PM once; duplicate historical entries cannot inflate the summary.
  for (const row of effective) {
    const key = row.user_id;
    if (!totals.has(key))
      totals.set(key, { rows: [], working: row.working_days });
    totals.get(key).rows.push(row);
  }
  let absenceTotal = 0;
  for (const entry of totals.values())
    for (const day of days) {
      const period = periodOnDay(entry.rows, day);
      if (period)
        absenceTotal += duration(
          { start_date: day, end_date: day, period },
          entry.working,
        );
    }
  const act = async (row, action) => {
    if (
      action === "delete" &&
      !window.confirm(
        `Supprimer l’absence de ${row.full_name} ? Cette période sera à nouveau disponible.`,
      )
    )
      return;
    setBusy(row.id);
    setError("");
    try {
      if (row.kind === "request")
        await apiClient.post(`/api/v1/absence-requests/${row.id}/${action}`, {
          comment: action === "reject" ? reason : "",
        });
      else if (action === "delete")
        await apiClient.delete(
          `/api/v1/users/${row.user_id}/unavailability/${row.id}`,
        );
      else
        await apiClient.post(
          `/api/v1/users/${row.user_id}/unavailability/${row.id}/validate`,
          {},
        );
      setRejecting("");
      setReason("");
      refresh();
    } catch (e) {
      setError(e.message || "Action impossible.");
    } finally {
      setBusy("");
    }
  };
  return (
    <main className={`abs-ui abs-dashboard ${dark ? "abs-dark" : ""}`}>
      <header className="abs-heading">
        <span className="abs-icon">
          <CalendarDays size={27} />
        </span>
        <div>
          <h1>Congés & absences</h1>
          <p>Anticiper les départs, accompagner les équipes.</p>
        </div>
        <button
          className="abs-button abs-primary"
          onClick={() => setDialog(true)}
        >
          <Plus size={15} style={{ verticalAlign: "middle", marginRight: 7 }} />
          Déclarer une absence
        </button>
      </header>
      <div className="abs-notice">
        <ShieldCheck size={19} />
        <div>
          <strong>Finance · des périodes protégées</strong>
          <p>
            Congés vacances exclus du 1er au 5 et les 5 derniers jours du mois.
            Les demandes exceptionnelles restent sans effet jusqu’à validation
            direction/RH. Une demi-journée compte pour 0,5 jour.
          </p>
        </div>
      </div>
      <div className="abs-toolbar">
        <label>
          Rechercher
          <input
            type="search"
            placeholder="Nom ou email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Mois
          <input
            type="month"
            required
            value={month}
            onChange={(e) => {
              if (/^\d{4}-\d{2}$/.test(e.target.value))
                setMonth(e.target.value);
            }}
          />
        </label>
        <label>
          Statut
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Tous les statuts</option>
            {Object.entries(STATUSES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Équipe
          <select value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="all">Toutes les équipes</option>
            <option value="finance">Finance</option>
          </select>
        </label>
        <button
          className="abs-icon-button"
          onClick={refresh}
          aria-label="Actualiser"
          disabled={loading}
        >
          <RefreshCw size={19} />
        </button>
      </div>
      {error && (
        <div className="abs-error" role="alert">
          {error}
        </div>
      )}
      <div className="abs-kpis">
        {[
          [
            "À examiner",
            filtered.filter((r) => r.status === "pending").length,
            "Demandes exceptionnelles en attente",
          ],
          [
            "Jours d’absence",
            daysLabel(absenceTotal),
            "Sur le mois et les jours de travail déclarés",
          ],
          [
            "Personnes concernées",
            new Set(effective.map((r) => r.user_id)).size,
            "Absences effectives sur la période",
          ],
          [
            "Absents aujourd’hui",
            new Set(current.map((r) => r.user_id)).size,
            "Inclut les demi-journées · filtres appliqués",
          ],
        ].map(([label, value, sub]) => (
          <div className="abs-kpi" key={label}>
            <span>{label}</span>
            <strong>{loading ? "—" : value}</strong>
            <small>{sub}</small>
          </div>
        ))}
      </div>
      <section className="abs-calendar">
        <div className="abs-calendar-title">
          <strong>Vue du mois</strong>
          <span>Personnes absentes par date · hors demandes en attente</span>
        </div>
        <div
          className="abs-calendar-grid"
          style={{
            gridTemplateColumns: `repeat(${days.length},minmax(22px,1fr))`,
          }}
        >
          {days.map((day) => {
            const people = [
              ...new Set(
                effective
                  .filter((r) => r.start_date <= day && r.end_date >= day)
                  .map((r) => r.user_id),
              ),
            ];
            return (
              <div
                className="abs-calendar-day"
                key={day}
                data-active={people.length > 0}
                data-today={day === today}
                data-weekend={[0, 6].includes(dateObject(day).getUTCDay())}
                title={`${day} : ${people.length} personne(s), demi-journées comprises`}
              >
                <span>{Number(day.slice(-2))}</span>
                <strong>{people.length || "·"}</strong>
              </div>
            );
          })}
        </div>
      </section>
      {loading ? (
        <div className="abs-empty" role="status">
          Chargement de la période…
        </div>
      ) : (
        <section className="abs-table-list" aria-label="Demandes et absences">
          {filtered.length === 0 && (
            <div className="abs-empty">
              Aucune absence ne correspond aux filtres.
            </div>
          )}
          {[...filtered]
            .sort(
              (a, b) =>
                (a.status === "pending" ? 0 : 1) -
                  (b.status === "pending" ? 0 : 1) ||
                a.start_date.localeCompare(b.start_date),
            )
            .map((row) => (
              <article className="abs-row" key={row.id}>
                <div className="abs-row-main">
                  <strong className="abs-person">
                    {row.full_name}{" "}
                    {["finance_team", "finance_director"].includes(
                      row.role,
                    ) && <span className="abs-status">Finance</span>}
                  </strong>
                  <div className="abs-row-title">
                    <strong>{rangeLabel(row)}</strong>
                    <StatusBadge status={row.status} />
                  </div>
                  <span>
                    {TYPES[row.absence_type]} · {PERIODS[row.period]} ·{" "}
                    {daysLabel(row.days)} sur le mois
                  </span>
                  {row.description && <p>{row.description}</p>}
                  {row.review_comment && (
                    <p>
                      <strong>Motif du refus :</strong> {row.review_comment}
                    </p>
                  )}
                  {rejecting === row.id && (
                    <form
                      className="abs-review-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        act(row, "reject");
                      }}
                    >
                      <label>
                        Motif du refus
                        <input
                          required
                          value={reason}
                          maxLength={2000}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </label>
                      <button className="abs-button" disabled={!!busy}>
                        Confirmer le refus
                      </button>
                      <button
                        className="abs-button"
                        type="button"
                        onClick={() => setRejecting("")}
                      >
                        Annuler
                      </button>
                    </form>
                  )}
                  {editing?.id === row.id && (
                    <AbsenceForm
                      userId={row.user_id}
                      initial={row}
                      onCancel={() => setEditing(null)}
                      onSaved={() => {
                        setEditing(null);
                        refresh();
                      }}
                    />
                  )}
                </div>
                <div className="abs-review">
                  {row.status === "pending" && row.user_id !== self?.id && (
                    <>
                      <button
                        className="abs-button abs-primary"
                        disabled={!!busy}
                        onClick={() => act(row, "approve")}
                      >
                        Valider
                      </button>
                      <button
                        className="abs-button"
                        disabled={!!busy}
                        onClick={() => {
                          setRejecting(row.id);
                          setReason("");
                        }}
                      >
                        Refuser
                      </button>
                    </>
                  )}
                  {row.status === "pending" && row.user_id === self?.id && (
                    <span className="abs-footnote">
                      Validation par un autre responsable
                    </span>
                  )}
                  {row.kind === "absence" && (
                    <>
                      {row.status === "declared" && (
                        <button
                          className="abs-button"
                          disabled={!!busy}
                          onClick={() => act(row, "validate")}
                        >
                          Valider
                        </button>
                      )}
                      <button
                        className="abs-button"
                        disabled={!!busy}
                        onClick={() => setEditing(row)}
                      >
                        Modifier
                      </button>
                      <button
                        className="abs-button"
                        disabled={!!busy}
                        onClick={() => act(row, "delete")}
                      >
                        Supprimer
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
        </section>
      )}
      <p className="abs-footnote">
        Décomptes indicatifs selon les jours de travail déclarés ; les jours
        fériés ne sont pas automatiquement exclus. Les absences déjà déclarées
        restent effectives, même sans visa RH.
      </p>
      {dialog && (
        <AbsenceDialog
          dark={dark}
          onClose={() => setDialog(false)}
          onChanged={refresh}
        />
      )}
    </main>
  );
}
