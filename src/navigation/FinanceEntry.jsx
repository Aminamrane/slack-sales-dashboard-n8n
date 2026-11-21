// /tracking-finance (dev 21/11/2026 : « quand on va en finances, le dashboard change à gauche, et du coup on ne peut plus
// retourner dans le CEO dashboard ») : un rôle qui a la Finance dans son tableau de bord l'ouvre là, sous son menu, avec
// les paramètres du lien (client, onglet, note). La facturation garde la page Finance seule : c'est sa page d'arrivée.
import { Navigate, useLocation } from "react-router-dom";
import apiClient from "../services/apiClient";
import { financeInDashboard } from "./dashboardMenu.jsx";

export default function FinanceEntry({ children }) {
  const { search } = useLocation();
  if (financeInDashboard(apiClient.getUser()?.role)) return <Navigate to={`/ceo/dispatch${search}`} replace />;
  return children;
}
