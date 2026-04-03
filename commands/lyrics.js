import axios from 'axios'
import { secureMessageSend } from '../utils/botSecurity.js'
import { chatCompletion, AI_MODELS } from '../utils/groq.js'

const TIMEOUT = 15000
const CHUNK_SIZE = 1500
const MAX_CHUNKS = 8

/**
 * Recherche l'URL Genius d'une chanson
 */
async function searchGeniusUrl(query) {
  try {
    const searchUrl = `https://genius.com/api/search/multi?q=${encodeURIComponent(query)}`
    const { data } = await axios.get(searchUrl, { timeout: 10000 })
    
    // Chercher dans les "top_hit" ou les "sections.song"
    const hits = data?.response?.sections?.find(s => s.type === 'song')?.hits || []
    const topHit = hits[0]?.result
    
    if (topHit) {
      return {
        url: `https://genius.com${topHit.path}`,
        title: topHit.full_title,
        image: topHit.header_image_url
      }
    }
  } catch (err) {
    console.error('[searchGenius] Erreur:', err.message)
  }
  return null
}

/**
 * Scrape le contenu HTML d'une page Genius
 */
async function scrapeGeniusHtml(url) {
  try {
    const { data: html } = await axios.get(url, { 
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })
    return html
  } catch (err) {
    console.error('[scrapeGeniusHtml] Erreur:', err.message)
    return null
  }
}

/**
 * Extrait les paroles via Groq
 */
async function extractLyricsWithAI(html, query) {
  // Tronquer le HTML pour rester dans les limites de tokens (on prend le milieu/fin où sont souvent les lyrics)
  // Souvent les lyrics Genius sont dans des balises Lyrics__Container
  const sanitizedHtml = html
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmb, '')
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmb, '')
    .slice(0, 50000) // Garder un bloc conséquent mais gérable

  const prompt = `
Tu es un expert en paroles de chansons. Voici le code HTML d'une page Genius pour la recherche : "${query}".
Ta mission :
1. Extrais uniquement les paroles de la chanson à partir de ce HTML.
2. Si les paroles ne sont pas en alphabet latin (ex: Japonais, Coréen, Chinois), fournis DIRECTEMENT la version "Romanized" (transcription phatétique).
3. Ne fournis QUE les paroles, sans bla-bla autour, sans "Voici les paroles".
4. Garde la structure des couplets/refrains si possible.

HTML :
${sanitizedHtml}
`
  try {
    const result = await chatCompletion(AI_MODELS.LLAMA_3_3, [
      { role: 'user', content: prompt }
    ], { temperature: 0.1 })
    return result?.trim()
  } catch (err) {
    console.error('[GroqLyrics] Erreur extraction:', err.message)
    return null
  }
}

// Fallbacks existants
async function fetchLyricsOvh(artist, title) {
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    const { data } = await axios.get(url, { timeout: 10000 })
    return data?.lyrics || null
  } catch { return null }
}

function chunkText(text, size = CHUNK_SIZE) {
  const chunks = []
  let i = 0
  while (i < text.length) {
    let end = Math.min(i + size, text.length)
    const nl = text.lastIndexOf('\n', end)
    const cut = nl > i ? nl : end
    chunks.push(text.slice(i, cut).trim())
    i = cut
  }
  return chunks.filter(Boolean)
}

export default async function lyricsCommand(sock, msg, args) {
  const from = msg.key.remoteJid
  const query = (args || []).join(' ').trim()

  if (!query) {
    return await secureMessageSend(sock, from, { text: '❌ *Usage*: .lyrics <titre chanson>', quoted: msg })
  }

  await secureMessageSend(sock, from, { text: `🔍 *Recherche sur Genius (via IA)...*\n*${query}*`, quoted: msg })

  try {
    // 1. Chercher sur Genius
    const geniusResult = await searchGeniusUrl(query)
    let lyrics = null
    let source = 'Genius (Scraping AI)'
    let finalTitle = geniusResult?.title || query

    if (geniusResult) {
      const html = await scrapeGeniusHtml(geniusResult.url)
      if (html) {
        lyrics = await extractLyricsWithAI(html, query)
      }
    }

    // 2. Fallback si Groq/Scraping échoue
    if (!lyrics) {
      source = 'Lyrics.OVH (Fallback)'
      lyrics = await fetchLyricsOvh('', query)
    }

    if (!lyrics || lyrics.length < 50) {
      return await secureMessageSend(sock, from, { text: '❌ Aucune paroles trouvée ou extraction échouée.', quoted: msg })
    }

    const header = `🎵 *PAROLES : ${finalTitle}*\n🔗 Source: ${source}\n\n`
    const text = header + lyrics
    const chunks = chunkText(text)

    for (const chunk of chunks.slice(0, MAX_CHUNKS)) {
      await secureMessageSend(sock, from, { text: chunk }, { quoted: msg })
    }

    if (chunks.length > MAX_CHUNKS) {
      await secureMessageSend(sock, from, { text: '⚠️ *Paroles tronquées*' }, { quoted: msg })
    }

  } catch (error) {
    console.error('Erreur Lyrics Command:', error)
    await secureMessageSend(sock, from, { text: '❌ Erreur lors de la récupération.', quoted: msg })
  }
}
