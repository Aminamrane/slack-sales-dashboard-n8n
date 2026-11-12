// Appels du suivi côté Owner d'une mission (`/optilex/automation-board/{id}/followup`) et règles des pièces jointes.
import apiClient from "../../services/apiClient";

const API = "/api/v1/optilex/automation-board";
export const FILE_ACCEPT = ".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx,.doc,.pptx,.csv";
const MAX_FILES = 6;
const MAX_BYTES = 20 * 1024 * 1024;
export const BODY_MAX = 4000;

async function send(path, options) {
  const response = await apiClient._authenticatedFetch(apiClient.baseUrl + path, options);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data.detail === "string" ? data.detail : "L’enregistrement n’a pas abouti. Réessayez.");
  }
  return response;
}

export const followupApi = {
  list: (id) => apiClient.get(`${API}/${id}/followup`),
  async add(id, { kind, body = "", targetKey = "", files = [] }) {
    const form = new FormData();
    form.append("kind", kind); form.append("body", body); form.append("target_key", targetKey || "");
    files.forEach((file) => form.append("files", file));
    return (await send(`${API}/${id}/followup`, { method: "POST", body: form })).json();
  },
  remove: (id, entryId) => apiClient.delete(`${API}/${id}/followup/${entryId}`),
  react: (id, targetKey, emoji) => apiClient.post(`${API}/${id}/followup/reactions`, { target_key: targetKey, emoji }),
  async download(id, file) {
    const blob = await (await send(`${API}/${id}/followup/files/${file.id}`)).blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = file.file_name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  },
};

// Fichiers choisis ou déposés : six au plus, 20 Mo chacun. Rend [fichiers gardés, message s'il y a eu un refus].
export function pickFiles(current, incoming) {
  const list = [...current];
  let refused = "";
  Array.from(incoming || []).forEach((file) => {
    if (list.length >= MAX_FILES) { refused = `${MAX_FILES} pièces jointes au plus.`; return; }
    if (file.size > MAX_BYTES) { refused = `« ${file.name} » dépasse 20 Mo.`; return; }
    list.push({ key: `${file.name}-${file.size}-${file.lastModified}-${list.length}`, file });
  });
  return [list, refused];
}
