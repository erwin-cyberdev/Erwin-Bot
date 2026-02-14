import { getGroupSettings } from './groupSettings.js'

// Liste des réactions par type
const REACTION_MAP = {
  // Réactions pour les salutations
  greeting: ['👋', '👋🏼', '👋🏽', '👋🏾', '👋🏿'],
  // Réactions pour les remerciements
  thanks: ['🙏', '🙏🏼', '🙏🏽', '🙏🏾', '🙏🏿'],
  // Réactions pour les rires
  laugh: ['😂', '🤣', '😆'],
  // Réactions pour les félicitations
  praise: ['👏', '👏🏼', '👏🏽', '👏🏾', '👏🏿', '🎉', '✨'],
  // Réactions pour les médias
  media: ['❤️', '🔥', '😍', '👍', '👌'],
  // Réactions pour les messages audio
  audio: ['🎧', '🔊', '🎵', '🔥'],
  // Réactions par défaut
  default: ['👍', '😂', '😎', '🔥', '👌']
}

// Mots-clés pour les réactions
const KEYWORDS = {
  greeting: ['bonjour', 'salut', 'coucou', 'hey', 'hello', 'hi', 'yo'],
  thanks: ['merci', 'thanks', 'thx', 'ty'],
  laugh: ['lol', 'mdr', 'ptdr', 'xd', 'haha', 'pfff'],
  praise: ['bravo', 'félicitations', 'gg', 'bien joué', 'nice']
}

/**
 * Vérifie si le message correspond à un type de réaction
 * @param {string} text - Le message à analyser
 * @returns {string|null} Le type de réaction ou null
 */
function getReactionType(text) {
  const lowerText = text.toLowerCase()
  
  // Vérifie les mots-clés spécifiques
  for (const [type, words] of Object.entries(KEYWORDS)) {
    if (words.some(word => lowerText.includes(word))) {
      return type
    }
  }
  
  return null
}

/**
 * Obtient une réaction aléatoire selon le type
 * @param {string} type - Le type de réaction
 * @returns {string} L'émoji de réaction
 */
function getRandomReaction(type) {
  const reactions = REACTION_MAP[type] || REACTION_MAP.default
  return reactions[Math.floor(Math.random() * reactions.length)]
}

/**
 * Gère l'auto-réaction aux messages
 * @param {object} sock - L'instance du socket Baileys
 * @param {object} msg - L'objet message
 * @param {string} from - L'expéditeur du message
 * @param {string} text - Le texte du message
 * @returns {Promise<void>}
 */
export async function handleAutoReact(sock, msg, from, text) {
  try {
    // Ignore si ce n'est pas un groupe
    if (!from.endsWith('@g.us')) return
    
    // Ignore les messages du bot, les commandes et les messages système
    if (!text || 
        msg.key.fromMe || 
        msg.message?.protocolMessage || 
        msg.message?.senderKeyDistributionMessage ||
        text.startsWith(getPrefix())) {
      return
    }
    
    // Récupère les paramètres du groupe
    const settings = await getGroupSettings(from)
    
    // Vérifie si l'auto-réaction est activée et si on a de la chance
    if (!settings.autoreact || Math.random() > (settings.autoreactChance || 0.25)) {
      return
    }
    
    // Détecte le type de réaction approprié
    let reactionType = getReactionType(text)
    
    // Si pas de type spécifique, utilise la logique par défaut
    if (!reactionType) {
      if (msg.message?.imageMessage || msg.message?.videoMessage) {
        reactionType = 'media'
      } else if (msg.message?.audioMessage) {
        reactionType = 'audio'
      } else {
        reactionType = 'default'
      }
    }
    
    // Obtient une réaction aléatoire
    const reaction = getRandomReaction(reactionType)
    
    // Ajoute un délai aléatoire pour paraître plus humain
    const delay = 400 + Math.random() * 800
    
    // Envoie la réaction de manière non-bloquante
    setTimeout(() => {
      sock.sendMessage(from, {
        react: {
          text: reaction,
          key: msg.key
        }
      }).catch(() => {}) // Ignore les erreurs silencieusement
    }, delay)
    
  } catch (error) {
    // Absolument silencieux en production
  }
}
