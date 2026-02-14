import { isAdmin } from '../utils/permissions.js'
import { getGroupSettings, updateGroupSetting } from '../utils/groupSettings.js'
import { getUserSettings, updateUserSetting } from '../utils/userSettings.js'
import { LANGUAGES } from '../utils/i18n.js'

const LANGUAGE_LABELS = {
  [LANGUAGES.fr]: { fr: 'français', en: 'French' },
  [LANGUAGES.en]: { fr: 'anglais', en: 'English' }
}

function formatLanguageLabel(lang) {
  const labels = LANGUAGE_LABELS[lang] || LANGUAGE_LABELS[LANGUAGES.fr]
  return `${labels.fr} / ${labels.en}`
}

export default async function setlangCommand(sock, msg, args) {
  const chatId = msg.key.remoteJid
  const sender = msg.key.participant || msg.key.remoteJid
  const isGroup = chatId.endsWith('@g.us')

  if (isGroup && !isAdmin(sender)) {
    return sock.sendMessage(chatId, {
      text: '⛔ Cette commande est réservée aux admins du bot.\n⛔ This command is reserved for bot admins.'
    }, { quoted: msg })
  }

  const langArg = (args[0] || '').toLowerCase().trim()
  const allowed = [LANGUAGES.fr, LANGUAGES.en]

  if (!langArg) {
    const settings = isGroup ? getGroupSettings(chatId) : getUserSettings(chatId)
    const current = settings.language || LANGUAGES.fr
    return sock.sendMessage(chatId, {
      text: `🌐 Langue actuelle : *${formatLanguageLabel(current)}*\n\nUtilisation / Usage :\n\`.setlang fr\` — Français uniquement\n\`.setlang en\` — English only`
    }, { quoted: msg })
  }

  if (!allowed.includes(langArg)) {
    return sock.sendMessage(chatId, {
      text: '❌ Valeur invalide. Choisis parmi: fr, en.\n❌ Invalid value. Choose between: fr, en.'
    }, { quoted: msg })
  }

  if (isGroup) {
    updateGroupSetting(chatId, 'language', langArg)
  } else {
    updateUserSetting(chatId, 'language', langArg)
  }

  await sock.sendMessage(chatId, {
    text: `✅ Langue mise à jour : *${formatLanguageLabel(langArg)}*\n✅ Language updated: *${formatLanguageLabel(langArg)}*`
  }, { quoted: msg })
}
