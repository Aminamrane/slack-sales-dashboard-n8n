// src/components/sequenceMail/domIds.js
//
// Identifiants DOM d'un onglet et de son panneau (relation ARIA tab ↔ tabpanel).

const safe = (key) => key.replace(/[^a-zA-Z0-9_-]/g, '_');
export const tabDomId = (key) => `smx-tab-${safe(key)}`;
export const panelDomId = (key) => `smx-panel-${safe(key)}`;

/** @brief Le premier onglet de la fenêtre est la liste des e-mails : son onglet et son panneau. */
export const LIST_TAB_ID = 'smx-tab-list';
export const LIST_PANEL_ID = 'smx-panel-list';
