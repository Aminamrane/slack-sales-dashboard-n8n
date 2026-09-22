import { CalendarCheck2, MailWarning } from 'lucide-react';
import { appointmentConfirmation } from '../../utils/appointmentConfirmation';

export default function AppointmentConfirmation({ result, selected, label, onClose }) {
  const confirmation = appointmentConfirmation(result, selected);
  return <div role="dialog" aria-modal="true" aria-labelledby="appointment-confirmed-title"
    style={{ position: 'fixed', inset: 0, zIndex: 10090, background: 'rgba(17,24,39,.42)', display: 'grid', placeItems: 'center', padding: 20, fontFamily: 'Inter, sans-serif' }}>
    <div style={{ width: 'min(480px, 100%)', borderRadius: 20, padding: 28, background: '#fff', color: '#1e2330', boxShadow: '0 24px 60px #11182733' }}>
      <div role="status" aria-live="polite">
        <CalendarCheck2 aria-hidden="true" size={38} color="#15794a" style={{ marginBottom: 16 }} />
        <h2 id="appointment-confirmed-title" style={{ margin: '0 0 8px', fontSize: 22 }}>Rendez-vous confirmé</h2>
        <p style={{ margin: '0 0 20px', color: '#667085', overflowWrap: 'anywhere' }}>{label}</p>
        <p style={{ padding: 16, borderRadius: 12, background: '#effaf4', color: '#12633e', fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>{confirmation.when}<small style={{ display: 'block', fontSize: 12, fontWeight: 500, marginTop: 6 }}>Heure de Paris</small></p>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>Les agendas ont été vérifiés et la date est enregistrée dans la fiche client.</p>
        {confirmation.notificationWarning && <p style={{ display: 'flex', gap: 8, padding: 12, borderRadius: 10, background: '#fff8eb', color: '#8a4b09', fontSize: 13, lineHeight: 1.5 }}><MailWarning size={20} style={{ flexShrink: 0 }} aria-hidden="true" />Le rendez-vous est confirmé. L’envoi de l’invitation n’a pas pu être confirmé ; vérifiez-la avant de contacter le client.</p>}
      </div>
      <button autoFocus type="button" onClick={onClose} style={{ width: '100%', padding: '12px 18px', border: 0, borderRadius: 10, background: '#15794a', color: '#fff', font: 'inherit', fontWeight: 700, cursor: 'pointer', marginTop: 12 }}>Terminer</button>
    </div>
  </div>;
}
