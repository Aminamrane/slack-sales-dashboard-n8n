// src/components/ErrorBoundary.jsx
//
// Garde-fou de rendu : capture toute exception d'un sous-arbre React et affiche
// un message au lieu de faire écran blanc sur toute la page. À utiliser autour
// des vues pilotées par des données externes (scorecards, bilans) dont le payload
// peut varier. Réinitialisé par un changement de `key` (remount) ou, sans remonter
// ce qui a bien tourné, par un changement de `resetKey` (ex. « Actualiser », 30/10/2026).

import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { err: null, resetKey: props.resetKey };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.resetKey ? { err: null, resetKey: props.resetKey } : null;
  }
  componentDidCatch(err, info) {
    // Trace pour le debug ; ne remonte pas à l'utilisateur.
    console.error("[ErrorBoundary] rendu interrompu :", err, info);
  }
  render() {
    if (this.state.err) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{ padding: "28px 24px", textAlign: "center", color: "#A4262C", fontSize: 14, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Cette analyse n'a pas pu s'afficher</div>
          <div style={{ color: "#4A5259", fontSize: 13 }}>Le format des données est inattendu. Les autres analyses restent accessibles.</div>
        </div>
      );
    }
    return this.props.children;
  }
}
