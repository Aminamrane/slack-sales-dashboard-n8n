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

## Régénérer

```
node scripts/webinar-sequences/build.mjs --landing <copie de la landing> --eras <anciennes versions de email.ts>
```

Détails et prérequis dans l'en-tête de `scripts/webinar-sequences/build.mjs`. À refaire quand la
landing change (nouvelle cohorte, e-mail modifié) : ces fichiers sont un instantané.

## Format

- `catalog.json` : métadonnées de chaque cohorte (id, libellé, public, live, intervenants, pages…).
- `cohorts/<id>.json` : `{ schema, generatedAt, cohort, sequences, rules, steps[] }`, où chaque
  étape porte `kind`, `order`, `sequence` (`pre` | `post` | `oneshot`), `phase`, `timing`,
  `conditions`, `subject`, `preheader`, `snippet`, `from`, `replyTo`, `html`, `text`, `links`, etc.

## Attention

Le dépôt est public. Ces fichiers reproduisent des e-mails marketing déjà envoyés ; ne régénérer
que sur des séquences validées, jamais sur une copie de travail non envoyée.
