import axios from 'axios'
import { getLanguagePreference } from '../utils/messageHelpers.js'

const API_ENDPOINT = 'https://newsapi.org/v2/top-headlines'
const DEFAULT_COUNTRY = 'fr'
const MAX_ARTICLES = 5
const REQUEST_TIMEOUT = 10000

const MESSAGES = {
  missingKey: {
    fr: '❌ NEWSAPI_KEY manquante. Ajoute-la dans ton fichier .env pour utiliser `.news`.',
    en: '❌ NEWSAPI_KEY is missing. Please set it in your .env file to use `.news`.'
  },
  loading: {
    fr: '🗞️ Récupération des dernières actualités...',
    en: '🗞️ Fetching the latest news...'
  },
  noResults: {
    fr: 'ℹ️ Aucun article trouvé pour ce sujet.',
    en: 'ℹ️ No articles found for this topic.'
  },
  error: {
    fr: '❌ Impossible de récupérer les actualités. {reason}',
    en: '❌ Unable to fetch news. {reason}'
  },
  footer: {
    fr: '🔖 Source : NewsAPI.org',
    en: '🔖 Source: NewsAPI.org'
  },
  unknownError: {
    fr: 'Erreur inconnue.',
    en: 'Unknown error.'
  }
}

function t(key, lang) {
  const entry = MESSAGES[key]
  if (!entry) return ''
  return entry[lang] || entry.fr
}

function formatArticles(articles, lang) {
  const lines = []
  articles.forEach((article, index) => {
    const title = article.title?.trim() || (lang === 'en' ? 'Untitled article' : 'Article sans titre')
    const url = article.url?.trim()
    const source = article.source?.name || 'Unknown'

    lines.push(`${index + 1}. *${title}*`)
    if (url) {
      lines.push(url)
    }
    lines.push(lang === 'en' ? `Source: ${source}` : `Source : ${source}`)
    lines.push('')
  })

  lines.push(t('footer', lang))
  return lines.join('\n')
}

async function fetchNews(apiKey, topic, lang) {
  const params = {
    apiKey,
    pageSize: MAX_ARTICLES
  }

  const country = lang === 'en' ? 'us' : DEFAULT_COUNTRY
  params.country = country

  if (topic) {
    params.q = topic
  }

  const response = await axios.get(API_ENDPOINT, {
    params,
    timeout: REQUEST_TIMEOUT
  })

  if (response.data?.status !== 'ok' || !Array.isArray(response.data?.articles)) {
    const error = new Error('INVALID_RESPONSE')
    error.responseData = response.data
    throw error
  }

  return response.data.articles.slice(0, MAX_ARTICLES)
}

export default async function newsCommand(sock, msg, args) {
  const from = msg.key.remoteJid
  const lang = getLanguagePreference(from)
  const apiKey = 'f4c35ab232d34163acf9824116fb9bab'

  if (!apiKey) {
    await sock.sendMessage(from, { text: t('missingKey', lang) }, { quoted: msg })
    return
  }

  const topic = args.join(' ').trim() || null

  await sock.sendMessage(from, { text: t('loading', lang) }, { quoted: msg })

  try {
    const articles = await fetchNews(apiKey, topic, lang)

    if (!articles.length) {
      await sock.sendMessage(from, { text: t('noResults', lang) }, { quoted: msg })
      return
    }

    const header = topic
      ? (lang === 'en' ? `🗞️ Latest news about *${topic}*` : `🗞️ Dernières actualités sur *${topic}*`)
      : (lang === 'en' ? '🗞️ Top headlines' : '🗞️ Actualités du moment')

    const body = formatArticles(articles, lang)

    await sock.sendMessage(from, { text: `${header}\n\n${body}` }, { quoted: msg })
  } catch (error) {
    console.error('Erreur .news:', error?.message || error)

    let reason
    if (error?.response?.status === 401) {
      reason = lang === 'en'
        ? 'Invalid API key.'
        : 'Clé API invalide.'
    } else if (error?.response?.status === 426) {
      reason = lang === 'en'
        ? 'NewsAPI plan does not support this request.'
        : 'Le plan NewsAPI ne permet pas cette requête.'
    } else if (error?.code === 'ECONNABORTED') {
      reason = lang === 'en'
        ? 'Request timed out.'
        : 'Délai d’attente dépassé.'
    } else if (error?.response?.data?.message) {
      reason = error.response.data.message
    } else {
      reason = t('unknownError', lang)
    }

    const text = t('error', lang).replace('{reason}', reason)
    await sock.sendMessage(from, { text }, { quoted: msg })
  }
}
