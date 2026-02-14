/**
 * commands/tiktok.js
 * Download TikTok videos without watermark
 */
import axios from 'axios'

const API_ENDPOINTS = [
    'https://tikwm.com/api/',
    'https://www.tikwm.com/api/',
]

async function downloadTikTok(url) {
    for (const endpoint of API_ENDPOINTS) {
        try {
            const response = await axios.post(endpoint, {
                url: url,
                hd: 1
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout: 30000
            })

            if (response.data?.code === 0 && response.data?.data) {
                const data = response.data.data
                return {
                    video: data.hdplay || data.play,
                    title: data.title || 'TikTok Video',
                    author: data.author?.unique_id || 'Unknown',
                    music: data.music || 'N/A'
                }
            }
        } catch (err) {
            console.warn(`Endpoint ${endpoint} failed:`, err.message)
            continue
        }
    }

    throw new Error('Impossible de télécharger cette vidéo TikTok')
}

export default async function tiktokCommand(sock, msg, args) {
    const from = msg.key.remoteJid
    const url = args.join(' ').trim()

    if (!url || !url.includes('tiktok.com')) {
        return sock.sendMessage(from, {
            text: `📱 *TikTok Downloader*

❌ Usage :
\`.tiktok <url>\`

📝 Exemples :
• \`.tiktok https://vm.tiktok.com/xxx\`
• \`.tiktok https://www.tiktok.com/@user/video/xxx\`

💡 Télécharge sans watermark !`
        }, { quoted: msg })
    }

    await sock.sendMessage(from, {
        text: '⏳ Téléchargement TikTok en cours...'
    }, { quoted: msg })

    try {
        const result = await downloadTikTok(url)

        await sock.sendMessage(from, {
            video: { url: result.video },
            caption: `📱 *TikTok Video*

🎬 ${result.title}

👤 @${result.author}
🎵 ${result.music}

━━━━━━━━━━━━━━━
✨ Sans watermark`
        }, { quoted: msg })

    } catch (err) {
        console.error('❌ Erreur .tiktok:', err)

        let message = '❗ Impossible de télécharger cette vidéo.'
        if (err.message.includes('timeout')) message = '⌛ Délai dépassé. Réessaie.'
        if (err.message.includes('network')) message = '🌐 Problème de connexion.'

        await sock.sendMessage(from, {
            text: `${message}

💡 Vérifie que :
• Le lien est correct
• La vidéo est publique
• Le lien n'est pas expiré`
        }, { quoted: msg })
    }
}
