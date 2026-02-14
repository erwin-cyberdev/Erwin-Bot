// utils/messageQueue.js

const TYPING = {
  minDelay: 900,
  maxDelay: 1800,
  perChar: 25,
  maxExtra: 2000
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function randomBetween(min, max) {
  return Math.floor(min + Math.random() * (max - min))
}

function extractTextLength(content) {
  if (!content) return 0
  if (typeof content === 'string') return content.length
  if (typeof content.text === 'string') return content.text.length
  if (typeof content.caption === 'string') return content.caption.length
  return 0
}

function computeTypingDelay(content) {
  const base = randomBetween(TYPING.minDelay, TYPING.maxDelay)
  const extra = Math.min(TYPING.maxExtra, extractTextLength(content) * TYPING.perChar)
  return base + extra
}

async function sendWithTyping(sock, jid, content, options = {}) {
  const directSend = typeof sock.__originalSendMessage === 'function'
    ? sock.__originalSendMessage
    : (typeof sock.sendMessage === 'function' ? sock.sendMessage.bind(sock) : null)

  if (!directSend) {
    throw new Error('Aucune fonction sendMessage disponible sur le socket.')
  }

  try { if (typeof sock.presenceSubscribe === 'function') await sock.presenceSubscribe(jid) } catch {}

  const delay = computeTypingDelay(content)

  try { if (typeof sock.sendPresenceUpdate === 'function') await sock.sendPresenceUpdate('composing', jid) } catch {}
  await sleep(delay)

  try { if (typeof sock.sendPresenceUpdate === 'function') await sock.sendPresenceUpdate('paused', jid) } catch {}

  const result = await directSend(jid, content, options)

  try { if (typeof sock.sendPresenceUpdate === 'function') await sock.sendPresenceUpdate('available', jid) } catch {}

  return result
}

export function enqueueMessage(sock, jid, content, options = {}) {
  return sendWithTyping(sock, jid, content, options)
}

export async function sendText(sock, jid, text, options = {}) {
  return sendWithTyping(sock, jid, { text }, options)
}

export async function sendImage(sock, jid, image, caption = '', options = {}) {
  return sendWithTyping(sock, jid, { image, caption }, options)
}

export async function sendAudio(sock, jid, audio, options = {}) {
  const content = { audio, mimetype: options.mimetype || 'audio/ogg; codecs=opus' }
  return sendWithTyping(sock, jid, content, options)
}

export async function sendVideo(sock, jid, video, caption = '', options = {}) {
  return sendWithTyping(sock, jid, { video, caption }, options)
}

export function getStats() {
  return {
    sent: 0,
    queued: 0,
    rejected: 0,
    queueSize: 0,
    isProcessing: false,
    hourlyRate: 0,
    dailyRate: 0
  }
}

export function resetStats() {}

export function clearQueue() {
  return 0
}

export function setConfig() {}

export function attachSendWrapper(sock) {
  if (!sock || typeof sock.sendMessage !== 'function') return sock

  if (!sock.__originalSendMessage) {
    sock.__originalSendMessage = sock.sendMessage.bind(sock)
  }

  sock.sendMessage = (jid, content, options = {}) => sendWithTyping(sock, jid, content, options)

  return sock
}
