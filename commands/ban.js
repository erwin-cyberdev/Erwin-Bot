// commands/ban.js - Owner only
import { ownerOnly, isOwner, banUser } from '../utils/permissions.js'

export default ownerOnly(async function (sock, msg, args) {
  const from = msg.key.remoteJid
  const sender = msg.key.participant || msg.key.remoteJid

  // Récupérer la cible (mention ou numéro)
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
  let target = mentioned[0]

  if (!target && args[0]) {
    let num = args[0].replace(/[^0-9]/g, '')
    if (num.length < 10) num = '237' + num
    target = `${num}@s.whatsapp.net`
  }

  if (!target) {
    return await sock.sendMessage(from, {
      text: '❗ Usage : `.ban @user` ou `.ban 674151474`'
    }, { quoted: msg })
  }

  // Vérifier qu'on ne bannit pas un owner
  if (isOwner(target)) {
    return await sock.sendMessage(from, {
      text: '⚠️ Impossible de bannir un propriétaire du bot.'
    }, { quoted: msg })
  }

  // Bannir
  const success = banUser(target, sender)
  if (success) {
    await sock.sendMessage(from, {
      text: `🚫 @${target.split('@')[0]} a été banni du bot.\nIl ne pourra plus utiliser aucune commande.`,
      mentions: [target]
    }, { quoted: msg })
  } else {
    await sock.sendMessage(from, {
      text: '⚠️ Cet utilisateur est déjà banni.'
    }, { quoted: msg })
  }
})
