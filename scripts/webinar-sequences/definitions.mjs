// scripts/webinar-sequences/definitions.mjs
//
// Définition des séquences e-mail des cohortes webinaire (données, pas de logique).
//
// Ce fichier ne contient QUE ce que le code de la landing n'exprime pas sous une forme
// exploitable : l'ordre des envois, la phase, le calendrier et les règles d'envoi de
// chaque e-mail. L'objet et le corps viennent, eux, de l'exécution des vrais rendus
// (cf. build.mjs) — rien n'est réécrit à la main ici.
//
// Sources des horaires : `lead-outbox.ts` (ancres calendaires, règles J+N), et les dates
// d'envoi réellement observées dans la table `outbox` (relevé lecture seule du 2026-09-25)
// pour ce que le code ne planifie pas lui-même (relances post-live, compte à rebours 22/06).
// Fuseau : Europe/Paris (CEST, +02:00, pour toutes les dates ci-dessous).

/** @brief Calendrier absolu : la même date pour toute la cohorte. */
const cal = (at) => ({ mode: 'calendar', at });
/** @brief N jours après l'inscription, à l'heure donnée (règle « arc éducatif »). */
const signupDays = (days, time = '11:00') => ({
  mode: 'signup-days',
  days,
  time,
  label: `J+${days} après l'inscription · ${time.replace(':', 'h')}`,
});
/** @brief Quelques minutes après l'inscription. */
const signupDelay = (minutes) => ({
  mode: 'signup-delay',
  minutes,
  label: `${minutes} min après l'inscription`,
});

// ── Règles communes (rappelées dans la fiche de chaque e-mail) ─────────────────
const RULE_UNSUB = "Jamais envoyé à un inscrit désinscrit (lien de désinscription présent dans chaque e-mail).";
const RULE_ANCHOR = "Ancre calendaire commune à toute la cohorte : sauté pour un inscrit arrivé après cette date.";
const RULE_EDU =
  "Programmé à l'inscription. Sauté si la date tombe un jour de rappel, le jour du live, ou est déjà passée (1 e-mail par jour maximum avant le live).";
const RULE_CONFIRM = "Un seul par inscrit et par cohorte (une réinscription ne recrée pas de séquence).";
const RULE_MISSED =
  "Segment « absents » (sans rendez-vous d'audit). Bascule vers « présents » si l'inscrit clique « Oui, j'étais présent » dans un e-mail post-live.";
const RULE_ATTENDED =
  "Segment « présents » (sans rendez-vous d'audit). Bascule vers « absents » si l'inscrit clique « Non, absent » dans un e-mail post-live.";

// Pas de type de séquence codé en dur ailleurs : ces libellés sont réutilisés par l'UI.
const SEQ_PRE = {
  label: 'Séquence pré-webinaire',
  description: "De l'inscription au démarrage du live : confirmation, nurturing, rappels et jour J.",
};
const SEQ_POST = {
  label: 'Séquence post-webinaire',
  description: 'Relances après le live pour amener les inscrits vers un audit.',
};
const SEQ_ONESHOT = {
  label: 'Envois ponctuels',
  description: 'Envois uniques, hors séquence automatique.',
};

const step = (kind, sequence, phase, timing, extra = {}) => ({ kind, sequence, phase, timing, ...extra });
const pre = (kind, phase, timing, extra) => step(kind, 'pre', phase, timing, extra);
const post = (kind, timing, segment, extra) => step(kind, 'post', 'post', timing, { segment, ...extra });

/**
 * @brief Étapes des cohortes ambulances (07-20 et 09-07) : même squelette, autres kinds.
 * @param p Préfixe des kinds (`jul20` | `sep07`).
 * @param a Ancres calendaires de la cohorte.
 */
function ambulancePre(p, a, eduKinds) {
  return [
    pre('email_confirmation', 'confirmation', signupDelay(2), { conditions: [RULE_CONFIRM] }),
    ...eduKinds.map((kind, i) => pre(kind, 'nurture', signupDays(i + 1), { conditions: [RULE_EDU] })),
    pre(`email_${p}_j7`, 'reminder', cal(a.j7), { conditions: [RULE_ANCHOR] }),
    pre(`email_${p}_j3`, 'reminder', cal(a.j3), { conditions: [RULE_ANCHOR] }),
    pre(`email_${p}_j1`, 'reminder', cal(a.j1), { conditions: [RULE_ANCHOR] }),
    pre(`email_${p}_morning`, 'liveday', cal(a.morning), { conditions: [RULE_ANCHOR] }),
    pre(`email_${p}_h1`, 'liveday', cal(a.h1), { conditions: [RULE_ANCHOR] }),
    pre(`email_${p}_live`, 'liveday', cal(a.live), { conditions: [RULE_ANCHOR] }),
    pre(`email_${p}_live15`, 'liveday', cal(a.live15), { conditions: [RULE_ANCHOR] }),
  ];
}

/** @brief Relances post-live à deux segments (absents / présents), D1 à Dn. */
function postSegments(days) {
  const out = [];
  for (const d of days) {
    const suffix = d.n === 1 ? '' : `_d${d.n}`;
    out.push(post(`email_post_missed_no_rdv${suffix}`, cal(d.at), 'missed', { conditions: [RULE_MISSED], atLabel: d.missedLabel }));
    out.push(
      post(`email_post_attended_no_rdv${suffix}`, cal(d.attendedAt || d.at), 'attended', {
        conditions: [RULE_ATTENDED],
        atLabel: d.attendedLabel,
      })
    );
  }
  return out;
}

export const COHORTS = [
  // ═══ 26 mai 2026 — TPE/PME, live à 11h00 (cohorte FIGÉE côté landing) ═══════════
  {
    id: 'webinar-2026-05-26',
    label: 'Webinaire du 26 mai 2026',
    short: '26 mai',
    audience: 'TPE/PME',
    liveAt: '2026-05-26T11:00:00+02:00',
    speakers: ['Paul Faucomprez', 'Maître Moraru'],
    pages: ['/', '/broad'],
    era: 'may',
    notes: [
      "Cohorte historique figée : à l'origine prévue le 19 mai, décalée au 26 (e-mail de report du 14 mai).",
      "Contenu reconstitué depuis la version du code de la landing antérieure au pied de désinscription (introduit le 22/06).",
    ],
    sequences: {
      pre: {
        ...SEQ_PRE,
        frequency:
          "Calendrier absolu partagé par toute la cohorte : un e-mail par jour du 21 au 25 mai (16h30 puis 11h00), puis 3 e-mails le jour du live (8h30, 11h00, 11h15).",
      },
      post: {
        ...SEQ_POST,
        frequency: "Deux segments (absents / présents) : D1 le soir du live, puis un e-mail par jour à 10h00 jusqu'à D4 (27 au 29 mai).",
      },
      oneshot: { ...SEQ_ONESHOT, frequency: 'Deux envois uniques en mai : report du webinaire, puis invitation à froid.' },
    },
    steps: [
      pre('email_confirmation', 'confirmation', signupDelay(2), { conditions: [RULE_CONFIRM] }),
      pre('email_marc_story', 'nurture', cal('2026-05-21T16:30:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_preview_reveal', 'nurture', cal('2026-05-22T11:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_why_concern', 'nurture', cal('2026-05-23T11:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_charges_unknown', 'nurture', cal('2026-05-24T11:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_j_minus_1', 'reminder', cal('2026-05-25T11:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_webinar_morning', 'liveday', cal('2026-05-26T08:30:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_live_now', 'liveday', cal('2026-05-26T11:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_live_plus_15', 'liveday', cal('2026-05-26T11:15:00+02:00'), { conditions: [RULE_ANCHOR] }),
      ...postSegments([
        {
          n: 1,
          at: '2026-05-26T16:17:00+02:00',
          attendedAt: '2026-05-26T17:00:00+02:00',
          missedLabel: '26 mai · 16h17 à 16h45',
          attendedLabel: '26 mai · 17h00 à 17h12',
        },
        { n: 2, at: '2026-05-27T10:00:00+02:00' },
        { n: 3, at: '2026-05-28T10:00:00+02:00' },
        { n: 4, at: '2026-05-29T10:00:00+02:00' },
      ]),
      step('email_postponement', 'oneshot', 'oneshot', cal('2026-05-14T12:31:00+02:00'), {
        atLabel: '14 mai 2026 · 12h31 à 13h08',
        conditions: ['Envoyé une seule fois aux 113 inscrits existants après le report du webinaire du 19 au 26 mai.'],
      }),
      step('email_broad_invite', 'oneshot', 'oneshot', cal('2026-05-14T16:07:00+02:00'), {
        atLabel: '14 mai 16h07 → 15 mai 19h14 · environ 1 envoi / 90 s',
        recipientsLabel: 'Prospects à froid (1 086 envois), pas des inscrits',
        conditions: [
          'Invitation à froid vers /broad, envoyée par Paul Faucomprez en texte brut (sans suivi d\'ouverture) pour éviter l\'onglet Promotions.',
        ],
      }),
    ],
  },

  // ═══ 22 juin 2026 — TPE/PME, live à 20h00 ══════════════════════════════════════
  {
    id: 'webinar-2026-06-22',
    label: 'Webinaire du 22 juin 2026',
    short: '22 juin',
    audience: 'TPE/PME',
    liveAt: '2026-06-22T20:00:00+02:00',
    speakers: ['Paul Faucomprez', 'Maître Moraru'],
    pages: ['/'],
    era: 'june',
    notes: [
      "Compte à rebours (19h30 / 19h55) inséré hors du code d'inscription, absent du planificateur de la cohorte.",
    ],
    sequences: {
      pre: {
        ...SEQ_PRE,
        frequency:
          "7 e-mails « story » espacés de 8 à 48 h après l'inscription (jamais plus d'un toutes les 8 h) jusqu'au 22/06 16h00, puis J-1 (21/06 11h00) et le jour du live : 17h00, 19h30, 19h55, 20h15.",
      },
      post: {
        ...SEQ_POST,
        frequency: "Deux segments (absents / présents) : D1 le lendemain à 12h15, puis un e-mail par jour à 10h00 (24 au 26 juin).",
      },
    },
    steps: [
      pre('email_confirmation', 'confirmation', signupDelay(2), { conditions: [RULE_CONFIRM] }),
      ...[
        'email_marc_story',
        'email_preview_reveal',
        'email_why_concern',
        'email_charges_unknown',
        'email_redevance_marque',
        'email_holding',
        'email_garantie',
      ].map((kind) =>
        pre(
          kind,
          'nurture',
          { mode: 'paced', label: "Espacé de 8 à 48 h après l'inscription (jusqu'au 22/06 16h00)" },
          {
            conditions: [
              "Répartis dans l'ordre entre l'inscription et le 22/06 16h00 ; si le temps manque, on garde le début de l'arc et le dernier e-mail « garantie » (le closer).",
            ],
          }
        )
      ),
      pre('email_j_minus_1', 'reminder', cal('2026-06-21T11:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_webinar_morning', 'liveday', cal('2026-06-22T17:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_countdown_30', 'liveday', cal('2026-06-22T19:30:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_countdown_5', 'liveday', cal('2026-06-22T19:55:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_live_plus_15', 'liveday', cal('2026-06-22T20:15:00+02:00'), { conditions: [RULE_ANCHOR] }),
      ...postSegments([
        { n: 1, at: '2026-06-23T12:15:00+02:00' },
        { n: 2, at: '2026-06-24T10:00:00+02:00' },
        { n: 3, at: '2026-06-25T10:00:00+02:00' },
        { n: 4, at: '2026-06-26T10:00:00+02:00' },
      ]),
    ],
  },

  // ═══ 20 juillet 2026 — ambulances ══════════════════════════════════════════════
  {
    id: 'webinar-2026-07-20',
    label: 'Webinaire du 20 juillet 2026',
    short: '20 juill.',
    audience: 'Ambulances',
    liveAt: '2026-07-20T20:00:00+02:00',
    speakers: ['Paul Faucomprez', 'Maître Bouchareb'],
    pages: ['/', '/v2'],
    era: 'july',
    notes: [
      "Première séquence ambulances complète. Les inscriptions ont continué jusqu'au 10 août, cohorte restée active jusqu'au 17/08.",
    ],
    sequences: {
      pre: {
        ...SEQ_PRE,
        frequency:
          "Un e-mail éducatif par jour à 11h00 (J+1 à J+5), rappels J-7, J-3 et J-1 (18h00), puis 4 e-mails le jour du live (10h00, 19h00, 20h00, 20h15).",
      },
      post: {
        ...SEQ_POST,
        frequency: "Deux segments (absents / présents) : D1 le lendemain à 11h50, puis un e-mail par jour à 10h00 (22 au 24 juillet).",
      },
    },
    steps: [
      ...ambulancePre(
        'jul20',
        {
          j7: '2026-07-13T11:00:00+02:00',
          j3: '2026-07-17T11:00:00+02:00',
          j1: '2026-07-19T18:00:00+02:00',
          morning: '2026-07-20T10:00:00+02:00',
          h1: '2026-07-20T19:00:00+02:00',
          live: '2026-07-20T20:00:00+02:00',
          live15: '2026-07-20T20:15:00+02:00',
        },
        ['email_jul20_why', 'email_jul20_discover', 'email_jul20_holding', 'email_jul20_comptable', 'email_jul20_pertes']
      ),
      ...postSegments([
        { n: 1, at: '2026-07-21T11:50:00+02:00' },
        { n: 2, at: '2026-07-22T10:00:00+02:00' },
        { n: 3, at: '2026-07-23T10:00:00+02:00' },
        { n: 4, at: '2026-07-24T10:00:00+02:00' },
      ]),
    ],
  },

  // ═══ 7 septembre 2026 — ambulances ═════════════════════════════════════════════
  {
    id: 'webinar-2026-09-07',
    label: 'Webinaire du 7 septembre 2026',
    short: '7 sept.',
    audience: 'Ambulances',
    liveAt: '2026-09-07T20:00:00+02:00',
    speakers: ['Paul Faucomprez', 'Maître Bouchareb'],
    pages: ['/', '/v2'],
    era: 'sept',
    notes: [
      "Copie réécrite d'après les maquettes du dev (18/08) : test diagnostic en J+2, simulateur de redevance de marque en J+4.",
      "Le kind « email_sep07_comptable » garde son nom historique mais porte le contenu « Redevance de marque - Simulateur ».",
    ],
    sequences: {
      pre: {
        ...SEQ_PRE,
        frequency:
          "Un e-mail éducatif par jour à 11h00 (J+1 à J+5), rappels J-7, J-3 et J-1 (18h00), puis 4 e-mails le jour du live (10h00, 19h00, 20h00, 20h15).",
      },
      post: {
        ...SEQ_POST,
        frequency:
          "Deux segments (absents / présents) : D1 le lendemain matin (≈ 11h15), D2 à D4 les trois jours suivants à 10h00, D5 le 14 septembre à 10h00.",
      },
    },
    steps: [
      ...ambulancePre(
        'sep07',
        {
          j7: '2026-08-31T11:00:00+02:00',
          j3: '2026-09-04T11:00:00+02:00',
          j1: '2026-09-06T18:00:00+02:00',
          morning: '2026-09-07T10:00:00+02:00',
          h1: '2026-09-07T19:00:00+02:00',
          live: '2026-09-07T20:00:00+02:00',
          live15: '2026-09-07T20:15:00+02:00',
        },
        ['email_sep07_why', 'email_sep07_discover', 'email_sep07_holding', 'email_sep07_comptable', 'email_sep07_pertes']
      ),
      ...postSegments([
        { n: 1, at: '2026-09-08T11:13:00+02:00', missedLabel: '8 sept. · 11h13 à 11h43', attendedLabel: '8 sept. · 11h13 à 11h15' },
        { n: 2, at: '2026-09-09T10:00:00+02:00' },
        { n: 3, at: '2026-09-10T10:00:00+02:00' },
        { n: 4, at: '2026-09-11T10:00:00+02:00' },
        { n: 5, at: '2026-09-14T10:00:00+02:00' },
      ]),
    ],
  },

  // ═══ 21 septembre 2026 — TPE/PME ═══════════════════════════════════════════════
  {
    id: 'webinar-2026-09-21',
    label: 'Webinaire du 21 septembre 2026',
    short: '21 sept.',
    audience: 'TPE/PME',
    liveAt: '2026-09-21T20:00:00+02:00',
    speakers: ['Paul Faucomprez', 'Maître Moraru'],
    pages: ['/tpe-pme'],
    era: 'sept',
    notes: [
      "Copie fournie par le dev (« Séquence Mail + sms webinaire broad », 02/09), activée le 03/09 après validation des 13 e-mails.",
      "Invitation agenda (fichier .ics) ajoutée le 17/09 ; les inscrits antérieurs l'ont reçue par rattrapage.",
      "Post-live en parcours unique : le rapport Zoom ne contenait aucune adresse, présents et absents ne sont pas distinguables.",
    ],
    sequences: {
      pre: {
        ...SEQ_PRE,
        frequency:
          "Un e-mail éducatif par jour à 11h00 (J+1 à J+5), rappels J-7, J-3 et J-1 (18h00), puis 4 e-mails le jour du live (10h00, 19h00, 20h00, 20h15).",
      },
      post: {
        ...SEQ_POST,
        frequency: "Un e-mail par jour à 11h00 pendant 4 jours (22 au 25 septembre), le même pour tous les inscrits.",
      },
    },
    steps: [
      pre('email_confirmation', 'confirmation', signupDelay(2), { conditions: [RULE_CONFIRM] }),
      pre('email_sep21_invitation', 'confirmation', signupDelay(3), {
        conditions: ['Invitation agenda (METHOD:REQUEST) : un seul destinataire dans l\'événement, rappel 30 minutes avant le live.'],
      }),
      ...['email_sep21_why', 'email_sep21_discover', 'email_sep21_holding', 'email_sep21_simulateur', 'email_sep21_pertes'].map(
        (kind, i) => pre(kind, 'nurture', signupDays(i + 1), { conditions: [RULE_EDU] })
      ),
      pre('email_sep21_j7', 'reminder', cal('2026-09-14T11:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_sep21_j3', 'reminder', cal('2026-09-18T11:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_sep21_j1', 'reminder', cal('2026-09-20T18:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_sep21_morning', 'liveday', cal('2026-09-21T10:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_sep21_h1', 'liveday', cal('2026-09-21T19:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_sep21_live', 'liveday', cal('2026-09-21T20:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_sep21_live15', 'liveday', cal('2026-09-21T20:15:00+02:00'), { conditions: [RULE_ANCHOR] }),
      ...[
        ['email_post21_j1', '2026-09-22T11:00:00+02:00'],
        ['email_post21_j2', '2026-09-23T11:00:00+02:00'],
        ['email_post21_j3', '2026-09-24T11:00:00+02:00'],
        ['email_post21_j4', '2026-09-25T11:00:00+02:00'],
      ].map(([kind, at]) =>
        post(kind, cal(at), 'all', {
          conditions: ['Parcours unique pour tous les inscrits (aucune distinction présents / absents).'],
          atLabel: `${new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })} · 11h00 (échelonné sur ≈ 40 min)`,
        })
      ),
    ],
  },

  // ═══ 8 octobre 2026 — ambulances (ouverte le 25/09, ticket Bot IA #60) ═════════
  {
    id: 'webinar-2026-10-08',
    label: 'Webinaire du 8 octobre 2026',
    short: '8 oct.',
    audience: 'Ambulances',
    liveAt: '2026-10-08T20:00:00+02:00',
    speakers: ['Paul Faucomprez', 'Maître Bouchared'],
    pages: ['/'],
    era: 'sept',
    notes: [
      "Cohorte ouverte le 25/09/2026 : seules la confirmation et l'événement Meta CAPI sont programmés, les relances attendent la copie du dev.",
      "La confirmation n'a pas de gabarit propre à cette cohorte : elle retombe sur le gabarit générique (« masterclass »), sans lien personnel ni groupe WhatsApp.",
    ],
    sequences: {
      pre: { ...SEQ_PRE, frequency: "Pour l'instant : une seule confirmation, 2 minutes après l'inscription." },
    },
    steps: [pre('email_confirmation', 'confirmation', signupDelay(2), { conditions: [RULE_CONFIRM] })],
  },
];

/** @brief Ères du code de la landing : quelle version de `email.ts` a produit les envois de quelles cohortes. */
export const ERAS = {
  // 26 mai : version antérieure au pied de désinscription (22/06) et aux réécritures du 23/06.
  may: { file: 'may.email.ts', postAmbulance: false },
  // 22 juin : version du 25/06 (séquences post-live réécrites, compte à rebours).
  june: { file: 'june.email.ts', postAmbulance: false },
  // 20 juillet : version du 17/08 (avant la paramétrisation des dates et la cohorte 09-07).
  july: { file: 'july.email.ts', postAmbulance: false },
  // 7/9, 21/9, 8/10 : code actuel de la landing.
  sept: { file: null, postAmbulance: true },
};

export const RULES_COMMON = [RULE_UNSUB];
