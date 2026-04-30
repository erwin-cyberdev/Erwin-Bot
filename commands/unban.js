// commands/unban.js - Owner only
import { ownerOnly, unbanUser } from '../utils/permissions.js'

export default ownerOnly(async function (sock, msg, args) {
  const from = msg.key.remoteJid
  const sender = msg.key.participant || msg.key.remoteJid

  // Récupérer la cible
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
  let target = mentioned[0]

  if (!target && args[0]) {
    let num = args[0].replace(/[^0-9]/g, '')
    if (num.length < 10) num = '237' + num
    target = `${num}@s.whatsapp.net`
  }

  if (!target) {
    return await sock.sendMessage(from, {
      text: '❗ Usage : `.unban @user` ou `.unban 674151474`'
    }, { quoted: msg })
  }

  // Débannir
  const success = unbanUser(target, sender)
  if (success) {
    await sock.sendMessage(from, {
      text: `✅ @${target.split('@')[0]} a été débanni.\nIl peut maintenant utiliser le bot.`,
      mentions: [target]
    }, { quoted: msg })
  } else {
    await sock.sendMessage(from, {
      text: '⚠️ Cet utilisateur n\'est pas banni.'
    }, { quoted: msg })
  }
})
