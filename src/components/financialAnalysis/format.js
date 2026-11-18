// Les nombres de « Analyse financière », écrits comme on les lit.
export const number = (value) => (value == null ? "–" : Math.round(Number(value)).toLocaleString("fr-FR"));
export const percent = (rate, digits = 1) => (rate == null ? "–" : `${(rate * 100).toLocaleString("fr-FR", { maximumFractionDigits: digits })} %`);
// Un montant en court : 2 847 300 € se lit « 2,8 M€ ».
export const compactEuros = (value) => (value == null ? "–" : value >= 1e6 ? `${(value / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€`
  : value >= 1e4 ? `${Math.round(value / 1e3).toLocaleString("fr-FR")} k€` : `${Math.round(value).toLocaleString("fr-FR")} €`);
