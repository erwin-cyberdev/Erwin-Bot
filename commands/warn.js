// commands/warn.js - Admin only
import { adminRequired } from '../utils/permissions.js'
import { addWarn, getWarns } from '../utils/groupSettings.js'

export default adminRequired(async function (sock, msg, args) {
  const from = msg.key.remoteJid

  // Vérifier que c'est un groupe
  if (!from.endsWith('@g.us')) {
    return await sock.sendMessage(from, {
      text: '❗ Cette commande fonctionne uniquement dans un groupe.'
    }, { quoted: msg })
  }

  // Récupérer la cible
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
  const target = mentioned[0]

  if (!target) {
    return await sock.sendMessage(from, {
      text: '❗ Usage : `.warn @user [raison]`\n\n💡 Après 3 avertissements, l\'utilisateur sera expulsé automatiquement.'
    }, { quoted: msg })
  }

  // Raison optionnelle
  const reason = args.slice(1).join(' ').trim() || 'Aucune raison spécifiée'

  // Ajouter le warn
  const warnCount = addWarn(from, target)

  let text = `⚠️ *Avertissement*\n\n`
  text += `👤 Utilisateur : @${target.split('@')[0]}\n`
  text += `📋 Raison : ${reason}\n`
  text += `🔢 Warns : ${warnCount}/3\n\n`

  // Si 3 warns, expulser
  if (warnCount >= 3) {
    try {
      await sock.groupParticipantsUpdate(from, [target], 'remove')
      text += `🚫 L'utilisateur a été expulsé du groupe après 3 avertissements.`
    } catch (e) {
      console.error('Erreur expulsion après 3 warns:', e)
      text += `⚠️ Impossible d'expulser l'utilisateur (permissions insuffisantes).`
    }
  } else {
    text += `💡 Encore ${3 - warnCount} warn(s) avant expulsion.`
  }

  await sock.sendMessage(from, {
    text,
    mentions: [target]
  }, { quoted: msg })
})
