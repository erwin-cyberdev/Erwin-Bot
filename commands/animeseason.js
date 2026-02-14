// commands/animeseason.js - Animes de la saison actuelle
import axios from 'axios'

export default async function (sock, msg, args) {
  const from = msg.key.remoteJid

  try {
    await sock.sendMessage(from, {
      text: '📺 Recherche des animes de la saison...'
    }, { quoted: msg })

    // Jikan API - animes de la saison
    const response = await axios.get('https://api.jikan.moe/v4/seasons/now', {
      timeout: 15000,
      params: {
        limit: 10,
        filter: 'tv'
      }
    })

    if (!response.data || !response.data.data || response.data.data.length === 0) {
      throw new Error('Aucun anime trouvé pour cette saison')
    }

    const animes = response.data.data.slice(0, 10)
    
    let text = `╭──────────────────────╮
                │ 📺 *SAISON ACTUELLE* │
                ╰──────────────────────╯

🗓️ *Top 10 animes en cours:*\n\n`

    animes.forEach((anime, index) => {
      const title = anime.title || anime.title_english || 'Sans titre'
      const score = anime.score ? `⭐ ${anime.score}` : '⭐ N/A'
      const episodes = anime.episodes ? `📺 ${anime.episodes} ep` : '📺 En cours'
      const type = anime.type || 'TV'
      
      text += `${index + 1}. *${title}*\n`
      text += `   ${score} | ${episodes} | ${type}\n`
      text += `   ${anime.genres?.slice(0, 3).map(g => g.name).join(', ') || 'Genres N/A'}\n\n`
    })

    text += `━━━━━━━━━━━━━━━━━━━━
📊 Source: MyAnimeList
🔄 Mis à jour régulièrement

💡 Tape .anime <nom> pour plus d'infos!`

    await sock.sendMessage(from, {
      text: text
    }, { quoted: msg })

  } catch (err) {
    console.error('Erreur .animeseason:', err)
    
    await sock.sendMessage(from, {
      text: `❌ *Impossible de récupérer les animes de la saison*

Raisons possibles:
• API temporairement indisponible
• Limite de requêtes atteinte
• Problème de connexion

💡 Réessaie dans quelques instants

Erreur: ${err.message || 'Inconnue'}`
    }, { quoted: msg })
  }
}
