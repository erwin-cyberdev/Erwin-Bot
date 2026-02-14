import { getGroupSettings } from './groupSettings.js'
import { getUserSettings } from './userSettings.js'
import { getErrorMessage } from './i18n.js'
import { sendText } from './messageQueue.js'

const SUPPORTED_LANGS = new Set(['fr', 'en'])
const DEFAULT_LANGUAGE = 'fr'

export function getLanguagePreference(jid) {
  if (!jid) return DEFAULT_LANGUAGE
  if (jid.endsWith('@g.us')) {
    const settings = getGroupSettings(jid)
    const lang = settings?.language
    return SUPPORTED_LANGS.has(lang) ? lang : DEFAULT_LANGUAGE
  }

  const settings = getUserSettings(jid)
  const lang = settings?.language
  return SUPPORTED_LANGS.has(lang) ? lang : DEFAULT_LANGUAGE
}

export async function sendLocalizedError(sock, jid, key, replacements = {}, options = {}) {
  if (!sock || !jid) return null
  const langPreference = getLanguagePreference(jid)
  const text = getErrorMessage(key, langPreference, replacements)
  if (!text) return null
  return sendText(sock, jid, text, options)
}
