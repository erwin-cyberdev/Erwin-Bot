// commands/broadcast.js - Owner only
import { ownerOnly } from '../utils/permissions.js'

export default ownerOnly(async function (sock, msg, args) {
  const from = msg.key.remoteJid

  const message = args.join(' ').trim()
  if (!message) {
    return await sock.sendMessage(from, {
      text: '❗ Usage : `.broadcast <message>`\n\n💡 Envoie un message à tous les groupes où le bot est présent.'
    }, { quoted: msg })
  }

  try {
    // Récupérer tous les groupes
    const groups = await sock.groupFetchAllParticipating()
    const groupList = Object.values(groups)

    if (groupList.length === 0) {
      return await sock.sendMessage(from, {
        text: '⚠️ Le bot n\'est dans aucun groupe.'
      }, { quoted: msg })
    }

    await sock.sendMessage(from, {
      text: `📢 Envoi du broadcast à ${groupList.length} groupe(s)...`
    }, { quoted: msg })

    let success = 0
    let failed = 0

    // Envoyer le message à chaque groupe
    for (const group of groupList) {
      try {
        await sock.sendMessage(group.id, { text: message })
        success++
        // Délai pour éviter le spam
        await new Promise(res => setTimeout(res, 1000))
      } catch (e) {
        console.error(`Erreur broadcast groupe ${group.id}:`, e)
        failed++
      }
    }

    await sock.sendMessage(from, {
      text: `✅ Broadcast terminé !\n\n✔️ Envoyés : ${success}\n❌ Échoués : ${failed}`
    }, { quoted: msg })

  } catch (err) {
    console.error('Erreur broadcast:', err)
    await sock.sendMessage(from, {
      text: '❗ Erreur lors du broadcast.'
    }, { quoted: msg })
  }
})
