import { CompanySchema } from './schemas.js';
import { companyClause } from './format.js';

// Used by Sales, setters and the standalone NDA page. A downloaded NDA must
// never hide a failed CRM save: the next contract step depends on these data.
export async function generateSavedNda({ company, meta, leadId, apiClient, fetchPdf = fetch }) {
  const parsed = CompanySchema.safeParse(company);
  if (!parsed.success) throw new Error(parsed.error.issues.map(issue => issue.message).join(' '));
  const normalized = { ...company, ...parsed.data,
    siren: company.isInRegistration ? '' : parsed.data.siren,
    // Keep explicit first/last names if supplied by the intake.
    representatives: company.representatives,
  };
  // Match the PDF endpoint's legacy EI mapping in the contract clause too.
  const clauseCompany = normalized.legalForm === 'Autre' && !normalized.rcsCity
    ? { ...normalized, legalForm: 'EI' } : normalized;
  const payload = { company: normalized, meta, client_info_text: companyClause({ company: clauseCompany }) };
  if (leadId != null && leadId !== '') {
    const id = Number(leadId);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Rouvrez le dossier avant de générer le NDA.');
    payload.lead_id = id;
  }
  try {
    const saved = await apiClient.post('/api/v1/contracts/client-data', payload);
    if (saved?.success !== true) throw new Error('Enregistrement non confirmé');
  } catch (cause) {
    throw new Error('Le NDA n’a pas pu être enregistré dans le dossier. Vos informations restent dans le formulaire : réessayez pour poursuivre vers le contrat.', { cause });
  }
  const response = await fetchPdf('/api/contract-preview', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company: normalized, meta }),
  });
  if (!response.ok) throw new Error('Les informations sont enregistrées, mais le PDF du NDA n’a pas pu être généré. Réessayez.');
  return response.blob();
}
