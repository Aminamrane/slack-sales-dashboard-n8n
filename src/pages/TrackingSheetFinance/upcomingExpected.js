// upcomingExpected.js : l'attendu du mois suivant, montré en indication sur
// la ligne du mois qui précède le début de facturation.
//
// Incident 01/10/2026 : n°773 (onboarding le 01/10 à 15 h) attendait
// 369,60 € Owner et 172,80 € Opti'Lex en OCTOBRE. La veille, la finance
// regardait septembre, où la ligne ne montrait que « onboarding le
// 01/10/2026 » : le montant à préparer ne se voyait pas.
//
// Le serveur décide quand l'indication s'applique (début de facturation au
// mois suivant, à partir de la veille ouvrée de l'onboarding) et sert le
// montant EFFECTIF de ce mois-là : `upcoming_period`, `upcoming_expected_owner`,
// `upcoming_expected_optilex_ttc`. Ici, on ne fait que le lire dans la vision
// active et le formuler. Ce montant n'est compté NULLE PART dans le mois
// affiché : ni attendu, ni retard, ni totaux du bandeau, ni export.

import { toNumber, formatEUR, formatMonthLabel } from './constants.js';

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Montant à venir dans la vision active : Owner, Opti'Lex, ou leur somme en
// Globale (même règle que les colonnes du tableau).
export const scopedUpcomingExpected = (row, scope) => {
  const owner = scope === 'optilex' ? 0 : (toNumber(row?.upcoming_expected_owner) || 0);
  const optilex = scope === 'owner' ? 0 : (toNumber(row?.upcoming_expected_optilex_ttc) || 0);
  return Math.round((owner + optilex) * 100) / 100;
};

// Indication à afficher, ou null (pas de mois à venir, ou rien dans cette
// vision). `onboardingLabel` : date déjà formatée « JJ/MM/AAAA », ou null
// (l'infobulle ne cite l'onboarding que s'il a lieu le mois annoncé).
//   label : « 369,60 € en octobre » (l'année n'est ajoutée que si elle change)
//   title : l'infobulle, qui dit que le montant n'est pas compté ici
export const upcomingExpectedHint = (row, scope, onboardingLabel = null) => {
  const period = row?.upcoming_period;
  if (!PERIOD_RE.test(period || '')) return null;
  const amount = scopedUpcomingExpected(row, scope);
  if (!(amount > 0)) return null;
  const monthYear = formatMonthLabel(period).toLowerCase();
  const sameYear = String(row?.period || '').slice(0, 4) === period.slice(0, 4);
  const month = sameYear ? monthYear.replace(/ \d{4}$/, '') : monthYear;
  // Le premier mois facturé n'est pas toujours celui du rendez-vous : date
  // de contrat ou début posé par la finance (n°756 : onboarding le 18/09,
  // facturé dès octobre). On ne nomme l'onboarding que s'il tombe ce mois-là.
  const onboardingThatMonth = /^\d{2}\/\d{2}\/\d{4}$/.test(onboardingLabel || '')
    && onboardingLabel.slice(3) === `${period.slice(5, 7)}/${period.slice(0, 4)}`;
  const onboarding = onboardingThatMonth
    ? `, mois de l’onboarding du ${onboardingLabel}`
    : ', premier mois facturé';
  return {
    period,
    amount,
    label: `${formatEUR(amount)} en ${month}`,
    title: `${formatEUR(amount)} attendus en ${monthYear}${onboarding}. `
      + 'Indication seulement : ce montant n’est pas compté dans le mois affiché, ni dans ses totaux.',
  };
};
