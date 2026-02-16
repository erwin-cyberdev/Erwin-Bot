import { isAdmin } from '../utils/permissions.js'

export default async function (sock, msg) {
  const from = msg.key.remoteJid
  const isGroup = from.endsWith('@g.us')
  const sender = msg.key.participant || msg.key.remoteJid

  // Vérifier si l'expéditeur est admin ou le propriétaire
  const isAuthorized = await isAdmin(sender)

  if (!isAuthorized) {
    return sock.sendMessage(from, {
      text: '❌ Désolé, seuls les administrateurs peuvent utiliser cette commande.'
    })
  }

  if (!isGroup) {
    return sock.sendMessage(from, {
      text: 'ℹ️ Cette commande est conçue pour les groupes. Dans les messages privés, seul le propriétaire peut contrôler le bot.'
    })
  }

  try {
    // Récupérer les métadonnées du groupe
    const metadata = await sock.groupMetadata(from)
    const admins = metadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin')

    // Vérifier si le bot est admin
    const botIdRaw = sock.user?.id || ''
    const botJid = botIdRaw.includes(':') ? `${botIdRaw.split(':')[0]}@s.whatsapp.net` : botIdRaw
    const isBotAdmin = admins.some(a => a.id === botJid)

    if (!isBotAdmin) {
      return sock.sendMessage(from, {
        text: '⚠️ Je dois être administrateur du groupe pour désactiver le mode muet.'
      })
    }

    // Désactiver le mode muet
    await sock.groupSettingUpdate(from, 'not_announcement')

    // Message de confirmation
    await sock.sendMessage(from, {
      text: '🔊 *Mode muet désactivé*\n\nTous les membres peuvent maintenant envoyer des messages dans ce groupe.'
    })

  } catch (err) {
    console.error('Erreur lors de la désactivation du mode muet:', err)

    let errorMessage = '❌ Une erreur est survenue lors de la désactivation du mode muet.'

    // Messages d'erreur plus détaillés
    if (err.message.includes('401')) {
      errorMessage = '❌ Je n\'ai pas les permissions nécessaires pour modifier les paramètres du groupe.'
    } else if (err.message.includes('403')) {
      errorMessage = '❌ Accès refusé. Vérifiez que je suis toujours dans le groupe.'
    } else if (err.message.includes('404')) {
      errorMessage = '❌ Groupe introuvable. Vérifiez que le groupe existe toujours.'
    }

    await sock.sendMessage(from, { text: errorMessage })
  }
}
