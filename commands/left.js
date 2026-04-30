// commands/left.js - Owner only
import { ownerOnly } from '../utils/permissions.js'

export default ownerOnly(async function (sock, msg) {
  const from = msg.key.remoteJid

  if (!from?.endsWith('@g.us')) {
    return sock.sendMessage(from, { text: '❌ Cette commande ne peut être utilisée que dans un groupe.' }, { quoted: msg })
  }

  try {
    await sock.sendMessage(from, { text: '👋 bye bye...' }, { quoted: msg })
    await sock.groupLeave(from)
  } catch (e) {
    console.log('Erreur .left:', e)
    return sock.sendMessage(from, { text: '❌ Impossible de quitter le groupe.' }, { quoted: msg })
  }
})
