/**
 * commands/vision.js - Image analysis using OpenRouter (Gemini Vision)
 * NOTE: OpenRouter may not support vision models yet, keeping Google SDK for now
 * but checking for OPENROUTER_API_KEY as fallback
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import { sendWithTyping } from '../utils/sendWithTyping.js'

const MODEL_ID = 'gemini-pro-vision'
const MAX_IMAGE_BYTES = 4 * 1024 * 1024 // 4 MB
const DOWNLOAD_TIMEOUT = 20000

function extractGeminiText(result) {
  const response = result?.response
  if (!response) return null

  if (typeof response.text === 'function') {
    try {
      const t = response.text()
      if (t) return t.trim()
    } catch { }
  }

  const candidates = response?.candidates || result?.candidates
  const parts = candidates
    ?.flatMap(c => c?.content?.parts || c?.parts || [])
    ?.map(p => p?.text || (p?.image ? '[image]' : null))
    .filter(Boolean)
  if (parts?.length) return parts.join('\n').trim()

  try {
    const raw = JSON.stringify(result)
    return raw.slice(0, 2000)
  } catch {
    return null
  }
}

export default async function visionCommand(sock, msg, args) {
  const from = msg.key.remoteJid

  const quotedInfo = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
  const imageMsg = msg.message?.imageMessage || quotedInfo?.imageMessage

  if (!imageMsg) {
    return sock.sendMessage(from, {
      text: `╭─────────────────────╮
│ 👁️ *AI VISION*      │
╰─────────────────────╯

❌ *Usage :*
Réponds à une image avec .vision [question optionnelle]

📝 Exemples :
• Réponds à une image + ".vision Que vois-tu ?"
• Réponds à une image + ".vision Décris cette image"

💡 Limite d'image : 4 MB (JPG/PNG/WEBP)`
    }, { quoted: msg })
  }

  const question = args && args.length ? args.join(' ').trim() : "Décris cette image en détail. Identifie les objets, personnes, lieux, couleurs et l'ambiance."

  try {
    if (typeof sendWithTyping === 'function') {
      await sendWithTyping(sock, from, { text: '👁️ Analyse de l\'image en cours...' }, { quoted: msg })
    } else {
      await sock.sendMessage(from, { text: '👁️ Analyse de l\'image en cours...' }, { quoted: msg })
    }
  } catch (e) {
    console.warn('info send failed', e?.message)
  }

  try {
    // Use OPENROUTER_API_KEY if available, fallback to GEMINI_API_KEY
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY

    if (!apiKey) {
      return sock.sendMessage(from, {
        text: `❌ *API Key manquante*\nAjoute OPENROUTER_API_KEY ou GEMINI_API_KEY dans .env et redémarre le bot.`
      }, { quoted: msg })
    }

    const mediaSource = msg.message?.extendedTextMessage?.contextInfo || msg
    const buffer = await sock.downloadMediaMessage(mediaSource, { timeout: DOWNLOAD_TIMEOUT }).catch(err => {
      throw new Error('Échec téléchargement de l\'image ou timeout')
    })

    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('Impossible de récupérer le contenu de l\'image')
    }

    if (buffer.length > MAX_IMAGE_BYTES) {
      return sock.sendMessage(from, {
        text: `❗ L'image est trop volumineuse (${(buffer.length / (1024 * 1024)).toFixed(2)} MB). Réduis-la à < 4 MB et réessaie.`
      }, { quoted: msg })
    }

    const mime = imageMsg.mimetype || 'image/jpeg'
    const base64Image = buffer.toString('base64')

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: MODEL_ID })

    const contents = [
      {
        role: 'user',
        parts: [
          { text: question },
          {
            inline_data: {
              mime_type: mime,
              data: base64Image
            }
          }
        ]
      }
    ]

    const result = await model.generateContent(contents)
    const description = extractGeminiText(result)

    if (!description) {
      throw new Error('Aucune description générée par le modèle')
    }

    const replyText = `╭─────────────────────╮
│ 👁️ *ANALYSE IA*     │
╰─────────────────────╯

${description}

━━━━━━━━━━━━━━━━━━━━
🤖 Analysé par Gemini Vision AI`

    if (typeof sendWithTyping === 'function') {
      await sendWithTyping(sock, from, { text: replyText }, { quoted: msg })
    } else {
      await sock.sendMessage(from, { text: replyText }, { quoted: msg })
    }

  } catch (err) {
    console.error('Erreur .vision:', err)

    const msgLower = (err?.message || '').toLowerCase()
    if (msgLower.includes('api key') || msgLower.includes('manquante')) {
      return sock.sendMessage(from, {
        text: `❌ *Clé API manquante ou invalide*\nAjoute OPENROUTER_API_KEY ou GEMINI_API_KEY dans ton .env et vérifie sa validité.`
      }, { quoted: msg })
    }

    if (msgLower.includes('timeout') || msgLower.includes('téléchargement')) {
      return sock.sendMessage(from, {
        text: '⚠️ Problème réseau ou timeout lors du téléchargement de l\'image. Réessaie avec une connexion stable ou une image plus petite.'
      }, { quoted: msg })
    }

    if (msgLower.includes('format') || msgLower.includes('mime') || msgLower.includes('image')) {
      return sock.sendMessage(from, {
        text: '⚠️ Format d\'image non supporté ou image corrompue. Utilise JPG, PNG ou WEBP.'
      }, { quoted: msg })
    }

    await sock.sendMessage(from, {
      text: `❌ Impossible d'analyser l'image.\nRaisons possibles:\n• Clé API manquante/invalide\n• Image trop volumineuse (>4MB)\n• Format non supporté\n• Problème temporaire du service\n\nErreur: ${err?.message || 'Inconnue'}`
    }, { quoted: msg })
  }
}
