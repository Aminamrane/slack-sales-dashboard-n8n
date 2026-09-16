import { Component } from 'react';

// A failed page chunk must leave a usable screen. Retrying is explicit so a
// flaky connection never causes reload loops or replays a business action.
export default class PageLoadBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="owner-loading" role="alert">
        <div className="owner-loading-card">
          <span className="owner-loading-brand">Owner</span>
          <h1>La page n’a pas pu s’afficher</h1>
          <p>Vérifiez votre connexion, puis réessayez en rechargeant la page.</p>
          <button type="button" onClick={() => window.location.reload()}>Recharger la page</button>
        </div>
      </main>
    );
  }
}
