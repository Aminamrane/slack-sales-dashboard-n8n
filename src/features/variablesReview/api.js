import apiClient from "../../services/apiClient";

// Poste de travail Variables : données CRM lues en direct + brouillon partagé.
const WORKBENCH = "/api/v1/variables/workbench";

// → { source, draft }
export const loadWorkbench = () => apiClient.get(WORKBENCH);

// body : { expected_revision, changes, settings, audit_item } → { draft }
// 409 { detail: "stale_revision" } si quelqu'un a enregistré entre-temps.
export const saveWorkbenchDraft = (body) => apiClient.put(`${WORKBENCH}/draft`, body);

// Paliers (dev 28/10/2026) : body { expected_revision, user_id (absent = généraux), from_month, tiers, audit_item }
// → { revision }. 409 { detail: "stale_revision" | "month_paid" }.
export const saveTierRule = (body) => apiClient.put(`${WORKBENCH}/tiers`, body);

export const isStaleRevision = (error) => error?.status === 409 && error?.data?.detail !== "month_paid";
