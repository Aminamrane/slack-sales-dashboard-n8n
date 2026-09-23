import { CalendarCheck2, Clock3, ArrowRight, RefreshCw, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import './integrationPreview.css';

export default function SaleReservation({ preparation, busy, error, onRetry, onContinue, onClose }) {
  const confirmed = preparation?.status === 'booked';
  const finalized = preparation?.status === 'finalized';
  const [retryIn, setRetryIn] = useState(0);
  useEffect(() => {
    if (confirmed || finalized) return;
    setRetryIn(30);
    const timer = setInterval(() => setRetryIn(v => Math.max(0, v - 1)), 1000);
    return () => clearInterval(timer);
  }, [preparation, confirmed, finalized]);
  const Icon = confirmed || finalized ? CalendarCheck2 : Clock3;
  return <section className="integration-preview ip-embedded si-reservation">
    <header className="si-title"><span className="si-title-icon"><Icon size={28}/></span><div>
      <small>{finalized ? 'DOSSIER TERMINÉ' : 'PREMIÈRE PARTIE ENREGISTRÉE'}</small>
      <h2>{finalized ? 'Vente déjà déclarée' : confirmed ? 'Le rendez-vous est réservé' : 'Réservation en cours de confirmation'}</h2>
      <p>{finalized ? `Client n°${preparation.client_numero}` : confirmed ? 'Vincent et la facturation ont leur rendez-vous dans l’agenda.' : 'Nous vérifions la confirmation des deux agendas. Le rendez-vous ne sera confirmé qu’après cette vérification.'}</p>
    </div></header>
    <div className="si-reservation-date"><CalendarCheck2 size={24}/><div><strong>{new Intl.DateTimeFormat('fr-FR', {dateStyle:'full', timeStyle:'short', timeZone:'Europe/Paris'}).format(new Date(preparation.slot))}</strong><span>Heure de Paris · Vincent 50 min · facturation les 15 dernières minutes</span></div></div>
    {!finalized && <div className="si-reservation-next"><Check size={20}/><div><strong>Vos informations de vente et de facturation sont sauvegardées.</strong><p>Vous pouvez fermer cette fenêtre et reprendre depuis « Finaliser la déclaration ». La vente sera déclarée après la finalisation du dossier et l’ajout d’au moins un document.</p></div></div>}
    {error && <div className="si-error" role="alert">{error}</div>}
    <footer className="si-actions"><button className="ip-secondary" disabled={busy} onClick={onClose}>{finalized ? 'Fermer' : 'Reprendre plus tard'}</button>
      {!finalized && (confirmed ? <button className="ip-primary" onClick={onContinue}>Finaliser le dossier<ArrowRight size={17}/></button> : <button className="ip-primary" disabled={busy || retryIn > 0} onClick={onRetry}><RefreshCw size={17}/>{busy ? 'Vérification…' : retryIn ? `Vérifier dans ${retryIn} s` : 'Vérifier la réservation'}</button>)}
    </footer>
  </section>;
}
