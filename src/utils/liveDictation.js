// Dictée en direct : ce que le navigateur entend pendant qu'on parle (reconnaissance vocale, fr-FR).
//
// Le texte entendu part dans le commentaire dès qu'on arrête de dicter : plus d'attente de la transcription du serveur
// (demande du 12/11/2026 : « en direct c'est parfait, mais pour l'avoir dans le texte ça met énormément de temps »).
// Le serveur ne reprend la main que si l'écoute en direct n'est pas fiable : navigateur sans reconnaissance vocale,
// erreur pendant la dictée, ou rien d'entendu. Il transcrit alors l'enregistrement entier, comme avant.
//
// Le navigateur coupe de lui-même l'écoute après un silence ou une minute : tant qu'on dicte, elle est relancée et le
// texte des écoutes précédentes est gardé devant le nouveau.

// Fins d'écoute sans gravité : un silence, ou l'arrêt qu'on vient de demander.
const BENIGN = ['no-speech', 'aborted'];

export function createLiveListener({ Recognition, lang = 'fr-FR', onText = () => {}, wait = 800 } = {}) {
  let current = null;
  let active = false;
  let broken = !Recognition;
  let base = '';
  let text = '';

  const listen = () => {
    if (!Recognition) return;
    try {
      const recognition = new Recognition();
      recognition.lang = lang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let heard = '';
        for (let i = 0; i < event.results.length; i++) heard += event.results[i][0].transcript;
        text = [base, heard.trim()].filter(Boolean).join(' ');
        onText(text);
      };
      recognition.onerror = (event) => { if (!BENIGN.includes(event?.error)) broken = true; };
      recognition.onend = () => {
        if (current !== recognition || !active) return;
        base = text;
        current = null;
        if (!broken) listen();
      };
      recognition.start();
      current = recognition;
    } catch {
      current = null;
      broken = true;
    }
  };

  return {
    start() {
      base = ''; text = ''; broken = !Recognition; active = true;
      onText('');
      listen();
    },
    // Arrête l'écoute et rend le texte entendu, une fois que le navigateur a rendu sa dernière phrase (au plus `wait` ms).
    // `trusted` : le texte est complet et peut partir tel quel dans le commentaire.
    finish() {
      active = false;
      const recognition = current;
      current = null;
      return new Promise((resolve) => {
        let settled = false;
        const settle = () => {
          if (settled) return;
          settled = true;
          resolve({ text, trusted: !broken && !!text });
        };
        if (!recognition) { settle(); return; }
        recognition.onend = settle;
        setTimeout(settle, wait);
        try { recognition.stop(); } catch { settle(); }
      });
    },
    cancel() {
      active = false;
      const recognition = current;
      current = null;
      try { recognition?.stop(); } catch { /* déjà arrêtée */ }
      base = ''; text = '';
    },
  };
}
