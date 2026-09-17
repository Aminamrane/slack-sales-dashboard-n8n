import { Navigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import { canSeeIntegrationPreview } from "../components/integrationPreview/model";

// Keep earlier shared links useful: the form now lives in the actual Sales sheet.
export default function OwnerIntegrationPreview() {
  return <Navigate replace to={canSeeIntegrationPreview(apiClient.getUser()) ? "/tracking-sheet" : "/"} />;
}
