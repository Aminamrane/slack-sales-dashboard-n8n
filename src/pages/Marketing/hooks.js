import { useEffect, useState, useRef, useCallback } from 'react';
import apiClient from '../../services/apiClient';

/**
 * Polling hook for a campaign endpoint. Pauses automatically when the
 * page is hidden (document.visibilityState !== 'visible') so we don't
 * burn quota / bandwidth when nobody's looking.
 *
 * Returns { data, loading, error, refresh }.
 */
export function useCampaignPolling(endpoint, intervalMs = 30000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const cancelledRef = useRef(false);
  const isVisibleRef = useRef(typeof document !== 'undefined' ? document.visibilityState === 'visible' : true);

  const load = useCallback(async () => {
    try {
      const json = await apiClient.get(endpoint);
      if (!cancelledRef.current) {
        setData(json);
        setError(null);
      }
    } catch (e) {
      if (!cancelledRef.current) setError(e?.message || 'Erreur');
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [endpoint]);

  // Restart polling — used after visibility change
  const startPolling = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!isVisibleRef.current) return;
    timerRef.current = setInterval(load, intervalMs);
  }, [load, intervalMs]);

  useEffect(() => {
    cancelledRef.current = false;
    void load();
    startPolling();

    const onVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      isVisibleRef.current = visible;
      if (visible) {
        // Refresh immediately on resume + restart loop
        void load();
        startPolling();
      } else if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [load, startPolling]);

  return { data, loading, error, refresh: load };
}

/**
 * Compute the "finished" state for a campaign — used to default the
 * collapsed UI state. A campaign is finished if nothing is pending
 * or currently in flight.
 */
export function isCampaignFinished(data) {
  if (!data) return false;
  const pending = data.counts?.pending ?? 0;
  const sending = data.counts?.sending ?? 0;
  return pending === 0 && sending === 0;
}
