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
};
