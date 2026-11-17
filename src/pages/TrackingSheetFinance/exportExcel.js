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
// Demande de la finance 2026-11-17 : en plus, de quoi se rappeler OÙ EN EST le
// client — son état et ses marqueurs (« à ne pas rappeler », promesse de
// règlement, météo…) puis les trois derniers échanges de l'équipe, datés
// (exportExchanges.js : mêmes sources que le panneau « Échanges »). Les colonnes
// d'avant ne bougent pas : les nouvelles sont à la suite.
//
// `xlsx` est déjà une dépendance du projet (elle n'était plus utilisée depuis
// un import résiduel de Leaderboard) : aucune bibliothèque ajoutée.

import * as XLSX from 'xlsx';

import { scopedOverdueCurrent, scopedOverdueCum } from './constants.js';
import { exchangeKey, excelSerial, formatExchange, tagsOf } from './exportExchanges.js';

const SCOPE_LABEL = {
  owner: 'Owner',
  optilex: "Opti'lex",
  global: 'Globale',
};

// Format monétaire français : séparateur de milliers, deux décimales, €.
// Excel applique le motif, la cellule reste un nombre.
const EUR_FMT = '# ##0.00\\ "€"';

// Date et heure (Paris) d'un échange : une vraie date Excel, pour trier et filtrer dessus.
const DATETIME_FMT = 'dd/mm/yyyy\\ hh:mm';

const COLUMNS = [
  { key: 'numero', label: 'N° client', width: 11 },
  { key: 'client', label: 'Client', width: 34 },
  { key: 'anterieures', label: 'Créances antérieures', width: 20, money: true },
  { key: 'moisCourant', label: 'Créance du mois en cours', width: 23, money: true },
  { key: 'total', label: 'Total en retard', width: 16, money: true },
  { key: 'telephone', label: 'Téléphone', width: 16 },
  { key: 'email', label: 'Email', width: 32 },
  { key: 'etat', label: 'État', width: 20 },
  { key: 'tags', label: 'Tags', width: 44 },
];

// Les colonnes d'échanges n'existent que si l'appelant a lu les échanges : sans eux, des colonnes vides
// laisseraient croire que personne n'a rien écrit.
const EXCHANGE_COLUMNS = [
  { key: 'dernierEchangeLe', label: 'Date du dernier échange', width: 22, datetime: true },
  { key: 'echange1', label: 'Dernier échange', width: 90 },
  { key: 'echange2', label: '2e échange', width: 90 },
  { key: 'echange3', label: '3e échange', width: 90 },
];
const columnsFor = (withExchanges) => (withExchanges ? [...COLUMNS, ...EXCHANGE_COLUMNS] : COLUMNS);

// Échanges d'un client non lus (réseau, serveur) : on le dit dans la cellule plutôt que de la laisser vide.
const UNREAD = 'Échanges non lus (erreur de lecture)';

// Deux décimales, sans surprise de flottant (0,1 + 0,2 ne doit pas sortir en
// 0,30000000000000004 dans une cellule numérique).
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Construit les lignes de l'export à partir des lignes AFFICHÉES.
 * Trié par total dû décroissant : une liste de relance se lit en commençant
 * par ce qui coûte le plus cher.
 */
export function buildExportRows(rows, scope, { etatOf, meteoOf, exchanges } = {}) {
  return (rows || [])
    .map((r) => {
      const anterieures = round2(scopedOverdueCum(r, scope));
      const moisCourant = round2(scopedOverdueCurrent(r, scope));
      const line = {
        numero: r.pending ? "Attente Opti'Lex" : (r.client?.numero_client || ''),
        client: r.client?.company_name || r.client?.societe || '',
        anterieures,
        moisCourant,
        total: round2(anterieures + moisCourant),
        telephone: r.client?.phone || '',
        email: r.client?.email || '',
        // État du board et marqueurs : les valeurs que la page affiche, jamais recalculées ici.
        etat: etatOf?.(r) || '',
        tags: tagsOf(r, meteoOf?.(r) || null).join(' · '),
      };
      if (!exchanges) return line;
      const found = exchanges.get(exchangeKey(r));
      const items = found?.items || [];
      return {
        ...line,
        dernierEchangeLe: items.length ? excelSerial(items[0].at) : '',
        echange1: found?.failed && !items.length ? UNREAD : (items[0] ? formatExchange(items[0]) : ''),
        echange2: items[1] ? formatExchange(items[1]) : '',
        echange3: items[2] ? formatExchange(items[2]) : '',
      };
    })
    .sort((a, b) => b.total - a.total);
}

/**
 * Construit le classeur (sans le télécharger : se teste seul).
 * @returns {{ book: object, name: string, count: number }}
 */
export function buildWorkbook({ rows, scope, period, etatOf, meteoOf, exchanges }) {
  const columns = columnsFor(!!exchanges);
  const data = buildExportRows(rows, scope, { etatOf, meteoOf, exchanges });

  const sheet = XLSX.utils.json_to_sheet(data, {
    header: columns.map((c) => c.key),
  });

  // En-têtes lisibles à la place des clés techniques.
  columns.forEach((col, i) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c: i });
    if (sheet[ref]) sheet[ref].v = col.label;
  });

  // Format monétaire sur les colonnes de montants, format date-heure sur celle de la date d'échange.
  columns.forEach((col, i) => {
    if (!col.money && !col.datetime) return;
    for (let row = 1; row <= data.length; row += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: i })];
      if (cell && cell.t === 'n') cell.z = col.money ? EUR_FMT : DATETIME_FMT;
    }
  });

  sheet['!cols'] = columns.map((c) => ({ wch: c.width }));
  // Fige la ligne d'en-tête : sur 700 lignes, on veut garder les titres.
  sheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  sheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(data.length, 1), c: columns.length - 1 },
    }),
  };

  const scopeLabel = SCOPE_LABEL[scope] || 'Globale';
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, `Retards ${scopeLabel}`.slice(0, 31));

  // Le nom du fichier porte le contexte : sans lui, trois exports du même
  // jour sur trois visions différentes seraient indiscernables.
  const monthTag = String(period || '').slice(0, 7) || 'periode';
  const name = `retards-${scopeLabel.toLowerCase().replace(/['’]/g, '')}-${monthTag}.xlsx`;
  return { book, name, count: data.length };
}

/**
 * Génère et télécharge le classeur.
 * `exchanges` : table lue par `loadExchanges` (exportExchanges.js) ; sans elle, pas de colonnes d'échanges.
 * @returns {number} nombre de lignes exportées
 */
export function exportFinanceXlsx(options) {
  const { book, name, count } = buildWorkbook(options);
  XLSX.writeFile(book, name);
  return count;
}

export { SCOPE_LABEL };
