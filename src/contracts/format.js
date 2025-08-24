// src/contracts/format.js
import { formatSiren, normalizeSiren } from "./schemas.js";

/**
 * Concatène proprement une adresse en "Ligne 1, 35000 Rennes, France"
 */
export const formatAddress = (a = {}) => {
  const parts = [
    a.line1?.trim(),
    a.postalCode && a.city
      ? `${String(a.postalCode).trim()} ${a.city.trim()}`
      : a.city?.trim(),
    a.country?.trim(),
  ].filter(Boolean);
  return parts.join(", ");
};

/**
 * Clause “Société” SANS afficher les noms des représentants.
 */
export function companyClause({ company }) {
  const { legalName, legalForm, siren, rcsCity, headOffice } = company;

  return `La Société ${legalName} (${legalForm}), immatriculée sous le SIREN n° ${formatSiren(
    siren
  )} au RCS de ${rcsCity}, dont le siège social est situé ${formatAddress(
    headOffice
  )}, prise en la personne de ses représentants légaux, domiciliés en cette qualité audit siège.`;
}