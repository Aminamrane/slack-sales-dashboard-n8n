// src/contracts/schemas.js
import { z } from "zod";

/** Garde uniquement les chiffres */
export const normalizeSiren = (val) => (val || "").replace(/\D+/g, "");

/** Luhn (sert uniquement pour un warning UI, pas bloquant) */
export const isValidSiren = (digits) => {
  let sum = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48; // '0' => 48
    if (n < 0 || n > 9) return false;
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
};

export const formatSiren = (val) => {
  const d = normalizeSiren(val);
  return d.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
};

export const AddressSchema = z.object({
  line1: z.string().min(3, "Adresse trop courte"),
  postalCode: z.string().regex(/^\d{5}$/, "Code postal FR à 5 chiffres"),
  city: z.string().min(2, "Ville requise"),
  country: z.string().default("France"),
});

/** Représentant totalement optionnel en V1 */
export const RepresentativeSchema = z.object({
  fullName: z.string().optional(),
  role: z.string().optional(),
});

/** ➜ V1 souple : SIREN = 9 chiffres, représentants facultatifs */
export const CompanySchema = z.object({
  legalName: z.string().min(2, "Raison sociale requise"),
  legalForm: z.enum(["SARL","SAS","SASU","SA","EURL","SCI","Autre"]),
  siren: z.string()
    .transform(normalizeSiren)
    .refine((v) => /^\d{9}$/.test(v), "SIREN = 9 chiffres"),
  rcsCity: z.string().min(2, "Ville du RCS requise"),
  headOffice: AddressSchema,
  representatives: z.array(RepresentativeSchema).default([]), // ✅ plus de min(1)
});

export const ClientSchema = z.object({
  name: z.string().min(2, "Nom du client requis"),
  email: z.string().email("Email client invalide"),
  address: AddressSchema.optional(),
});

export const ContractVarsSchema = z.object({
  amount: z.number().nonnegative().optional(),
  startDate: z.string().optional(), // ISO
  endDate: z.string().optional(),
  scope: z.string().optional(),
});

export const ContractInputSchema = z.object({
  company: CompanySchema,
  client: ClientSchema,
  templateKey: z.string().default("standard_v1"),
  variables: ContractVarsSchema.optional(),
});
