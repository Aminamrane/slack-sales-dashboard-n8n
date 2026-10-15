// src/components/sequenceMail/SequenceErrorBoundary.jsx
//
// Garde-fou de rendu des fenêtres de séquence : une exception (donnée inattendue du CRM, JSON de cohorte
// abîmé, état persisté corrompu, chargement d'un morceau de code qui échoue) ne doit pas remplacer toute la
// page Sub-Tickets — le bot IA compris — par l'écran d'erreur général. Elle ne tombe que sur la FENÊTRE
// concernée, avec trois sorties : réessayer, réinitialiser l'affichage (efface l'état mémorisé des onglets et
// fenêtres : jamais les données), recharger la page.
//
// Rien n'est envoyé ni écrit ailleurs que dans le stockage de la session du navigateur.

import { Component } from 'react';

/** Clé de session de l'état mémorisé du client e-mail (cf. store.js) : repli si `resetSeqMailState` n'existe pas. */
const PERSIST_KEY = 'owner.seqMail.v1';

export default class SequenceErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    console.error('[SequenceErrorBoundary] rendu interrompu :', err, info);
  }

  retry = () => {
    this.setState({ err: null });
    this.props.onRetry?.();
  };

  reset = async () => {
    try {
      const store = await import('./store');
      if (typeof store.resetSeqMailState === 'function') store.resetSeqMailState();
      else sessionStorage.removeItem(PERSIST_KEY);
    } catch {
      try { sessionStorage.removeItem(PERSIST_KEY); } catch { /* stockage indisponible */ }
    }
    this.retry();
  };

  render() {
    const { err } = this.state;
    if (!err) return this.props.children;
    const C = this.props.colors || {};
    const btn = {
      height: 32, padding: '0 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
      border: `1px solid ${C.border || '#d0d5dd'}`, background: 'transparent', color: C.text || 'inherit',
    };
    return (
      <div role="alert" style={{ height: '100%', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, boxSizing: 'border-box', color: C.text || 'inherit', background: C.bg || 'transparent' }}>
        <div style={{ maxWidth: 420, textAlign: 'center', lineHeight: 1.55, fontSize: 13.5 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{this.props.label ? `« ${this.props.label} » n'a pas pu s'afficher` : 'Cette fenêtre n’a pas pu s’afficher'}</div>
          <div style={{ color: C.muted || 'inherit', marginBottom: 14 }}>
            Un contenu inattendu a interrompu l’affichage. Les séquences et les cohortes ne sont pas touchées : cet écran est en lecture seule.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" style={btn} onClick={this.retry}>Réessayer</button>
            <button type="button" style={btn} onClick={this.reset}>Réinitialiser l’affichage</button>
            <button type="button" style={btn} onClick={() => window.location.reload()}>Recharger la page</button>
          </div>
        </div>
      </div>
    );
  }
}
