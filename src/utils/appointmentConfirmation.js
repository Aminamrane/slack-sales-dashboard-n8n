export function appointmentConfirmation(result, selected) {
  if (result?.success !== true || result?.calendar_moved !== true) {
    throw new Error('La reprogrammation n’a pas pu être confirmée. Vérifiez le même créneau.');
  }
  // Backend returns Paris wall time, never reinterpret it in the device timezone.
  const dateTime = result.new_dt || `${selected.date}T${selected.slot}`;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(dateTime);
  if (!match) throw new Error('La date du rendez-vous reste à vérifier.');
  return { dateTime, when: `${match[3]}/${match[2]}/${match[1]} à ${match[4]} h ${match[5]}`, notificationWarning: result.notification_sent === false };
}

export function appointmentFailure(error) {
  const uncertain = !error.status || error.status >= 500;
  return { uncertain, message: uncertain
    ? 'La confirmation a été interrompue. Cliquez sur « Vérifier ce créneau » pour reprendre sans créer de doublon.'
    : (typeof error.data?.detail === 'string' ? error.data.detail : error.message || 'La reprogrammation a échoué.') };
}
