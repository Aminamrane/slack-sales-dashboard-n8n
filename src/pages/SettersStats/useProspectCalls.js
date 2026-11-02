// Les appels Allo d'un setter, par prospect de ses RDV (une lecture par fiche ouverte) : GET /api/v1/ceo-dashboard/setters/{id}/prospect-calls.
import { useEffect, useState } from "react";
import apiClient from "../../services/apiClient";
import { prospectCallsPath } from "./setterCalls.js";

// Les appels du setter (une lecture par fiche ouverte). Toute erreur (route absente, accès refusé, réseau) = « indisponible » :
// l'écran existant reste tel quel, sans bandeau d'erreur.
export default function useProspectCalls(setterId) {
  const [calls, setCalls] = useState({ id: null, state: "loading", data: null });
  useEffect(() => {
    let alive = true;
    apiClient.get(prospectCallsPath(setterId))
      .then((data) => { if (alive) setCalls({ id: setterId, state: "ready", data }); })
      .catch(() => { if (alive) setCalls({ id: setterId, state: "unavailable", data: null }); });
    return () => { alive = false; };
  }, [setterId]);
  // Une fiche qui vient de s'ouvrir sur un autre setter ne montre jamais les appels du précédent.
  return calls.id === setterId ? calls : { id: setterId, state: "loading", data: null };
}
