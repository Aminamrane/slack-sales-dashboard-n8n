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

/**
 * @brief Suivi post-live des cohortes d'octobre (8/10 et 22/10) : un e-mail par segment, puis 4 e-mails communs.
 * @param p Préfixe des kinds (`post08` | `post22`).
 * @param plan Dates réelles relevées dans la file d'envoi (`outbox`), clés `missed`, `attended`, `1` à `4` :
 * `[premier envoi ISO, libellé]`. Sans `plan`, aucune date n'est inventée : le mode `after-live` n'affiche que son libellé.
 * @note La landing ne planifie PAS ces lignes à l'inscription (cf. commentaire de `buildOct08Outbox`) : elles sont créées
 * après le live, une fois les présents et les absents connus.
 */
function postOctober(p, plan) {
  const when = (key, label) => (plan?.[key] ? [cal(plan[key][0]), { atLabel: plan[key][1] }] : [{ mode: 'after-live', label }, {}]);
  const common = 'Parcours commun à tous les inscrits (aucune distinction présents / absents).';
  const [missedAt, missedExtra] = when('missed', 'Après le live');
  const [attendedAt, attendedExtra] = when('attended', 'Après le live');
  return [
    post(`email_${p}_missed`, missedAt, 'missed', { conditions: [RULE_MISSED], ...missedExtra }),
    post(`email_${p}_attended`, attendedAt, 'attended', { conditions: [RULE_ATTENDED], ...attendedExtra }),
    ...[1, 2, 3, 4].map((n) => {
      const [at, extra] = when(String(n), `Relance ${n} après le live`);
      return post(`email_${p}_j${n}`, at, 'all', { conditions: [common], ...extra });
    }),
  ];
}

/** Arc éducatif de novembre (J+1 à J+5 après l'inscription), commun aux cohortes du 17 et du 24. */
const NOV17_EDU = ['email_nov17_remuneration', 'email_nov17_decouvrir', 'email_nov17_holding', 'email_nov17_simulateur', 'email_nov17_pertes'];

/** Suivi post-live du 22/10 : dates des lignes `pending` de la file d'envoi (relevé lecture seule du 2026-10-23, envois échelonnés). Heure d'hiver (+01:00) dès le 25/10 à 3 h. */
const POST22_PLAN = {
  missed: ['2026-10-23T15:02:00+02:00', '23 oct. · 15h02 à 15h40'],
  attended: ['2026-10-23T15:03:00+02:00', '23 oct. · 15h03 à 15h40'],
  1: ['2026-10-24T11:00:00+02:00', '24 oct. · 11h00 (échelonné sur ≈ 40 min)'],
  2: ['2026-10-25T11:00:00+01:00', '25 oct. · 11h00 (échelonné sur ≈ 40 min)'],
  3: ['2026-10-26T11:00:00+01:00', '26 oct. · 11h00 (échelonné sur ≈ 40 min)'],
  4: ['2026-10-27T11:00:00+01:00', '27 oct. · 11h00 (échelonné sur ≈ 40 min)'],
};

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
      "Séquence complète validée par le dev le 28/09 (« Séquence mail + sms Webinaire Ambulance du 8_10 ») : même structure que le 21 septembre.",
      "Deux SMS (Brevo) accompagnent la séquence : 1 h avant le live et au démarrage. Ils n'apparaissent pas dans cette liste, qui ne montre que les e-mails.",
      "Relevé de la file d'envoi du 23/10 : 21 inscrits (22/09 → 06/10), e-mails partis jusqu'au 05/10 (J-3). Il n'existe aucune ligne d'envoi pour le rappel J-1, le jour J ni le suivi post-live : ces étapes sont montrées telles que prévues par le code, sans envoi.",
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
          "Aucune relance post-live programmée au 23/10 (aucune ligne d'envoi) : un e-mail par segment (absents / présents) puis 4 e-mails communs sont prévus par le code.",
      },
    },
    steps: [
      pre('email_confirmation', 'confirmation', signupDelay(2), { conditions: [RULE_CONFIRM] }),
      ...['email_oct08_remuneration', 'email_oct08_diagnostic', 'email_oct08_holding', 'email_oct08_simulateur', 'email_oct08_pertes'].map(
        (kind, i) => pre(kind, 'nurture', signupDays(i + 1), { conditions: [RULE_EDU] })
      ),
      pre('email_oct08_j7', 'reminder', cal('2026-10-01T11:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_oct08_j3', 'reminder', cal('2026-10-05T11:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_oct08_j1', 'reminder', cal('2026-10-07T18:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_oct08_morning', 'liveday', cal('2026-10-08T10:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_oct08_h1', 'liveday', cal('2026-10-08T19:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_oct08_live', 'liveday', cal('2026-10-08T20:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_oct08_live15', 'liveday', cal('2026-10-08T20:15:00+02:00'), { conditions: [RULE_ANCHOR] }),
      ...postOctober('post08'),
    ],
  },

  // ═══ 22 octobre 2026 — TPE/PME, jeudi 11h00 (webinaire « broad ») ═══════════════
  {
    id: 'webinar-2026-10-22',
    label: 'Webinaire du 22 octobre 2026',
    short: '22 oct.',
    audience: 'TPE/PME',
    liveAt: '2026-10-22T11:00:00+02:00',
    speakers: ['Paul Faucomprez', 'Maître Moraru'],
    pages: ['/tpe-pme'],
    era: 'sept',
    notes: [
      "Copie fournie par le dev (« Campagne mail et SMS webinaire broad du 22_10 à 11h », 11/10) : même structure que le 8 octobre.",
      "Live à 11h00 : le mail du jour J part à 8h30 (comme le 26 mai), la veille à 18h00. Les inscrits arrivent du formulaire Meta « Webinaire BROAD - OCTOBRE » (lu en direct, sans n8n).",
      "Deux SMS (Brevo) accompagnent la séquence : 1 h avant le live et au démarrage. Ils n'apparaissent pas dans cette liste, qui ne montre que les e-mails.",
      "Suivi post-webinaire planifié le 23/10 (lendemain du live) : un e-mail par segment entre 15h00 et 15h40, puis un e-mail commun par jour à 11h00 du 24 au 27 octobre (échelonné sur ≈ 40 min). Dates relevées dans la file d'envoi le 23/10.",
    ],
    sequences: {
      pre: {
        ...SEQ_PRE,
        frequency:
          "Un e-mail éducatif par jour à 11h00 (J+1 à J+5), rappels J-7, J-3 et J-1 (18h00), puis 4 e-mails le jour du live (8h30, 10h00, 11h00, 11h15).",
      },
      post: {
        ...SEQ_POST,
        frequency:
          "Un e-mail par segment (absents / présents) le 23 octobre entre 15h00 et 15h40, puis 4 e-mails communs à tous les inscrits, un par jour à 11h00 du 24 au 27 octobre.",
      },
    },
    steps: [
      pre('email_confirmation', 'confirmation', signupDelay(2), { conditions: [RULE_CONFIRM] }),
      ...['email_oct22_remuneration', 'email_oct22_decouvrir', 'email_oct22_holding', 'email_oct22_simulateur', 'email_oct22_pertes'].map(
        (kind, i) => pre(kind, 'nurture', signupDays(i + 1), { conditions: [RULE_EDU] })
      ),
      pre('email_oct22_j7', 'reminder', cal('2026-10-15T11:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_oct22_j3', 'reminder', cal('2026-10-19T11:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_oct22_j1', 'reminder', cal('2026-10-21T18:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_oct22_morning', 'liveday', cal('2026-10-22T08:30:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_oct22_h1', 'liveday', cal('2026-10-22T10:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_oct22_live', 'liveday', cal('2026-10-22T11:00:00+02:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_oct22_live15', 'liveday', cal('2026-10-22T11:15:00+02:00'), { conditions: [RULE_ANCHOR] }),
      ...postOctober('post22', POST22_PLAN),
    ],
  },

  // ═══ 17 novembre 2026 — TPE/PME, mardi 11h00 (séquence du 06/11, ticket Bot IA #64) ═══
  {
    id: 'webinar-2026-11-17',
    label: 'Webinaire du 17 novembre 2026',
    short: '17 nov.',
    audience: 'TPE/PME',
    liveAt: '2026-11-17T11:00:00+01:00',
    speakers: ['Paul Faucomprez', 'Maître Bouchareb'],
    pages: ['/tpe-pme'],
    era: 'sept',
    notes: [
      "Séquence fournie par le dev (« Séquence Webinaire Broad du 17 novembre », 06/11) : même structure que le 22 octobre. Ouverte d'abord en mise en ligne minimale (confirmation seule), complétée le 06/11.",
      "Live à 11h00, heure d'hiver : le mail du jour J part à 6h30, la veille à 18h00.",
      "Deux SMS (Brevo) accompagnent la séquence : 1 h avant le live et au démarrage. Ils n'apparaissent pas dans cette liste, qui ne montre que les e-mails.",
      "Le suivi post-webinaire est planifié par la landing APRÈS le live, une fois les présents et les absents connus : ses dates apparaîtront ensuite.",
      "Webinaire déplacé au 24 novembre le 10/11 : les inscrits et la suite des envois sont sur la cohorte du 24 novembre. Cette cohorte n'est plus suivie par le CRM.",
    ],
    sequences: {
      pre: {
        ...SEQ_PRE,
        frequency:
          "Un e-mail éducatif par jour à 11h00 (J+1 à J+5), rappels J-7, J-3 et J-1 (18h00), puis 4 e-mails le jour du live (6h30, 10h00, 11h00, 11h15).",
      },
      post: {
        ...SEQ_POST,
        frequency:
          "Planifié après le live : un e-mail par segment (absents / présents), puis 4 e-mails communs à tous les inscrits, un par jour.",
      },
    },
    steps: [
      pre('email_confirmation', 'confirmation', signupDelay(2), { conditions: [RULE_CONFIRM] }),
      ...NOV17_EDU.map((kind, i) => pre(kind, 'nurture', signupDays(i + 1), { conditions: [RULE_EDU] })),
      pre('email_nov17_j7', 'reminder', cal('2026-11-10T11:00:00+01:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_nov17_j3', 'reminder', cal('2026-11-14T11:00:00+01:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_nov17_j1', 'reminder', cal('2026-11-16T18:00:00+01:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_nov17_morning', 'liveday', cal('2026-11-17T06:30:00+01:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_nov17_h1', 'liveday', cal('2026-11-17T10:00:00+01:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_nov17_live', 'liveday', cal('2026-11-17T11:00:00+01:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_nov17_live15', 'liveday', cal('2026-11-17T11:15:00+01:00'), { conditions: [RULE_ANCHOR] }),
      ...postOctober('post17'),
    ],
  },
  {
    // Le webinaire du 17 novembre, déplacé d'une semaine le 10/11. La landing n'a pas de registre propre à cette cohorte :
    // elle envoie le registre du 17 (`NOV17_EMAILS`, types `email_nov17_*` / `email_post17_*`) et adapte la date et le lien
    // au moment de l'envoi, selon la cohorte de l'inscrit (`nov17Cohort`, email.ts). D'où `emailsOf`.
    id: 'webinar-2026-11-24',
    emailsOf: 'webinar-2026-11-17',
    label: 'Webinaire du 24 novembre 2026',
    short: '24 nov.',
    audience: 'TPE/PME',
    liveAt: '2026-11-24T11:00:00+01:00',
    speakers: ['Paul Faucomprez', 'Maître Bouchareb'],
    pages: ['/tpe-pme'],
    era: 'sept',
    notes: [
      "Le webinaire prévu le 17 novembre, déplacé d'une semaine le 10/11 : même séquence, mêmes heures, dates décalées de 7 jours. Les inscrits du 17 ont été rattachés à cette cohorte.",
      "La landing réutilise les e-mails du 17 novembre (mêmes types d'envoi) : la date et le lien de cohorte sont adaptés à l'envoi. Le contenu affiché ici est celui que reçoit un inscrit de cette cohorte.",
      "Le rappel J-7 est parti le 10/11 à 11h00 pour les inscrits d'alors (85 envois, il annonçait encore le 17 novembre) ; l'avis de changement de date leur a été envoyé le même jour. Les inscrits arrivés ensuite le reçoivent le 17/11.",
      "Live à 11h00, heure d'hiver : le mail du jour J part à 6h30, la veille à 18h00.",
      "Deux SMS (Brevo) accompagnent la séquence : 1 h avant le live et au démarrage. Ils n'apparaissent pas dans cette liste, qui ne montre que les e-mails.",
      "Le suivi post-webinaire est planifié par la landing APRÈS le live, une fois les présents et les absents connus : ses dates apparaîtront ensuite.",
    ],
    sequences: {
      pre: {
        ...SEQ_PRE,
        frequency:
          "Un e-mail éducatif par jour à 11h00 (J+1 à J+5), rappels J-7, J-3 et J-1 (18h00), puis 4 e-mails le jour du live (6h30, 10h00, 11h00, 11h15).",
      },
      post: {
        ...SEQ_POST,
        frequency:
          "Planifié après le live : un e-mail par segment (absents / présents), puis 4 e-mails communs à tous les inscrits, un par jour.",
      },
      oneshot: { ...SEQ_ONESHOT, frequency: 'Un envoi unique le 10 novembre : avis de changement de date (du 17 au 24 novembre).' },
    },
    steps: [
      pre('email_confirmation', 'confirmation', signupDelay(2), { conditions: [RULE_CONFIRM] }),
      ...NOV17_EDU.map((kind, i) => pre(kind, 'nurture', signupDays(i + 1), { conditions: [RULE_EDU] })),
      pre('email_nov17_j7', 'reminder', cal('2026-11-17T11:00:00+01:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_nov17_j3', 'reminder', cal('2026-11-21T11:00:00+01:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_nov17_j1', 'reminder', cal('2026-11-23T18:00:00+01:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_nov17_morning', 'liveday', cal('2026-11-24T06:30:00+01:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_nov17_h1', 'liveday', cal('2026-11-24T10:00:00+01:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_nov17_live', 'liveday', cal('2026-11-24T11:00:00+01:00'), { conditions: [RULE_ANCHOR] }),
      pre('email_nov17_live15', 'liveday', cal('2026-11-24T11:15:00+01:00'), { conditions: [RULE_ANCHOR] }),
      ...postOctober('post17'),
      step('email_postponement', 'oneshot', 'oneshot', cal('2026-11-10T16:21:00+01:00'), {
        atLabel: '10 nov. 2026 · 16h21 à 16h49',
        conditions: [
          "Envoyé une seule fois aux 86 inscrits existants, le jour du déplacement du webinaire du 17 au 24 novembre.",
          "L'e-mail reçu commence par « Bonjour Prénom Nom, » ; cet aperçu, rendu pour un inscrit modèle, affiche « Bonjour, ».",
        ],
      }),
    ],
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
