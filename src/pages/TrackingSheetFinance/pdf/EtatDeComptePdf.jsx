// EtatDeComptePdf.jsx — état de compte client PDF (phase 4 Tracking Finance).
//
// Réplique fidèle du rendu de référence fourni par la finance (export du
// Google Sheet officiel, « Etat de compte - Feuille 1.pdf », 2026-08-21) :
// A4 PAYSAGE, bandeau navy « Owner Technology », titre « Etat de compte »
// (orthographe verbatim de la référence), date courte DD/MM/YY en haut à
// gauche, blocs Issuer (gauche) / Recipient (décalé à droite) aux labels
// gras TOUJOURS affichés même à valeur vide, tableau à en-tête navy blanc,
// ligne Total = barre navy + total du Restant dû en ROUGE gras (un seul
// total, comme la référence).
//
// Améliorations assumées vs la référence (validées par le dev) :
//   - « Company » au lieu de la coquille « Compagny » du Sheet
//   - ligne « Client : n°X » dans le bloc Recipient
//   - alignements propres, tabular-nums, en-tête de tableau répété sur
//     chaque page (fixed), footer discret de pagination
//
// Documents séparés par émetteur Owner / Opti’Lex, et par société choisie.
// Génération frontend via @react-pdf/renderer, depuis les données relues
// par le DetailPanel (aucun appel réseau ici). Module chargé en
// LAZY (dynamic import) : @react-pdf/renderer part dans un chunk séparé.
//
// Piège encodage géré : Helvetica (font standard PDF, WinAnsi) ne connaît
// pas l'espace fine insécable U+202F que `toLocaleString('fr-FR')` insère
// comme séparateur de milliers → `pdfSafe` la remplace avant rendu.

import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { formatEUR } from '../constants.js';

// ── Émetteurs ────────────────────────────────────────────────────────────
// Deux entités juridiques distinctes → deux états de compte séparés (jamais
// de document « fusionné »), sélectionnés par la vision active du tableau.
//
// `name`  : texte du bandeau navy.
// `block` : lignes du bloc émetteur, dans l'ordre du modèle officiel de
//           chaque entité. Une entrée = { label?, value } — sans `label`
//           la ligne est brute (gabarit Opti'lex), avec `label` elle est
//           rendue « Label : valeur » (gabarit Owner).
export const ISSUER_OWNER = {
  name: 'Owner Technology',
  block: [
    { label: 'Company', value: 'Owner Technology FZCO' },
    { label: 'Address', value: 'Building A1, Digital Park,' },
    { value: 'D.S.O, U.A.E' },
    { label: 'Trade licence', value: '55092' },
  ],
};

// Valeurs recopiées du modèle officiel du cabinet (optilex.xlsx, 2026-08-25).
export const ISSUER_OPTILEX = {
  name: 'Optilex',
  block: [
    { value: "OPTI'LEX", bold: true },
    { value: '11 Boulevard De Sébastopol' },
    { value: '75001 Paris, FR' },
    { value: 'cabinetoptilex@gmail.com' },
    { label: 'SIRET', value: '94029967000015' },
  ],
};

export const ISSUER_BY_ENTITY = { owner: ISSUER_OWNER, optilex: ISSUER_OPTILEX };

// Sanitize pour l'encodage WinAnsi des fonts standard (cf. en-tête).
const pdfSafe = (s) => String(s ?? '').replace(/[\u202F\u00A0]/g, ' ');
const eur = (v) => pdfSafe(formatEUR(v));

// Navy charte Owner (ref_owner_brand_colors) — bandeau + en-têtes du Sheet.
const NAVY = '#121b35';
const INK = '#1e2330';
const MUTED = '#5b6472';
const BORDER = '#1e2330';
const RED = '#e11919';   // rouge vif du total de la référence
const GREEN = '#15794a'; // solde négatif = trop-perçu global (crédit)

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: INK,
    paddingTop: 30,
    paddingBottom: 40,
    paddingHorizontal: 46,
  },
  // 1. Bandeau navy pleine largeur
  banner: {
    backgroundColor: NAVY,
    paddingVertical: 8,
    marginBottom: 10,
  },
  bannerText: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    textAlign: 'center',
  },
  // 2. Titre
  title: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    textAlign: 'center',
    color: '#000000',
    marginBottom: 12,
  },
  // 3. Date d'émission (petite, haut gauche)
  issueDate: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    marginBottom: 10,
  },
  // 4-5. Blocs parties
  partiesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  partyBlockLeft: { width: '44%' },
  partyBlockRight: { width: '38%', paddingTop: 12 },
  partyTitle: {
    fontFamily: 'Helvetica-BoldOblique',
    fontSize: 11,
    color: NAVY,
    marginBottom: 8,
    marginLeft: 24,
  },
  partyLine: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 3.5 },
  partyLabel: { fontFamily: 'Helvetica-Bold' },
  partyValue: {},
  // 6. Tableau
  table: {},
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: NAVY,
  },
  th: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    textAlign: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRightWidth: 0.6,
    borderRightColor: '#ffffff',
  },
  thLast: { borderRightWidth: 0 },
  tr: { flexDirection: 'row' },
  td: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 0.6,
    borderBottomColor: BORDER,
    borderRightWidth: 0.6,
    borderRightColor: BORDER,
    textAlign: 'center',
  },
  tdFirst: { borderLeftWidth: 0.6, borderLeftColor: BORDER },
  tdBold: { fontFamily: 'Helvetica-Bold' },
  // 7. Ligne Total
  totalRow: { flexDirection: 'row' },
  totalBar: {
    backgroundColor: NAVY,
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  totalBarText: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5,
    textAlign: 'right',
  },
  totalCell: {
    borderWidth: 0.6,
    borderColor: BORDER,
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
  },
  totalCellText: {
    // color posée dynamiquement au rendu : rouge si dû, vert si crédit, noir si 0.
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 46,
    right: 46,
    fontSize: 7,
    color: MUTED,
    textAlign: 'center',
  },
});

// Largeurs de colonnes (somme = 100 %) — proportions de la référence.
const COLW = { period: '18%', offre: '30%', billed: '14%', paid: '14%', remaining: '24%' };
// Largeur de la barre navy du Total = toutes les colonnes sauf Restant dû.
const TOTAL_BAR_W = '76%';

// Ligne d'un bloc partie :
//   - avec `label` → « Label : valeur », le label gras restant affiché même
//     à valeur vide (fidèle aux modèles : « Adresse postale : », « Siret : »)
//   - sans `label` → ligne brute (gabarit émetteur Opti'lex, nom de société
//     en tête du bloc Entreprise), `bold` pour la ligne de tête.
function PartyLine({ label, value, bold = false }) {
  if (!label) {
    return (
      <View style={styles.partyLine}>
        <Text style={bold ? styles.partyLabel : styles.partyValue}>{pdfSafe(value || '')}</Text>
      </View>
    );
  }
  return (
    <View style={styles.partyLine}>
      <Text style={styles.partyLabel}>{`${pdfSafe(label)} : `}</Text>
      <Text style={styles.partyValue}>{pdfSafe(value || '')}</Text>
    </View>
  );
}

function EtatDeComptePdf({ issuer, recipient, rows, issueDate, paymentsOnly = false, allocations = [] }) {
  const widths = paymentsOnly
    ? { period: '24%', offre: '32%', paid: '22%', remaining: '22%' } : COLW;
  const totalWidth = paymentsOnly ? '78%' : TOTAL_BAR_W;
  // « Restant dû » = SOLDE CUMULÉ après chaque période (logique comptable,
  // retour dev ZILWA n°637 2026-08-21) : solde += facturé − payé ligne à
  // ligne. Un paiement excédentaire régularise les mois précédents (le solde
  // retombe à 0) au lieu d'afficher un « -X € » isolé ; un solde cumulé
  // réellement négatif = trop-perçu global, affiché en négatif (vert).
  let running = 0;
  const computed = rows.map((r) => {
    running += paymentsOnly ? r.paid : r.billed - r.paid;
    return { ...r, solde: running };
  });
  // Total = solde final (= Σ facturé − Σ payé du périmètre) : c'est par
  // construction le dernier solde de la colonne.
  const totalRemaining = running;
  if (import.meta.env?.DEV) {
    // Assertion de cohérence (dev only) : les deux calculs doivent coïncider.
    const check = rows.reduce((acc, r) => acc + (paymentsOnly ? r.paid : r.billed - r.paid), 0);
    if (Math.abs(check - totalRemaining) > 0.005) {
      console.warn('[EtatDeComptePdf] incohérence solde final', { check, totalRemaining });
    }
  }

  return (
    <Document
      title={`Etat de compte — ${pdfSafe(recipient.company || 'Client')}`}
      author="Owner Technology"
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* 1. Bandeau navy */}
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{pdfSafe(issuer.name)}</Text>
        </View>

        {/* 2. Titre — orthographe verbatim de la référence */}
        <Text style={styles.title}>{paymentsOnly ? 'Relevé des règlements par société' : 'Etat de compte'}</Text>
        {paymentsOnly && <Text style={{ fontSize: 8, color: MUTED, marginBottom: 8 }}>Ce relevé présente uniquement les règlements attribués à cette société. Les montants non ventilés et les remboursements du dossier ne sont pas inclus. Aucun reste dû par société n’est calculé.</Text>}

        {/* 3. Date d'émission */}
        <Text style={styles.issueDate}>{pdfSafe(issueDate)}</Text>

        {/* 4-5. Issuer | Recipient */}
        <View style={styles.partiesRow}>
          {/* Émetteur — bloc propre à l'entité (gabarit de son modèle) */}
          <View style={styles.partyBlockLeft}>
            <Text style={styles.partyTitle}>Issuer</Text>
            {issuer.block.map((l, i) => (
              <PartyLine key={i} label={l.label} value={l.value} bold={l.bold} />
            ))}
          </View>

          {/* Destinataire — présentation UNIQUE aux deux entités (modèle
              Opti'lex retenu par le dev) : titre « Entreprise », nom de
              société en tête, puis Adresse postale / Adresse mail / Siret.
              Libellés du modèle avec ses coquilles corrigées
              (« Adresse postable » → « Adresse postale », « Addresse mail »
              → « Adresse mail »), comme « Compagny » → « Company ». */}
          <View style={styles.partyBlockRight}>
            <Text style={styles.partyTitle}>Entreprise</Text>
            <PartyLine value={recipient.company} bold />
            <PartyLine
              label={recipient.clientLabel || 'Client'}
              value={[
                recipient.person || null,
                recipient.clientNumber ? `n°${recipient.clientNumber}` : null,
              ].filter(Boolean).join(' · ')}
            />
            {/* Valeurs vides tolérées : le libellé reste affiché (modèle). */}
            {(!paymentsOnly || recipient.address) && <PartyLine label="Adresse postale" value={recipient.address} />}
            {(!paymentsOnly || recipient.email) && <PartyLine label="Adresse mail" value={recipient.email} />}
            <PartyLine label={recipient.identifierLabel || 'SIRET'} value={recipient.siret || 'Non renseigné'} />
          </View>
        </View>

        {/* 6. Tableau */}
        <View style={styles.table}>
          {/* En-tête répété sur chaque page (amélioration assumée) */}
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.th, { width: widths.period }]}>Période</Text>
            <Text style={[styles.th, { width: widths.offre }]}>{paymentsOnly ? 'Nature du règlement' : 'Offre'}</Text>
            {!paymentsOnly && <Text style={[styles.th, { width: widths.billed }]}>Montant facturé</Text>}
            <Text style={[styles.th, { width: widths.paid }]}>Montant payé</Text>
            <Text style={[styles.th, styles.thLast, { width: widths.remaining }]}>{paymentsOnly ? 'Cumul réglé' : 'Restant dû'}</Text>
          </View>

          {/* Aucune échéance facturée sur le périmètre : le document sort
              quand même (en-tête + bloc client), avec une ligne explicite
              et un Total à 0,00 € — l'état de compte doit être
              téléchargeable pour TOUS les clients (dev 2026-08-25). */}
          {computed.length === 0 && (
            <View style={styles.tr} wrap={false}>
              <Text style={[styles.td, styles.tdFirst, { width: '100%', color: MUTED }]}>
                {paymentsOnly ? 'Aucun règlement attribué sur la période' : 'Aucune échéance sur la période'}
              </Text>
            </View>
          )}

          {computed.map((r, i) => (
            <View key={i} style={styles.tr} wrap={false}>
              <Text style={[styles.td, styles.tdFirst, styles.tdBold, { width: widths.period }]}>
                {pdfSafe(r.periodLabel)}
              </Text>
              <Text style={[styles.td, styles.tdBold, { width: widths.offre }]}>{pdfSafe(r.offre)}</Text>
              {!paymentsOnly && <Text style={[styles.td, { width: widths.billed }]}>{eur(r.billed)}</Text>}
              <Text style={[styles.td, { width: widths.paid }]}>{eur(r.paid)}</Text>
              <Text style={[styles.td, { width: widths.remaining, color: r.solde < 0 ? GREEN : INK }]}>
                {r.solde < 0 ? `-${eur(-r.solde)}` : eur(r.solde)}
              </Text>
            </View>
          ))}

          {/* 7. Total = solde final : rouge si dû, vert si crédit, noir si 0 */}
          <View style={styles.totalRow} wrap={false}>
            <View style={[styles.totalBar, { width: totalWidth }]}>
              <Text style={styles.totalBarText}>{paymentsOnly ? 'Total réglé par cette société' : 'Total'}</Text>
            </View>
            <View style={[styles.totalCell, { width: widths.remaining }]}>
              <Text style={[
                styles.totalCellText,
                { color: paymentsOnly ? INK : totalRemaining > 0 ? RED : totalRemaining < 0 ? GREEN : INK },
              ]}>
                {totalRemaining < 0 ? `-${eur(-totalRemaining)}` : eur(totalRemaining)}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer discret de pagination (amélioration assumée) */}
        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `page ${pageNumber} / ${totalPages}` : ''
          }
        />
      </Page>
      {!paymentsOnly && allocations.length > 0 && (
        <Page size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.banner}><Text style={styles.bannerText}>{pdfSafe(issuer.name)}</Text></View>
          <Text style={styles.title}>Répartition des règlements par société</Text>
          <Text style={{ fontSize: 9, marginBottom: 8 }}>{pdfSafe(recipient.company)} · Dossier n°{pdfSafe(recipient.clientNumber)} · {pdfSafe(issueDate)}</Text>
          <Text style={{ fontSize: 8, color: MUTED, marginBottom: 12 }}>Les montants « Non ventilé » restent au niveau du dossier. Cette répartition détaille les encaissements ; les remboursements du dossier figurent dans l’état de compte précédent.</Text>
          {allocations.some(r => r.mismatch) && <Text style={{ fontSize: 8, color: RED, marginBottom: 10 }}>Un écart négatif indique une ventilation supérieure à l’encaissement enregistré. Il reste à vérifier et ne constitue pas un remboursement.</Text>}
          <View style={styles.table}>
            <View style={styles.tableHeader} fixed>
              <Text style={[styles.th, { width: '18%' }]}>Période</Text>
              <Text style={[styles.th, { width: '38%' }]}>Société</Text>
              <Text style={[styles.th, { width: '22%' }]}>Nature du règlement</Text>
              <Text style={[styles.th, styles.thLast, { width: '22%' }]}>Montant</Text>
            </View>
            {allocations.map((r, i) => (
              <View key={i} style={styles.tr} wrap={false}>
                <Text style={[styles.td, styles.tdFirst, { width: '18%' }]}>{pdfSafe(r.periodLabel)}</Text>
                <Text style={[styles.td, { width: '38%', textAlign: 'left', color: r.mismatch ? RED : INK }]}>{pdfSafe(r.company)}{r.identifier ? `\nSIREN : ${pdfSafe(r.identifier)}` : ''}</Text>
                <Text style={[styles.td, { width: '22%' }]}>{pdfSafe(r.kindLabel)}</Text>
                <Text style={[styles.td, { width: '22%', color: r.mismatch ? RED : INK }]}>{eur(r.paid)}</Text>
              </View>
            ))}
            <View style={styles.totalRow} wrap={false}>
              <View style={[styles.totalBar, { width: '78%' }]}><Text style={styles.totalBarText}>Total des encaissements du dossier, hors remboursements</Text></View>
              <View style={[styles.totalCell, { width: '22%' }]}><Text style={styles.totalCellText}>{eur(allocations.reduce((sum, r) => sum + r.paid, 0))}</Text></View>
            </View>
          </View>
          <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => `page ${pageNumber} / ${totalPages}`} />
        </Page>
      )}
    </Document>
  );
}

// Point d'entrée consommé par le DetailPanel (lazy import) : rend le
// document et retourne un Blob prêt pour le download.
// `entity` : 'owner' | 'optilex' → sélectionne l'émetteur (deux entités
// juridiques distinctes, jamais de document fusionné). `issuer` explicite
// reste possible (tests / futur template).
export async function generateEtatDeCompte(props) {
  const issuer = props.issuer || ISSUER_BY_ENTITY[props.entity] || ISSUER_OWNER;
  return pdf(<EtatDeComptePdf {...props} issuer={issuer} />).toBlob();
}

export default EtatDeComptePdf;
