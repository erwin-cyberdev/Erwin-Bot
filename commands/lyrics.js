// commands/lyrics.js
import axios from 'axios'
import { secureMessageSend } from '../utils/botSecurity.js'

const TIMEOUT = 10000
const CHUNK_SIZE = 1500
const MAX_CHUNKS = 8

const requestCache = new Map()

// ====== FETCH JSON AVEC CACHE ET SÉCURITÉ ======
async function fetchJson(url) {
  if (!url) return null
  if (!requestCache.has(url)) {
    const promise = axios
      .get(url, { timeout: TIMEOUT })
      .then(res => res?.data || null)
      .catch(err => {
        console.error(`[fetchJson] Erreur sur ${url} :`, err.message)
        requestCache.delete(url)
        return null
      })
    requestCache.set(url, promise)
  }

  const data = await requestCache.get(url)
  if (data === null) requestCache.delete(url)
  return data
}

// ====== DÉCOUPEUR DE TEXTE (pour éviter les messages trop longs) ======
function chunkText(text, size = CHUNK_SIZE) {
  const chunks = []
  let i = 0
  while (i < text.length) {
    let end = Math.min(i + size, text.length)
    const nl = text.lastIndexOf('\n', end)
    const sp = text.lastIndexOf(' ', end)
    const cut = Math.max(nl, sp)
    if (cut > i) end = cut
    chunks.push(text.slice(i, end).trim())
    i = end
  }
  return chunks.filter(Boolean)
}

// ====== APIS DE LYRICS ======
async function fetchLyricsOvh(artist, title) {
  if (!artist || !title) return null
  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
  const data = await fetchJson(url)
  return data?.lyrics || null
}

async function fetchLyricsRandom(titleQuery) {
  if (!titleQuery) return null
  const url = `https://some-random-api.ml/lyrics?title=${encodeURIComponent(titleQuery)}`
  const data = await fetchJson(url)
  return data?.lyrics || null
}

// ====== NETTOYAGE ET GÉNÉRATION DES VARIANTS DE RECHERCHE ======
function normalizeInput(raw) {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .trim()
}

function generateCandidates(raw) {
  const normalized = normalizeInput(raw)
  const candidates = []
  const seen = new Set()

  const pushCandidate = (title, artist) => {
    const key = `${title || ''}|${artist || ''}`
    if (!seen.has(key)) {
      seen.add(key)
      candidates.push({ title, artist })
    }
  }

  if (!normalized) return candidates

  // Cas : "titre - artiste"
  if (normalized.includes(' - ')) {
    const [title, artist] = normalized.split(' - ').map(s => s.trim())
    if (title && artist) {
      pushCandidate(title, artist)
      pushCandidate(artist, title) // inversion possible
    }
  } else if (normalized.includes('-')) {
    const parts = normalized.split('-').map(s => s.trim())
    if (parts.length >= 2) {
      const title = parts.slice(0, -1).join(' - ')
      const artist = parts.slice(-1)[0]
      pushCandidate(title, artist)
      pushCandidate(artist, title)
    }
  }

  // Variante simple : tout comme titre
  pushCandidate(normalized, null)

  // Variante "dernier mot = artiste supposé"
  const words = normalized.split(' ')
  if (words.length > 1) {
    const tentativeTitle = words.slice(0, -1).join(' ')
    const tentativeArtist = words.slice(-1)[0]
    pushCandidate(tentativeTitle, tentativeArtist)
  }

  return candidates
}

// ====== TEST DES CANDIDATS ======
async function tryCandidates(candidates = []) {
  for (const { artist, title } of candidates) {
    const tasks = []

    // Source 1 : lyrics.ovh
    if (artist && title)
      tasks.push(
        fetchLyricsOvh(artist, title).then(lyrics =>
          lyrics ? { lyrics, title, artist, source: 'lyrics.ovh' } : null
        )
      )

    // Source 2 : some-random-api.ml
    const query = artist && title ? `${title} - ${artist}` : title || artist
    if (query)
      tasks.push(
        fetchLyricsRandom(query).then(lyrics =>
          lyrics ? { lyrics, title: query, source: 'some-random-api.ml' } : null
        )
      )

    const results = await Promise.allSettled(tasks)
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value) return res.value
    }
  }

  return null
}

// ====== COMMANDE PRINCIPALE ======
export default async function lyricsCommand(sock, msg, args) {
  const from = msg.key.remoteJid
  const raw = (args || []).join(' ').trim()

  if (!raw) {
    return await secureMessageSend(sock, from, {
      text: '❌ *Usage*: .lyrics <titre - artiste>',
      quoted: msg
    })
  }

  const candidates = generateCandidates(raw)
  await secureMessageSend(sock, from, {
    text: `🔍 *Recherche en cours...*\nRecherche des paroles pour : *${raw}*`,
    quoted: msg
  })

  try {
    const result = await tryCandidates(candidates)
    if (!result) {
      return await secureMessageSend(sock, from, {
        text: '❌ Aucune paroles trouvée.\nEssaie avec un format différent : `.lyrics <titre - artiste>`',
        quoted: msg
      })
    }

    const { lyrics, title, artist, source } = result
    const meta = `*${title || raw}*${artist ? ' - ' + artist : ''}`
    const sourceLabel = source ? `\n🔗 *Source*: ${source}` : ''
    
    const header = `🎵 *PAROLES* ${meta}${sourceLabel}\n\n`
    const text = header + lyrics.trim()

    const chunks = chunkText(text)
    for (const chunk of chunks.slice(0, MAX_CHUNKS)) {
      await secureMessageSend(sock, from, { text: chunk }, { quoted: msg })
    }

    if (chunks.length > MAX_CHUNKS) {
      await secureMessageSend(sock, from, {
        text: '⚠️ *Message tronqué*\nLes paroles sont trop longues pour être affichées en entier.',
        quoted: msg
      })
    }

  } catch (error) {
    console.error('Erreur dans .lyrics :', error)
    await secureMessageSend(sock, from, {
      text: '❌ Une erreur est survenue lors de la recherche des paroles.',
      quoted: msg
    })
  }
}
