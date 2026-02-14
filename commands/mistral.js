import fetch from 'node-fetch'

const API_URL = 'https://api.mistral.ai/v1/chat/completions'
const MAX_REPLY_LENGTH = 6500
const TIMEOUT_MS = 20000

const MODEL_INFO = {
  'mistral-small-latest': {
    label: 'Mistral Small',
    aliases: new Set(['small', 'mistral-small', 'mistral-small-latest'])
  },
  'mixtral-8x7b-instruct': {
    label: 'Mixtral 8x7B',
    aliases: new Set(['mixtral', 'mixtral-8x7b', 'mixtral-8x7b-instruct'])
  }
}

const DEFAULT_MODEL = 'mistral-small-latest'

function resolveModelAndPrompt(args = []) {
  if (!Array.isArray(args)) return { error: 'missing_args' }

  const trimmedArgs = args.map(arg => String(arg || '').trim()).filter(Boolean)
  if (!trimmedArgs.length) return { error: 'missing_prompt' }

  const potentialAlias = trimmedArgs[0].toLowerCase()
  const matchedEntry = Object.entries(MODEL_INFO).find(([, info]) => info.aliases.has(potentialAlias))

  if (matchedEntry) {
    const [model, info] = matchedEntry
    const promptParts = trimmedArgs.slice(1)
    if (!promptParts.length) return { error: 'missing_prompt' }
    return { model, label: info.label, prompt: promptParts.join(' ') }
  }

  const info = MODEL_INFO[DEFAULT_MODEL]
  return { model: DEFAULT_MODEL, label: info.label, prompt: trimmedArgs.join(' ') }
}

async function callMistral(model, prompt, apiKey) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        top_p: 0.9,
        max_tokens: 1024
      }),
      signal: controller.signal
    })

    const json = await response.json().catch(() => null)

    if (!response.ok) {
      const reason = json?.error?.message || `${response.status} ${response.statusText || 'Erreur API Mistral'}`
      throw new Error(reason)
    }

    const text = json?.choices?.[0]?.message?.content?.trim()
    if (!text) throw new Error('Réponse vide de Mistral')

    return text
  } catch (err) {
    if (err.name === 'AbortError' || err.type === 'aborted') {
      throw new Error('Timeout Mistral atteint')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

export default async function mistralCommand(sock, msg, args) {
  const from = msg.key.remoteJid
  const { error, model, label, prompt } = resolveModelAndPrompt(args)

  if (error === 'missing_prompt') {
    return sock.sendMessage(from, {
      text: `💡 Utilisation : 
.mistral <texte…>
.mistral mixtral <texte…>

Modèles disponibles : mixtral-8x7b | mistral-small`
    }, { quoted: msg })
  }

  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) {
    return sock.sendMessage(from, {
      text: '⚠️ Clé `MISTRAL_API_KEY` manquante. Ajoute-la dans ton `.env`.'
    }, { quoted: msg })
  }

  await sock.sendMessage(from, { text: `🧠 ${label} réfléchit...` }, { quoted: msg })

  try {
    const reply = await callMistral(model, prompt, apiKey)
    const safeReply = reply.length > MAX_REPLY_LENGTH
      ? `${reply.slice(0, MAX_REPLY_LENGTH - 200)}\n\n(↘️ tronqué)`
      : reply

    await sock.sendMessage(from, {
      text: `✨ *Réponse de ${label} :*\n\n${safeReply}`
    }, { quoted: msg })
  } catch (err) {
    const lower = String(err?.message || '').toLowerCase()
    let message

    if (lower.includes('timeout')) message = '⌛ Le service Mistral a mis trop de temps à répondre. Réessaie plus tard.'
    else if (lower.includes('invalid') || lower.includes('clé')) message = '⚠️ Clé API Mistral invalide ou permissions insuffisantes.'
    else if (lower.includes('rate') || lower.includes('429')) message = '⚠️ Trop de requêtes vers Mistral. Fais une pause avant de réessayer.'
    else message = `❗ Erreur Mistral : ${String(err?.message || 'inconnue').slice(0, 200)}`

    try {
      await sock.sendMessage(from, { text: message }, { quoted: msg })
    } catch {}
  }
}
