// commands/listadmins.js - Owner only
import { ownerOnly, getAdmins, getOwners } from '../utils/permissions.js'

export default ownerOnly(async function (sock, msg) {
  const from = msg.key.remoteJid

  const admins = getAdmins()
  const owner = '237674151474' // Primary owner number

  let text = '👑 *Liste des admins du bot*\n\n'
  text += `🔰 Owner : @${owner}\n\n`

  if (admins.length === 0) {
    text += '📋 Aucun admin (seulement le owner).'
  } else {
    text += `📋 Admins (${admins.length}) :\n`
    admins.forEach((admin, i) => {
      text += `${i + 1}. @${admin.split('@')[0]}\n`
    })
  }

  text += '\n💡 Utilise `.setadmin @user` pour promouvoir un admin.'

  const mentions = [`${owner}@s.whatsapp.net`, ...admins]

  await sock.sendMessage(from, {
    text,
    mentions
  }, { quoted: msg })
})
