// exportExchanges.js — derniers échanges et marqueurs (tags) d'un client, pour l'export Excel du tableau finance.
//
// Demande de la finance 2026-11-17 : « sur le board, quand j'extrais une liste (ex. Onboarding), avoir en plus
// les derniers commentaires de nos collaborateurs avec la date, et les tags ou mentions qu'on met, du type
// "à ne pas rappeler" ».
//
// Les échanges ne sont PAS dans les lignes du tableau : le panneau « Échanges » (ExchangeThread.jsx) les lit
// client par client, à deux endroits, et l'export lit EXACTEMENT les mêmes :
//   - l'espace commun du board   GET /api/v1/optilex/comments?numero_client=…           (partagé avec le cabinet)
//   - les notes internes finance GET /api/v1/finance-periods/client/{id}/comments       (jamais montrées au cabinet)
// L'autorisation reste celle du serveur : un refus (401/403) d'une source = aucune ligne pour elle, jamais une
// erreur, et la source n'est plus interrogée pour les clients suivants.
//
// Ce module ne touche ni au réseau (la fonction de lecture est injectée) ni au fichier : il se teste seul.

import { formatDateFR } from './constants.js';

/** Nombre d'échanges gardés par client (le plus récent d'abord). */
export const EXCHANGES_PER_CLIENT = 3;
/** Lectures simultanées : assez pour finir vite, assez peu pour ne pas saturer l'API. */
export const READ_CONCURRENCY = 6;
// Une cellule Excel accepte 32 767 caractères ; 500 par échange gardent la feuille lisible.
const BODY_MAX = 500;

// Les dates sans fuseau du serveur sont en UTC (même règle que le panneau d'échanges).
const toMillis = (iso) => {
  if (!iso) return null;
  const d = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(String(iso)) ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
};

// Une cellule = une ligne : les retours à la ligne deviennent « / ».
const oneLine = (text) => String(text ?? '').replace(/\s*\n+\s*/g, ' / ').replace(/[ \t]+/g, ' ').trim();
const clip = (text) => (text.length > BODY_MAX ? `${text.slice(0, BODY_MAX - 1).trimEnd()}…` : text);

/** Clé d'un client dans la table des échanges : la même à la lecture et à l'export. */
export const exchangeKey = (row) => String(row?.client_id ?? row?.client?.numero_client ?? row?.id ?? '');

/**
 * Un commentaire du serveur → un échange normalisé, ou null s'il est vide / sans date lisible.
 * @param {object} raw       commentaire tel que servi (`created_at`, `body`, `author_name`…)
 * @param {boolean} internal vrai pour une note interne de la finance
 */
export function normalizeExchange(raw, internal) {
  if (!raw) return null;
  const at = toMillis(raw.created_at);
  const body = clip(oneLine(raw.body));
  if (at === null || !body) return null;
  return {
    at,
    id: String(raw.id ?? ''),
    author: raw.author_name || raw.author_email || 'Inconnu',
    internal: !!internal,
    body,
  };
}

/** Les `limit` échanges les plus récents, tous espaces confondus (messages communs + notes internes). */
export function latestExchanges(shared = [], notes = [], limit = EXCHANGES_PER_CLIENT) {
  const all = [
    ...(shared || []).map((c) => normalizeExchange(c, false)),
    ...(notes || []).map((n) => normalizeExchange(n, true)),
  ].filter(Boolean);
  all.sort((a, b) => (b.at - a.at) || b.id.localeCompare(a.id));
  return all.slice(0, limit);
}

// ── Dates : heure de Paris, quelle que soit la machine qui exporte ───────────
const PARIS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
function parisParts(ms) {
  const o = {};
  for (const p of PARIS.formatToParts(new Date(ms))) o[p.type] = p.value;
  return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour, mi: +o.minute };
}
const two = (n) => String(n).padStart(2, '0');

/** « 17/11/2026 11:48 » à l'heure de Paris. */
export function parisText(ms) {
  const p = parisParts(ms);
  return `${two(p.d)}/${two(p.mo)}/${p.y} ${two(p.h)}:${two(p.mi)}`;
}

/**
 * Numéro de série Excel de l'heure MURALE de Paris : la cellule affiche la même heure que l'écran,
 * sur n'importe quel poste (Excel n'a pas de fuseau ; un `Date` JS serait décalé par celui du poste).
 */
export function excelSerial(ms) {
  const p = parisParts(ms);
  return (Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - Date.UTC(1899, 11, 30)) / 86400000;
}

/** « 17/11/2026 11:48 · Alice Test · Interne : texte » (les messages communs n'ont pas de mention). */
export function formatExchange(e) {
  return `${parisText(e.at)} · ${e.author}${e.internal ? ' · Interne' : ''} : ${e.body}`;
}

// ── Tags : ce que le tableau montre en pastilles à côté du nom ───────────────
/** « Promesse de règlement (30/10/2026 — Virement annoncé) » ; la promesse est un objet `{ promised_for, note }`. */
export function promiseLabel(promise) {
  const base = 'Promesse de règlement';
  if (!promise || promise === true) return base;
  if (typeof promise === 'string') {
    const t = promise.trim();
    return t && t !== 'Oui' ? `${base} (${t})` : base;
  }
  const date = promise.promised_for ? formatDateFR(promise.promised_for) : '';
  const detail = [date && date !== '—' ? date : '', String(promise.note || '').trim()].filter(Boolean).join(' — ');
  return detail ? `${base} (${detail})` : base;
}

/**
 * Les marqueurs d'un client, dans l'ordre de l'écran.
 * @param {object} row   ligne du tableau
 * @param {{label?: string, score?: number}|null} [meteo]  météo du board (déjà calculée par la page)
 */
export function tagsOf(row, meteo = null) {
  const c = row?.client || {};
  const tags = [];
  if (c.do_not_call) tags.push('À ne pas rappeler');
  if (c.payment_promise) tags.push(promiseLabel(c.payment_promise));
  if (c.is_loss) tags.push('Perte actée');
  if (meteo?.label) tags.push(`Météo ${meteo.label}${meteo.score != null ? ` (${meteo.score}/5)` : ''}`);
  return tags;
}

// ── Lecture ─────────────────────────────────────────────────────────────────
const listOf = (data) => (Array.isArray(data?.comments) ? data.comments : Array.isArray(data) ? data : []);

/**
 * Lit les derniers échanges de chaque client (une seule lecture par client, même si la liste le répète).
 *
 * @param {object[]} rows  lignes à exporter
 * @param {object} opts
 * @param {(url: string) => Promise<any>} opts.get   lecture HTTP (ex. `apiClient.get`) ; lève une erreur portant `status`
 * @param {(done: number, total: number) => void} [opts.onProgress]
 * @returns {Promise<Map<string, {items: object[], failed: boolean}>>}  clé = `exchangeKey(row)` ;
 *          `failed` = une source n'a pas pu être lue (réseau / serveur) : l'export le dit au lieu de laisser croire « aucun échange ».
 */
export async function loadExchanges(rows, { get, onProgress, concurrency = READ_CONCURRENCY, limit = EXCHANGES_PER_CLIENT } = {}) {
  const wanted = new Map();
  for (const r of rows || []) {
    const key = exchangeKey(r);
    if (key && !wanted.has(key)) wanted.set(key, { numero: r.client?.numero_client || null, clientId: r.client_id ?? null });
  }
  const entries = [...wanted.entries()];
  const result = new Map();
  const denied = { shared: false, notes: false };

  const read = async (url, source) => {
    if (!url || denied[source]) return { ok: true, list: [] };
    try {
      return { ok: true, list: listOf(await get(url)) };
    } catch (e) {
      if (e?.status === 401 || e?.status === 403) { denied[source] = true; return { ok: true, list: [] }; }
      if (e?.status === 404) return { ok: true, list: [] };
      return { ok: false, list: [] };
    }
  };

  let cursor = 0;
  let done = 0;
  const worker = async () => {
    for (;;) {
      const i = cursor; cursor += 1;
      if (i >= entries.length) return;
      const [key, { numero, clientId }] = entries[i];
      const [shared, notes] = await Promise.all([
        read(numero ? `/api/v1/optilex/comments?numero_client=${encodeURIComponent(numero)}` : null, 'shared'),
        read(clientId != null ? `/api/v1/finance-periods/client/${encodeURIComponent(clientId)}/comments` : null, 'notes'),
      ]);
      result.set(key, { items: latestExchanges(shared.list, notes.list, limit), failed: !(shared.ok && notes.ok) });
      done += 1;
      onProgress?.(done, entries.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), entries.length) }, worker));
  return result;
}
