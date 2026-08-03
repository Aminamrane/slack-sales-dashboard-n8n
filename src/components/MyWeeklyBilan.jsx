// src/components/MyWeeklyBilan.jsx
//
// Bilan IA hebdo du sales CONNECTÉ, pour l'onglet « Bilan IA » de la tracking sheet.
// Isole tout le fetch/état pour ne rien ajouter au composant TrackingSheet (sacré).
// Appelle l'endpoint self-service /recordings/my-analysis : le backend force le
// scope à l'email du JWT, donc le sales ne voit QUE son propre bilan. Sans période,
// renvoie le dernier disponible (la semaine en cours aujourd'hui, la suivante après
// le prochain passage d'analyse).

import { useEffect, useState } from "react";
import apiClient from "../services/apiClient";
import WeeklyBilanView from "./WeeklyBilanView.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";

export default function MyWeeklyBilan({ name, avatarUrl, team }) {
  const [bilan, setBilan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(false);
    apiClient.getMyAnalysis("sales_weekly")
      .then((r) => { if (alive) setBilan(r?.payload || null); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "60px 24px" }}>
        <style>{`@keyframes mwbSpin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ width: 30, height: 30, borderRadius: "50%", border: "2.5px solid #E1DED5", borderTopColor: "#E8A317", animation: "mwbSpin 0.7s linear infinite" }} />
        <span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 11.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8A9099" }}>Chargement de ton bilan…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center", color: "#4A5259", fontSize: 14 }}>
        Ton bilan n'a pas pu être chargé pour le moment. Réessaie dans un instant.
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <WeeklyBilanView bilan={bilan} salesName={name} avatarUrl={avatarUrl} team={team} />
    </ErrorBoundary>
  );
}
