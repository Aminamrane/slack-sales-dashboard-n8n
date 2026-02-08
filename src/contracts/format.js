// src/contracts/format.js
import { formatSiren } from "./schemas.js";

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
 * Construit la phrase des représentants de manière dynamique
 * Exemples:
 * - 1 rep: "son Président Jean Dupont"
 * - 2 reps: "son Président Jean Dupont et de son Directeur général Marie Martin"
 * - 3+ reps: "son Président X, de son DG Y et de son Trésorier Z"
 */
const joinReps = (reps = []) => {
  const clean = reps
    .map(r => ({
      fullName: (r.fullName || "").trim(),
      role: (r.role || "").trim(),
    }))
    .filter(r => r.fullName && r.role);

  // Sécurité: si vide, fallback neutre (normalement bloqué par schema)
  if (!clean.length) return "ses représentants légaux";

  // Construction de la phrase
  if (clean.length === 1) {
    // 1 rep: "son Président Jean Dupont"
    return `son ${clean[0].role} ${clean[0].fullName}`;
  }

  if (clean.length === 2) {
    // 2 reps: "son Président X et de son DG Y"
    return `son ${clean[0].role} ${clean[0].fullName} et de son ${clean[1].role} ${clean[1].fullName}`;
  }

  // 3+ reps: "son Président X, de son DG Y et de son Trésorier Z"
  return clean
    .map((r, idx) => `${idx === 0 ? "son" : "de son"} ${r.role} ${r.fullName}`)
    .join(", ")
    .replace(/, ([^,]*)$/, " et $1"); // Remplace la dernière virgule par "et"
};

/**
 * Clause "Société" avec représentants dynamiques et mention des sociétés liées.
 */
export function companyClause({ company }) {
  const { legalName, legalForm, siren, rcsCity, headOffice, representatives = [], isInRegistration = false } = company;
  const repsText = joinReps(representatives);

  const isEI = legalForm === "EI" || legalForm === "Autre";

  // Build the registration part
  let registrationText;
  if (isInRegistration) {
    // Company in registration process
    if (isEI) {
      // EI doesn't have RCS
      registrationText = `en cours d'immatriculation`;
    } else {
      // Other legal forms have RCS
      registrationText = `en cours d'immatriculation au Registre du Commerce et des Sociétés de ${rcsCity}`;
    }
  } else {
    // Already registered/immatriculated
    if (isEI) {
      // EI has SIREN but no RCS
      registrationText = `immatriculée sous le SIREN n° ${formatSiren(siren)}`;
    } else {
      // Other legal forms have both SIREN and RCS
      registrationText = `immatriculée sous le SIREN n° ${formatSiren(siren)} au RCS de ${rcsCity}`;
    }
  }

  return `La Société ${legalName} (${legalForm}), ${registrationText}, dont le siège social est situé ${formatAddress(
    headOffice
  )}, prise en la personne de ${repsText}, domiciliés en cette qualité audit siège, et des éventuelles sociétés liées à la société sus-mentionnée.`;
}