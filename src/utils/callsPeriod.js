// Période par défaut du tracking des appels : le mois en cours, en heures de Paris.
export function monthRange() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return { start: `${today.slice(0, 7)}-01`, end: today };
}
