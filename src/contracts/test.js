import { ContractInputSchema } from "./schemas.js";
import { companyClause } from "./format.js";


const data = {
  company: {
    legalName: "HEDONIST",
    legalForm: "SARL",
    siren: "907 748 503",
    rcsCity: "Rennes",
    headOffice: { line1: "34 boulevard de la Liberté", postalCode: "35000", city: "Rennes", country: "France" },
    representatives: [{ fullName: "Jean Dupont", role: "Gérant" }],
  },
  client: { name: "Client Test", email: "client@example.com" }
};

const parsed = ContractInputSchema.parse(data);
console.log(companyClause({ company: parsed.company }));
