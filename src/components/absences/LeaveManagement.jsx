import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  History,
  CheckCheck,
  ArrowUpRight,
  X,
  Search,
} from "lucide-react";
import apiClient from "../../services/apiClient";
import { AbsenceDialog, AbsenceForm, StatusBadge } from "./AbsencePanel";
import {
  TYPES,
  PERIODS,
  STATUSES,
  todayParis,
  nextDay,
  dateObject,
  daysLabel,
  duration,
  periodOnDay,
} from "./absenceDates";
import {
  monthLabel,
  monthEnd,
  shiftMonth,
  teamLabel,
  newestFirst,
  isReview,
  isPast,
  countDays,
} from "./absenceOverview";
import { PersonAvatar, MetricIllustration } from "./AbsenceVisuals";
import AbsencePlanning from "./AbsencePlanning";
import "./absences.css";
import "./absenceOverview.css";

const fullDate = (value) =>
  dateObject(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
const createdLabel = (value) =>
  value
    ? new Date(value).toLocaleString("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
      })
    : "";
const rowKey = (row) => row.kind + "-" + row.id;

export default function LeaveManagement({ dark = false }) {
  const today = todayParis();
  const [view, setView] = useState("planning");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [year, setYear] = useState(today.slice(0, 4));
  const [data, setData] = useState({
    rows: [],
    review: [],
    today: [],
    key: "",
  });
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [team, setTeam] = useState("all");
  const [selectedDay, setSelectedDay] = useState("");
  const [revision, setRevision] = useState(0),
    [dialog, setDialog] = useState(false),
    [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(""),
    [rejecting, setRejecting] = useState(""),
    [reason, setReason] = useState("");
  const [reviewExpanded, setReviewExpanded] = useState(false),
    [limit, setLimit] = useState(20);
  const self = apiClient.getUser();
  const start = view === "history" ? year + "-01-01" : month + "-01";
  const end = view === "history" ? year + "-12-31" : monthEnd(month);
  const scopeKey = start + ":" + end;
  const refresh = () => setRevision((r) => r + 1);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const root = "/api/v1/absence-management?start=";
    Promise.all([
      apiClient.get(root + start + "&end=" + end),
      apiClient.get(root + today + "&end=" + today + "&review_only=true"),
      apiClient.get(root + today + "&end=" + today),
    ])
      .then(([rows, review, current]) => {
        if (active)
          setData({
            rows,
            review: review.filter(isReview),
            today: current,
            key: scopeKey,
          });
      })
      .catch((e) => {
        if (active)
          setError(e.message || "Impossible de charger les absences.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [start, end, today, scopeKey, revision]);
  useEffect(() => {
    const update = () => {
      if (!document.hidden) setRevision((r) => r + 1);
    };
    window.addEventListener("focus", update);
    const timer = window.setInterval(update, 60000);
    return () => {
      window.removeEventListener("focus", update);
      window.clearInterval(timer);
    };
  }, []);
  const matchesPerson = (r) =>
    (team === "all" || teamLabel(r.role) === team) &&
    (r.full_name + " " + r.email)
      .toLocaleLowerCase("fr")
      .includes(search.toLocaleLowerCase("fr"));
  const rows = data.key === scopeKey ? data.rows : [];
  const periodRows = rows
    .filter(matchesPerson)
    .filter((r) => view !== "history" || isPast(r, today));
  const effective = periodRows.filter((r) => r.kind === "absence");
  const reviewRows = data.review.filter(matchesPerson).sort(newestFirst);
  const todayRows = data.today
    .filter(matchesPerson)
    .filter((r) => r.kind === "absence");
  const todayPeople = [
    ...new Map(todayRows.map((r) => [r.user_id, r])).values(),
  ];
  const filtered = periodRows
    .filter(
      (r) =>
        (status === "all" || r.status === status) &&
        (!selectedDay ||
          (r.start_date <= selectedDay && r.end_date >= selectedDay)),
    )
    .sort(
      view === "history"
        ? (a, b) => b.end_date.localeCompare(a.end_date) || newestFirst(a, b)
        : newestFirst,
    );
  const days = useMemo(() => {
    const list = [];
    for (let d = month + "-01"; d <= monthEnd(month); d = nextDay(d))
      list.push(d);
    return list;
  }, [month]);
  const periodTitle =
    view === "history" ? "Historique " + year : monthLabel(month);
  const changeView = (next) => {
    setView(next);
    setSelectedDay("");
    setStatus("all");
    setLimit(20);
  };
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

  function renderRow(row, review = false) {
    return (
      <article
        className={"hr-record " + (review ? "hr-record-review" : "")}
        key={rowKey(row)}
      >
        <div className="hr-record-person">
          <PersonAvatar person={row} />
          <div>
            <strong>{row.full_name || row.email}</strong>
            <small>{teamLabel(row.role)}</small>
            <button
              className="hr-text-button"
              onClick={() => {
                setSearch(row.full_name || row.email);
                setYear(
                  String(
                    Math.min(
                      Number(row.end_date.slice(0, 4)),
                      Number(today.slice(0, 4)),
                    ),
                  ),
                );
                changeView("history");
              }}
            >
              Voir l’historique <ArrowUpRight size={12} />
            </button>
          </div>
        </div>
        <div className="hr-record-detail">
          <div className="hr-record-line">
            <span className="hr-type" data-type={row.absence_type}>
              {TYPES[row.absence_type]}
            </span>
            {review ? (
              <span
                className={
                  "abs-status " +
                  (row.kind === "request"
                    ? "abs-status-pending"
                    : "abs-status-declared")
                }
              >
                {row.kind === "request" ? "Approbation requise" : "À viser"}
              </span>
            ) : (
              <StatusBadge status={row.status} />
            )}
            {!review && row.kind === "absence" && isPast(row, today) && (
              <span className="hr-ended">Terminée</span>
            )}
          </div>
          <strong className="hr-record-dates">
            {fullDate(row.start_date)}
            {row.end_date !== row.start_date && " → " + fullDate(row.end_date)}
          </strong>
          <span className="hr-record-meta">
            {PERIODS[row.period || "full"]} ·{" "}
            {daysLabel(duration(row, row.working_days))}
            {row.created_at && " · Déclarée le " + createdLabel(row.created_at)}
          </span>
          {row.description && <p className="hr-comment">{row.description}</p>}
          {row.review_comment && (
            <p className="hr-comment">
              <strong>Motif du refus : </strong>
              {row.review_comment}
            </p>
          )}
          {review && (
            <small className="hr-review-explanation">
              {row.kind === "request"
                ? "Ne prendra effet qu’après approbation."
                : "Absence déjà prise en compte · visa RH attendu."}
            </small>
          )}
          {rejecting === rowKey(row) && (
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
          {editing && rowKey(editing) === rowKey(row) && (
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
        <div className="hr-record-actions">
          {row.kind === "request" &&
            row.status === "pending" &&
            row.user_id !== self?.id && (
              <>
                <button
                  className="abs-button abs-primary"
                  disabled={!!busy || loading}
                  onClick={() => act(row, "approve")}
                >
                  Approuver
                </button>
                <button
                  className="abs-button"
                  disabled={!!busy || loading}
                  onClick={() => {
                    setRejecting(rowKey(row));
                    setReason("");
                  }}
                >
                  Refuser
                </button>
              </>
            )}
          {row.kind === "request" &&
            row.status === "pending" &&
            row.user_id === self?.id && (
              <small>Validation par un autre responsable</small>
            )}
          {row.kind === "absence" && (
            <>
              {row.status === "declared" && (
                <button
                  className="abs-button abs-primary"
                  disabled={!!busy || loading}
                  onClick={() => act(row, "validate")}
                >
                  Valider
                </button>
              )}
              <button
                className="abs-button"
                disabled={!!busy || loading}
                onClick={() => setEditing(row)}
              >
                Modifier
              </button>
              <button
                className="hr-text-button hr-delete"
                disabled={!!busy || loading}
                onClick={() => act(row, "delete")}
              >
                Supprimer
              </button>
            </>
          )}
        </div>
      </article>
    );
  }

  return (
    <main
      className={
        "abs-ui abs-dashboard hr-dashboard " + (dark ? "abs-dark" : "")
      }
    >
      <header className="hr-page-heading">
        <div>
          <span className="hr-eyebrow">RESSOURCES HUMAINES</span>
          <h1>Congés & absences</h1>
          <p>
            Les demandes à traiter, les disponibilités et l’historique de votre
            équipe.
          </p>
        </div>
        <button
          className="abs-button abs-primary"
          onClick={() => setDialog(true)}
        >
          <Plus size={17} /> Déclarer une absence
        </button>
      </header>
      {error && (
        <div className="abs-error" role="alert">
          {error}
          <button className="abs-button" onClick={refresh}>
            Réessayer
          </button>
        </div>
      )}
      <section className="hr-review-section" aria-label="Absences à valider">
        <div className="hr-section-heading">
          <div className="hr-review-heading">
            <span className="hr-review-icon">
              <CheckCheck size={22} />
            </span>
            <div>
              <h2>
                À valider{" "}
                <span className="hr-count">
                  {loading && !data.key ? "—" : reviewRows.length}
                </span>
              </h2>
              <p>Toutes les dates · dernières déclarations en premier</p>
            </div>
          </div>
          {reviewRows.length > 3 && (
            <button
              className="hr-text-button"
              onClick={() => setReviewExpanded(!reviewExpanded)}
            >
              {reviewExpanded
                ? "Réduire"
                : "Voir les " + reviewRows.length + " demandes"}{" "}
              <ArrowUpRight size={15} />
            </button>
          )}
        </div>
        {loading && !data.key ? (
          <div className="abs-empty" role="status">
            Chargement des demandes…
          </div>
        ) : error && !data.key ? (
          <div className="abs-empty">
            Les demandes n’ont pas pu être chargées.
          </div>
        ) : reviewRows.length ? (
          <div className="hr-records">
            {reviewRows
              .slice(0, reviewExpanded ? undefined : 3)
              .map((r) => renderRow(r, true))}
          </div>
        ) : (
          <div className="hr-review-clear">
            <CheckCheck size={19} />
            <span>
              {search || team !== "all"
                ? "Aucune demande à valider pour cette sélection."
                : "Tout est à jour. Aucune déclaration ne reste à valider."}
            </span>
          </div>
        )}
      </section>
      <div className="hr-navigation">
        <div className="hr-tabs" role="group" aria-label="Vue des absences">
          <button
            aria-pressed={view === "planning"}
            onClick={() => changeView("planning")}
          >
            <CalendarDays size={17} /> Planning du mois
          </button>
          <button
            aria-pressed={view === "history"}
            onClick={() => changeView("history")}
          >
            <History size={17} /> Historique des absences
          </button>
        </div>
        <div className="hr-period-picker">
          <button
            className="abs-icon-button"
            aria-label={
              view === "history" ? "Année précédente" : "Mois précédent"
            }
            onClick={() => {
              view === "history"
                ? setYear(String(Number(year) - 1))
                : setMonth(shiftMonth(month, -1));
              setSelectedDay("");
              setLimit(20);
            }}
          >
            <ChevronLeft size={17} />
          </button>
          {view === "planning" ? (
            <label>
              <span className="abs-sr">Mois affiché</span>
              <input
                type="month"
                required
                value={month}
                onChange={(e) => {
                  if (/^\d{4}-\d{2}$/.test(e.target.value)) {
                    setMonth(e.target.value);
                    setSelectedDay("");
                    setLimit(20);
                  }
                }}
              />
            </label>
          ) : (
            <label>
              <span className="abs-sr">Année de l’historique</span>
              <select
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  setLimit(20);
                }}
              >
                {Array.from(
                  {
                    length:
                      Number(today.slice(0, 4)) -
                      Math.min(2000, Number(year)) +
                      1,
                  },
                  (_, i) => String(Number(today.slice(0, 4)) - i),
                ).map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </label>
          )}
          <button
            className="abs-icon-button"
            disabled={view === "history" && year >= today.slice(0, 4)}
            aria-label={view === "history" ? "Année suivante" : "Mois suivant"}
            onClick={() => {
              view === "history"
                ? setYear(String(Number(year) + 1))
                : setMonth(shiftMonth(month, 1));
              setSelectedDay("");
              setLimit(20);
            }}
          >
            <ChevronRight size={17} />
          </button>
          <button
            className="hr-text-button"
            onClick={() => {
              setMonth(today.slice(0, 7));
              setYear(today.slice(0, 4));
              setSelectedDay("");
            }}
          >
            Aujourd’hui
          </button>
        </div>
      </div>
      <div className="hr-filters">
        <label className="hr-search">
          <span className="abs-sr">Rechercher un collaborateur</span>
          <Search size={17} />
          <input
            type="search"
            placeholder="Rechercher un collaborateur…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(20);
            }}
          />
        </label>
        <label>
          <span className="abs-sr">Équipe</span>
          <select
            value={team}
            onChange={(e) => {
              setTeam(e.target.value);
              setLimit(20);
            }}
          >
            <option value="all">Toutes les équipes</option>
            {["Commercial", "Finance", "RH", "Direction", "Autres équipes"].map(
              (t) => (
                <option key={t}>{t}</option>
              ),
            )}
          </select>
        </label>
        <label>
          <span className="abs-sr">Statut dans la liste</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setLimit(20);
            }}
          >
            <option value="all">Tous les statuts</option>
            {Object.entries(STATUSES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {(search || team !== "all" || status !== "all" || selectedDay) && (
          <button
            className="hr-text-button"
            onClick={() => {
              setSearch("");
              setTeam("all");
              setStatus("all");
              setSelectedDay("");
              setLimit(20);
            }}
          >
            <X size={14} /> Effacer les filtres
          </button>
        )}
        <button
          className="abs-icon-button"
          onClick={refresh}
          aria-label="Actualiser les absences"
          disabled={loading}
        >
          <RefreshCw size={17} className={loading ? "hr-spinning" : ""} />
        </button>
      </div>
      <div className="hr-kpis">
        {[
          ["review", "À valider", reviewRows.length, "Toutes les périodes"],
          [
            "days",
            "Jours d’absence",
            daysLabel(countDays(effective, start, end)),
            periodTitle,
          ],
          [
            "people",
            "Collaborateurs concernés",
            new Set(effective.map((r) => r.user_id)).size,
            periodTitle,
          ],
          ["today", "Absents aujourd’hui", todayPeople.length, fullDate(today)],
        ].map(([type, label, value, subtitle]) => (
          <article className="hr-metric" key={type}>
            <div>
              <span>{label}</span>
              <strong>{loading || error ? "—" : value}</strong>
              <small>{subtitle}</small>
            </div>
            <MetricIllustration type={type} />
          </article>
        ))}
      </div>
      {!loading && !!todayPeople.length && (
        <div className="hr-today-strip">
          <span>Aujourd’hui</span>
          <div>
            {todayPeople.map((person) => (
              <button
                key={person.user_id}
                onClick={() => {
                  setSearch(person.full_name || person.email);
                  setMonth(today.slice(0, 7));
                  changeView("planning");
                }}
              >
                <PersonAvatar person={person} small />
                <strong>{person.full_name}</strong>
                <small>
                  {
                    PERIODS[
                      periodOnDay(
                        todayRows.filter((r) => r.user_id === person.user_id),
                        today,
                      )
                    ]
                  }
                </small>
              </button>
            ))}
          </div>
        </div>
      )}
      {loading ? (
        <div className="abs-empty" role="status">
          Chargement de {periodTitle}…
        </div>
      ) : (
        <>
          {view === "planning" && (
            <AbsencePlanning
              rows={effective}
              days={days}
              today={today}
              selectedDay={selectedDay}
              onDay={(d) => {
                setSelectedDay(selectedDay === d ? "" : d);
                setLimit(20);
              }}
              onPerson={(p) => {
                setSearch(p.full_name || p.email);
                setLimit(20);
              }}
            />
          )}
          <section className="hr-detail-section">
            <div className="hr-section-heading">
              <div>
                <h2>
                  {view === "history"
                    ? "Absences passées"
                    : selectedDay
                      ? "Absences du " + fullDate(selectedDay)
                      : "Détail des absences"}{" "}
                  <span className="hr-count">{filtered.length}</span>
                </h2>
                <p>
                  {view === "history"
                    ? year + " · de la plus récente à la plus ancienne"
                    : periodTitle + " · dernières déclarations en premier"}
                </p>
              </div>
              {selectedDay && (
                <button
                  className="hr-text-button"
                  onClick={() => setSelectedDay("")}
                >
                  <X size={14} /> Revenir au mois complet
                </button>
              )}
            </div>
            {filtered.length ? (
              <div className="hr-records">
                {filtered.slice(0, limit).map((r) => renderRow(r))}
              </div>
            ) : (
              <div className="abs-empty">
                <History size={28} />
                <strong>
                  {view === "history"
                    ? "Aucune absence passée sur cette sélection"
                    : "Aucune absence sur cette sélection"}
                </strong>
                <span>
                  {view === "history"
                    ? "Choisissez une autre année ou retirez les filtres."
                    : "Les nouvelles demandes apparaissent dans « À valider », quelle que soit leur date."}
                </span>
              </div>
            )}
            {filtered.length > limit && (
              <button
                className="abs-button hr-load-more"
                onClick={() => setLimit(limit + 20)}
              >
                Afficher les suivantes ({filtered.length - limit})
              </button>
            )}
          </section>
        </>
      )}
      {dialog && (
        <AbsenceDialog
          dark={dark}
          onClose={() => setDialog(false)}
          onChanged={() => {
            setSearch("");
            setTeam("all");
            setReviewExpanded(true);
            refresh();
          }}
        />
      )}
    </main>
  );
}
