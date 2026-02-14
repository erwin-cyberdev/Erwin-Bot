import { sendWithTyping } from '../utils/sendWithTyping.js'
import { buildDisclaimer } from '../utils/i18n.js'
import { getLanguagePreference } from '../utils/messageHelpers.js'

export default async function disclaimerCommand(sock, msg) {
  const from = msg.key.remoteJid
  const languagePreference = getLanguagePreference(from)
  const disclaimerText = buildDisclaimer(languagePreference)

  if (typeof sendWithTyping === 'function') {
    await sendWithTyping(sock, from, { text: disclaimerText }, { quoted: msg })
    return
  }

  await sock.sendMessage(from, { text: disclaimerText }, { quoted: msg })
}
