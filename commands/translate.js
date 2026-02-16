/**
 * commands/translate.js - Refactored to use OpenRouter
 */
import { chatCompletion, AI_MODELS } from '../utils/openRouter.js'

async function translateText(text, targetLang) {
  const prompt = `Traduire le texte suivant en ${targetLang}. Ne donne que la traduction, sans explication :\n\n"${text}"`

  const response = await chatCompletion(
    AI_MODELS.GEMINI,
    [{ role: 'user', content: prompt }]
  )

  return response.trim()
}

export default async function (sock, msg, args) {
  const from = msg.key.remoteJid

  if (args.length < 2) {
    return await sock.sendMessage(
      from,
      {
        text: "❌ *Usage:* .translate <langue_cible> <texte à traduire>\n\nExemple : `.translate en Bonjour tout le monde`"
      },
      { quoted: msg }
    )
  }

  const targetLang = args[0].toLowerCase()
  const textToTranslate = args.slice(1).join(" ")

  try {
    const translated = await translateText(textToTranslate, targetLang)
    const responseText = `🌐 *Traduction (${targetLang})*\n\n${translated}`
    await sock.sendMessage(from, { text: responseText }, { quoted: msg })
  } catch (err) {
    console.error('❌ Erreur .translate:', err)
    await sock.sendMessage(
      from,
      { text: `⚠️ Erreur lors de la traduction : ${err.message}` },
      { quoted: msg }
    )
  }
}
