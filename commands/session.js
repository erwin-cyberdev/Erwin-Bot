import fs from 'fs'
import path from 'path'
import { ownerOnly } from '../utils/permissions.js'
import { execSync } from 'child_process'

export default ownerOnly(async function sessionCommand(sock, msg) {
    const from = msg.key.remoteJid
    const authDir = path.join(process.cwd(), 'auth_info')

    if (!fs.existsSync(authDir)) {
        return await sock.sendMessage(from, { text: '❌ Dossier de session non trouvé. Assure-toi d\'être connecté.' }, { quoted: msg })
    }

    try {
        const tarPath = path.join(process.cwd(), 'session_export.tar.gz')
        execSync(`tar -czf ${tarPath} -C ${authDir} .`)
        const sessionBuffer = fs.readFileSync(tarPath)
        const base64 = sessionBuffer.toString('base64')
        fs.unlinkSync(tarPath) // Nettoyage

        const text = `📦 *SESSION DATA (BASE64)*
        
Ceci est votre clé de session multi-fichiers pour Render/Docker. Copiez-la et ajoutez-la en tant que variable d'environnement \`SESSION_DATA\` pour conserver votre connexion WhatsApp.

\`\`\`
${base64}
\`\`\`

⚠️ *Note :* Ne partagez jamais ce code, il donne un accès direct et complet à votre compte WhatsApp.`

        await sock.sendMessage(from, { text }, { quoted: msg })

    } catch (e) {
        console.error('Erreur session command:', e)
        await sock.sendMessage(from, { text: `❌ Erreur lors de l'extraction de la session: ${e.message}` }, { quoted: msg })
    }
})
