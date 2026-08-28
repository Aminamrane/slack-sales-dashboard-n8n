// exportExcel.js — export du tableau finance vers un vrai classeur .xlsx.
//
// Demande dev 2026-08-28 : « ils sélectionnent leurs filtres et ils ont des
// exports Excel de leur tableau, qu'ils soient sur Opti'Lex ou Owner. »
//
// L'export reprend EXACTEMENT ce que la table affiche : vues-filtres, filtres
// du menu, filtres personnels et recherche compris, dans la vision active.
// Ce qui est à l'écran est ce qui sort du fichier — sinon l'export mentirait
// sur son propre périmètre.
//
// Colonnes (demande dev) : le client, ce qu'il doit — créances antérieures et
// mois en cours séparées, puis le total — et de quoi le joindre. C'est une
// liste de relance : on identifie, on chiffre, on appelle.
//
// Les montants sortent en NOMBRES avec un format monétaire, jamais en texte :
// l'équipe doit pouvoir sommer une colonne et trier dessus. Un export où les
// euros sont des chaînes est inutilisable.
//
// `xlsx` est déjà une dépendance du projet (elle n'était plus utilisée depuis
// un import résiduel de Leaderboard) : aucune bibliothèque ajoutée.

import * as XLSX from 'xlsx';

import { scopedOverdueCurrent, scopedOverdueCum } from './constants.js';

const SCOPE_LABEL = {
  owner: 'Owner',
  optilex: "Opti'lex",
  global: 'Globale',
};

// Format monétaire français : séparateur de milliers, deux décimales, €.
// Excel applique le motif, la cellule reste un nombre.
const EUR_FMT = '# ##0.00\\ "€"';

const COLUMNS = [
  { key: 'numero', label: 'N° client', width: 11 },
  { key: 'client', label: 'Client', width: 34 },
  { key: 'anterieures', label: 'Créances antérieures', width: 20, money: true },
  { key: 'moisCourant', label: 'Créance du mois en cours', width: 23, money: true },
  { key: 'total', label: 'Total en retard', width: 16, money: true },
  { key: 'telephone', label: 'Téléphone', width: 16 },
  { key: 'email', label: 'Email', width: 32 },
];

// Deux décimales, sans surprise de flottant (0,1 + 0,2 ne doit pas sortir en
// 0,30000000000000004 dans une cellule numérique).
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Construit les lignes de l'export à partir des lignes AFFICHÉES.
 * Trié par total dû décroissant : une liste de relance se lit en commençant
 * par ce qui coûte le plus cher.
 */
export function buildExportRows(rows, scope) {
  return (rows || [])
    .map((r) => {
      const anterieures = round2(scopedOverdueCum(r, scope));
      const moisCourant = round2(scopedOverdueCurrent(r, scope));
      return {
        numero: r.client?.numero_client || '',
        client: r.client?.societe || '',
        anterieures,
        moisCourant,
        total: round2(anterieures + moisCourant),
        telephone: r.client?.phone || '',
        email: r.client?.email || '',
      };
    })
    .sort((a, b) => b.total - a.total);
}

/**
 * Génère et télécharge le classeur.
 * @returns {number} nombre de lignes exportées
 */
export function exportFinanceXlsx({ rows, scope, period }) {
  const data = buildExportRows(rows, scope);

  const sheet = XLSX.utils.json_to_sheet(data, {
    header: COLUMNS.map((c) => c.key),
  });

  // En-têtes lisibles à la place des clés techniques.
  COLUMNS.forEach((col, i) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c: i });
    if (sheet[ref]) sheet[ref].v = col.label;
  });

  // Format monétaire sur les colonnes de montants.
  COLUMNS.forEach((col, i) => {
    if (!col.money) return;
    for (let row = 1; row <= data.length; row += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: i })];
      if (cell && cell.t === 'n') cell.z = EUR_FMT;
    }
  });

  sheet['!cols'] = COLUMNS.map((c) => ({ wch: c.width }));
  // Fige la ligne d'en-tête : sur 700 lignes, on veut garder les titres.
  sheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  sheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(data.length, 1), c: COLUMNS.length - 1 },
    }),
  };

  const scopeLabel = SCOPE_LABEL[scope] || 'Globale';
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, `Retards ${scopeLabel}`.slice(0, 31));

  // Le nom du fichier porte le contexte : sans lui, trois exports du même
  // jour sur trois visions différentes seraient indiscernables.
  const monthTag = String(period || '').slice(0, 7) || 'periode';
  const name = `retards-${scopeLabel.toLowerCase().replace(/['’]/g, '')}-${monthTag}.xlsx`;

  XLSX.writeFile(book, name);
  return data.length;
}

export { SCOPE_LABEL };
