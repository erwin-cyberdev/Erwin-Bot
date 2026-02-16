import fs from 'fs'
import path from 'path'
import { isOwner } from '../utils/permissions.js'

export default async function sessionCommand(sock, msg) {
    const from = msg.key.remoteJid
    const sender = msg.key.participant || msg.key.remoteJid

    if (!isOwner(sender)) {
        return await sock.sendMessage(from, { text: '⛔ Cette commande est réservée au propriétaire.' }, { quoted: msg })
    }

    const authPath = path.join(process.cwd(), 'auth_info', 'creds.json')

    if (!fs.existsSync(authPath)) {
        return await sock.sendMessage(from, { text: '❌ Fichier de session non trouvé. Assure-toi d\'être connecté.' }, { quoted: msg })
    }

    try {
        const creds = fs.readFileSync(authPath, 'utf8')
        const base64 = Buffer.from(creds).toString('base64')

        const text = `📦 *SESSION DATA (BASE64)*
        
Ceci est votre clé de session pour Render. Copiez-la et ajoutez-la en tant que variable d'environnement \`SESSION_DATA\` sur votre tableau de bord Render.

\`\`\`
${base64}
\`\`\`

⚠️ *Note :* Ne partagez jamais ce code, il donne accès à votre compte WhatsApp.`

        await sock.sendMessage(from, { text }, { quoted: msg })

    } catch (e) {
        console.error('Erreur session command:', e)
        await sock.sendMessage(from, { text: `❌ Erreur lors de l'extraction de la session: ${e.message}` }, { quoted: msg })
    }
}
