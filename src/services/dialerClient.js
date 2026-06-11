// src/services/dialerClient.js
//
// Dedicated client for the "Power Dialer maison" backend (FastAPI, isolated
// container on n8n-vps, reverse-proxied at `https://api.ownertechnology.com/dialer`).
//
// Why a SEPARATE client instead of extending apiClient.js :
//   - apiClient.js is a sacred, widely-used file — we don't touch it.
//   - The dialer lives under a different prefix (`/dialer/*`, NOT `/api/v1/*`)
//     and is a fully isolated service (its own SQLite, no shared data).
//   - It speaks application/x-www-form-urlencoded (FastAPI `Form(...)`) and
//     multipart (CSV upload) — apiClient only sends JSON.
//   - It has no auth of its own ; we deliberately send no bearer token.
//
// Endpoints (mirror the backend in power-dialer/main.py) :
//   GET  /campaigns
//   POST /campaigns                         (form: name, caller_id?)
//   POST /campaigns/{id}/upload-csv         (multipart: file)
//   GET  /campaigns/{id}/next
//   POST /campaigns/{id}/call               (form: item_id)
//   GET  /campaigns/{id}/stats

const API_ROOT = import.meta.env.VITE_API_URL || 'https://api.ownertechnology.com';
const DIALER_BASE = `${API_ROOT}/dialer`;

async function parse(res) {
  const txt = await res.text();
  let body = null;
  try { body = txt ? JSON.parse(txt) : null; } catch { body = { raw: txt }; }
  if (!res.ok) {
    const err = new Error(body?.detail || `Erreur dialer (HTTP ${res.status})`);
    err.status = res.status;
    err.data = body;
    throw err;
  }
  return body;
}

const dialerClient = {
  base: DIALER_BASE,

  /** List all campaigns (newest first — backend orders by id desc). */
  listCampaigns() {
    return fetch(`${DIALER_BASE}/campaigns`).then(parse);
  },

  /** Create a campaign. Returns { id, name, caller_id }. */
  createCampaign(name, callerId = '') {
    const body = new URLSearchParams({ name });
    if (callerId) body.set('caller_id', callerId);
    return fetch(`${DIALER_BASE}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    }).then(parse);
  },

  /** Upload a CSV (first_name,last_name,phone). Returns { inserted }. */
  uploadCsv(campaignId, file) {
    const fd = new FormData();
    fd.append('file', file);
    // No Content-Type header — let the browser set the multipart boundary.
    return fetch(`${DIALER_BASE}/campaigns/${campaignId}/upload-csv`, {
      method: 'POST',
      body: fd,
    }).then(parse);
  },

  /** Next pending fiche. Returns { done, item }. */
  next(campaignId) {
    return fetch(`${DIALER_BASE}/campaigns/${campaignId}/next`).then(parse);
  },

  /**
   * Launch a call for a fiche.
   *   - `confName` set  → conference mode (V2) : the prospect is dialed into
   *     the operator's live conference — she does NOT re-answer.
   *   - `confName` empty → bridge mode (v1) : Twilio rings `agentPhone` first.
   * Returns { sid, dry_run, mode, item }.
   */
  call(campaignId, itemId, agentPhone = '', confName = '') {
    const body = new URLSearchParams({ item_id: String(itemId) });
    if (agentPhone) body.set('agent_phone', agentPhone);
    if (confName) body.set('conf_name', confName);
    return fetch(`${DIALER_BASE}/campaigns/${campaignId}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    }).then(parse);
  },

  // ── continuous line (V2 — persistent conference) ──────────────────────
  /** Open the continuous line : rings the handset once → conference. */
  startSession(opKey, agentPhone) {
    const body = new URLSearchParams({ op_key: opKey, agent_phone: agentPhone });
    return fetch(`${DIALER_BASE}/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    }).then(parse);
  },
  /** Current active continuous-line session for an operator (or {active:false}). */
  activeSession(opKey) {
    return fetch(`${DIALER_BASE}/sessions/active?op_key=${encodeURIComponent(opKey)}`).then(parse);
  },
  /** Close the continuous line (hangs up the operator's handset). */
  endSession(opKey) {
    const body = new URLSearchParams({ op_key: opKey });
    return fetch(`${DIALER_BASE}/sessions/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    }).then(parse);
  },

  /** Really terminate the live Twilio call for a fiche. Returns { ok, item }. */
  hangup(campaignId, itemId) {
    const body = new URLSearchParams({ item_id: String(itemId) });
    return fetch(`${DIALER_BASE}/campaigns/${campaignId}/hangup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    }).then(parse);
  },

  /** Live counters for the DAF dashboard. */
  stats(campaignId) {
    return fetch(`${DIALER_BASE}/campaigns/${campaignId}/stats`).then(parse);
  },

  /** Per-call detail (called fiches, newest first, each with its duration). */
  items(campaignId) {
    return fetch(`${DIALER_BASE}/campaigns/${campaignId}/items`).then(parse);
  },

  /** Read an operator's saved handset number. Returns { op_key, agent_phone }. */
  getOperator(opKey) {
    return fetch(`${DIALER_BASE}/operators/${encodeURIComponent(opKey)}`).then(parse);
  },

  /** Save / update an operator's handset number. */
  saveOperator(opKey, agentPhone) {
    const body = new URLSearchParams({ agent_phone: agentPhone });
    return fetch(`${DIALER_BASE}/operators/${encodeURIComponent(opKey)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    }).then(parse);
  },
};

export default dialerClient;
