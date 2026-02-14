/**
 * commands/insta.js
 * Download Instagram posts, reels, and stories
 */
import axios from 'axios'

const API_ENDPOINTS = [
    'https://api.instagram-scraper.com/download',
    'https://insta-scraper.vercel.app/api/download'
]

async function downloadInstagram(url) {
    // Try primary API
    try {
        const response = await axios.get(`https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`, {
            timeout: 15000
        })

        if (response.data?.thumbnail_url) {
            return {
                type: 'image',
                url: response.data.thumbnail_url.replace('_u', '_n'), // Get higher quality
                title: response.data.title || 'Instagram Post',
                author: response.data.author_name || 'Unknown'
            }
        }
    } catch (err) {
        console.warn('OEmbed API failed, trying alternative...')
    }

    // Fallback: use scraper API
    for (const endpoint of API_ENDPOINTS) {
        try {
            const response = await axios.post(endpoint, {
                url: url
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout: 25000
            })

            if (response.data?.url || response.data?.video_url || response.data?.image_url) {
                return {
                    type: response.data.video_url ? 'video' : 'image',
                    url: response.data.url || response.data.video_url || response.data.image_url,
                    title: response.data.title || 'Instagram Media',
                    author: response.data.username || 'Unknown'
                }
            }
        } catch (err) {
            console.warn(`Endpoint ${endpoint} failed:`, err.message)
            continue
        }
    }

    throw new Error('Impossible de télécharger ce contenu Instagram')
}

export default async function instaCommand(sock, msg, args) {
    const from = msg.key.remoteJid
    const url = args.join(' ').trim()

    if (!url || !url.includes('instagram.com')) {
        return sock.sendMessage(from, {
            text: `📸 *Instagram Downloader*

❌ Usage :
\`.insta <url>\`

📝 Exemples :
• \`.insta https://www.instagram.com/p/xxx\`
• \`.insta https://www.instagram.com/reel/xxx\`

💡 Fonctionne avec :
• Posts (images/vidéos)
• Reels
• IGTV

⚠️ Les stories nécessitent un lien direct`
        }, { quoted: msg })
    }

    await sock.sendMessage(from, {
        text: '⏳ Téléchargement Instagram en cours...'
    }, { quoted: msg })

    try {
        const result = await downloadInstagram(url)

        const caption = `📸 *Instagram ${result.type === 'video' ? 'Reel/Video' : 'Post'}*

📝 ${result.title}
👤 @${result.author}

━━━━━━━━━━━━━━━
✨ Téléchargé via Erwin-Bot`

        if (result.type === 'video') {
            await sock.sendMessage(from, {
                video: { url: result.url },
                caption
            }, { quoted: msg })
        } else {
            await sock.sendMessage(from, {
                image: { url: result.url },
                caption
            }, { quoted: msg })
        }

    } catch (err) {
        console.error('❌ Erreur .insta:', err)

        let message = '❗ Impossible de télécharger ce contenu.'
        if (err.message.includes('timeout')) message = '⌛ Délai dépassé. Réessaie.'
        if (err.message.includes('network')) message = '🌐 Problème de connexion.'

        await sock.sendMessage(from, {
            text: `${message}

💡 Vérifie que :
• Le lien est correct
• Le compte est public
• Le post n'a pas été supprimé

⚠️ Les comptes privés ne sont pas supportés`
        }, { quoted: msg })
    }
}
