# Manuel d'utilisation — Erwin-Bot

## Informations générales
- **Préfixe par défaut** : `-` (modifiable via la commande `-setprefix`).
- **Notation** : chaque commande se lance sous la forme `<préfixe><nom>`, par exemple `-ping`.
- **Mention des membres** : utilisez `@numero` pour signaler un membre (dans les groupes).
- **Rôles** :
  - **Utilisateur** : toute personne ayant accès au bot.
  - **Admin** : administrateur du groupe WhatsApp.
  - **Propriétaire** : propriétaire du bot (identifié dans la configuration interne).

## 🤖 Commandes Intelligence Artificielle (Groq)
- **-ai <prompt>** — Question/Réponse rapide avec l'IA. Supporte l'analyse d'image en répondant à une photo.
- **-chat <message>** — Discussion continue avec mémoire (se souvient des 10 derniers échanges).
- **-transcribe** — Transcrire un message vocal en texte (répondre au vocal avec la commande).
- **-chat reset** — Effacer la mémoire de la conversation en cours.

## 🛠️ Commandes Utilisateurs
- **-advice** — Recevoir un conseil aléatoire.
- **-anime <titre>** — Chercher des informations sur un anime.
- **-crypto <symbole>** — Consulter le prix d’une cryptomonnaie (ex : `-crypto BTC`).
- **-lyrics <titre>** — Obtenir les paroles d’une chanson.
- **-meteo <ville>** — Consulter la météo d’une ville.
- **-movie <titre>** — Afficher la fiche d’un film.
- **-ping** — Tester la réactivité du bot.
- **-song <titre|lien YouTube>** — Télécharger une chanson depuis YouTube.
- **-sticker** — Créer un sticker (répondre à une image/vidéo).
- **-yt <url>** — Télécharger une vidéo YouTube.

## 🛡️ Commandes Admin (réservées aux administrateurs)
- **-antidelete <on|off>** — Empêcher la suppression des messages.
- **-antilink <on|off>** — Bloquer automatiquement les liens.
- **-kick <@membre>** — Expulser un membre du groupe.
- **-tagall [message]** — Mentionner tous les membres du groupe.

## 👑 Commandes Propriétaire (réservées au propriétaire)
- **-setprefix <préfixe>** — Modifier le préfixe global des commandes.
- **-botstats** — Afficher les statistiques internes du bot.
- **-broadcast <message>** — Diffuser un message à tous les chats.

## 💡 Conseils d'utilisation
- **Prefixe** : Si le bot ne répond pas à `.`, essaie le nouveau préfixe `-`.
- **Mémoire** : La commande `-chat` est idéale pour de longues discussions, alors que `-ai` est plus rapide pour des questions uniques.
- **Vocal** : Pour transcrire un vocal, assure-toi de bien **répondre** au message vocal avec la commande `-transcribe`.

Ce manuel a été mis à jour après la refactorisation complète du bot.
