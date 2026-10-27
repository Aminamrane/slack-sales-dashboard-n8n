import apiClient from "../../services/apiClient";

// Poste de travail Variables : données CRM lues en direct + brouillon partagé.
const WORKBENCH = "/api/v1/variables/workbench";

// → { source, draft }
export const loadWorkbench = () => apiClient.get(WORKBENCH);

// body : { expected_revision, changes, settings, audit_item } → { draft }
// 409 { detail: "stale_revision" } si quelqu'un a enregistré entre-temps.
export const saveWorkbenchDraft = (body) => apiClient.put(`${WORKBENCH}/draft`, body);

export const isStaleRevision = (error) => error?.status === 409;
