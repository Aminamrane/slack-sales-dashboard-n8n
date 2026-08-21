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
// Document EXCLUSIVEMENT OWNER (décision dev 2026-08-21) : Opti'lex gère
// ses propres états de compte — les montants sont toujours les montants
// Owner, quelle que soit la vision active du panneau.
//
// Génération 100 % frontend via @react-pdf/renderer, depuis les données déjà
// chargées par le DetailPanel (aucun appel réseau ici). Module chargé en
// LAZY (dynamic import) : @react-pdf/renderer part dans un chunk séparé.
//
// Piège encodage géré : Helvetica (font standard PDF, WinAnsi) ne connaît
// pas l'espace fine insécable U+202F que `toLocaleString('fr-FR')` insère
// comme séparateur de milliers → `pdfSafe` la remplace avant rendu.

import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { formatEUR } from '../constants.js';

// ── Émetteur ─────────────────────────────────────────────────────────────
// Valeurs du template officiel. Owner uniquement : il n'y aura pas de
// template Opti'lex chez nous (le cabinet émet les siens).
export const ISSUER_OWNER = {
  name: 'Owner Technology',
  company: 'Owner Technology FZCO',
  addressLines: ['Building A1, Digital Park,', 'D.S.O, U.A.E'],
  tradeLicence: '55092',
};

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
    marginBottom: 18,
  },
  // 4-5. Blocs parties
  partiesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 26,
  },
  partyBlockLeft: { width: '44%' },
  partyBlockRight: { width: '38%', paddingTop: 26 }, // Recipient décalé, comme la référence
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

// Ligne « Label : valeur » — le label gras reste affiché même à valeur
// vide (fidèle à la référence : « Address : », « Trade licence : »).
function PartyLine({ label, value }) {
  return (
    <View style={styles.partyLine}>
      <Text style={styles.partyLabel}>{`${pdfSafe(label)} : `}</Text>
      <Text style={styles.partyValue}>{pdfSafe(value || '')}</Text>
    </View>
  );
}

function EtatDeComptePdf({ issuer, recipient, rows, issueDate }) {
  // « Restant dû » = SOLDE CUMULÉ après chaque période (logique comptable,
  // retour dev ZILWA n°637 2026-08-21) : solde += facturé − payé ligne à
  // ligne. Un paiement excédentaire régularise les mois précédents (le solde
  // retombe à 0) au lieu d'afficher un « -X € » isolé ; un solde cumulé
  // réellement négatif = trop-perçu global, affiché en négatif (vert).
  let running = 0;
  const computed = rows.map((r) => {
    running += r.billed - r.paid;
    return { ...r, solde: running };
  });
  // Total = solde final (= Σ facturé − Σ payé du périmètre) : c'est par
  // construction le dernier solde de la colonne.
  const totalRemaining = running;
  if (import.meta.env?.DEV) {
    // Assertion de cohérence (dev only) : les deux calculs doivent coïncider.
    const check = rows.reduce((acc, r) => acc + r.billed - r.paid, 0);
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
        <Text style={styles.title}>Etat de compte</Text>

        {/* 3. Date d'émission */}
        <Text style={styles.issueDate}>{pdfSafe(issueDate)}</Text>

        {/* 4-5. Issuer | Recipient */}
        <View style={styles.partiesRow}>
          <View style={styles.partyBlockLeft}>
            <Text style={styles.partyTitle}>Issuer</Text>
            <PartyLine label="Company" value={issuer.company} />
            <PartyLine label="Address" value={issuer.addressLines[0]} />
            {issuer.addressLines.slice(1).map((l, i) => (
              <View key={i} style={styles.partyLine}>
                <Text style={styles.partyValue}>{pdfSafe(l)}</Text>
              </View>
            ))}
            <PartyLine label="Trade licence" value={issuer.tradeLicence} />
          </View>
          <View style={styles.partyBlockRight}>
            <Text style={styles.partyTitle}>Recipient</Text>
            {/* « Company » : coquille « Compagny » de la référence corrigée.
                Company = société seule (splitSocieteRep) ; Client = la/les
                personne(s) découpée(s) + numéro. */}
            <PartyLine label="Company" value={recipient.company} />
            <PartyLine
              label="Client"
              value={[
                recipient.person || null,
                recipient.clientNumber ? `n°${recipient.clientNumber}` : null,
              ].filter(Boolean).join(' · ')}
            />
            <PartyLine label="Address" value="" />
            {/* Trade licence côté client = SIREN quand il est connu */}
            <PartyLine label="Trade licence" value={recipient.siren} />
          </View>
        </View>

        {/* 6. Tableau */}
        <View style={styles.table}>
          {/* En-tête répété sur chaque page (amélioration assumée) */}
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.th, { width: COLW.period }]}>Période</Text>
            <Text style={[styles.th, { width: COLW.offre }]}>Offre</Text>
            <Text style={[styles.th, { width: COLW.billed }]}>Montant facturé</Text>
            <Text style={[styles.th, { width: COLW.paid }]}>Montant payé</Text>
            <Text style={[styles.th, styles.thLast, { width: COLW.remaining }]}>Restant dû</Text>
          </View>

          {computed.map((r, i) => (
            <View key={i} style={styles.tr} wrap={false}>
              <Text style={[styles.td, styles.tdFirst, styles.tdBold, { width: COLW.period }]}>
                {pdfSafe(r.periodLabel)}
              </Text>
              <Text style={[styles.td, styles.tdBold, { width: COLW.offre }]}>{pdfSafe(r.offre)}</Text>
              <Text style={[styles.td, { width: COLW.billed }]}>{eur(r.billed)}</Text>
              <Text style={[styles.td, { width: COLW.paid }]}>{eur(r.paid)}</Text>
              <Text style={[styles.td, { width: COLW.remaining, color: r.solde < 0 ? GREEN : INK }]}>
                {r.solde < 0 ? `-${eur(-r.solde)}` : eur(r.solde)}
              </Text>
            </View>
          ))}

          {/* 7. Total = solde final : rouge si dû, vert si crédit, noir si 0 */}
          <View style={styles.totalRow} wrap={false}>
            <View style={[styles.totalBar, { width: TOTAL_BAR_W }]}>
              <Text style={styles.totalBarText}>Total</Text>
            </View>
            <View style={[styles.totalCell, { width: COLW.remaining }]}>
              <Text style={[
                styles.totalCellText,
                { color: totalRemaining > 0 ? RED : totalRemaining < 0 ? GREEN : INK },
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
    </Document>
  );
}

// Point d'entrée consommé par le DetailPanel (lazy import) : rend le
// document et retourne un Blob prêt pour le download.
export async function generateEtatDeCompte(props) {
  const issuer = props.issuer || ISSUER_OWNER;
  return pdf(<EtatDeComptePdf {...props} issuer={issuer} />).toBlob();
}

export default EtatDeComptePdf;
