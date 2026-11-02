// Écoute à la demande d'un appel de setter (page CEO « Setters ») : tout le fonctionnement, sans rien dessiner (l'icône et la barre de position
// sont dans CallListen.jsx). Rien n'est téléchargé tant qu'on n'a pas cliqué : le fichier passe par la route authentifiée
// GET /ceo-dashboard/setters/{id}/prospect-calls/{appel}/recording (le jeton ne peut pas être joint à un <audio src>), est lu en blob, puis l'écoute
// démarre : le clic EST la demande d'écoute (jamais de lecture au chargement de la page ni à l'ouverture d'un panneau). Une seule écoute à la fois ;
// tout est abandonné et libéré dès que la ligne disparaît (fermeture du panneau, autre prospect, autre setter).
import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "../../services/apiClient";

const NOT_AVAILABLE = "Cet enregistrement n’est pas disponible.";
const FORMAT_ERROR = "Lecture audio impossible : format non pris en charge ou fichier incomplet.";

const recordingPath = (setterId, callId) => `/api/v1/ceo-dashboard/setters/${encodeURIComponent(setterId)}/prospect-calls/${encodeURIComponent(callId)}/recording`;

// Une seule écoute à la fois : lancer un appel met en pause celui qui jouait.
let current = null;
const claim = (handle) => { if (current && current !== handle) current.pause(); current = handle; };
export function stopListening() { current?.pause(); current = null; }

const IDLE = { status: "idle", error: "", playing: false, time: 0, duration: 0 };

export default function useCallAudio(setterId, callId) {
  const [view, setView] = useState(IDLE);
  const own = useRef({ alive: true, url: "", controller: null, audio: null, handle: null });
  if (!own.current.handle) own.current.handle = { pause: () => own.current.audio?.pause() };

  useEffect(() => {
    const o = own.current;
    o.alive = true;
    return () => {
      o.alive = false;
      o.controller?.abort();
      o.audio?.pause();
      if (o.url) URL.revokeObjectURL(o.url);
      if (current === o.handle) current = null;
    };
  }, []);

  const load = useCallback(async () => {
    const o = own.current;
    o.controller?.abort();
    o.controller = new AbortController();
    setView({ ...IDLE, status: "loading" });
    try {
      const options = { signal: o.controller.signal, cache: "no-store" };
      const response = await apiClient._authenticatedFetch(`${apiClient.baseUrl}${recordingPath(setterId, callId)}`, options);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(response.status === 404 ? NOT_AVAILABLE : response.status === 403 ? "Accès à cet enregistrement refusé." : body.detail || "Enregistrement indisponible.");
      }
      const blob = await response.blob();
      if (!o.alive) return;
      if (o.url) URL.revokeObjectURL(o.url);
      o.url = URL.createObjectURL(blob);
      const audio = new Audio();
      audio.preload = "metadata";
      const live = () => o.alive && o.audio === audio;
      const measure = () => live() && setView((v) => ({ ...v, duration: Number.isFinite(audio.duration) ? audio.duration : 0 }));
      audio.addEventListener("loadedmetadata", measure);
      audio.addEventListener("durationchange", measure);
      audio.addEventListener("timeupdate", () => live() && setView((v) => ({ ...v, time: audio.currentTime })));
      audio.addEventListener("play", () => live() && setView((v) => ({ ...v, playing: true })));
      audio.addEventListener("pause", () => live() && setView((v) => ({ ...v, playing: false })));
      audio.addEventListener("ended", () => {
        if (!live()) return;
        audio.currentTime = 0;
        setView((v) => ({ ...v, playing: false, time: 0 }));
      });
      audio.addEventListener("error", () => {
        if (!live()) return;
        o.audio = null;
        URL.revokeObjectURL(o.url);
        o.url = "";
        setView({ ...IDLE, status: "error", error: FORMAT_ERROR });
      });
      o.audio = audio;
      audio.src = o.url;
      setView({ ...IDLE, status: "ready" });
      claim(o.handle);
      audio.play().catch(() => {});                                  // si le navigateur refuse la lecture, le lecteur reste simplement en pause
    } catch (error) {
      if (own.current.alive && error.name !== "AbortError") {
        setView({ ...IDLE, status: "error", error: error.message === "Failed to fetch" ? "Le serveur ne répond pas." : error.message });
      }
    }
  }, [setterId, callId]);

  const toggle = useCallback(() => {
    const o = own.current;
    if (view.status === "ready" && o.audio) {
      if (o.audio.paused) { claim(o.handle); o.audio.play().catch(() => {}); } else o.audio.pause();
    } else if (view.status !== "loading") {
      load();
    }
  }, [view.status, load]);

  const seek = useCallback((seconds) => {
    const audio = own.current.audio;
    if (!audio || !Number.isFinite(seconds)) return;
    audio.currentTime = seconds;
    setView((v) => ({ ...v, time: seconds }));
  }, []);

  return { ...view, toggle, seek };
}
