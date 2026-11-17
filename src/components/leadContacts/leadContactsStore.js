import { useEffect, useSyncExternalStore } from 'react';
import apiClient from '../../services/apiClient';

const urlOf = (leadId) => `/api/v1/tracking/leads/${leadId}/contacts`;

// Un petit magasin par lead : le compteur du champ et la liste dépliée lisent les mêmes données, chargées une seule
// fois par ouverture de fiche. `open` : le type de contact déplié ('phone', 'email' ou rien).
const stores = new Map();
function storeOf(leadId) {
  let store = stores.get(leadId);
  if (!store) { store = { snapshot: { data: null, open: null }, listeners: new Set(), loadedAt: 0 }; stores.set(leadId, store); }
  return store;
}
function emit(store, patch) { store.snapshot = { ...store.snapshot, ...patch }; store.listeners.forEach((listener) => listener()); }
export async function load(leadId) {
  const store = storeOf(leadId);
  store.loadedAt = Date.now();
  try { emit(store, { data: await apiClient.get(urlOf(leadId)) }); } catch { emit(store, { data: null }); }
}
export function useContacts(leadId) {
  const store = storeOf(leadId);
  const snapshot = useSyncExternalStore((listener) => { store.listeners.add(listener); return () => store.listeners.delete(listener); }, () => store.snapshot);
  useEffect(() => { if (Date.now() - store.loadedAt > 5000) load(leadId); }, [leadId, store]);
  return [snapshot, (patch) => emit(store, patch)];
}
