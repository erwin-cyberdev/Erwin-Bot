import fs from 'fs'
import path from 'path'
import { formatMenuSections, getMenuErrorMessage } from '../utils/i18n.js'
import { getLanguagePreference } from '../utils/messageHelpers.js'

const FALLBACK_DESCRIPTION = {
  fr: 'Description non disponible.',
  en: 'Description not available.'
}

const COMMAND_METADATA = {
  add: { category: 'admin', descriptionFr: 'Ajouter un membre au groupe via son numéro.', descriptionEn: 'Add a member to the group using their number.' },
  advice: { category: 'user', descriptionFr: 'Recevoir un conseil aléatoire.', descriptionEn: 'Receive a random piece of advice.' },
  ai: { category: 'user', descriptionFr: 'Conversation IA générique (GPT-4o-mini).', descriptionEn: 'Generic AI conversation (GPT-4o-mini).' },
  chat: { category: 'user', descriptionFr: 'Conversation IA avec mémoire contextuelle.', descriptionEn: 'AI conversation with contextual memory.' },
  gemini: { category: 'user', descriptionFr: 'Envoyer un message à Gemini via OpenRouter.', descriptionEn: 'Send a message to Gemini via OpenRouter.' },
  mistral: { category: 'user', descriptionFr: 'Envoyer un message à Mistral via OpenRouter.', descriptionEn: 'Send a message to Mistral via OpenRouter.' },
  anime: { category: 'user', descriptionFr: 'Chercher des informations sur un anime.', descriptionEn: 'Search for information about an anime.' },
  animequote: { category: 'user', descriptionFr: 'Afficher une citation d’anime.', descriptionEn: 'Display an anime quote.' },
  animeseason: { category: 'user', descriptionFr: 'Lister les animes de la saison en cours.', descriptionEn: 'List the anime of the current season.' },
  antibot: { category: 'admin', descriptionFr: 'Activer ou désactiver la protection anti-bot.', descriptionEn: 'Enable or disable anti-bot protection.' },
  antidelete: { category: 'admin', descriptionFr: 'Empêcher la suppression des messages dans le groupe.', descriptionEn: 'Prevent message deletion in the group.' },
  antilink: { category: 'admin', descriptionFr: 'Bloquer automatiquement les liens partagés.', descriptionEn: 'Automatically block shared links.' },
  ban: { category: 'owner', descriptionFr: 'Bannir un utilisateur de toutes les commandes du bot.', descriptionEn: 'Ban a user from all bot commands.' },
  birthday: { category: 'user', descriptionFr: 'Calculer le compte à rebours avant une date.', descriptionEn: 'Calculate the countdown before a date.' },
  botstats: { category: 'owner', descriptionFr: 'Afficher les statistiques internes du bot.', descriptionEn: 'Display the bot’s internal statistics.' },
  broadcast: { category: 'owner', descriptionFr: 'Diffuser un message à tous les chats.', descriptionEn: 'Broadcast a message to all chats.' },
  bible: { category: 'user', descriptionFr: 'Obtenir un verset biblique aléatoire ou ciblé.', descriptionEn: 'Get a random or specific Bible verse.' },
  calc: { category: 'user', descriptionFr: 'Résoudre une expression mathématique.', descriptionEn: 'Solve a math expression.' },
  clear: { category: 'admin', descriptionFr: 'Supprimer les derniers messages du chat.', descriptionEn: 'Delete recent messages in the chat.' },
  coin: { category: 'user', descriptionFr: 'Lancer une pièce pile ou face.', descriptionEn: 'Flip a coin.' },
  crypto: { category: 'user', descriptionFr: 'Consulter le prix d’une cryptomonnaie.', descriptionEn: 'Check the price of a cryptocurrency.' },
  define: { category: 'user', descriptionFr: 'Afficher la définition d’un mot.', descriptionEn: 'Show the definition of a word.' },
  demote: { category: 'admin', descriptionFr: 'Retirer un membre de la liste des admins du groupe.', descriptionEn: 'Remove a member from the group admin list.' },
  dice: { category: 'user', descriptionFr: 'Lancer un dé virtuel.', descriptionEn: 'Roll a virtual die.' },
  disclaimer: { category: 'user', descriptionFr: 'Afficher les conditions d’utilisation du bot.', descriptionEn: 'Show the bot’s terms of use.' },
  extract: { category: 'user', descriptionFr: 'Sauvegarder un média à lecture unique.', descriptionEn: 'Save a view-once media.' },
  fact: { category: 'user', descriptionFr: 'Découvrir un fait insolite.', descriptionEn: 'Discover an unusual fact.' },
  filter: { category: 'admin', descriptionFr: 'Gérer les filtres automatiques du groupe.', descriptionEn: 'Manage the group’s automatic filters.' },
  imagine: { category: 'user', descriptionFr: 'Générer une image via l\'IA.', descriptionEn: 'Generate an image with AI.' },
  info: { category: 'user', descriptionFr: 'Afficher les informations du bot.', descriptionEn: 'Display bot information.' },
  insta: { category: 'user', descriptionFr: 'Télécharger un post/reel Instagram.', descriptionEn: 'Download an Instagram post/reel.' },
  joke: { category: 'user', descriptionFr: 'Recevoir une blague aléatoire.', descriptionEn: 'Receive a random joke.' },
  kick: { category: 'admin', descriptionFr: 'Expulser un membre du groupe.', descriptionEn: 'Kick a member from the group.' },
  listadmins: { category: 'owner', descriptionFr: 'Lister les administrateurs du bot.', descriptionEn: 'List the bot administrators.' },
  listbanned: { category: 'owner', descriptionFr: 'Afficher les utilisateurs bannis du bot.', descriptionEn: 'Display bot-banned users.' },
  lyrics: { category: 'user', descriptionFr: 'Obtenir les paroles d’une chanson.', descriptionEn: 'Get a song’s lyrics.' },
  manga: { category: 'user', descriptionFr: 'Chercher des informations sur un manga.', descriptionEn: 'Search for information about a manga.' },
  meme: { category: 'user', descriptionFr: 'Envoyer un meme aléatoire.', descriptionEn: 'Send a random meme.' },
  menu: { category: 'user', descriptionFr: 'Afficher la liste complète des commandes.', descriptionEn: 'Display the full list of commands.' },
  meteo: { category: 'user', descriptionFr: 'Consulter la météo d’une ville.', descriptionEn: 'Check a city’s weather.' },
  movie: { category: 'user', descriptionFr: 'Afficher la fiche d’un film.', descriptionEn: 'Show a movie’s details.' },
  news: { category: 'user', descriptionFr: 'Consulter les dernières actualités par sujet.', descriptionEn: 'Fetch the latest news by topic.' },
  mute: { category: 'admin', descriptionFr: 'Mettre un membre en mode muet.', descriptionEn: 'Mute a member.' },
  perso: { category: 'user', descriptionFr: 'Envoyer un message personnalisé préconfiguré.', descriptionEn: 'Send a preconfigured custom message.' },
  private: { category: 'owner', descriptionFr: 'Commande réservée aux owners/admins pour actions privées.', descriptionEn: 'Owner/admin-only private command.' },
  ping: { category: 'user', descriptionFr: 'Tester la réactivité du bot.', descriptionEn: 'Test the bot’s responsiveness.' },
  poll: { category: 'user', descriptionFr: 'Créer un sondage interactif.', descriptionEn: 'Create an interactive poll.' },
  pp: { category: 'user', descriptionFr: 'Récupérer une photo de profil.', descriptionEn: 'Fetch a profile picture.' },
  promote: { category: 'admin', descriptionFr: 'Promouvoir un membre en admin du groupe.', descriptionEn: 'Promote a member to group admin.' },
  purge: { category: 'admin', descriptionFr: 'Supprimer les messages d’un membre spécifique.', descriptionEn: 'Delete messages from a specific member.' },
  qrcode: { category: 'user', descriptionFr: 'Générer un QR code.', descriptionEn: 'Generate a QR code.' },
  quote: { category: 'user', descriptionFr: 'Afficher une citation inspirante.', descriptionEn: 'Display an inspiring quote.' },
  rmadmin: { category: 'owner', descriptionFr: 'Retirer un administrateur du bot.', descriptionEn: 'Remove a bot administrator.' },
  roulette: { category: 'user', descriptionFr: 'Jouer à la roulette russe virtuelle.', descriptionEn: 'Play virtual Russian roulette.' },
  say: { category: 'user', descriptionFr: 'Convertir du texte en audio.', descriptionEn: 'Convert text to audio.' },
  securitystats: { category: 'owner', descriptionFr: 'Consulter les statistiques de sécurité.', descriptionEn: 'Check security statistics.' },
  setadmin: { category: 'owner', descriptionFr: 'Ajouter un administrateur au bot.', descriptionEn: 'Add a bot administrator.' },
  setgoodbye: { category: 'admin', descriptionFr: 'Configurer le message d’au revoir automatique.', descriptionEn: 'Configure the automatic goodbye message.' },
  setprefix: { category: 'owner', descriptionFr: 'Modifier le préfixe des commandes du bot.', descriptionEn: 'Change the bot command prefix.' },
  setwelcome: { category: 'admin', descriptionFr: 'Configurer le message de bienvenue automatique.', descriptionEn: 'Configure the automatic welcome message.' },
  ship: { category: 'user', descriptionFr: 'Estimer l’affinité entre deux membres.', descriptionEn: 'Estimate compatibility between two members.' },
  shorten: { category: 'user', descriptionFr: 'Raccourcir une URL.', descriptionEn: 'Shorten a URL.' },
  screenshot: { category: 'user', descriptionFr: 'Capturer une page web en image.', descriptionEn: 'Capture a webpage as an image.' },
  song: { category: 'user', descriptionFr: 'Télécharger une chanson depuis YouTube.', descriptionEn: 'Download a song from YouTube.' },
  sticker: { category: 'user', descriptionFr: 'Créer un sticker à partir d’un média.', descriptionEn: 'Create a sticker from media.' },
  status: { category: 'user', descriptionFr: 'Télécharger en privé la story WhatsApp répondue.', descriptionEn: 'Privately download the replied WhatsApp status.' },
  tagall: { category: 'admin', descriptionFr: 'Mentionner tous les membres du groupe.', descriptionEn: 'Mention all group members.' },
  tictactoe: { category: 'user', descriptionFr: 'Jouer au morpion avec le bot.', descriptionEn: 'Play tic-tac-toe with the bot.' },
  tiktok: { category: 'user', descriptionFr: 'Télécharger une vidéo TikTok sans watermark.', descriptionEn: 'Download a TikTok video without watermark.' },
  time: { category: 'user', descriptionFr: 'Afficher l’heure d’une ville.', descriptionEn: 'Show a city’s time.' },
  transcribe: { category: 'user', descriptionFr: 'Convertir un message vocal en texte via OpenRouter.', descriptionEn: 'Convert a voice message to text via OpenRouter.' },
  translate: { category: 'user', descriptionFr: 'Traduire un texte via OpenRouter.', descriptionEn: 'Translate text via OpenRouter.' },
  trivia: { category: 'user', descriptionFr: 'Participer à un quiz généraliste.', descriptionEn: 'Take part in a general knowledge quiz.' },
  unban: { category: 'owner', descriptionFr: 'Réhabiliter un utilisateur banni.', descriptionEn: 'Reinstate a banned user.' },
  unmute: { category: 'admin', descriptionFr: 'Réactiver un membre mis en sourdine.', descriptionEn: 'Unmute a member.' },
  unwarn: { category: 'admin', descriptionFr: 'Retirer un avertissement d’un membre.', descriptionEn: 'Remove a warning from a member.' },
  vision: { category: 'user', descriptionFr: 'Analyser une image avec Gemini Vision.', descriptionEn: 'Analyze an image with Gemini Vision.' },
  vote: { category: 'user', descriptionFr: 'Créer un vote rapide dans le groupe.', descriptionEn: 'Create a quick group vote.' },
  wallpaper: { category: 'user', descriptionFr: 'Trouver un fond d’écran HD.', descriptionEn: 'Find an HD wallpaper.' },
  waifu: { category: 'user', descriptionFr: 'Obtenir une image aléatoire de waifu ou husbando.', descriptionEn: 'Get a random waifu or husbando image.' },
  warn: { category: 'admin', descriptionFr: 'Attribuer un avertissement à un membre.', descriptionEn: 'Give a member a warning.' },
  warns: { category: 'admin', descriptionFr: 'Consulter les avertissements d’un membre.', descriptionEn: 'Check a member’s warnings.' },
  yt: { category: 'user', descriptionFr: 'Télécharger une vidéo YouTube.', descriptionEn: 'Download a YouTube video.' },
  setlang: { category: 'admin', descriptionFr: 'Définir la langue des réponses (fr ou en).', descriptionEn: 'Set the response language (fr or en).' }
}

export default async function (sock, msg) {
  const from = msg.key.remoteJid

  const commandsDir = path.resolve('./commands')
  let commandFiles = []

  try {
    commandFiles = fs
      .readdirSync(commandsDir)
      .filter(name => name.endsWith('.js'))
      .map(name => name.replace(/\.js$/, ''))
      .filter(name => name.length > 0)
      .sort((a, b) => a.localeCompare(b))
  } catch (err) {
    console.warn('Impossible de lister les commandes / Unable to list commands:', err?.message || err)
  }

  const categorized = {
    user: [],
    admin: [],
    owner: []
  }

  for (const name of commandFiles) {
    const metadata = COMMAND_METADATA[name] || { category: 'user' }
    const category = categorized[metadata.category] ? metadata.category : 'user'
    const description = {
      fr: metadata.descriptionFr || FALLBACK_DESCRIPTION.fr,
      en: metadata.descriptionEn || FALLBACK_DESCRIPTION.en
    }
    categorized[category].push({ name, description })
  }

  const totalCommands = commandFiles.length
  const imagePath = path.resolve('./assets/erwinbothelp.png')
  const sections = {
    total: totalCommands,
    categories: [
      { key: 'user', commands: categorized.user },
      { key: 'admin', commands: categorized.admin },
      { key: 'owner', commands: categorized.owner }
    ]
  }

  const languagePreference = getLanguagePreference(from)
  const menuText = formatMenuSections(sections, languagePreference)

  try {
    if (fs.existsSync(imagePath)) {
      const imgBuffer = fs.readFileSync(imagePath)
      await sock.sendMessage(
        from,
        { image: imgBuffer, caption: menuText },
        { quoted: msg }
      )
    } else {
      await sock.sendMessage(from, { text: menuText }, { quoted: msg })
    }
  } catch (err) {
    console.error('Erreur lors de l’envoi du menu / Error while sending menu:', err)
    await sock.sendMessage(from, { text: getMenuErrorMessage(languagePreference) }, { quoted: msg })
  }
}
