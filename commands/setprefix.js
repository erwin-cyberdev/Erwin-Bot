import { setPrefix, getPrefix, resetPrefix } from '../utils/prefixManager.js'
import { isOwner } from '../utils/permissions.js'

export default async function setprefixCommand(sock, msg, args) {
  const from = msg.key.remoteJid
  
  // Vérifier si l'utilisateur est propriétaire
  if (!isOwner(msg.key.participant || msg.key.remoteJid)) {
    return await sock.sendMessage(from, { 
      text: '❌ Seul le propriétaire du bot peut modifier le préfixe.'
    })
  }

  // Si aucun argument n'est fourni, afficher l'aide
  if (args.length === 0) {
    const currentPrefix = getPrefix()
    return await sock.sendMessage(from, {
      text: `*Utilisation :* \n` +
            `• *${currentPrefix}setprefix [nouveau_préfixe]* - Modifier le préfixe\n` +
            `• *${currentPrefix}setprefix reset* - Réinitialiser le préfixe par défaut (!)\n\n` +
            `Préfixe actuel : *${currentPrefix}*`
    })
  }

  // Gérer la réinitialisation du préfixe
  if (args[0].toLowerCase() === 'reset') {
    const result = resetPrefix()
    return await sock.sendMessage(from, {
      text: result.message + ' ✅'
    })
  }

  // Vérifier que le préfixe est valide (1-3 caractères)
  const newPrefix = args[0]
  if (newPrefix.length > 3) {
    return await sock.sendMessage(from, {
      text: '❌ Le préfixe ne peut pas dépasser 3 caractères.'
    })
  }

  // Mettre à jour le préfixe
  const result = setPrefix(newPrefix)
  if (result.success) {
    return await sock.sendMessage(from, {
      text: result.message + ' ✅\n' +
            `Exemple d'utilisation : *${newPrefix}ping*`
    })
  } else {
    return await sock.sendMessage(from, {
      text: `❌ ${result.message}`
    })
  }
}

// Ajout des métadonnées pour le menu d'aide
export const commandInfo = {
  name: 'setprefix',
  description: {
    fr: 'Modifier le préfixe des commandes du bot',
    en: 'Change the bot command prefix'
  },
  usage: {
    fr: 'setprefix [préfixe|reset]',
    en: 'setprefix [prefix|reset]'
  },
  category: 'owner',
  aliases: ['prefix', 'changeprefix'],
  cooldown: 5
}
