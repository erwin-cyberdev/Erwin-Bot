// commands/antilink.js - Admin only
import { isAdmin } from '../utils/permissions.js'
import { toggleGroupSetting, getGroupSettings } from '../utils/groupSettings.js'

const LINK_REGEX = /(https?:\/\/|www\.)\S+/i
const activeListeners = new WeakSet()

function ensureListener(sock) {
  if (activeListeners.has(sock)) return
  activeListeners.add(sock)

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' || !messages?.length) return

    for (const message of messages) {
      if (!message?.key?.remoteJid?.endsWith('@g.us')) continue

      const chatId = message.key.remoteJid
      const settings = getGroupSettings(chatId)
      if (!settings?.antilink) continue

      const text = message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        message.message?.imageMessage?.caption ||
        message.message?.videoMessage?.caption || ''

      if (!text || !LINK_REGEX.test(text)) continue

      try {
        await sock.sendMessage(chatId, {
          delete: {
            id: message.key.id,
            fromMe: false,
            participant: message.key.participant,
            remoteJid: chatId
          }
        })

        await sock.sendMessage(chatId, {
          text: '⚠️ Lien détecté et supprimé automatiquement.'
        })
      } catch (err) {
        console.error('Antilink delete error:', err)
      }
    }
  })
}

export default async function (sock, msg, args) {
  const from = msg.key.remoteJid
  const sender = msg.key.participant || msg.key.remoteJid

  // Vérifier que c'est un groupe
  if (!from.endsWith('@g.us')) {
    return await sock.sendMessage(from, {
      text: '❗ Cette commande fonctionne uniquement dans un groupe.'
    }, { quoted: msg })
  }

  // Vérifier que c'est un admin du bot
  if (!isAdmin(sender)) {
    return await sock.sendMessage(from, {
      text: '⛔ Cette commande est réservée aux admins du bot.\n\n💡 Le owner peut te promouvoir avec `.setadmin`'
    }, { quoted: msg })
  }

  // Toggle le paramètre
  const newValue = toggleGroupSetting(from, 'antilink')
  ensureListener(sock)

  if (newValue) {
    await sock.sendMessage(from, {
      text: '🔗 *Antilink activé* ✅\n\nLes liens envoyés par les membres (non-admins du groupe) seront automatiquement supprimés.'
    }, { quoted: msg })
  } else {
    await sock.sendMessage(from, {
      text: '🔗 *Antilink désactivé* ❌\n\nLes liens sont maintenant autorisés.'
    }, { quoted: msg })
  }
}
