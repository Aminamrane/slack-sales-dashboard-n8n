import { TYPES, PERIODS, dateObject, daysLabel } from "./absenceDates";
import { countDays, daySlots, teamLabel } from "./absenceOverview";
import { PersonAvatar } from "./AbsenceVisuals";

export default function AbsencePlanning({
  rows,
  days,
  today,
  selectedDay,
  onDay,
  onPerson,
}) {
  const people = [
    ...new Map(
      rows.filter((r) => r.kind === "absence").map((r) => [r.user_id, r]),
    ).values(),
  ].sort((a, b) => a.full_name.localeCompare(b.full_name, "fr"));
  return (
    <section className="hr-planning">
      <div className="hr-section-heading">
        <div>
          <h2>Qui est absent, et quand ?</h2>
          <p>
            Une ligne par personne. Cliquez sur une date pour voir le détail.
          </p>
        </div>
        <div className="hr-legend">
          {Object.entries(TYPES).map(([type, label]) => (
            <span key={type}>
              <i data-type={type} />
              {label}
            </span>
          ))}
        </div>
      </div>
      {!people.length ? (
        <div className="abs-empty">Aucune absence sur cette période.</div>
      ) : (
        <div
          className="hr-planning-scroll"
          tabIndex={0}
          aria-label="Planning des absences, défilement horizontal"
        >
          <table className="hr-planning-table">
            <thead>
              <tr>
                <th scope="col">Collaborateur</th>
                {days.map((day) => (
                  <th
                    scope="col"
                    key={day}
                    data-today={day === today}
                    data-weekend={[0, 6].includes(dateObject(day).getUTCDay())}
                  >
                    <button
                      onClick={() => onDay(day)}
                      aria-pressed={selectedDay === day}
                      aria-label={"Afficher les absences du " + day}
                    >
                      <span>
                        {dateObject(day).toLocaleDateString("fr-FR", {
                          weekday: "narrow",
                          timeZone: "UTC",
                        })}
                      </span>
                      <strong>{Number(day.slice(-2))}</strong>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((person) => {
                const own = rows.filter((r) => r.user_id === person.user_id);
                return (
                  <tr key={person.user_id}>
                    <th scope="row">
                      <button
                        className="hr-planning-person"
                        onClick={() => onPerson(person)}
                      >
                        <PersonAvatar person={person} small />
                        <span>
                          <strong>{person.full_name}</strong>
                          <small>
                            {teamLabel(person.role)} ·{" "}
                            {daysLabel(countDays(own, days[0], days.at(-1)))}
                          </small>
                        </span>
                      </button>
                    </th>
                    {days.map((day) => {
                      const slots = daySlots(own, day);
                      const label = ["am", "pm"]
                        .filter((p) => slots[p])
                        .map(
                          (p) =>
                            PERIODS[p] + " : " + TYPES[slots[p].absence_type],
                        )
                        .join(" · ");
                      return (
                        <td
                          key={day}
                          data-today={day === today}
                          data-weekend={[0, 6].includes(
                            dateObject(day).getUTCDay(),
                          )}
                        >
                          {label ? (
                            <button
                              className="hr-day-block"
                              onClick={() => onDay(day)}
                              title={
                                person.full_name + " — " + day + " — " + label
                              }
                              aria-label={
                                person.full_name + " — " + day + " — " + label
                              }
                            >
                              <span data-type={slots.am?.absence_type || ""} />
                              <span data-type={slots.pm?.absence_type || ""} />
                            </button>
                          ) : (
                            <span
                              className="hr-day-empty"
                              aria-label="Aucune absence"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!!people.length && (
        <div className="hr-half-legend">
          <span>
            <i className="hr-half-sample" /> Moitié haute : matin
          </span>
          <span>
            <i className="hr-half-sample hr-half-bottom" /> Moitié basse :
            après-midi
          </span>
        </div>
      )}
    </section>
  );
}
