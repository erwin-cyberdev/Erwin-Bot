// commands/anime.js - Recherche d'anime via Jikan
import axios from 'axios'

const API_BASE = 'https://api.jikan.moe/v4'
const SYNOPSIS_CHUNK = 900
const MAX_CHUNKS = 3
const REQUEST_TIMEOUT = 15000
const RETRY_LIMIT = 3
const RETRY_DELAY = 1500 // 1.5s entre les tentatives

const client = axios.create({
  baseURL: API_BASE,
  timeout: REQUEST_TIMEOUT,
  headers: { 'User-Agent': 'ErwinBot-Anime/1.1' }
})

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function splitSynopsis(text = '') {
  if (!text?.trim()) return ['Pas de synopsis disponible.']
  const clean = text.replace(/\s+/g, ' ').trim()
  const parts = []
  for (let i = 0; i < clean.length && parts.length < MAX_CHUNKS; i += SYNOPSIS_CHUNK) {
    const chunk = clean.slice(i, i + SYNOPSIS_CHUNK).trim()
    if (chunk) parts.push(chunk)
  }
  return parts.length ? parts : ['Pas de synopsis disponible.']
}

async function fetchWithRetry(url, params = {}) {
  for (let attempt = 1; attempt <= RETRY_LIMIT; attempt++) {
    try {
      const res = await client.get(url, { params })
      if (res?.data?.data) return res.data.data
    } catch (err) {
      const status = err?.response?.status
      if (status === 429 || status === 503) {
        console.warn(`Tentative ${attempt} échouée (${status}). Nouvelle tentative dans ${RETRY_DELAY}ms...`)
        await delay(RETRY_DELAY)
      } else {
        throw err
      }
    }
  }
  throw new Error('Impossible de contacter l’API Jikan après plusieurs tentatives.')
}

async function fetchAnime(query) {
  if (!query) {
    return await fetchWithRetry('/random/anime')
  }

  const results = await fetchWithRetry('/anime', {
    q: query,
    limit: 5,
    sfw: true,
    order_by: 'popularity',
    sort: 'asc'
  })

  if (!Array.isArray(results) || !results.length) return null
  const safeResult = results.find(anime => !(anime.rating || '').startsWith('Rx'))
  return safeResult || results[0]
}

export default async function animeCommand(sock, msg, args) {
  const from = msg.key.remoteJid
  const query = args.join(' ').trim()

  try {
    const anime = await fetchAnime(query)
    if (!anime) {
      await sock.sendMessage(from, {
        text: query
          ? '😕 Aucun anime trouvé pour cette recherche.'
          : '😕 Impossible d’obtenir un anime aléatoire pour le moment.'
      }, { quoted: msg })
      return
    }

    const title = anime.title_english || anime.title || anime.title_japanese || 'Titre inconnu'
    const score = typeof anime.score === 'number' ? `${anime.score}/10` : 'N/A'
    const status = anime.status || 'Inconnu'
    const type = anime.type || 'Inconnu'
    const episodes = Number.isFinite(anime.episodes) ? anime.episodes : '?'
    const date = anime.aired?.string || 'Date inconnue'
    const url = anime.url || `https://myanimelist.net/anime/${anime.mal_id || ''}`
    const image = anime.images?.jpg?.large_image_url || anime.images?.webp?.large_image_url
    const genres = Array.isArray(anime.genres) ? anime.genres.slice(0, 4).map(g => g.name) : []
    const studios = Array.isArray(anime.studios) ? anime.studios.map(s => s.name) : []

    const lines = [
      `🎬 *${title}*`,
      `📺 Type : ${type}`,
      `📆 Diffusion : ${date}`,
      `📡 Statut : ${status}`,
      `🎞️ Épisodes : ${episodes}`,
      `⭐ Score : ${score}`,
      `🔗 MAL : ${url}`
    ]

    if (genres.length) lines.push(`🏷️ Genres : ${genres.join(', ')}`)
    if (studios.length) lines.push(`🎬 Studio : ${studios.join(', ')}`)

    const caption = lines.join('\n')

    if (image) {
      await sock.sendMessage(from, { image: { url: image }, caption }, { quoted: msg })
    } else {
      await sock.sendMessage(from, { text: caption }, { quoted: msg })
    }

    const synopsisChunks = splitSynopsis(anime.synopsis)
    for (let i = 0; i < synopsisChunks.length; i++) {
      const header = synopsisChunks.length > 1
        ? `📝 *Synopsis (partie ${i + 1}/${synopsisChunks.length})*`
        : '📝 *Synopsis :*'

      await sock.sendMessage(from, {
        text: `${header}\n\n${synopsisChunks[i]}`
      }, { quoted: msg })
    }

    if (synopsisChunks.length === MAX_CHUNKS) {
      await sock.sendMessage(from, {
        text: '⚠️ Synopsis abrégé. Consulte MyAnimeList pour la version complète.'
      }, { quoted: msg })
    }

  } catch (err) {
    console.error('Erreur .anime:', err)
    const reason = err?.response?.status
      ? `API Jikan a répondu ${err.response.status}`
      : err?.message || 'Erreur inconnue.'
    await sock.sendMessage(from, {
      text: `❌ Impossible de récupérer les informations sur l'anime.\nMotif : ${reason}`
    }, { quoted: msg })
  }
}
