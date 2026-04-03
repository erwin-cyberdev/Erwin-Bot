// commands/render.js - Commande de gestion Render
import { getServiceStatus, restartService, getRecentDeploys } from '../utils/render.js'
import { isOwner } from '../utils/permissions.js'
import chalk from 'chalk'

export default async function (sock, msg, args) {
  const from = msg.key.remoteJid
  const sender = msg.key.participant || msg.key.remoteJid
  const prefix = '-' // On pourrait le récupérer dynamiquement via getPrefix() si dispo

  // Vérification des permissions (Seul l'owner peut gérer Render)
  if (!isOwner(sender)) {
    return sock.sendMessage(from, { text: '🚫 Cette commande est réservée à l\'owner du bot.' }, { quoted: msg })
  }

  const subCommand = args[0]?.toLowerCase()

  try {
    switch (subCommand) {
      case 'status':
      case 'info': {
        await sock.sendMessage(from, { text: '⏳ Récupération des infos Render...' }, { quoted: msg })
        const service = await getServiceStatus()
        
        let statusEmoji = '🟢'
        if (service.status !== 'live') statusEmoji = '🟡'
        if (service.suspended === 'suspended') statusEmoji = '🔴'

        const text = `📊 *ETAT RENDER - ERWIN-BOT*\n\n` +
          `• *Nom:* ${service.name}\n` +
          `• *Statut:* ${statusEmoji} ${service.status.toUpperCase()}\n` +
          `• *Suspendu:* ${service.suspended === 'suspended' ? 'OUI ⚠️' : 'NON'}\n` +
          `• *Type:* ${service.type}\n` +
          `• *Région:* ${service.region}\n` +
          `• *Dernière MAJ:* ${new Date(service.updatedAt).toLocaleString('fr-FR')}\n\n` +
          `🔗 *URL:* ${service.serviceDetails.url || 'N/A'}`

        await sock.sendMessage(from, { text }, { quoted: msg })
        break
      }

      case 'restart':
      case 'deploy': {
        await sock.sendMessage(from, { text: '⚙️ Déclenchement d\'un nouveau déploiement Render...' }, { quoted: msg })
        const deploy = await restartService()
        
        const text = `🚀 *RESTART LANCÉ*\n\n` +
          `• *ID:* ${deploy.id}\n` +
          `• *Statut:* ${deploy.status.toUpperCase()}\n\n` +
          `Le bot va redémarrer dans quelques instants. Connexion en cours...`

        await sock.sendMessage(from, { text }, { quoted: msg })
        console.log(chalk.yellow(`[RENDER] Restart déclenché par ${sender}`))
        break
      }

      case 'deploys':
      case 'history': {
        const history = await getRecentDeploys(5)
        let text = `📜 *DERNIERS DÉPLOIEMENTS*\n\n`
        
        history.forEach((d, i) => {
          const date = new Date(d.createdAt).toLocaleString('fr-FR')
          const emoji = d.status === 'live' ? '✅' : (d.status === 'in_progress' ? '⏳' : '❌')
          text += `${i+1}. [${emoji}] ${d.status.toUpperCase()}\n   📅 ${date}\n`
        })

        await sock.sendMessage(from, { text }, { quoted: msg })
        break
      }

      default:
        const helpText = `🛠️ *GESTION RENDER*\n\n` +
          `Usage: \`${prefix}render [commande]\`\n\n` +
          `• \`status\`: Voir l'état du service\n` +
          `• \`restart\`: Forcer un redémarrage\n` +
          `• \`deploys\`: Historique des déploiements`
        
        await sock.sendMessage(from, { text: helpText }, { quoted: msg })
        break
    }
  } catch (err) {
    console.error('Erreur commande render:', err)
    const errorMsg = err.response?.data?.message || err.message
    await sock.sendMessage(from, { text: `❌ *ERREUR RENDER API*\n\n${errorMsg}` }, { quoted: msg })
  }
}
