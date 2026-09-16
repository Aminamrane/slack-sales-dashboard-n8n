import { useEffect, useState } from 'react';

export default function PageLoading() {
  const [slow, setSlow] = useState(false);
  const [offline, setOffline] = useState(() => !navigator.onLine);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 12000);
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return (
    <main className="owner-loading" role="status" aria-live="polite">
      <div className="owner-loading-card">
        <span className="owner-loading-brand">Owner</span>
        <span className="owner-loading-spinner" aria-hidden="true" />
        <h1>Chargement de votre espace</h1>
        <p>{offline
          ? 'Connexion interrompue. Vérifiez votre connexion Internet.'
          : slow
            ? 'Le chargement prend un peu plus de temps. Vous pouvez patienter ou réessayer.'
            : 'Votre page sera prête dans quelques instants.'}</p>
        {(slow || offline) && <button type="button" onClick={() => window.location.reload()}>Recharger la page</button>}
      </div>
    </main>
  );
}
