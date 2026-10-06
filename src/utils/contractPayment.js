// Match declaration: latest signed contract, never an unsigned replacement.
export function signedContractPaymentMode(contracts = []) {
  const signed = contracts.filter(c => c.yousign_status === 'done' || c.signed_at);
  signed.sort((a, b) => String(b.signed_at || '').localeCompare(String(a.signed_at || ''))
    || String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return signed[0]?.payment_mode || null;
}
