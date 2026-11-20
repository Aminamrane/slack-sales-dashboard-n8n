import { useEffect, useState } from 'react';

// Thème clair / sombre du document : suit la classe `dark-mode` du <body> (posée par la barre du haut, la barre latérale
// ou la coquille de la route) avec un observateur, au lieu d'un sondage toutes les 500 ms.
export default function useBodyTheme() {
  const [dark, setDark] = useState(() => (typeof document !== 'undefined' ? document.body.classList.contains('dark-mode') || localStorage.getItem('darkMode') === 'true' : false));
  useEffect(() => {
    const sync = () => setDark(document.body.classList.contains('dark-mode'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}
