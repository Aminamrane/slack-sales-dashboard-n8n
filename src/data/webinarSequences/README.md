# Séquences e-mail des cohortes webinaire

Contenu **réel** des e-mails envoyés par la landing webinaire, cohorte par cohorte : objet, HTML,
texte, expéditeur, pièces jointes, calendrier et règles d'envoi. Il alimente la fenêtre
« Gestion de séquence » de `/ceo/Sub-Tickets` (`src/components/sequenceMail/`).

## Pourquoi ces fichiers existent

L'API du CRM (`/api/v1/marketing/webinars/…`) donne les cohortes et les **statistiques** par type
d'e-mail, mais pas leur contenu : celui-ci n'existe que dans le code de la landing
(`landing-webinaire`, projet Next.js séparé, hébergé sur le VPS de production). Les chiffres
restent lus en direct dans l'API ; seul le contenu, qui n'y est pas, est embarqué ici.

## D'où viennent les données

Rien n'est écrit à la main. `scripts/webinar-sequences/build.mjs` compile le vrai `email.ts` de la
landing, l'exécute avec un faux client Resend qui capture la charge utile, et appelle les vraies
fonctions d'envoi avec un inscrit « modèle » (`{{prénom}}`, `EVENT_ID`). Le résultat est donc ce que
la landing envoie, aux champs personnalisés près.

Les cohortes passées sont restituées avec la **version du code qui les a envoyées** (les relances
post-live ont été réécrites le 08/09) : 26/05, 22/06 et 20/07 viennent d'anciennes sauvegardes de
`email.ts`, 07/09, 21/09 et 08/10 du code actuel. Le calendrier (`definitions.mjs`) vient de
`lead-outbox.ts` et des dates réellement observées dans la table `outbox`.

Limites connues : le pied de désinscription (introduit le 22/06) et la version texte (18/08)
n'existaient pas dans les envois plus anciens ; pour ces cohortes le texte est dérivé du HTML
(`textDerived: true`).

## Publication (dépôt public)

Ces fichiers sont publiés avec le dépôt : les e-mails ont déjà été envoyés aux inscrits. Sont **masqués** les codes d'invitation des groupes WhatsApp
(`chat.whatsapp.com/CODE_MASQUE`) et l'adresse personnelle d'un expéditeur (`scripts/webinar-sequences/redact.mjs`, appliqué par `build.mjs`). Ne jamais
commiter une version non masquée.

## Régénérer

```
node scripts/webinar-sequences/build.mjs --landing <copie de la landing> --eras <anciennes versions de email.ts>
```

Détails et prérequis dans l'en-tête de `scripts/webinar-sequences/build.mjs`. À refaire quand la
landing change (nouvelle cohorte, e-mail modifié) : ces fichiers sont un instantané.

### Cohortes courantes (8 oct., 22 oct., 17 nov., 24 nov.)

Elles relèvent de l'ère « sept » (code actuel de la landing) : `--only` en régénère une ou plusieurs, sans `--eras`.

```
node scripts/webinar-sequences/build.mjs --landing <copie de la landing> --only webinar-2026-11-24
```

Le webinaire du 17 novembre a été déplacé au 24 le 10/11 : ses inscrits sont passés sur la cohorte `webinar-2026-11-24`, que
le CRM suit désormais. La landing n'a pas de registre d'e-mails propre au 24 : elle envoie celui du 17 (mêmes types d'envoi
`email_nov17_*` / `email_post17_*`) et adapte la date et le lien selon la cohorte de l'inscrit. `definitions.mjs` le dit avec
`emailsOf: 'webinar-2026-11-17'` : le générateur appelle le registre du 17 pour un inscrit du 24, et le contenu obtenu est
celui que reçoit cette cohorte (20 e-mails : les 19 de la séquence et l'avis de changement de date du 10/11). Ses dates de
suivi après le live seront connues une fois le live passé : à régénérer à ce moment-là. La cohorte du 17 reste au catalogue
(19 e-mails), sans chiffres : le CRM ne la liste plus.

Le code actuel de la landing contient le crochet de « Confirmer les modifications » (`sequence-versions`, appelé juste avant
l'envoi) : le générateur le remplace par `stubs/sequence-versions.mjs` et restitue donc toujours l'e-mail d'**origine**.

« Confirmer les modifications » (Sub-Tickets) publie la version choisie **à la place** de l'e-mail d'origine,
et l'éditeur part de ces fichiers : ils doivent donc refléter ce que la landing envoie aujourd'hui.
Régénérer et comparer avant toute livraison de la landing qui touche `email.ts`.

## Format

- `catalog.json` : métadonnées de chaque cohorte (id, libellé, public, live, intervenants, pages…).
- `cohorts/<id>.json` : `{ schema, generatedAt, cohort, sequences, rules, steps[] }`, où chaque
  étape porte `kind`, `order`, `sequence` (`pre` | `post` | `oneshot`), `phase`, `timing`,
  `conditions`, `subject`, `preheader`, `snippet`, `from`, `replyTo`, `html`, `text`, `links`, etc.

## Attention

Le dépôt est public. Ces fichiers reproduisent des e-mails marketing déjà envoyés ; ne régénérer
que sur des séquences validées, jamais sur une copie de travail non envoyée.
