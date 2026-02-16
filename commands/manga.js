import axios from 'axios'

export default async function (sock, msg, args) {
  const from = msg.key.remoteJid
  const q = args.join(' ')
  if (!q) return sock.sendMessage(from, { text: '❗ Usage: .manga <nom>' })

  try {
    const res = await axios.get(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(q)}&limit=1`, { timeout: 9000 })
    const d = res.data.data[0]
    if (!d) return sock.sendMessage(from, { text: '❗ Manga introuvable.' })

    const synopsis = d.synopsis || 'Aucun synopsis disponible.'
    const txt = `📚 ${d.title}\n🗓️ ${d.published?.prop?.from?.year || 'N/A'}\n⭐ ${d.score || 'N/A'}\n📖 ${synopsis}`
    await sock.sendMessage(from, { text: txt })
  } catch (e) {
    console.error(e)
    await sock.sendMessage(from, { text: '❗ Erreur manga.' })
  }
}
