/**
 * commands/gemini.js - Refactored to use OpenRouter
 */
import { chatCompletion, AI_MODELS } from '../utils/openRouter.js'

const MAX_PROMPT = 4000

function sanitizePrompt(text = '') {
  return String(text).replace(/\s+/g, ' ').trim()
}

function truncatePrompt(prompt) {
  if (!prompt) return ''
  return prompt.length <= MAX_PROMPT
    ? prompt
    : `${prompt.slice(0, MAX_PROMPT - 100)}… (tronqué)`
}

export default async function geminiCommand(sock, msg, args = []) {
  const from = msg.key.remoteJid
  const promptRaw = sanitizePrompt(args.join(' '))

  if (!promptRaw) {
    return sock.sendMessage(
      from,
      { text: '💡 Utilisation : `.gemini <question>`' },
      { quoted: msg }
    )
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return sock.sendMessage(
      from,
      { text: '⚠️ OPENROUTER_API_KEY manquante dans le fichier .env' },
      { quoted: msg }
    )
  }

  await sock.sendMessage(
    from,
    { text: '🧠 Gemini réfléchit...' },
    { quoted: msg }
  )

  try {
    const prompt = truncatePrompt(promptRaw)
    const reply = await chatCompletion(
      AI_MODELS.GEMINI,
      [{ role: 'user', content: prompt }]
    )

    const MAX_WH_TEXT = 6500
    const safeReply =
      reply.length > MAX_WH_TEXT
        ? `${reply.slice(0, MAX_WH_TEXT - 200)}\n\n(↘️ tronqué)`
        : reply

    await sock.sendMessage(
      from,
      { text: `✨ *Réponse de Gemini :*\n\n${safeReply}` },
      { quoted: msg }
    )

  } catch (err) {
    console.error('❌ Erreur Gemini (OpenRouter) :', err)

    let message = '❗ Erreur inconnue Gemini.'
    const reason = String(err?.message || '').toLowerCase()

    if (reason.includes('api key') || reason.includes('401')) message = '⚠️ Clé API invalide.'
    else if (reason.includes('quota') || reason.includes('429')) message = '⚠️ Quota dépassé.'
    else if (reason.includes('timeout')) message = '⌛ Gemini met trop de temps à répondre.'
    else if (reason.includes('network')) message = '🌐 Problème réseau vers OpenRouter.'
    else if (reason.includes('503')) message = '⚠️ Service temporairement indisponible.'

    try {
      await sock.sendMessage(from, { text: message }, { quoted: msg })
    } catch { }
  }
}
