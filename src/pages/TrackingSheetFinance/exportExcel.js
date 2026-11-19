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
// Demande 2026-11-19 : TOUS les tags du client (no show, rétractation, résiliation, récupéré…) et une vraie mise en
// page, lisible sans être chargée : bandeau titre, colonnes regroupées par famille (Client · Créances · Contact ·
// Suivi · Échanges) à la teinte pastel, état et météo aux couleurs du board, tags un par ligne teintés selon leur
// gravité, lignes zébrées très clair, en-têtes figés, filtres actifs, total qui suit les filtres. Rien n'est retiré.
//
// `xlsx-js-style` = le moteur de `xlsx` (mêmes fonctions) plus l'écriture des styles. Il ne sait ni figer des volets
// ni masquer le quadrillage : `finishSheetXml` retouche le fichier généré (fflate, déjà installé avec le moteur PDF).

// Import par défaut : le paquet est en CommonJS (pas de « module »), seule la forme par défaut marche partout (Vite, node).
import XLSX from 'xlsx-js-style';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import { scopedOverdueCurrent, scopedOverdueCum } from './constants.js';
import { exchangeKey, excelSerial, formatExchange, parisText, tagsOf } from './exportExchanges.js';

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

// ── Palette (pastels du board Owner) ────────────────────────────────────────
const INK = '1F2A44';        // texte courant et bandeau titre
const MUTED = '5B6472';
const ZERO = '9AA1AD';       // montant nul : présent, mais discret
const LINE = 'E3E6EB';       // filet entre deux lignes
const ZEBRA = 'F8F9FB';
const OVERDUE = 'B42318';    // total en retard
const TONE_SEVERE = { bg: 'FDE6E6', fg: 'B42318' };
const TONE_WATCH = { bg: 'FBF1C2', fg: '7A5A05' };
const TONE_OK = { bg: 'E2F6EA', fg: '0B7A4B' };

// Familles de colonnes : bandeau (teinte), en-tête (teinte plus claire), texte du bandeau.
const GROUPS = {
  client: { label: 'Client', band: 'DCE8F8', head: 'EAF1FB', ink: '1B4F9C' },
  creances: { label: 'Créances', band: 'FDE9D2', head: 'FEF3E6', ink: '9A4A0B' },
  contact: { label: 'Contact', band: 'D9F0E8', head: 'ECF8F3', ink: '17694D' },
  suivi: { label: 'Suivi', band: 'E8E4F8', head: 'F3F1FC', ink: '4A3FC4' },
  echanges: { label: 'Derniers échanges', band: 'E6E9EE', head: 'F2F4F7', ink: '3C4655' },
};

const COLUMNS = [
  { key: 'numero', label: 'N° client', width: 12, group: 'client', align: 'center' },
  { key: 'client', label: 'Client', width: 34, group: 'client', bold: true },
  { key: 'anterieures', label: 'Créances antérieures', width: 17, group: 'creances', money: true },
  { key: 'moisCourant', label: 'Créance du mois en cours', width: 17, group: 'creances', money: true },
  { key: 'total', label: 'Total en retard', width: 16, group: 'creances', money: true, total: true },
  { key: 'telephone', label: 'Téléphone', width: 17, group: 'contact' },
  { key: 'email', label: 'Email', width: 30, group: 'contact' },
  { key: 'etat', label: 'État', width: 24, group: 'suivi', align: 'center', tone: 'etat' },
  { key: 'meteo', label: 'Météo', width: 15, group: 'suivi', align: 'center', tone: 'meteo' },
  { key: 'tags', label: 'Tags', width: 44, group: 'suivi', wrap: true, tone: 'tags' },
];

// Les colonnes d'échanges n'existent que si l'appelant a lu les échanges : sans eux, des colonnes vides
// laisseraient croire que personne n'a rien écrit.
const EXCHANGE_COLUMNS = [
  { key: 'dernierEchangeLe', label: 'Date du dernier échange', width: 19, group: 'echanges', datetime: true, align: 'center' },
  { key: 'echange1', label: 'Dernier échange', width: 66, group: 'echanges', wrap: true },
  { key: 'echange2', label: '2e échange', width: 66, group: 'echanges', wrap: true },
  { key: 'echange3', label: '3e échange', width: 66, group: 'echanges', wrap: true },
];
const columnsFor = (withExchanges) => (withExchanges ? [...COLUMNS, ...EXCHANGE_COLUMNS] : COLUMNS);

// Échanges d'un client non lus (réseau, serveur) : on le dit dans la cellule plutôt que de la laisser vide.
const UNREAD = 'Échanges non lus (erreur de lecture)';

// Deux décimales, sans surprise de flottant (0,1 + 0,2 ne doit pas sortir en
// 0,30000000000000004 dans une cellule numérique).
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Lignes avant les données : 0 titre, 1 sous-titre, 2 filet, 3 bandeau des familles, 4 en-têtes.
export const HEADER_ROW = 4;

const hex = (c) => String(c || '').replace('#', '').toUpperCase();

/**
 * Construit les lignes de l'export à partir des lignes AFFICHÉES.
 * Trié par total dû décroissant : une liste de relance se lit en commençant
 * par ce qui coûte le plus cher.
 * `etatToneOf(etat)` → `{bg, fg}` et `meteoOf(r)` → `{label, score, bg, fg}` : les couleurs du board, jamais redéfinies ici.
 */
export function buildExportRows(rows, scope, { etatOf, etatToneOf, meteoOf, boardOf, exchanges } = {}) {
  return (rows || [])
    .map((r) => {
      const anterieures = round2(scopedOverdueCum(r, scope));
      const moisCourant = round2(scopedOverdueCurrent(r, scope));
      const meteo = meteoOf?.(r) || null;
      const etat = etatOf?.(r) || '';
      const line = {
        numero: r.pending ? "Attente Opti'Lex" : (r.client?.numero_client || ''),
        client: r.client?.company_name || r.client?.societe || '',
        anterieures,
        moisCourant,
        total: round2(anterieures + moisCourant),
        telephone: r.client?.phone || '',
        email: r.client?.email || '',
        // État du board et marqueurs : les valeurs que la page affiche, jamais recalculées ici.
        etat,
        meteo: meteo?.label ? `${meteo.label}${meteo.score != null ? ` (${meteo.score}/5)` : ''}` : '',
        // Tous les tags du client, un par ligne de la cellule (la météo a sa propre colonne).
        tags: tagsOf(r, null, boardOf?.(r) || {}).join('\n'),
      };
      // Teintes du board, pour la mise en page seulement (propriétés non énumérables : ce ne sont pas des colonnes).
      Object.defineProperty(line, 'tones', {
        value: { etat: etat ? etatToneOf?.(etat) || null : null, meteo: meteo?.bg ? meteo : null },
      });
      if (!exchanges) return line;
      const found = exchanges.get(exchangeKey(r));
      const items = found?.items || [];
      return Object.defineProperty({
        ...line,
        dernierEchangeLe: items.length ? excelSerial(items[0].at) : '',
        echange1: found?.failed && !items.length ? UNREAD : (items[0] ? formatExchange(items[0]) : ''),
        echange2: items[1] ? formatExchange(items[1]) : '',
        echange3: items[2] ? formatExchange(items[2]) : '',
      }, 'tones', { value: line.tones });
    })
    .sort((a, b) => b.total - a.total);
}

// ── Styles ──────────────────────────────────────────────────────────────────
const fill = (rgb) => ({ patternType: 'solid', fgColor: { rgb: hex(rgb) } });
const font = (rgb, { bold = false, sz = 10, italic = false } = {}) => ({ name: 'Calibri', sz, bold, italic, color: { rgb: hex(rgb) } });
const edge = (rgb, style = 'thin') => ({ style, color: { rgb: hex(rgb) } });

// Gravité d'une cellule de tags : rouge si un départ, une perte ou un no show ; ambre pour le reste à surveiller ;
// vert quand le seul marqueur est « Récupéré ».
const SEVERE_TAG = /^(En cours de )?(rétractation|résiliation)|^Self-Résiliation|^Perte actée|^No show/i;
function tagsTone(text) {
  const tags = String(text || '').split('\n').filter(Boolean);
  if (!tags.length) return null;
  if (tags.some((t) => SEVERE_TAG.test(t))) return TONE_SEVERE;
  if (tags.every((t) => /^Récupéré/.test(t))) return TONE_OK;
  return TONE_WATCH;
}

// Hauteur d'une ligne : le nombre de lignes de texte de ses cellules à retour automatique.
function rowHeight(line, columns) {
  let lines = 1;
  for (const col of columns) {
    if (!col.wrap) continue;
    const text = String(line[col.key] ?? '');
    if (!text) continue;
    const perLine = Math.max(8, Math.floor(col.width * 1.05));
    lines = Math.max(lines, text.split('\n').reduce((n, part) => n + Math.max(1, Math.ceil(part.length / perLine)), 0));
  }
  return Math.min(180, Math.max(21, lines * 13.5 + 8));
}

const monthLabel = (period) => {
  const m = String(period || '').match(/^(\d{4})-(\d{2})/);
  if (!m) return '';
  const label = new Date(Date.UTC(+m[1], +m[2] - 1, 1)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return label;
};

/**
 * Construit le classeur (sans le télécharger : se teste seul).
 * @returns {{ book: object, name: string, count: number }}
 */
export function buildWorkbook({ rows, scope, period, etatOf, etatToneOf, meteoOf, boardOf, exchanges, now = Date.now() }) {
  const columns = columnsFor(!!exchanges);
  const data = buildExportRows(rows, scope, { etatOf, etatToneOf, meteoOf, boardOf, exchanges });
  const last = columns.length - 1;
  const first = HEADER_ROW + 1;
  const sheet = {};
  const heights = [];
  const merges = [];
  const put = (r, c, cell) => { sheet[XLSX.utils.encode_cell({ r, c })] = cell; };
  const span = (r, c1, c2, cell, style) => {            // cellule fusionnée : le style couvre toute la plage
    put(r, c1, { ...cell, s: style });
    for (let c = c1 + 1; c <= c2; c += 1) put(r, c, { t: 's', v: '', s: style });
    if (c2 > c1) merges.push({ s: { r, c: c1 }, e: { r, c: c2 } });
  };

  const scopeLabel = SCOPE_LABEL[scope] || 'Globale';

  // 0 — bandeau titre ; 1 — contexte ; 2 — filet
  span(0, 0, last, { t: 's', v: `Suivi des retards — ${scopeLabel}` },
    { fill: fill(INK), font: font('FFFFFF', { bold: true, sz: 16 }), alignment: { vertical: 'center', horizontal: 'left', indent: 1 } });
  heights[0] = 34;
  const month = monthLabel(period);
  const context = [month && `Période : ${month}`, `${data.length} client${data.length > 1 ? 's' : ''}`, `Exporté le ${parisText(now).slice(0, 10)}`]
    .filter(Boolean).join('   ·   ');
  span(1, 0, last, { t: 's', v: context }, { font: font(MUTED, { sz: 10, italic: true }), alignment: { vertical: 'center', horizontal: 'left', indent: 1 } });
  heights[1] = 20;
  heights[2] = 6;

  // 3 — bandeau des familles (une cellule fusionnée par famille consécutive)
  heights[3] = 20;
  let c = 0;
  while (c < columns.length) {
    const g = GROUPS[columns[c].group];
    let end = c;
    while (end + 1 < columns.length && columns[end + 1].group === columns[c].group) end += 1;
    span(3, c, end, { t: 's', v: g.label.toUpperCase() }, {
      fill: fill(g.band), font: font(g.ink, { bold: true, sz: 9 }), alignment: { vertical: 'center', horizontal: 'center' },
      border: { left: edge('FFFFFF', 'medium'), right: edge('FFFFFF', 'medium') },
    });
    c = end + 1;
  }

  // 4 — en-têtes
  heights[HEADER_ROW] = 34;
  columns.forEach((col, i) => {
    const g = GROUPS[col.group];
    put(HEADER_ROW, i, {
      t: 's', v: col.label,
      s: {
        fill: fill(g.head), font: font(INK, { bold: true, sz: 10 }),
        alignment: { vertical: 'center', horizontal: col.money ? 'right' : (col.align || 'left'), wrapText: true },
        border: { bottom: edge(g.ink, 'medium'), left: edge('FFFFFF', 'medium'), right: edge('FFFFFF', 'medium') },
      },
    });
  });

  // Données
  data.forEach((line, idx) => {
    const r = first + idx;
    const base = idx % 2 ? ZEBRA : 'FFFFFF';
    heights[r] = rowHeight(line, columns);
    columns.forEach((col, i) => {
      const value = line[col.key];
      let style = {
        fill: fill(base), font: font(INK, { bold: !!col.bold }),
        alignment: { vertical: 'center', horizontal: col.money ? 'right' : (col.align || 'left'), wrapText: !!col.wrap, indent: col.money || col.align ? 0 : 1 },
        border: { bottom: edge(LINE) },
      };
      if (col.money) {
        style.font = font(value > 0 ? (col.total ? OVERDUE : INK) : ZERO, { bold: !!col.total });
      } else if (col.tone) {
        const tone = col.tone === 'tags' ? tagsTone(value) : (col.tone === 'etat' ? line.tones?.etat : line.tones?.meteo);
        const fg = tone?.fg || tone?.color;
        if (value && tone?.bg && fg) {
          style = { ...style, fill: fill(tone.bg), font: font(fg, { bold: true }), alignment: { ...style.alignment, indent: 0 } };
          if (col.tone === 'tags') style.alignment = { ...style.alignment, horizontal: 'left', indent: 1 };
        }
      }
      const cell = typeof value === 'number' ? { t: 'n', v: value } : { t: 's', v: value == null ? '' : String(value) };
      if (col.money) cell.z = EUR_FMT;
      else if (col.datetime && cell.t === 'n') cell.z = DATETIME_FMT;
      put(r, i, { ...cell, s: style });
    });
  });

  // Total des lignes affichées : SUBTOTAL ne compte que ce que les filtres laissent visible.
  const lastRow = first + data.length - 1;
  let rangeEnd = HEADER_ROW;
  if (data.length) {
    const t = lastRow + 1;
    rangeEnd = t;
    heights[t] = 26;
    const totalStyle = (money) => ({
      fill: fill('F2F4F7'), font: font(INK, { bold: true, sz: 10 }),
      alignment: { vertical: 'center', horizontal: money ? 'right' : 'left', indent: money ? 0 : 1 },
      border: { top: edge(INK, 'medium') },
    });
    span(t, 0, 1, { t: 's', v: 'Total des lignes affichées' }, totalStyle(false));
    for (let i = 2; i <= last; i += 1) put(t, i, { t: 's', v: '', s: totalStyle(false) });
    ['anterieures', 'moisCourant', 'total'].forEach((key) => {
      const i = columns.findIndex((col) => col.key === key);
      const letter = XLSX.utils.encode_col(i);
      put(t, i, {
        t: 'n', v: round2(data.reduce((sum, l) => sum + l[key], 0)), z: EUR_FMT,
        f: `SUBTOTAL(109,${letter}${first + 1}:${letter}${lastRow + 1})`,
        s: { ...totalStyle(true), font: font(key === 'total' ? OVERDUE : INK, { bold: true }) },
      });
    });
  }

  sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rangeEnd, c: last } });
  sheet['!cols'] = columns.map((col) => ({ wch: col.width }));
  sheet['!rows'] = heights.map((hpt) => (hpt ? { hpt } : {}));
  sheet['!merges'] = merges;
  // Filtres sur les en-têtes ; le total, hors plage, reste sous le tableau.
  sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: HEADER_ROW, c: 0 }, e: { r: Math.max(lastRow, HEADER_ROW), c: last } }) };

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, `Retards ${scopeLabel}`.slice(0, 31));

  // Le nom du fichier porte le contexte : sans lui, trois exports du même
  // jour sur trois visions différentes seraient indiscernables.
  const monthTag = String(period || '').slice(0, 7) || 'periode';
  const name = `retards-${scopeLabel.toLowerCase().replace(/['’]/g, '')}-${monthTag}.xlsx`;
  return { book, name, count: data.length };
}


/**
 * Retouche la feuille générée : en-têtes figés (les lignes avant les données restent visibles), quadrillage masqué.
 * @param {Uint8Array} bytes   classeur .xlsx
 * @param {number} frozenRows  nombre de lignes à figer
 * @returns {Uint8Array}
 */
export function finishSheetXml(bytes, frozenRows) {
  const files = unzipSync(bytes);
  const key = Object.keys(files).find((k) => /^xl\/worksheets\/sheet1\.xml$/.test(k));
  if (!key) return bytes;
  const view = `<sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="${frozenRows}" topLeftCell="A${frozenRows + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${frozenRows + 1}" sqref="A${frozenRows + 1}"/></sheetView></sheetViews>`;
  let xml = strFromU8(files[key]);
  if (/<sheetViews>[\s\S]*?<\/sheetViews>/.test(xml)) xml = xml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, view);
  else if (/<sheetFormatPr|<cols>|<sheetData/.test(xml)) xml = xml.replace(/(<sheetFormatPr|<cols>|<sheetData)/, `${view}$1`);
  files[key] = strToU8(xml);
  return zipSync(files, { level: 6 });
}

/**
 * Génère et télécharge le classeur.
 * `exchanges` : table lue par `loadExchanges` (exportExchanges.js) ; sans elle, pas de colonnes d'échanges.
 * @returns {number} nombre de lignes exportées
 */
export function exportFinanceXlsx(options) {
  const { book, name, count } = buildWorkbook(options);
  const bytes = finishSheetXml(new Uint8Array(XLSX.write(book, { bookType: 'xlsx', type: 'array' })), HEADER_ROW + 1);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return count;
}

export { SCOPE_LABEL };
