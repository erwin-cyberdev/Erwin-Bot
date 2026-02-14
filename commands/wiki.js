import axios from 'axios'

export default async function (sock, msg, args = []) {
  const from = msg.key.remoteJid
  if (!args.length) {
    return sock.sendMessage(from, { text: '❗ Usage : `.wiki <recherche>`.' }, { quoted: msg })
  }

  const raw = args.join(' ').trim()
  if (!raw) {
    return sock.sendMessage(from, { text: '❗ Fournis un terme à rechercher.' }, { quoted: msg })
  }

  let lang = 'fr'
  let query = raw
  const langMatch = raw.match(/^([a-z]{2,3})\s*:\s*(.+)$/i)
  if (langMatch) {
    lang = langMatch[1].toLowerCase()
    query = langMatch[2].trim()
  }

  const endpoint = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`

  try {
    const { data } = await axios.get(endpoint, { timeout: 8000 })
    if (!data || data.type === 'http') {
      return sock.sendMessage(from, { text: '❌ Aucun résultat trouvé.' }, { quoted: msg })
    }

    if (data.type === 'disambiguation') {
      return sock.sendMessage(from, { text: 'ℹ️ Résultat ambigu, précise ta recherche.' }, { quoted: msg })
    }

    const title = data.title || query
    const description = data.description ? `_${data.description}_\n` : ''
    const extract = data.extract || 'Pas de résumé disponible.'
    const url = data.content_urls?.desktop?.page || data.content_urls?.mobile?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`

    const response = `📚 *${title}*
${description}${extract}

🔗 ${url}`

    return sock.sendMessage(from, { text: response.trim() }, { quoted: msg })
  } catch (err) {
    console.error('Erreur .wiki:', err)
    return sock.sendMessage(from, { text: '❌ Impossible de contacter Wikipédia.' }, { quoted: msg })
  }
}
