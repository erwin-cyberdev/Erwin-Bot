// commands/advice.js
import axios from 'axios'
import { translate } from '@vitalets/google-translate-api'

// Cache pour stocker les conseils déjà obtenus
const adviceCache = new Map()
const CACHE_EXPIRATION = 5 * 60 * 1000 // 5 minutes

// Fonction pour nettoyer le cache
function cleanupCache() {
  const now = Date.now()
  for (const [key, { timestamp }] of adviceCache.entries()) {
    if (now - timestamp > CACHE_EXPIRATION) {
      adviceCache.delete(key)
    }
  }
}

// Nettoyer le cache toutes les 5 minutes
setInterval(cleanupCache, CACHE_EXPIRATION)

export default async function (sock, msg) {
  const from = msg.key.remoteJid

  // Vérifier d'abord le cache
  const cachedAdvice = adviceCache.get('current')
  const now = Date.now()

  if (cachedAdvice && (now - cachedAdvice.timestamp < CACHE_EXPIRATION)) {
    await sock.sendMessage(from, { text: cachedAdvice.message }, { quoted: msg })
    return
  }

  try {
    const loadingMsg = await sock.sendMessage(from, { text: '⏳ Génération d\'un conseil...' }, { quoted: msg })

    try {
      const res = await axios.get('https://api.adviceslip.com/advice', { timeout: 8000 })

      if (!res?.data?.slip?.advice) {
        throw new Error('Réponse de l\'API invalide')
      }

      const advice = res.data.slip.advice
      let translatedAdvice = advice

      // Traduire en français
      try {
        const translation = await translate(advice, { from: 'en', to: 'fr' })
        translatedAdvice = translation.text
      } catch (translationError) {
        console.log('Traduction échouée, utilisation du texte original')
      }

      const message = `💡 *CONSEIL DU JOUR*\n\n✨ "${translatedAdvice}"\n\n━━━━━━━━━━━━━━━━━━━━\n💡 Sagesse quotidienne`.trim()

      adviceCache.set('current', { message, timestamp: now })
      await sock.sendMessage(from, { text: message }, { quoted: msg })

      if (loadingMsg?.key?.id) {
        await sock.sendMessage(from, { delete: loadingMsg.key }).catch(() => { })
      }

    } catch (apiError) {
      console.error('Erreur API advice:', apiError)
      if (cachedAdvice) {
        await sock.sendMessage(from, { text: `⚠️ Service lent. Voici un conseil récent :\n\n${cachedAdvice.message}` }, { quoted: msg })
      } else {
        throw apiError
      }
    }

  } catch (err) {
    console.error('Erreur .advice:', err)
    await sock.sendMessage(from, { text: '❌ Impossible de récupérer un conseil pour le moment.' }, { quoted: msg })
  }
}
