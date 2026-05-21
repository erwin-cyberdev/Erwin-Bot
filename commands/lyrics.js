import axios from 'axios'
import * as cheerio from 'cheerio'
import { secureMessageSend } from '../utils/botSecurity.js'

const TIMEOUT = 15000
const CHUNK_SIZE = 1500
const MAX_CHUNKS = 8

/**
 * Recherche l'URL Genius d'une chanson, en priorisant la version Romanisée
 */
async function searchGeniusUrl(query) {
  try {
    // 1. Tenter d'abord de trouver la version "Romanized"
    const romUrl = `https://genius.com/api/search/multi?q=${encodeURIComponent(query + ' romanized')}`
    const { data: romData } = await axios.get(romUrl, { 
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://genius.com/'
      }
    })
    const romHits = romData?.response?.sections?.find(s => s.type === 'song')?.hits || []
    
    // On s'assure que le résultat mentionne "Romanized"
    let bestHit = romHits.find(h => h.result.full_title.toLowerCase().includes('romanized')) || romHits[0]

    // 2. Si aucun résultat, on cherche normalement
    if (!bestHit) {
      const stdUrl = `https://genius.com/api/search/multi?q=${encodeURIComponent(query)}`
      const { data: stdData } = await axios.get(stdUrl, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://genius.com/'
        }
      })
      const stdHits = stdData?.response?.sections?.find(s => s.type === 'song')?.hits || []
      bestHit = stdHits[0]
    }

    if (bestHit?.result) {
      return {
        url: `https://genius.com${bestHit.result.path}`,
        title: bestHit.result.full_title,
        image: bestHit.result.header_image_url
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'TE': 'trailers',
        'Referer': 'https://www.google.com/'
      }
    })
    return html
  } catch (err) {
    console.error('[scrapeGeniusHtml] Erreur:', err.message)
    return null
  }
}

/**
 * Extrait les paroles depuis le HTML Genius avec cheerio
 */
function extractLyricsFromHtml(html) {
  const $ = cheerio.load(html)

  // Sélectionner les conteneurs de paroles Genius (plusieurs sélecteurs possibles selon la version de la page)
  let containers = $('[data-lyrics-container="true"]')
  
  if (containers.length === 0) {
    // Essayer les anciens sélecteurs si le nouveau échoue
    containers = $('.lyrics, .SongLyrics__Container-sc-190p9sh-1')
  }

  if (containers.length === 0) return null

  let lyrics = ''

  containers.each((_, el) => {
    const container = $(el)

    // Supprimer les éléments de métadonnées (contributeurs, traductions, description)
    container.find('[data-exclude-from-selection]').remove()

    // Remplacer les <br> par des sauts de ligne avant d'extraire le texte
    container.find('br').replaceWith('\n')

    // Extraire le texte (cheerio gère déjà le stripping des balises <a>, <span>, etc.)
    const text = container.text()
    lyrics += text + '\n'
  })

  // Nettoyer : supprimer les lignes vides en excès
  lyrics = lyrics
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return lyrics.length > 30 ? lyrics : null
}

// Fallback lyrics.ovh
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

  await secureMessageSend(sock, from, { text: `🔍 *Recherche des paroles romanisées...*\n*${query}*`, quoted: msg })

  try {
    // 1. Chercher sur Genius (priorité romanisé)
    const geniusResult = await searchGeniusUrl(query)
    let lyrics = null
    let source = 'Genius (Scraping)'
    let finalTitle = geniusResult?.title || query

    if (geniusResult) {
      const html = await scrapeGeniusHtml(geniusResult.url)
      if (html) {
        lyrics = extractLyricsFromHtml(html)
      }
    }

    // 2. Fallback si scraping échoue
    if (!lyrics) {
      source = 'Lyrics.OVH (Fallback)'
      lyrics = await fetchLyricsOvh('', query)
    }

    if (!lyrics || lyrics.length < 50) {
      return await secureMessageSend(sock, from, { text: '❌ Aucune paroles trouvée.', quoted: msg })
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
