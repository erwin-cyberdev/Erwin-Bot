// gemini.js — Gemini stable + timeout réel + retry robuste
import { GoogleGenerativeAI } from '@google/generative-ai'

const MODEL_ID = 'gemini-2.5-flash'
const MAX_PROMPT = 4000
const MAX_RETRIES = 5
const BASE_WAIT_MS = 1500
const TIMEOUT_MS = 20000

const RETRYABLE_MESSAGES = [
  'fetch failed',
  'timeout',
  'econnreset',
  'enotfound',
  'network',
  'und_err'
]

// ─────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────

function sanitizePrompt(text = '') {
  return String(text).replace(/\s+/g, ' ').trim()
}

function truncatePrompt(prompt) {
  if (!prompt) return ''
  return prompt.length <= MAX_PROMPT
    ? prompt
    : `${prompt.slice(0, MAX_PROMPT - 100)}… (tronqué)`
}

function wait(ms) {
  return new Promise(res => setTimeout(res, ms))
}

function isRetryable(err) {
  const msg = String(err?.message || '').toLowerCase()
  return RETRYABLE_MESSAGES.some(k => msg.includes(k))
}

// ─────────────────────────────────────────────
// Appel Gemini avec AbortController + retry
// ─────────────────────────────────────────────

async function callGemini(model, prompt) {
  let lastError

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const result = await model.generateContent(prompt, {
        signal: controller.signal
      })

      clearTimeout(timeout)

      const text =
        typeof result?.response?.text === 'function'
          ? result.response.text().trim()
          : null

      if (!text) throw new Error('Réponse Gemini vide')
      return text

    } catch (err) {
      clearTimeout(timeout)
      lastError = err

      if (attempt >= MAX_RETRIES || !isRetryable(err)) break

      const backoff = Math.min(
        12000,
        BASE_WAIT_MS * Math.pow(2, attempt)
      )
      const jitter = Math.floor(Math.random() * 500)
      await wait(backoff + jitter)
    }
  }

  throw lastError || new Error('Erreur inconnue Gemini')
}

// ─────────────────────────────────────────────
// Commande principale
// ─────────────────────────────────────────────

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

  if (!process.env.GEMINI_API_KEY) {
    return sock.sendMessage(
      from,
      { text: '⚠️ GEMINI_API_KEY manquante dans le fichier .env' },
      { quoted: msg }
    )
  }

  await sock.sendMessage(
    from,
    { text: '🧠 Gemini réfléchit...' },
    { quoted: msg }
  )

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: MODEL_ID })

    const prompt = truncatePrompt(promptRaw)
    const reply = await callGemini(model, prompt)

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
    console.error('❌ Erreur Gemini :', err)

    let message = '❗ Erreur inconnue Gemini.'

    const reason = String(err?.message || '').toLowerCase()

    if (reason.includes('api key')) message = '⚠️ Clé API invalide.'
    else if (reason.includes('quota')) message = '⚠️ Quota dépassé.'
    else if (reason.includes('timeout')) message = '⌛ Gemini met trop de temps à répondre.'
    else if (reason.includes('fetch failed')) message = '🌐 Problème réseau vers Gemini.'
    else if (reason.includes('503')) message = '⚠️ Service Gemini indisponible.'

    try {
      await sock.sendMessage(from, { text: message }, { quoted: msg })
    } catch { }
  }
}
