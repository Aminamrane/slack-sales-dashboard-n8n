import apiClient from '../../services/apiClient';
import { createReadStore, useStoreRead } from './freshRead';

// RDV posés par jour par les setters (/monitoring/performance/v2/setters/placed). Gardés en mémoire pour que changer de période ou d'onglet soit
// instantané, mais jamais présentés comme à jour au-delà de 30 s : avant, la lecture restait affichée des heures durant, et les RDV posés depuis
// la première ouverture de la page n'apparaissaient qu'au bouton « Actualiser ». Voir freshRead.js : la dernière valeur reste visible pendant la
// relecture (pas d'écran vide), « Actualiser » (`refreshKey`) impose une relecture, le retour sur l'onglet du navigateur relit une valeur périmée.
const store = createReadStore();
export function usePlacements(start, end, refreshKey = 0) {
  const key = start && end ? `${start}|${end}` : null;
  const { value, error, refreshing } = useStoreRead(store, key, () => apiClient.get(`/api/v1/monitoring/performance/v2/setters/placed?start=${start}&end=${end}`), { version: refreshKey, enabled: !!key });
  return [value, error, refreshing];
}

const pad = (n) => String(n).padStart(2, '0');
export const monthRange = (ym) => { const [y, m] = ym.split('-').map(Number); return [`${ym}-01`, `${ym}-${pad(new Date(y, m, 0).getDate())}`]; };
