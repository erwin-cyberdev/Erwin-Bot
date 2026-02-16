import { chatCompletion, AI_MODELS } from '../utils/groq.js'

const DOWNLOAD_TIMEOUT = 20000

export default async function visionCommand(sock, msg, args) {
  const from = msg.key.remoteJid

  const quotedInfo = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
  const imageMsg = msg.message?.imageMessage || quotedInfo?.imageMessage

  if (!imageMsg) {
    return sock.sendMessage(from, {
      text: `╭─────────────────────╮
│ 👁️ *AI VISION (Groq)* │
╰─────────────────────╯

❌ *Usage :*
Réponds à une image avec .vision [question optionnelle]

💡 Propulsé par Llama 3.2 Vision.`
    }, { quoted: msg })
  }

  const question = args && args.length ? args.join(' ').trim() : "Décris cette image en détail."

  await sock.sendMessage(from, { text: '👁️ Analyse de l\'image par Groq...' }, { quoted: msg })

  try {
    const mediaSource = msg.message?.extendedTextMessage?.contextInfo || msg
    const buffer = await sock.downloadMediaMessage(mediaSource, { timeout: DOWNLOAD_TIMEOUT })

    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('Impossible de récupérer le contenu de l\'image')
    }

    const mime = imageMsg.mimetype || 'image/jpeg'
    const base64Image = buffer.toString('base64')

    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: question },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mime};base64,${base64Image}`
            }
          }
        ]
      }
    ]

    const description = await chatCompletion(AI_MODELS.VISION_LLAMA_11B, messages)

    if (!description) {
      throw new Error('Aucune description générée')
    }

    const replyText = `╭─────────────────────╮
│ 👁️ *ANALYSE GROQ*    │
╰─────────────────────╯

${description}

━━━━━━━━━━━━━━━━━━━━
🤖 Llama 3.2 Vision`

    await sock.sendMessage(from, { text: replyText }, { quoted: msg })

  } catch (err) {
    console.error('Erreur .vision Groq:', err)
    await sock.sendMessage(from, {
      text: `❌ Impossible d'analyser l'image.\n\nErreur: ${err.message || 'Inconnue'}`
    }, { quoted: msg })
  }
}
