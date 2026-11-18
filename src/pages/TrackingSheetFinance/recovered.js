// Client récupéré (dev 18/11/2026) : repassé « Signé » juste après une rétractation ou une résiliation. Le serveur le
// calcule (champ `recupere` du board : {at, from, by, billing}) ; la Finance le filtre (vue « Récupérés ») et rétablit
// sa facturation. `billing` : « to_restore » tant que la revue du retour attend la Finance, « restored » une fois
// traitée, null quand le départ n'avait jamais été acté côté Finance.
const FROM = {
  'Rétractation': 'en rétractation',
  'En cours de rétractation': 'en cours de rétractation',
  'Résiliation': 'résilié',
  'En cours de résiliation': 'en cours de résiliation',
  'Self-Résiliation': 'en self-résiliation',
};
export const RECOVERED_TONES = {
  toRestore: { fg: '#c2500e', bg: '#fde9da' },
  done: { fg: '#0b7a4b', bg: '#e2f6ea' },
};

// Jour du passage à Paris, « JJ/MM ».
export function recoveredDay(at) {
  const d = new Date(at || '');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit' });
}

export function recoveredInfo(recovered) {
  if (!recovered) return null;
  const day = recoveredDay(recovered.at);
  const toRestore = recovered.billing === 'to_restore';
  const billing = toRestore ? ' Facturation à rétablir.' : recovered.billing === 'restored' ? ' Facturation rétablie.' : '';
  return {
    toRestore,
    day,
    tone: toRestore ? RECOVERED_TONES.toRestore : RECOVERED_TONES.done,
    title: `Récupéré${day ? ` le ${day}` : ''}${recovered.by ? ` par ${recovered.by}` : ''} : était ${FROM[recovered.from] || 'sur le départ'}.${billing}`,
  };
}
