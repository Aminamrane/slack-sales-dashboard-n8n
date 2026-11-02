// Lecteur d'un appel de setter (page CEO « Setters ») : une pastille visible dès l'ouverture de la carte de l'appel, avec un bouton lecture / pause rond
// (l'icône SVG qui se redessine au survol), la barre de position et le temps « 0:00 / 2:12 ». La durée affichée avant le chargement est celle
// qu'Allo annonce pour l'enregistrement ; elle est remplacée par la durée réelle du fichier une fois chargé. Le fonctionnement (chargement à la
// demande, une seule écoute à la fois, libération) est dans useCallAudio.js.
// États : au repos (play) · chargement (cercle qui tourne) · lecture (pause) · pause (play) · erreur (flèche « réessayer » + la raison dessous).
import { fmtPlayTime } from "./setterCalls.js";

const KEY_STEP = 5;                                                       // secondes de saut avec les flèches de la barre de position

// Tracés à 24 px de côté, trait 2, extrémités rondes (comme la frise de l'historique d'un lead) ; `pathLength` = 1 pour que le tracé puisse se
// redessiner au survol (voir CallsPanel.css).
const GLYPHS = {
  play: ["M8 5v14l11-7z"],
  pause: ["M9 5.5v13", "M15 5.5v13"],
  loading: ["M12 3a9 9 0 1 0 9 9"],
  retry: ["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5"],
  nomic: ["M2 2l20 20", "M18.9 13.2A7.1 7.1 0 0 0 19 12v-2", "M5 10v2a7 7 0 0 0 12 5", "M15 9.3V5a3 3 0 0 0-5.7-1.3", "M9 9v3a3 3 0 0 0 5.1 2.1", "M12 19v3"],
};

function Icon({ kind, size = 16, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {GLYPHS[kind].map((d) => <path key={d} d={d} pathLength="1" />)}
    </svg>
  );
}

// `label` = « du lundi 12 octobre à 14 h 00 » : le nom accessible dit de quel appel il s'agit.
function PlayButton({ audio, label }) {
  const { status, playing, toggle } = audio;
  const kind = status === "loading" ? "loading" : status === "error" ? "retry" : playing ? "pause" : "play";
  const name = status === "error" ? "Réessayer de charger l’enregistrement"
    : status === "loading" ? "Chargement de l’enregistrement…"
      : status === "ready" ? (playing ? "Mettre l’enregistrement en pause" : "Reprendre l’enregistrement")
        : `Écouter l’appel ${label}`;
  const hint = status === "error" ? "Réessayer" : status === "loading" ? "Chargement…" : playing ? "Pause" : status === "ready" ? "Lecture" : "Écouter l’enregistrement";
  return (
    <button type="button" className={`sc-listen${playing ? " is-on" : ""}${status === "error" ? " is-error" : ""}`} onClick={toggle}
      aria-label={name} aria-busy={status === "loading"} title={hint}>
      <Icon kind={kind} className={kind === "loading" ? "sc-spin" : kind === "play" ? "sc-nudge" : undefined} />
    </button>
  );
}

// Le lecteur d'un appel enregistré. `expected` = durée annoncée par Allo (secondes), pour afficher la durée avant le chargement.
export function AudioPlayer({ audio, label, expected }) {
  const { status, error, time, duration, seek } = audio;
  const ready = status === "ready";
  const total = duration || expected || 0;
  const shown = ready ? Math.min(time, duration || 0) : 0;
  return (
    <>
      <div className={`sc-audio${status === "error" ? " is-error" : ""}`}>
        <PlayButton audio={audio} label={label} />
        <input type="range" className="sc-seek" min={0} max={duration || 0} step="any" value={shown} disabled={!ready || !duration}
          onChange={(e) => seek(Number(e.target.value))} aria-label="Position dans l’enregistrement"
          onKeyDown={(e) => {                                                // flèches : ±5 s, comme un lecteur audio
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            seek(Math.min(duration, Math.max(0, time + (e.key === "ArrowRight" ? KEY_STEP : -KEY_STEP))));
          }}
          aria-valuetext={`${fmtPlayTime(shown)} sur ${fmtPlayTime(total)}`}
          style={{ "--p": `${duration ? (100 * shown) / duration : 0}%` }} />
        <span className="sc-time ps2-num">{fmtPlayTime(shown)}{total ? <span className="sc-total"> / {fmtPlayTime(total)}</span> : null}</span>
      </div>
      {status === "error" && <span role="alert" className="sc-error">{error}</span>}
    </>
  );
}

// Un appel sans enregistrement le dit, discrètement, à la place du lecteur.
export function NoRecording() {
  return (
    <span className="sc-none"><Icon kind="nomic" size={14} />Pas d’enregistrement pour cet appel</span>
  );
}
