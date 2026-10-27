import { useEffect, useState } from 'react';
import apiClient from '../../services/apiClient';

// Chargement d'un indicateur du dashboard : un chemin d'API, un état {data, loading,
// error}, un rafraîchissement périodique suspendu quand l'onglet est caché. Un échec
// après un premier chargement garde les dernières données connues (jamais un 0 à la
// place d'un chiffre). `refreshMs` : 60 s par défaut ; les sources lourdes ou mises
// à jour chaque nuit passent une valeur plus longue.
export default function useDashboardData(path, refreshMs = 60000) {
  const [state, setState] = useState({ data: null, loading: true, error: false });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let stopped = false, busy = false;
    setState({ data: null, loading: true, error: false });
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const data = await apiClient.get(path);
        if (!stopped) setState({ data, loading: false, error: false });
      } catch {
        if (!stopped) setState((prev) => ({ data: prev.data, loading: false, error: prev.data == null }));
      } finally { busy = false; }
    };
    load();
    const tick = () => { if (!document.hidden) load(); };
    const timer = setInterval(tick, refreshMs);
    document.addEventListener('visibilitychange', tick);
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [path, retry, refreshMs]);
  return { ...state, retry: () => setRetry((n) => n + 1) };
}
