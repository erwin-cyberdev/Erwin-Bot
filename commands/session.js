import fs from 'fs'
import path from 'path'
import { ownerOnly } from '../utils/permissions.js'

export default ownerOnly(async function sessionCommand(sock, msg) {
    const from = msg.key.remoteJid
    const credsPath = path.join(process.cwd(), 'auth_info', 'creds.json')

    if (!fs.existsSync(credsPath)) {
        return await sock.sendMessage(from, { text: '❌ Fichier creds.json non trouvé. Assure-toi d\'être connecté.' }, { quoted: msg })
    }

    const txtPath = path.join(process.cwd(), 'session_export.txt')

    try {
        const credsContent = fs.readFileSync(credsPath, 'utf-8')
        const base64 = Buffer.from(credsContent).toString('base64')

        fs.writeFileSync(txtPath, base64, 'utf-8')

        const platform = process.env.RAILWAY_PUBLIC_DOMAIN ? 'Railway' : 'Render'
        const caption = platform === 'Railway'
            ? `📦 *SESSION BACKUP (creds.json)*\n\n📏 Taille : ~${(base64.length / 1024).toFixed(1)} KB\n\n💡 Sur Railway avec Volume, ce fichier n'est nécessaire qu'en backup.\n\n⚠️ *Ne partagez jamais ce fichier !*`
            : `📦 *SESSION DATA (creds.json)*\n\n📏 Taille : ~${(base64.length / 1024).toFixed(1)} KB\n\nCollez le contenu dans la variable \`SESSION_DATA\` sur Render.\n\n⚠️ *Ne partagez jamais ce fichier !*`

        await sock.sendMessage(from, {
            document: fs.readFileSync(txtPath),
            mimetype: 'text/plain',
            fileName: 'session.txt',
            caption
        }, { quoted: msg })

    } catch (e) {
        console.error('Erreur session command:', e)
        await sock.sendMessage(from, { text: `❌ Erreur : ${e.message}` }, { quoted: msg })
    } finally {
        if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath)
    }
})
