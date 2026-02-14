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

    // Essayer d'abord avec un timeout court
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
      const res = await axios.get('https://api.adviceslip.com/advice', {
        timeout: 8000,
        signal: controller.signal
      })
      clearTimeout(timeout)

      if (!res?.data?.slip?.advice) {
        throw new Error('Réponse de l\'API invalide')
      }

      const advice = res.data.slip.advice
      let translatedAdvice = advice

      // Traduire en français avec gestion d'erreur
      try {
        const translation = await Promise.race([
          translate(advice, { from: 'en', to: 'fr' }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Traduction timeout')), 4000)
          )
        ])
        translatedAdvice = translation.text
      } catch (translationError) {
        console.log('Traduction échouée, utilisation du texte original')
      }

      const message = `
╭────────────────────────╮
│  💡 *CONSEIL DU JOUR*  │
╰────────────────────────╯

✨ *Conseil :*
"${translatedAdvice}"

━━━━━━━━━━━━━━━━━━━━
💡 Sagesse quotidienne
      `.trim()

      // Mettre en cache le conseil
      adviceCache.set('current', {
        message,
        timestamp: now
      })

      await sock.sendMessage(from, { text: message }, { quoted: msg })
      
      // Supprimer le message de chargement si possible
      if (loadingMsg?.key?.id) {
        await sock.sendMessage(from, { 
          delete: loadingMsg.key 
        })
      }

    } catch (apiError) {
      clearTimeout(timeout)
      console.error('Erreur API advice:', apiError)
      
      // Si l'API est en erreur mais qu'on a un conseil en cache, l'utiliser
      if (cachedAdvice) {
        await sock.sendMessage(from, { 
          text: `⚠️ Service temporairement indisponible. Voici un conseil récent :\n\n${cachedAdvice.message}` 
        }, { quoted: msg })
      } else {
        throw apiError
      }
    }

  } catch (err) {
    console.error('Erreur .advice:', err)
    
    const errorMessage = err.code === 'ECONNABORTED' || err.name === 'AbortError'
      ? '❌ Le service de conseils est trop lent à répondre. Réessayez plus tard.'
      : '❌ Impossible de récupérer un conseil pour le moment. Le service est peut-être indisponible.'
    
    await sock.sendMessage(from, { text: errorMessage }, { quoted: msg })
  }
}
