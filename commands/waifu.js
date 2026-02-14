// commands/waifu.js — Envoi d'une waifu aléatoire
import axios from 'axios'

const WAIFU_API = 'https://api.waifu.pics'
const ANILIST_API = 'https://graphql.anilist.co'
const validTypes = ['waifu', 'husbando', 'neko', 'shinobu', 'megumin', 'bully', 'cuddle']
const validCategories = ['sfw', 'nsfw']

function isRandomMode(args) {
  if (!args.length) return true
  const [first, second] = args.map(a => a.toLowerCase())
  return validTypes.includes(first) || validCategories.includes(first) || validCategories.includes(second || '')
}

function sanitizeText(text) {
  if (!text) return ''
  const noTags = text.replace(/<[^>]*>/g, ' ')
  return noTags.replace(/\s+/g, ' ').trim()
}

async function fetchSpecificWaifu(query) {
  const gql = `
    query ($search: String) {
      Character(search: $search) {
        name {
          full
          native
        }
        image {
          large
          medium
        }
        description
        siteUrl
        favourites
      }
    }
  `

  const { data } = await axios.post(ANILIST_API, {
    query: gql,
    variables: { search: query }
  }, {
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    timeout: 20000,
    validateStatus: (status) => status >= 200 && status < 300
  })

  const character = data?.data?.Character
  if (!character) return null

  const description = sanitizeText(character.description).slice(0, 480)
  return {
    name: character.name?.full || query,
    native: character.name?.native || null,
    image: character.image?.large || character.image?.medium || null,
    url: character.siteUrl || null,
    favourites: character.favourites || character.favourites === 0 ? character.favourites : null,
    description
  }
}

async function sendSpecificWaifu(sock, from, msg, query) {
  const result = await fetchSpecificWaifu(query)
  if (!result) {
    await sock.sendMessage(from, { text: `❌ Aucun personnage trouvé pour « ${query} ».` }, { quoted: msg })
    return
  }

  const lines = []
  lines.push(`🎎 *${result.name}*${result.native ? ` (${result.native})` : ''}`)
  if (result.favourites !== null) lines.push(`❤️ ${result.favourites} favoris sur AniList`)
  if (result.description) lines.push(`📝 ${result.description}${result.description.length === 480 ? '…' : ''}`)
  if (result.url) lines.push(`🔗 ${result.url}`)

  if (result.image) {
    await sock.sendMessage(from, {
      image: { url: result.image },
      caption: lines.join('\n')
    }, { quoted: msg })
  } else {
    await sock.sendMessage(from, { text: lines.join('\n') }, { quoted: msg })
  }
}

async function sendRandomWaifu(sock, from, msg, args) {
  const [rawType, rawCategory] = args.map(a => a?.toLowerCase())
  const chosenType = validTypes.includes(rawType) ? rawType : 'waifu'
  const chosenCat = validCategories.includes(rawCategory) ? rawCategory : validCategories.includes(rawType) ? rawType : 'sfw'

  const endpoint = `${WAIFU_API}/${chosenCat}/${chosenType}`
  const { data } = await axios.get(endpoint, { timeout: 15000, validateStatus: (status) => status >= 200 && status < 300 })

  const imageUrl = data?.url
  if (!imageUrl) throw new Error('Lien d’image introuvable')

  await sock.sendMessage(from, {
    image: { url: imageUrl },
    caption: `✨ Voici ta waifu (${chosenType}, ${chosenCat})`
  }, { quoted: msg })
}

export default async function waifuCommand(sock, msg, args) {
  const from = msg.key.remoteJid

  try {
    if (!isRandomMode(args)) {
      const query = args.join(' ').trim()
      await sendSpecificWaifu(sock, from, msg, query)
      return
    }

    await sendRandomWaifu(sock, from, msg, args)
  } catch (err) {
    console.error('Erreur .waifu:', err)
    await sock.sendMessage(from, { text: `❌ Erreur lors de la récupération de la waifu : ${err.message}` }, { quoted: msg })
  }
}
