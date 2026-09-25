// Contracts of a lead, whoever sent them (the sales, a setter, Owner through the
// guided journey, an admin): the people working the lead must see a contract in
// signature and be able to cancel it to send a corrected one.

export async function fetchContractsOfLead(api, leadId) {
  try {
    const resp = await api.get(`/api/v1/contracts/lead/${leadId}`);
    return { list: Array.isArray(resp?.contracts) ? resp.contracts : [], senders: resp?.senders || {} };
  } catch (err) {
    // Backend not yet updated: keep the previous behaviour (contracts sent by me).
    if (err?.status !== 404) throw err;
    const resp = await api.get(`/api/v1/contracts/my-contracts?lead_id=${leadId}`);
    const list = resp?.contracts || resp || [];
    return { list: Array.isArray(list) ? list : [], senders: {} };
  }
}

// A real timestamp (not a CRM wall-clock date): shown in Paris time.
function parisDateTime(value) {
  if (!value) return '';
  const text = String(value);
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
  return parts.replace(' ', ' à ');
}

export function contractSentLine(contract, senders = {}) {
  if (!contract) return '';
  const who = senders[String(contract.commercial_user_id)] || '';
  const when = parisDateTime(contract.sent_at || contract.created_at);
  const signer = [contract.client_name, contract.client_email && `(${contract.client_email})`].filter(Boolean).join(' ');
  return [
    'Envoyé',
    who && `par ${who}`,
    when && `le ${when}`,
    signer && `à ${signer}`,
  ].filter(Boolean).join(' ');
}
