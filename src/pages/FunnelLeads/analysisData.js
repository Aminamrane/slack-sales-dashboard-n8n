// Analyse de l'acquisition : synthèse mensuelle rédigée (statique, par mois).
//
// Clé = 'YYYY-MM'. Une entrée par mois analysé ; si le mois sélectionné n'a
// pas d'entrée, le bloc n'est tout simplement pas rendu.
//
// IMPORTANT : c'est une synthèse ÉDITORIALE figée à `generatedAt`, pas un
// recompute live. Le funnel affiché au-dessus, lui, est recalculé en direct
// par l'API. Les chiffres cités ici sont la photo prise à la date de synthèse.
//
// Convention de texte : **gras** met en avant un chiffre clé (rendu via le
// petit parseur `renderRich` du composant). Pas de tiret cadratin.

export const ANALYSIS_BY_MONTH = {
  '2026-06': {
    generatedAt: '19/06/2026',
    monthLabel: 'Juin 2026',

    // Aperçu (replié) : une accroche + des chiffres saillants.
    teaser:
      "Au 19/06, mois en cours, l'acquisition a généré **731 leads exploitables**. " +
      'Le funnel est sain et en pleine maturation : quand un lead répond, près de ' +
      '**3 sur 4** posent un rendez-vous, et **81 %** des leads sont traités le jour même. ' +
      "Sur les rendez-vous tenus, la présence R1 est d'environ **51 %**, en ligne avec Perf Sales.",

    highlights: [
      { icon: 'phone', value: '73,8 %', label: 'des répondants posent un R1' },
      { icon: 'clock', value: '81 %', label: 'des leads traités le jour même' },
      { icon: 'target', value: '≈ 51 %', label: 'présence R1 (rendez-vous tenus)' },
      { icon: 'layers', value: 'Général', label: 'source la plus rentable' },
    ],

    // Analyse complète (dépliée).
    sections: [
      {
        icon: 'funnel',
        tone: 'violet',
        title: "Vue d'ensemble",
        body: [
          "Sur la période, l'acquisition a produit **928 leads reçus** et **731 leads clean** " +
            'réellement exploitables après filtrage du téléphone FR. L\'enchaînement : **214 répondus** ' +
            '(29,3 % du clean), **158 R1 placés**, **50 R1 effectués** à date, **52 R2 placés**, ' +
            '**20 R2 effectués**, et **67 leads non pertinents** (9,2 % du clean).',
          'Deux lectures évitent de sous-estimer la performance réelle. D\'abord, **73,8 % des répondants ' +
            'posent un R1** : la conversion réponse vers rendez-vous est excellente. Ensuite, la présence aux ' +
            'rendez-vous se lit sur ceux déjà tenus : sur l\'entonnoir, R1 effectué (50) sur R1 placé (158) ressort ' +
            'à 32 %, mais c\'est un effet du mois en cours, car **57 R1 sont encore à venir**. Sur les rendez-vous ' +
            'réellement tenus, la **présence R1 est d\'environ 51 %** (un sur deux), exactement ce qu\'affiche Perf Sales.',
        ],
      },
      {
        icon: 'layers',
        tone: 'blue',
        title: 'Performance par source',
        body: [
          'Trois moteurs portent le volume, avec des rendements nettement différents. Le tableau croise ' +
            'la part du débit, la joignabilité et la conversion utile de chaque source.',
        ],
        block: 'sources',
        after: [
          '**Général** est la source la plus rentable de bout en bout : meilleure prise de R1 sur répondants ' +
            '(**79,5 %**), meilleure transformation R1 placé vers effectué (**43 %**) et la branche la plus proche ' +
            'du cash (**26 R2 placés**). C\'est la source à scaler en priorité.',
          '**Resto** est le moteur de volume (**45 % du clean**, le plus de R1 en absolu) avec un rendement médian : ' +
            'une masse à rentabiliser sur le décroché.',
          '**BTP** est le gisement de progression : réponse et conversion plus basses, avec des motifs hors-cible ' +
            'structurels au segment (pas de société, micro sans chiffre d\'affaires, indépendant seul hors cible ' +
            'salariés). Un sujet de ciblage en amont, pas de traitement.',
          'Contactabilité saine partout : la messagerie est élevée et homogène (**26 à 30 %**), commune au canal ' +
            'téléphonique, et les numéros morts restent marginaux (moins de **3 %** du clean).',
        ],
      },
      {
        icon: 'snow',
        tone: 'blue',
        title: 'Ce qui est encore en jeu',
        body: [
          'Une part importante de juin n\'apparaît pas encore dans les ratios : **57 R1 placés** non encore tenus, ' +
            '**21 R2 placés** à venir, et un backlog de leads récents en cours de traitement normal.',
          'Côté traitement, Perf Sales recense **112 leads encore non traités** (sur 714 affectés), dont ' +
            '**une quarantaine de froids** (plus de 7 jours sans aucune action, ni appel ni note). C\'est le seul ' +
            'stock à risque réel, à attaquer en priorité avant qu\'ils ne se refroidissent ; le reste est récent et suit son cours.',
        ],
      },
      {
        icon: 'clock',
        tone: 'emerald',
        title: 'Vélocité de traitement',
        body: [
          'La vitesse de prise en charge est forte et déjà suivie dans Perf Sales : **81 % des leads sont traités ' +
            'le jour même**, avec un **délai médian de 3h49** entre l\'affectation et la première action (appel du ' +
            'sales ou du setter). Le délai de traitement n\'est pas la cause des pertes du funnel ; les leviers sont en amont.',
        ],
      },
      {
        icon: 'trending',
        tone: 'amber',
        title: 'Où se situent les leviers',
        body: [
          'Deux goulots, tous deux en amont de la prise de rendez-vous qui, elle, est déjà excellente.',
          '**Goulot n°1, le taux de réponse (29,3 %).** C\'est le vrai plafond du funnel. Une fois le lead joint, ' +
            '73,8 % posent un R1 : chaque point de réponse gagné se rentabilise immédiatement.',
          '**Goulot n°2, la présence aux rendez-vous (présence R1 ≈ 51 %, R2 ≈ 61 %).** Un rendez-vous sur deux ne se ' +
            'tient pas encore : c\'est le levier de conversion le plus rentable après le décroché.',
        ],
        block: 'levers',
      },
    ],

    // Tableau « Performance par source ».
    sources: [
      { name: 'Général', clean: '242', share: '33 %', reply: '30,2 %', r1: '24,0 %', useful: '10,3 %', tag: 'Meilleur rendement', tone: 'emerald' },
      { name: 'Resto', clean: '329', share: '45 %', reply: '30,4 %', r1: '23,4 %', useful: '6,4 %', tag: 'Moteur de volume', tone: 'blue' },
      { name: 'BTP', clean: '147', share: '20 %', reply: '25,9 %', r1: '15,6 %', useful: '2,7 %', tag: 'À diagnostiquer', tone: 'amber' },
    ],

    // Plan d'action.
    levers: [
      { icon: 'layers', title: 'Scaler Général', text: 'Meilleur rendement bout-en-bout (24,0 % R1/clean, 10,3 % de conversion utile). Augmenter sa part dans le mix est le gain de qualité le plus direct, à effort constant.' },
      { icon: 'phone', title: 'Rentabiliser le volume Resto', text: "Resto porte 45 % du clean avec un décroché moyen. Les relances automatiques (SMS répondeur, re-surfaçage aux setters) sont déjà en place : le gain restant est la cadence d'appels et le choix des créneaux horaires sur ce gros volume." },
      { icon: 'target', title: 'Diagnostiquer BTP en amont', text: "Affiner le ciblage du formulaire et l'accroche au segment salariés : le plus gros gisement de progression relative." },
      { icon: 'snow', title: 'Réattaquer le stock froid', text: "Une quarantaine de leads restent non traités à plus de 7 jours. Le re-surfaçage automatique aux setters s'arrête à 24 h et rien ne réattaque ensuite un lead resté froid : une relance ciblée sur ce lot déjà payé est un gain net." },
      { icon: 'repeat', title: 'Étendre les relances déjà en place', text: "La relance tourne déjà (près de 270 envois en juin, surtout SMS répondeur et emails autour du R2), mais elle reste centrée sur le R2 et activée par une partie des sales seulement (relances email chez 4 sur 11). La généraliser et l'étendre aux non-répondants, sur l'infra existante, transforme du contact sans rien reconstruire." },
      { icon: 'calendar', title: 'Cibler les créneaux à fort no-show', text: "La confirmation de présence la veille est déjà faite par les setters (vue dédiée des rendez-vous à venir). Le gain restant sur la présence R1 (≈ 51 %) est de la concentrer sur les créneaux à fort no-show, que la heatmap présence de Perf Sales fait ressortir, et d'éviter d'y poser des R1." },
    ],

    // Note de cohérence avec Perf Sales : une nuance de définition, pas un conflit.
    nuance:
      "L'entonnoir ne compte un **R1 effectué** que lorsque le résultat est marqué « done » sur la cohorte du " +
      "mois, d'où les **32 %** visibles sur les barres (le mois est en cours, 57 R1 restent à tenir). Perf Sales " +
      'mesure la **présence** (présent ou venu) sur les seuls rendez-vous déjà tenus, d\'où **≈ 51 %**. Les deux ' +
      'chiffres sont justes : ils ne comptent simplement pas tout à fait la même chose.',
  },
};
