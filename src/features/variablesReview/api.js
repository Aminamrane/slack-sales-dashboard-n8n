import apiClient from "../../services/apiClient";

// Poste de travail Variables : données CRM lues en direct + brouillon partagé.
const WORKBENCH = "/api/v1/variables/workbench";

// → { source, draft }
export const loadWorkbench = () => apiClient.get(WORKBENCH);

// body : { expected_revision, changes, settings, audit_item } → { draft }
// 409 { detail: "stale_revision" } si quelqu'un a enregistré entre-temps.
export const saveWorkbenchDraft = (body) => apiClient.put(`${WORKBENCH}/draft`, body);

export const isStaleRevision = (error) => error?.status === 409;

// Registre des paies (corps : { expected_revision, … } ; 409 { detail: code } si refusé, rien n'est écrit).
// Clôture d'un mois : statements = closurePayload(…) ; paie versée hors de la page ; décision sur une vente à confirmer.
export const closePayrollMonth = (month, body) => apiClient.post(`${WORKBENCH}/months/${month}/close`, body);
export const markPayrollOutside = (month, body) => apiClient.post(`${WORKBENCH}/months/${month}/outside`, body);
export const decideHeldSale = (leadId, body) => apiClient.post(`${WORKBENCH}/held/${leadId}`, body);
