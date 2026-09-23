// Données de la section "Analyse IA du live" (replay vidéo + segments horodatés
// + synthèse). Par cohorte. Les segments pointent un timecode (secondes depuis
// le début de l'enregistrement) que le lecteur vidéo rejoue au clic.
//
// Source : analyse profonde de la transcription + présence + funnel réel
// (bookings.db + contracts CRM). Voir docs internes / dossier "webinaire 07:20".

export const WEBINAR_REPLAY = {
  "webinar-2026-07-20": {
    title: "Webinaire 20 juillet 2026 · niche ambulances",
    // Le lecteur accepte un fichier local (présentation depuis le Mac) OU une
    // URL hébergée (à renseigner quand la vidéo sera sur le VPS).
    videoUrl: null,
    verdict:
      "La mission du webinaire n'est pas de vendre sur scène, c'est de fabriquer des RDV d'audit chauds qui closent en aval. Sur ce KPI, c'est un succès : on a mal vendu sur scène, mais on a bien nourri la machine de close.",
    score: "~70 / 100",
    scoreNote: "54/100 sur la vente live, rehaussé à ~70/100 en jugeant la vente pour le close.",
    funnel: [
      { label: "Présents (internes exclus)", value: "53", sub: "74 le 22/06" },
      { label: "RDV audit pris", value: "21", sub: "×1,95 conversion vs 22/06" },
      { label: "Taux présent → RDV", value: "40 %", sub: "20 % le 22/06" },
      { label: "Signés à 48h", value: "3", sub: "+ 18 en pipeline actif" },
    ],
    positives: [
      { title: "Cas chiffré 60k de Me Bouchareb", detail: "Le seul moment où la courbe de présence remonte (pic 39 @ 20:48). Preuve tangible > promesse. À systématiser tôt et salle pleine." },
      { title: "Double autorité mise en scène", detail: "Paul (900 dirigeants, 2000 sociétés) + un vrai avocat fiscaliste pour la démo. Ossature de crédibilité qui tue le « c'est du vent »." },
      { title: "Risk reversal", detail: "« On a l'obligation de vous faire gagner au moins notre coût. » Neutralise le risque prix avant qu'il soit un sujet." },
      { title: "Retournement de l'avocate sceptique Farah", detail: "Contestée dans le chat, défusée sans l'humilier, elle bascule en caution publique. La meilleure séquence de la soirée." },
      { title: "Pré-traitement « mon comptable gère déjà »", detail: "Le comptable n'est pas incompétent, il est structurellement hors-jeu. Le prospect n'a pas à avouer une erreur. Objection-handling senior." },
      { title: "Queue de funnel post-live", detail: "7 RDV sur 21 (33 %) tombent après le direct, dont 5 via le lien « semaine prochaine ». Le funnel ne meurt pas à la fin du live." },
    ],
    negatives: [
      { title: "Lien cliquable ~19 min après le CTA verbal", time: "20:12 → 20:31", detail: "Les RDV suivent le LIEN (premiers à 20:33), pas la voix. Fenêtre morte pile au pic d'intention. La fuite la plus grossière, réparable à coût nul." },
      { title: "Pic de désir désaligné de l'offre", time: "20:48", detail: "La preuve la plus vendeuse (cas 60k) arrive 26 min après l'ouverture de l'offre, au lieu de l'ancrer." },
      { title: "Offre sans urgence ni rareté", time: "20:11", detail: "« 100% gratuit, sans pression » jusqu'à « au pire vous travaillez pas avec nous ». Zéro deadline, aucune raison d'agir ce soir." },
      { title: "Pas de hard close, clôture en fondu", time: "21:36", detail: "13 min de contenu non-vendeur après le dernier CTA, fin sur « bonne soirée ». Aucune action finale à 60s." },
      { title: "Off-cible aspiré dans l'audit", time: "20:48", detail: "David Tang (TNS sans salarié) prend un audit qu'il faudra disqualifier. Le lapsus « micro-crèches » en 1re phrase entretient le flou de ciblage." },
      { title: "21 min vendeuses brûlées sur salle vide", time: "19:39 → 20:00", detail: "Le meilleur contenu démarre à 19:50, le public arrive à 20:00, le 1er CTA à 20:11. La fenêtre d'attention prime part en warmup." },
    ],
    axes: [
      { priority: "P1", title: "Synchroniser le lien cliquable au CTA verbal", detail: "Poster le lien + QR au même instant, re-poster toutes les 10-15 min, pinner, surimpression écran. Le caler sur le pic de preuve (~20:38-20:48). Coût nul, ROI immédiat." },
      { priority: "P1", title: "Resserrer le ciblage : ICP = ambulances AVEC salariés", detail: "Filtrer l'inscription, qualifier à l'ouverture, purger le deck de « micro-crèches ». Hausse du taux RDV → signature." },
      { priority: "P2", title: "Verbaliser urgence et rareté", detail: "« Le spécialiste ne peut faire que N audits cette semaine, il en reste X. » La rareté existe, il faut la dire. Compresse la décision + réduit le no-show." },
      { priority: "P2", title: "Hard close calé sur le pic (~20:50)", detail: "Juste après le cas 60k : récap, CTA unique, lien à l'écran, action immédiate. On close salle pleine, pas à 21:24 quand ils sont partis." },
      { priority: "P2", title: "Récupérer les 21 min : re-séquencer", detail: "Rejouer les 3 leviers vendeurs (cas Bouchareb, redevance de marque, risk reversal) après 20:05-20:10, salle pleine." },
      { priority: "P2", title: "Muscler la relance post-live", detail: "Le post-live pèse déjà 33 % des RDV sans effort. Séquence dédiée dès J+1, segmentée, avec replay du cas chiffré + rareté." },
      { priority: "P3", title: "Co-host chat dédié", detail: "Le bras armé : poste et re-poste le lien, traite les objections, recadre les hors-cible, DM le lien aux présents actifs." },
      { priority: "P3", title: "Instrumentation par cohorte", detail: "Dashboard auto : présents → RDV% → signature%, no-show, disqualif, ventilation par lien, part live vs post-live. Une ligne par cohorte." },
    ],
    closing:
      "Le moteur commercial fonctionne. Il nous reste à arrêter de saboter mécaniquement notre propre funnel : le lien de réservation posé au bon moment et un ciblage qui exige des salariés valent plus de signatures que n'importe quel argument de plus sur scène.",
    segments: [
      { at: 52, clock: "19:39:55", kind: "bad", title: "Hook cassé : mauvaise niche annoncée", insight: "« Bienvenue dans cette masterclass consacrée aux dirigeants micro-crèches. » Mauvaise cible dès le 1er mot (copier-coller d'un autre webinaire)." },
      { at: 420, clock: "19:46:03", kind: "bad", title: "Agitation us-vs-them délivrée à une salle vide", insight: "Le meilleur matériel émotionnel (« l'administration est dans une logique statistique de rentabilité ») délivré avant 20:00 à ~0 présent." },
      { at: 1240, clock: "19:59:43", kind: "good", title: "Valeur chiffrée 12k puis 20k à l'arrivée du public", insight: "« Vous avez déjà fait 12.000 € d'économies par an juste à restructurer entre la SAS et la SARL » (puis 20k). Ancre un gain palpable pile quand la salle se remplit." },
      { at: 1580, clock: "20:05:23", kind: "proof", title: "Redevance de marque : levier concret réservé aux initiés", insight: "« Les redevances de marque, loyers fiscalement avantageux, 9,3% du CA. » Chiffre + marque connue + droit sous-utilisé = format qui retient (29 → 36 présents)." },
      { at: 1860, clock: "20:10:03", kind: "cta", title: "CTA #1 offre molle, zéro urgence", insight: "« C'est vraiment 100% gratuit, il y a le QR code. » Sans rareté ni deadline. Aucune raison d'agir maintenant. L'énergie de conversion laissée au chat." },
      { at: 2660, clock: "20:23:23", kind: "proof", title: "Risk reversal sur l'offre", insight: "« On a l'obligation de vous faire gagner au moins notre coût, forfaits les plus bas possibles. » Abaisse la barrière au RDV." },
      { at: 3570, clock: "20:38:33", kind: "proof", title: "PIC de rétention : cas chiffré avocat 60k sur 3 ans", insight: "« Ça monte à 15-20.000 € de récupération, 60.000 € sur les 3 dernières années. » Seul moment où la courbe MONTE (pic 39 @ 20:48)." },
      { at: 4191, clock: "20:48:54", kind: "objection", title: "Objection avocate reframée en direct", insight: "Farah conteste (« je suis avocate fiscaliste spécialisée, il y en a beaucoup »). Paul reframe la rareté sur scène, elle finit par valider publiquement." },
      { at: 5125, clock: "21:04:28", kind: "good", title: "Sondage chat holding : seul pic d'interaction de la 2e mi-temps", insight: "« Tous ceux qui ont une holding mettez 2. » Rend la salle active et stabilise brièvement la courbe (~28-31)." },
      { at: 5940, clock: "21:18:03", kind: "bad", title: "Décrochage holding : trop technique en rétention basse", insight: "« 1,205% ... c'est un peu technique » (QPFC). Le bloc le plus complexe délivré à 21:18-21:44 quand la salle a fondu (~24-25)." },
      { at: 6297, clock: "21:24:00", kind: "good", title: "Synthèse qui récapitule les 3 leviers", insight: "« Il faut restructurer votre rémunération, tous les mois vous perdez de l'argent. » Réactive proprement rémunération / holding / masse salariale." },
      { at: 7020, clock: "21:36:03", kind: "bad", title: "Clôture qui s'effiloche, pas de hard close", insight: "« Passez une excellente soirée, au revoir. » Fin en fondu après un monologue, aucun close net, aucune action à 60s." },
      { at: 7718, clock: "21:47:41", kind: "cta", title: "CTA #4 urgence maximale (chat uniquement)", insight: "« Ne quittez pas le webinaire sans votre rendez-vous ! » (lien /rdv semaine +1, 21:48 puis 21:57). Bonne urgence écrite, mais jamais dite à l'oral." },
    ],
  },

    "webinar-2026-09-21": {
      "title": "Webinaire 21 septembre 2026 · dirigeants de TPE/PME",
      "videoUrl": null,
      "verdict": "Un live qui retient bien mais qui convertit moins fort que le 20/07 : 77 présents une fois le staff retiré, une médiane de 77 minutes sur 126 et seulement 6,5 % de départs précoces, donc le contenu tient la salle. En face, 28 RDV d'audit pour 77 présents (36,4 %) contre 40 % en juillet, et 12 RDV seulement pendant le live : la moitié de la récolte se fait après, sur les relances. Le chat éclaire le reste. Les deux premières réservations tombent avant que le moindre lien soit écrit, le pic d'engagement est un sondage sur la forme juridique qui précède six réservations, et deux fuites nettes apparaissent : une question de holding à forte valeur laissée sans réponse, et un participant qui annonce « rdv pris » sans qu'aucune trace existe. Le vrai trou reste en amont : 352 inscrits pour 77 présents, soit 22 % de présence.",
      "score": "72 / 100",
      "scoreNote": "Note PROVISOIRE, calculée sur les seuls chiffres (conversion présents vers RDV 36,4 %, rétention médiane 61 % du live, bounce 6,5 %, 3 signés à 48 h). La performance d'animation n'est pas encore jugée : elle demande la vidéo, qui sera ajoutée ensuite.",
      "funnel": [
        {
          "label": "Inscrits",
          "value": "352",
          "sub": "22 % de présence"
        },
        {
          "label": "Présents au live (staff exclu)",
          "value": "77",
          "sub": "53 le 20/07"
        },
        {
          "label": "RDV audit pris",
          "value": "28",
          "sub": "36,4 % des présents · 40 % le 20/07"
        },
        {
          "label": "Signés à 48h",
          "value": "3",
          "sub": "4 536 € déclarés sur 2 des 3"
        }
      ],
      "positives": [
        {
          "title": "Répétition technique avant l'ouverture au public",
          "detail": "La salle est ouverte à 19h32 pour une session d'entraînement, le public entre à 20h01. Le live tourne donc sur un dispositif déjà vérifié, ce qui explique l'absence d'incident technique et le très faible taux de départs précoces. À retenir : le rapport Zoom indique 155 minutes parce qu'il compte depuis cette ouverture ; le live public réel dure 126 minutes, et c'est cette base qui sert à tous les taux de rétention."
        },
        {
          "title": "La salle tient jusqu'au bout",
          "detail": "Médiane de présence à 77 minutes sur 126, moyenne 75, et 48 % des participants restent au-delà de 90 minutes. Un tiers suit l'intégralité. Sur un format de deux heures un dimanche soir, c'est un contenu qui porte."
        },
        {
          "title": "Presque aucun départ précoce",
          "detail": "6,5 % seulement quittent en moins de cinq minutes. L'accroche et le cadrage initial ne font pas fuir, contrairement au 20/07 où le bounce était à 21 %."
        },
        {
          "title": "Le pic d'audience arrive vite et se maintient",
          "detail": "56 spectateurs simultanés à 20h19, soit 18 minutes après l'arrivée du public, puis un plateau au-dessus de 50 jusqu'à 21h00. À ne pas confondre avec les 77 présents de la soirée : tout le monde n'est pas là en même temps."
        },
        {
          "title": "Les questions posées sont traitées en direct",
          "detail": "5 des 7 questions ont reçu une réponse pendant le live, toutes par le même intervenant. Les trois questions de la même participante portent sur la redevance de marque et le risque de contrôle : c'est le sujet qui fait vendre."
        },
        {
          "title": "Le funnel ne meurt pas à la fin du live",
          "detail": "12 RDV pris pendant le live, 9 de plus le lendemain. Un tiers de la récolte arrive après, ce qui valide les relances du J+1."
        }
      ],
      "negatives": [
        {
          "title": "Le trou est en amont : 23 % de présence",
          "time": "avant le live",
          "detail": "352 inscrits pour 77 présents. C'est la première perte du funnel, et de loin la plus grosse. Aucun rappel ne rattrape un écart de cette taille une fois le live commencé."
        },
        {
          "title": "Deux questions laissées sans réponse",
          "time": "21:26 et 22:05",
          "detail": "La question sur le rachat des parts d'un associé partant à la retraite, posée à 21h26, n'a jamais reçu de réponse. C'est un cas de holding à forte valeur, posé par quelqu'un qui était encore là. La seconde, à 22h05, est une intention de contact directe."
        },
        {
          "title": "Décrochage marqué autour de 20h55",
          "time": "20:51 vers 20:58",
          "detail": "Perte de 7 spectateurs simultanés en cinq minutes, la plus forte chute hors fin de session. À recouper avec le contenu de ce créneau une fois la vidéo disponible."
        },
        {
          "title": "Aucun présent identifié par son lien Zoom",
          "time": "structurel",
          "detail": "L'inscription Zoom était désactivée : l'export ne contient aucune adresse. Le rattachement entre inscrits et présents se fait au nom saisi, et la moitié des participants reste impossible à relier à un inscrit. C'est aussi ce qui a fait passer quatre membres du staff pour des participants dans un premier comptage."
        }
      ],
      "axes": [
        {
          "priority": "P1",
          "title": "Traiter le taux de présence avant de retoucher le live",
          "detail": "22 % de présence sur 352 inscrits est le premier poste de perte. Séquence de rappel le jour J, SMS à H-1 et à l'ouverture, et test d'un créneau différent pèseront plus que n'importe quelle amélioration de contenu."
        },
        {
          "priority": "P1",
          "title": "Réactiver l'inscription Zoom",
          "detail": "Sans elle, on ne sait pas qui était là. Toute l'analyse présents contre absents repose sur un rattachement au nom, et la moitié des participants reste non identifiée. C'est un réglage, pas un chantier."
        },
        {
          "priority": "P2",
          "title": "Concentrer les appels à l'action sur la fenêtre 20h15 vers 21h00",
          "detail": "C'est le plateau d'audience, au-dessus de 50 simultanés. Les 12 RDV du live se répartissent après 20h34, avec une reprise à 21h45 : deux fenêtres à exploiter explicitement plutôt qu'un CTA diffus."
        },
        {
          "priority": "P2",
          "title": "Reprendre les questions non traitées en relance nominative",
          "detail": "Deux questions sans réponse, dont une sur un rachat de parts. Ce sont des intentions identifiées et nominatives : elles valent un appel, pas un e-mail de masse."
        }
      ],
      "closing": "Le live fait son travail de rétention : la salle reste, le bounce est faible, le contenu tient deux heures. La conversion, elle, se joue ailleurs : 23 % de taux de présence en amont, et une récolte de RDV dont un tiers arrive après le live. Avant de retoucher le déroulé, c'est la venue au live et l'identification des présents qu'il faut réparer. Les 3 signatures à 48 h montrent que les RDV produits sont de bonne qualité.",
      "segments": [
        {
          "at": 1192,
          "clock": "20:20:37",
          "kind": "proof",
          "title": "Première question du live : le bureau professionnel",
          "insight": "Gloria Guitteaud ouvre le Q&R sur la fiscalité des loyers du bureau professionnel. Elle posera trois questions dans la soirée, toutes sur la redevance de marque et le risque de contrôle, et réservera son audit dix-neuf minutes plus tard.",
          "reasoning": [
            "Q&R : 3 questions sur 7 viennent d'elle, toutes sur le même sujet",
            "Elle réserve à 20h39, soit 19 min après sa première question",
            "Le sujet qui fait poser des questions est celui qui fait réserver"
          ]
        },
        {
          "at": 2014,
          "clock": "20:34:19",
          "kind": "good",
          "title": "Premier rendez-vous réservé, avant tout lien dans le chat",
          "insight": "Valery Grard réserve son audit à 20h34. Le premier lien ne sera posté dans le chat qu'à 21h01, vingt-sept minutes plus tard : la réservation vient donc du QR code ou de l'énoncé oral.",
          "reasoning": [
            "Réservation enregistrée à 20:34 (base des réservations)",
            "Premier lien dans le chat à 21:01:27 seulement",
            "Deux réservations sont tombées avant que le lien soit écrit quelque part"
          ]
        },
        {
          "at": 2387,
          "clock": "20:40:32",
          "kind": "objection",
          "title": "Demande de support : « allons-nous recevoir un support ? »",
          "insight": "Nicolas demande un support de la présentation. La question reste sans réponse écrite dans le chat. Il réservera malgré tout, mais en toute fin de live, à 22h01 : c'est le dernier rendez-vous de la soirée.",
          "reasoning": [
            "Message chat à 00:39:47, aucune réponse écrite visible",
            "Nicolas Hue réserve à 22:01, 81 minutes plus tard",
            "Un support promis en échange de l'e-mail est une capture de contact gratuite"
          ]
        },
        {
          "at": 3642,
          "clock": "21:01:27",
          "kind": "cta",
          "title": "Premier lien de réservation posté dans le chat",
          "insight": "« Choisissez votre créneau pour faire analyser votre situation ». Le lien arrive à 21h01, alors que l'audience est à son plateau depuis quarante minutes et que deux personnes ont déjà réservé sans lui.",
          "reasoning": [
            "Pic d'audience à 58 simultanés dès 20h19",
            "Le lien arrive 42 min après ce pic",
            "Poster le lien dès le pic aurait couvert les 40 premières minutes"
          ]
        },
        {
          "at": 3711,
          "clock": "21:02:36",
          "kind": "proof",
          "title": "Question à forte intention : la rétroactivité des redevances",
          "insight": "Cynthia Dilasseur demande si les redevances de marque peuvent s'appliquer rétroactivement et sur quelle durée, puis enchaîne sur le cas d'une entreprise en sortie de redressement. Ce sont des questions de mise en œuvre, pas de découverte : le signal d'achat le plus net du chat.",
          "reasoning": [
            "Deux questions successives à 01:01:51 et 01:03:46",
            "Elle donne son numéro de téléphone dans son nom d'affichage Zoom",
            "Les questions de mise en œuvre marquent une intention plus forte que les questions de principe"
          ]
        },
        {
          "at": 5149,
          "clock": "21:26:34",
          "kind": "bad",
          "title": "Question sur un rachat de parts laissée sans réponse",
          "insight": "Jane demande comment monter une holding pour un dirigeant qui rachète les parts d'un associé partant à la retraite, sans avantager l'associé restant. Le cas est complexe, à forte valeur, posé par quelqu'un encore présent. La question n'a jamais reçu de réponse.",
          "reasoning": [
            "Rapport Q&R : aucune heure de réponse, aucun répondant",
            "Elle avait déjà signalé son secteur et son montage dans le chat",
            "Une question de cette taille sans réponse est un rendez-vous perdu, pas un oubli anodin"
          ]
        },
        {
          "at": 6138,
          "clock": "21:43:03",
          "kind": "good",
          "title": "Sondage sur la forme juridique : le pic d'engagement du live",
          "insight": "En cinq minutes, quinze participants répondent en annonçant leur structure : SAS, SARL, SASU, holding, SCI. C'est le seul moment où le chat s'anime massivement, et il tombe pile dans la fenêtre où six des douze rendez-vous du live sont pris.",
          "reasoning": [
            "15 réponses entre 01:42:18 et 01:47:57",
            "6 réservations entre 21:12 et 21:57, soit la moitié de la récolte du live",
            "Faire parler la salle de sa propre situation précède la prise de rendez-vous"
          ]
        },
        {
          "at": 6489,
          "clock": "21:48:54",
          "kind": "bad",
          "title": "Un participant ne peut pas réserver : le calendrier s'arrête à septembre",
          "insight": "« Je ne peux pas prendre de rdv sur septembre mais souhaite octobre, vous pouvez me donner accès au calendrier d'octobre ? » C'est exactement la fuite constatée le 20 juillet sur l'horizon de créneaux, à l'identique, deux mois plus tard.",
          "reasoning": [
            "Message chat à 01:48:09, soit 21h48",
            "Le 20/07 portait déjà l'axe « élargir l'horizon de créneaux du lien par défaut »",
            "AVLIS est le participant le plus actif du chat : 11 messages sur la soirée"
          ]
        },
        {
          "at": 7515,
          "clock": "22:06:00",
          "kind": "objection",
          "title": "Un participant conteste le discours sur l'expert-comptable",
          "insight": "Lionel objecte à trois reprises que l'expert-comptable fait du droit fiscal, qu'il a un devoir de conseil et qu'il est assuré pour cela. L'argument central du webinaire est contesté publiquement, devant une salle encore à trente personnes.",
          "reasoning": [
            "Trois messages : 02:05:15, 02:08:52 et 02:23:56",
            "Audience encore à ~31 simultanés à ce moment",
            "Aucune réponse écrite dans le chat n'est visible face à ces trois messages"
          ]
        },
        {
          "at": 7807,
          "clock": "22:10:52",
          "kind": "bad",
          "title": "Le calendrier est ouvert en direct, le rendez-vous n'arrive jamais",
          "insight": "« Merci d'avoir ouvert le calendrier à octobre », puis « rdv pris » sept secondes plus tard. Or aucune réservation n'est enregistrée après 22h01, aucun créneau d'octobre n'a été réservé pendant le live, et aucun lead ne porte ce nom. Le blocage a été levé en direct et la conversion s'est quand même perdue quelque part.",
          "reasoning": [
            "Base des réservations : dernière entrée à 22:01, aucune ensuite",
            "Aucun créneau d'octobre réservé pendant le live",
            "Aucun lead au nom d'AVLIS dans le CRM",
            "À vérifier côté page de réservation : un échec silencieux est l'hypothèse la plus probable"
          ]
        },
        {
          "at": 8980,
          "clock": "22:30:25",
          "kind": "good",
          "title": "Un participant prend la défense du discours",
          "insight": "Face au contradicteur, AVLIS répond que les cabinets d'expertise comptable sont trop débordés pour conseiller, puis conclut « on a besoin des deux ». La salle règle l'objection à la place de l'animateur, ce qui est la meilleure issue possible.",
          "reasoning": [
            "Messages à 02:29:40 et 02:31:38",
            "C'est le même participant qui n'a pas pu réserver",
            "Une objection traitée par un pair porte plus qu'une réponse de l'animateur"
          ]
        },
        {
          "at": 9152,
          "clock": "22:33:17",
          "kind": "cta",
          "title": "Dernier rappel du lien, trois minutes avant la fin",
          "insight": "Septième et dernier rappel : « Ne quittez pas le webinaire sans votre rendez-vous ». Sur les sept rappels de la soirée, le dernier tombe alors qu'il ne reste plus que trente-six personnes, contre cinquante-huit au pic.",
          "reasoning": [
            "7 rappels du lien entre 01:00:42 et 02:32:32",
            "Audience à 36 simultanés en fin de live contre 58 au pic",
            "Les 4 derniers rappels s'adressent à une salle qui s'est déjà vidée d'un tiers"
          ]
        }
      ]
    }
};
