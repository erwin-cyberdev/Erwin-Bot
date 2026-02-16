import axios from 'axios'
import { getLanguagePreference } from '../utils/messageHelpers.js'

const REQUEST_TIMEOUT = 10000
// Configuration de l'API Bible
const BIBLE_API_BASE = 'https://bible-api.com'
const BIBLE_API_KEY = ''

const BIBLE_VERSIONS = {
  'LSG': { label: { fr: 'Louis Segond 1910', en: 'Louis Segond 1910' } },
  'KJV': { label: { fr: 'King James Version', en: 'King James Version' } },
  'BDS': { label: { fr: 'Bible du Semeur', en: 'Bible du Semeur' } },
  'NEG1979': { label: { fr: 'Nouvelle Edition de Genève', en: 'New Geneva Edition' } },
  'NIV': { label: { fr: 'Nouvelle Version Internationale', en: 'New International Version' } },
  'NLT': { label: { fr: 'Nouvelle Traduction Vivante', en: 'New Living Translation' } },
  'BHS': { label: { fr: 'Hébreu', en: 'Hebrew' } },
  'GNT': { label: { fr: 'Grec', en: 'Greek' } }
}

// Versions disponibles par langue
const LANG_VERSIONS = {
  fr: ['LSG', 'BDS', 'NEG1979', 'NIV', 'NLT', 'KJV', 'BHS', 'GNT'],
  en: ['KJV', 'NIV', 'NLT', 'LSG', 'BHS', 'GNT']
}

const RANDOM_VERSES = [
  { bookCanonical: 'John', chapter: 3, verse: 16, display: { fr: 'Jean 3:16', en: 'John 3:16' } },
  { bookCanonical: 'Psalms', chapter: 23, verse: 1, display: { fr: 'Psaume 23:1', en: 'Psalm 23:1' } },
  { bookCanonical: 'Romans', chapter: 8, verse: 28, display: { fr: 'Romains 8:28', en: 'Romans 8:28' } },
  { bookCanonical: 'Proverbs', chapter: 3, verse: 5, display: { fr: 'Proverbes 3:5', en: 'Proverbs 3:5' } },
  { bookCanonical: 'Isaiah', chapter: 41, verse: 10, display: { fr: 'Ésaïe 41:10', en: 'Isaiah 41:10' } },
  { bookCanonical: 'Philippians', chapter: 4, verse: 13, display: { fr: 'Philippiens 4:13', en: 'Philippians 4:13' } },
  { bookCanonical: 'Jeremiah', chapter: 29, verse: 11, display: { fr: 'Jérémie 29:11', en: 'Jeremiah 29:11' } },
  { bookCanonical: 'Matthew', chapter: 11, verse: 28, display: { fr: 'Matthieu 11:28', en: 'Matthew 11:28' } },
  { bookCanonical: '1 Corinthians', chapter: 13, verse: 4, display: { fr: '1 Corinthiens 13:4', en: '1 Corinthians 13:4' } },
  { bookCanonical: 'Ephesians', chapter: 2, verse: 8, display: { fr: 'Éphésiens 2:8', en: 'Ephesians 2:8' } },
  { bookCanonical: 'Hebrews', chapter: 11, verse: 1, display: { fr: 'Hébreux 11:1', en: 'Hebrews 11:1' } },
  { bookCanonical: 'Revelation', chapter: 21, verse: 4, display: { fr: 'Apocalypse 21:4', en: 'Revelation 21:4' } }
]

function getPreferredVersions(lang) {
  return LANG_VERSIONS[lang] || LANG_VERSIONS.en
}

function getVersionLabel(code, lang) {
  const entry = BIBLE_VERSIONS[code]
  if (!entry) return code
  return entry.label[lang] || entry.label.en || code
}

const BOOK_ALIAS_MAP = new Map()

function normalizeKey(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function registerBook(canonical, aliases = []) {
  BOOK_ALIAS_MAP.set(normalizeKey(canonical), canonical)
  aliases.forEach(alias => {
    BOOK_ALIAS_MAP.set(normalizeKey(alias), canonical)
  })
}

registerBook('Genesis', ['genese', 'genes', 'genesis', 'gn'])
registerBook('Exodus', ['exode', 'exodus', 'exo'])
registerBook('Leviticus', ['levitique', 'leviticus', 'lv'])
registerBook('Numbers', ['nombres', 'numbers', 'nb'])
registerBook('Deuteronomy', ['deuteronome', 'deuteronomy', 'dt'])
registerBook('Joshua', ['josue', 'joshua', 'jos'])
registerBook('Judges', ['juges', 'judges'])
registerBook('Ruth', ['ruth'])
registerBook('1 Samuel', ['1samuel', '1 samuel', 'premier samuel', '1sa'])
registerBook('2 Samuel', ['2samuel', '2 samuel', 'deuxieme samuel', '2sa'])
registerBook('1 Kings', ['1rois', '1 rois', 'premier rois', '1kings', '1kg'])
registerBook('2 Kings', ['2rois', '2 rois', 'deuxieme rois', '2kings', '2kg'])
registerBook('1 Chronicles', ['1chroniques', '1 chroniques', 'premieres chroniques', '1ch'])
registerBook('2 Chronicles', ['2chroniques', '2 chroniques', 'deuxieme chroniques', '2ch'])
registerBook('Ezra', ['esdras', 'ezra'])
registerBook('Nehemiah', ['nehemie', 'nehemiah'])
registerBook('Esther', ['esther'])
registerBook('Job', ['job'])
registerBook('Psalms', ['psaumes', 'psaume', 'psalms', 'ps'])
registerBook('Proverbs', ['proverbes', 'proverbs', 'pr'])
registerBook('Ecclesiastes', ['ecclesiaste', 'ecclesiaste', 'ecclesiastes', 'qohelet'])
registerBook('Song of Solomon', ['cantiquedescantiques', 'cantique des cantiques', 'cantique', 'songofsolomon', 'cantique'])
registerBook('Isaiah', ['esaie', 'esaïe', 'esaiah', 'isaiah', 'esa'])
registerBook('Jeremiah', ['jeremie', 'jeremiah'])
registerBook('Lamentations', ['lamentations', 'lamentation'])
registerBook('Ezekiel', ['ezechiel', 'ezekiel'])
registerBook('Daniel', ['daniel'])
registerBook('Hosea', ['osee', 'hosea'])
registerBook('Joel', ['joel'])
registerBook('Amos', ['amos'])
registerBook('Obadiah', ['abdias', 'obadiah'])
registerBook('Jonah', ['jonas', 'jonah'])
registerBook('Micah', ['michee', 'micah'])
registerBook('Nahum', ['nahum'])
registerBook('Habakkuk', ['habakuk', 'habacuc', 'habakkuk'])
registerBook('Zephaniah', ['sophonie', 'zephaniah'])
registerBook('Haggai', ['agee', 'haggai'])
registerBook('Zechariah', ['zacharie', 'zechariah'])
registerBook('Malachi', ['malachie', 'malachi'])
registerBook('Matthew', ['matthieu', 'matthew'])
registerBook('Mark', ['marc', 'mark'])
registerBook('Luke', ['luc', 'luke'])
registerBook('John', ['jean', 'john'])
registerBook('Acts', ['actes', 'acts'])
registerBook('Romans', ['romains', 'romans'])
registerBook('1 Corinthians', ['1corinthiens', '1 corinthiens', 'premier corinthiens', '1cor'])
registerBook('2 Corinthians', ['2corinthiens', '2 corinthiens', 'deuxieme corinthiens', '2cor'])
registerBook('Galatians', ['galates', 'galatians'])
registerBook('Ephesians', ['ephesiens', 'éphésiens', 'ephesians', 'ep'])
registerBook('Philippians', ['philippiens', 'philippians'])
registerBook('Colossians', ['colossiens', 'colossians'])
registerBook('1 Thessalonians', ['1thessaloniciens', '1 thessaloniciens', 'premier thessaloniciens', '1th'])
registerBook('2 Thessalonians', ['2thessaloniciens', '2 thessaloniciens', 'deuxieme thessaloniciens', '2th'])
registerBook('1 Timothy', ['1timothee', '1 timothee', 'premier timothee', '1ti'])
registerBook('2 Timothy', ['2timothee', '2 timothee', 'deuxieme timothee', '2ti'])
registerBook('Titus', ['tite', 'titus'])
registerBook('Philemon', ['philemon', 'philémon', 'philemon'])
registerBook('Hebrews', ['hebreux', 'hebrews'])
registerBook('James', ['jacques', 'james'])
registerBook('1 Peter', ['1pierre', '1 pierre', 'premiere pierre', '1pe'])
registerBook('2 Peter', ['2pierre', '2 pierre', 'deuxieme pierre', '2pe'])
registerBook('1 John', ['1jean', '1 jean', 'premier jean', '1jn'])
registerBook('2 John', ['2jean', '2 jean', 'deuxieme jean', '2jn'])
registerBook('3 John', ['3jean', '3 jean', 'troisieme jean', '3jn'])
registerBook('Jude', ['jude'])
registerBook('Revelation', ['apocalypse', 'revelation', 'ap'])

const BOOK_OSIS = {
  Genesis: 'GEN',
  Exodus: 'EXO',
  Leviticus: 'LEV',
  Numbers: 'NUM',
  Deuteronomy: 'DEU',
  Joshua: 'JOS',
  Judges: 'JDG',
  Ruth: 'RUT',
  '1 Samuel': '1SA',
  '2 Samuel': '2SA',
  '1 Kings': '1KI',
  '2 Kings': '2KI',
  '1 Chronicles': '1CH',
  '2 Chronicles': '2CH',
  Ezra: 'EZR',
  Nehemiah: 'NEH',
  Esther: 'EST',
  Job: 'JOB',
  Psalms: 'PSA',
  Proverbs: 'PRO',
  Ecclesiastes: 'ECC',
  'Song of Solomon': 'SNG',
  Isaiah: 'ISA',
  Jeremiah: 'JER',
  Lamentations: 'LAM',
  Ezekiel: 'EZK',
  Daniel: 'DAN',
  Hosea: 'HOS',
  Joel: 'JOL',
  Amos: 'AMO',
  Obadiah: 'OBA',
  Jonah: 'JON',
  Micah: 'MIC',
  Nahum: 'NAM',
  Habakkuk: 'HAB',
  Zephaniah: 'ZEP',
  Haggai: 'HAG',
  Zechariah: 'ZEC',
  Malachi: 'MAL',
  Matthew: 'MAT',
  Mark: 'MRK',
  Luke: 'LUK',
  John: 'JHN',
  Acts: 'ACT',
  Romans: 'ROM',
  '1 Corinthians': '1CO',
  '2 Corinthians': '2CO',
  Galatians: 'GAL',
  Ephesians: 'EPH',
  Philippians: 'PHP',
  Colossians: 'COL',
  '1 Thessalonians': '1TH',
  '2 Thessalonians': '2TH',
  '1 Timothy': '1TI',
  '2 Timothy': '2TI',
  Titus: 'TIT',
  Philemon: 'PHM',
  Hebrews: 'HEB',
  James: 'JAS',
  '1 Peter': '1PE',
  '2 Peter': '2PE',
  '1 John': '1JN',
  '2 John': '2JN',
  '3 John': '3JN',
  Jude: 'JUD',
  Revelation: 'REV'
}

const MESSAGES = {
  loading: {
    fr: '📖 Recherche du verset...',
    en: '📖 Fetching verse...'
  },
  missingKey: {
    fr: '❌ L\'API Bible est configurée avec une URL par défaut.',
    en: '❌ Bible API is using default endpoint.'
  },
  invalidArgs: {
    fr: '❌ Format invalide. Utilisez :\n`.bible <livre> <chapitre:verset>`\nExemple : `.bible Jean 3:16`',
    en: '❌ Invalid format. Usage:\n`.bible <book> <chapter:verse>`\nExample: `.bible John 3:16`'
  },
  unknownBook: {
    fr: '❌ Livre non trouvé : *{book}*\n\nVérifiez l\'orthographe ou essayez un autre nom.',
    en: '❌ Book not found: *{book}*\n\nPlease check the spelling or try a different name.'
  },
  requestFailed: {
    fr: '❌ Impossible de récupérer le verset demandé. Raison : {reason}',
    en: '❌ Unable to retrieve the requested verse. Reason: {reason}'
  },
  randomLabel: {
    fr: '📖 Verset aléatoire',
    en: '📖 Random verse'
  },
  specificLabel: {
    fr: '📖 Verset demandé',
    en: '📖 Requested verse'
  },
  sourceFooter: {
    fr: '🔖 Source : Bible API (bible-api.com)',
    en: '🔖 Source: Bible API (bible-api.com)'
  },
  versionLine: {
    fr: '📚 Version : {version}',
    en: '📚 Version: {version}'
  },
  verseNotFound: {
    fr: '❌ Verset non trouvé. Vérifiez la référence.',
    en: '❌ Verse not found. Please check the reference.'
  }
}

function t(key, lang) {
  const entry = MESSAGES[key]
  if (!entry) return ''
  return entry[lang] || entry.fr
}

function resolveBookName(raw) {
  const key = normalizeKey(raw)
  return BOOK_ALIAS_MAP.get(key) || null
}

function formatReference(book, chapter, verse) {
  return `${book} ${chapter}:${verse}`
}

function cleanVerseText(text) {
  if (!text) return ''
  return String(text)
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r?\n\s*/g, '\n')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function getOsisCode(bookCanonical) {
  return BOOK_OSIS[bookCanonical] || null
}

function buildVerseId(osis, chapter, verse) {
  return `${osis}.${chapter}.${verse}`
}

async function fetchVerse(bookCanonical, chapter, verse, apiBase, lang) {
  const versions = getPreferredVersions(lang)
  let lastError = null
  let lastStatus = null

  // Obtenir le nom du livre au format OSIS
  const osisBook = getOsisCode(bookCanonical)
  if (!osisBook) {
    const err = new Error('LIVRE_NON_TROUVE')
    err.details = { book: bookCanonical }
    throw err
  }

  // Vérifier si le numéro de chapitre est valide
  if (isNaN(chapter) || chapter <= 0) {
    const err = new Error('CHAPITRE_INVALIDE')
    err.details = { chapter }
    throw err
  }

  // Vérifier si le numéro de verset est valide
  if (isNaN(verse) || verse <= 0) {
    const err = new Error('VERSET_INVALIDE')
    err.details = { verse }
    throw err
  }

  // Essayer chaque version jusqu'à ce qu'une fonctionne
  for (const versionCode of versions) {
    try {
      // Construire l'URL pour bible-api.com
      const bookPath = `${osisBook}+${chapter}:${verse}`
      const url = `${apiBase}/${bookPath}?translation=${versionCode}`

      const response = await axios.get(url, {
        timeout: REQUEST_TIMEOUT,
        headers: {
          'Accept': 'application/json',
          'Owner': 'Erwin',
          'Name': 'Erwin-Bot/1.0'
        },
        validateStatus: status => status >= 200 && status < 500
      })

      lastStatus = response.status

      if (response.status === 200 && response.data && response.data.text) {
        return {
          text: cleanVerseText(response.data.text),
          versionCode,
          reference: response.data.reference || `${bookCanonical} ${chapter}:${verse}`,
          versionName: getVersionLabel(versionCode, lang) || versionCode,
          copyright: response.data.copyright || ''
        }
      } else if (response.status === 404) {
        // Si le verset n'est pas trouvé dans cette version, on essaie la suivante
        continue
      } else {
        // Pour les autres erreurs HTTP, on enregistre l'erreur et on continue
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
        continue
      }
    } catch (error) {
      lastError = error
      console.error(`Erreur avec la version ${versionCode}:`, error.message)

      // Si c'est une erreur de timeout ou de réseau, on attend un peu avant de réessayer
      if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        await sleep(1000) // Attendre 1 seconde avant de réessayer
      }

      continue
    }
  }

  // Si on arrive ici, aucune version n'a fonctionné
  const err = new Error('ERREUR_API')
  err.details = {
    book: bookCanonical,
    chapter,
    verse,
    lastStatus,
    lastError: lastError ? lastError.message : 'Inconnue',
    versionsTried: versions.join(', ')
  }

  if (lastStatus === 404) {
    err.message = 'VERSET_NON_TROUVE'
  }

  throw err
}

function parseArguments(args) {
  if (!args.length) {
    return { type: 'random' }
  }

  // Si un seul argument est fourni, vérifier s'il s'agit d'une référence complète (ex: "Jean 3:16")
  if (args.length === 1) {
    const refMatch = args[0].match(/^([\w\s]+?)\s*(\d+)[:\s]+(\d+)$/i)
    if (refMatch) {
      const [, bookRaw, chapterStr, verseStr] = refMatch
      const chapter = parseInt(chapterStr, 10)
      const verse = parseInt(verseStr, 10)

      if (chapter > 0 && verse > 0) {
        const bookCanonical = resolveBookName(bookRaw.trim())
        if (bookCanonical) {
          return {
            type: 'specific',
            bookRaw: bookRaw.trim(),
            bookCanonical,
            chapter,
            verse
          }
        }
      }
    }
  }

  // Format traditionnel avec arguments séparés
  const parts = [...args]
  const verseStr = parts.pop()
  const chapterStr = parts.pop()

  if (!verseStr || !/^\d+$/.test(verseStr) || !chapterStr || !/^\d+$/.test(chapterStr)) {
    return {
      type: 'invalid',
      reason: 'format',
      expected: 'Livre Chapitre:Verset (ex: Jean 3:16)'
    }
  }

  const bookRaw = parts.join(' ').trim()
  if (!bookRaw) {
    return {
      type: 'invalid',
      reason: 'no_book',
      expected: 'Veuillez spécifier un livre de la Bible'
    }
  }

  const chapter = parseInt(chapterStr, 10)
  const verse = parseInt(verseStr, 10)

  if (!Number.isInteger(chapter) || chapter <= 0 || !Number.isInteger(verse) || verse <= 0) {
    return {
      type: 'invalid',
      reason: 'invalid_numbers',
      expected: 'Les numéros de chapitre et de verset doivent être des nombres positifs'
    }
  }

  // Essayer différentes variantes du nom du livre
  const bookCanonical = resolveBookName(bookRaw) ||
    resolveBookName(bookRaw.replace(/\s+/g, '')) ||
    resolveBookName(bookRaw.replace(/[^\w\s]/g, ''))

  if (!bookCanonical) {
    return {
      type: 'unknownBook',
      book: bookRaw
    }
  }

  return {
    type: 'specific',
    bookRaw,
    bookCanonical,
    chapter,
    verse
  }
}

// Fonction utilitaire pour obtenir des suggestions de livres
function getBookSuggestions(input, lang) {
  if (!input) return []

  const inputNorm = normalizeKey(input)
  const suggestions = []
  const allBooks = Object.keys(BOOK_OSIS)

  // Vérifier d'abord les correspondances exactes
  for (const book of allBooks) {
    const bookNorm = normalizeKey(book)
    if (bookNorm === inputNorm) {
      return [book] // Retourne directement le livre si correspondance exacte
    }
  }

  // Ensuite les correspondances partielles
  for (const book of allBooks) {
    const bookNorm = normalizeKey(book)
    if (bookNorm.includes(inputNorm) || inputNorm.includes(bookNorm)) {
      if (!suggestions.includes(book)) {
        suggestions.push(book)
        if (suggestions.length >= 3) break
      }
    }
  }

  // Si pas de suggestions, chercher dans les alias
  if (suggestions.length === 0) {
    for (const [alias, canonical] of BOOK_ALIAS_MAP.entries()) {
      if (alias.includes(inputNorm)) {
        const bookName = BOOK_ALIAS_MAP.get(alias)
        if (bookName && !suggestions.includes(bookName)) {
          suggestions.push(bookName)
          if (suggestions.length >= 3) break
        }
      }
    }
  }

  return suggestions
}

// Messages d'erreur
const ERROR_MESSAGES = {
  fr: {
    INVALID_REFERENCE: '❌ Référence biblique invalide. Format attendu : *Livre Chapitre:Verset*\nExemple : *Jean 3:16*',
    BOOK_NOT_FOUND: '❌ Livre non trouvé : *{book}*',
    INVALID_CHAPTER: '❌ Chapitre invalide : *{chapter}*',
    INVALID_VERSE: '❌ Verset invalide : *{verse}*',
    VERSE_NOT_FOUND: '❌ Le verset *{reference}* n\'a pas été trouvé dans la Bible.',
    API_ERROR: '❌ Impossible de récupérer le verset. Veuillez réessayer plus tard.',
    NO_BOOK_SPECIFIED: '❌ Veuillez spécifier un livre de la Bible.',
    LOADING: '⏳ Recherche du verset...',
    RANDOM_VERSE: '✨ *Verset aléatoire*',
    VERSE_TITLE: '📖 *{reference}*',
    VERSION: '📚 Version : {version}',
    COPYRIGHT: '\n\n_{copyright}_',
    DID_YOU_MEAN: '\n\nVouliez-vous dire : *{suggestions}* ?'
  },
  en: {
    INVALID_REFERENCE: '❌ Invalid Bible reference. Expected format: *Book Chapter:Verse*\nExample: *John 3:16*',
    BOOK_NOT_FOUND: '❌ Book not found: *{book}*',
    INVALID_CHAPTER: '❌ Invalid chapter: *{chapter}*',
    INVALID_VERSE: '❌ Invalid verse: *{verse}*',
    VERSE_NOT_FOUND: '❌ The verse *{reference}* was not found in the Bible.',
    API_ERROR: '❌ Unable to retrieve the verse. Please try again later.',
    NO_BOOK_SPECIFIED: '❌ Please specify a Bible book.',
    LOADING: '⏳ Fetching verse...',
    RANDOM_VERSE: '✨ *Random verse*',
    VERSE_TITLE: '📖 *{reference}*',
    VERSION: '📚 Version: {version}',
    COPYRIGHT: '\n\n_{copyright}_',
    DID_YOU_MEAN: '\n\nDid you mean: *{suggestions}*?'
  }
}

// Fonction utilitaire pour formater les messages d'erreur
function formatMessage(key, lang, vars = {}) {
  const messages = ERROR_MESSAGES[lang] || ERROR_MESSAGES.en
  let message = messages[key] || key

  // Remplacer les variables dans le message
  Object.entries(vars).forEach(([k, v]) => {
    message = message.replace(new RegExp(`{${k}}`, 'g'), v)
  })

  return message
}

export default async function bibleCommand(sock, msg, args) {
  const from = msg.key.remoteJid
  const lang = getLanguagePreference(from) || 'fr' // Français par défaut
  const isGroup = from.endsWith('@g.us')

  // Utilisation de l'URL de l'API depuis les variables d'environnement ou la valeur par défaut
  const apiBase = BIBLE_API_BASE.endsWith('/') ? BIBLE_API_BASE.slice(0, -1) : BIBLE_API_BASE

  // Vérifier si l'URL de base est correctement configurée
  if (!apiBase) {
    await sock.sendMessage(from, {
      text: '❌ L\'URL de l\'API Bible n\'est pas configurée. Veuillez définir BIBLE_API_BASE_URL dans le fichier .env'
    }, { quoted: msg })
    return
  }

  // Parser les arguments
  const parsed = parseArguments(args)

  // Gestion des erreurs de format
  if (parsed.type === 'invalid') {
    let errorMsg

    switch (parsed.reason) {
      case 'format':
        errorMsg = formatMessage('INVALID_REFERENCE', lang)
        break
      case 'no_book':
        errorMsg = formatMessage('NO_BOOK_SPECIFIED', lang)
        break
      case 'invalid_numbers':
        errorMsg = formatMessage('INVALID_REFERENCE', lang)
        break
      default:
        errorMsg = formatMessage('INVALID_REFERENCE', lang)
    }

    await sock.sendMessage(from, { text: errorMsg }, { quoted: msg })
    return
  }

  // Gestion des livres inconnus
  if (parsed.type === 'unknownBook') {
    const suggestions = getBookSuggestions(parsed.book, lang)
    let errorMsg = formatMessage('BOOK_NOT_FOUND', lang, { book: parsed.book })

    if (suggestions.length > 0) {
      const suggestionText = formatMessage('DID_YOU_MEAN', lang, {
        suggestions: suggestions.join('*, *')
      })
      errorMsg += suggestionText
    }

    await sock.sendMessage(from, { text: errorMsg }, { quoted: msg })
    return
  }

  // Afficher un message de chargement
  await sock.sendMessage(from, {
    text: formatMessage('LOADING', lang)
  }, { quoted: msg })

  try {
    const isRandom = parsed.type === 'random'
    let bookCanonical, chapter, verse, displayReference, versionName

    // Gérer le cas d'un verset aléatoire
    if (isRandom) {
      const picked = RANDOM_VERSES[Math.floor(Math.random() * RANDOM_VERSES.length)]
      bookCanonical = picked.bookCanonical
      chapter = picked.chapter
      verse = picked.verse
      displayReference = picked.display?.[lang] || formatReference(bookCanonical, chapter, verse)
    } else {
      // Cas d'une référence spécifique
      bookCanonical = parsed.bookCanonical
      chapter = parsed.chapter
      verse = parsed.verse
      displayReference = formatReference(parsed.bookRaw, chapter, verse)
    }

    // Récupérer le verset depuis l'API
    const result = await fetchVerse(bookCanonical, chapter, verse, apiBase, lang)

    if (!result || !result.text) {
      throw new Error('VERSE_NOT_FOUND')
    }

    const { text: verseText, versionName: vName, copyright = '' } = result
    versionName = vName || getPreferredVersions(lang)[0]

    // Construire le message de réponse
    const lines = [
      isRandom
        ? formatMessage('RANDOM_VERSE', lang)
        : formatMessage('VERSE_TITLE', lang, { reference: displayReference }),
      '',
      verseText,
      '',
      formatMessage('VERSION', lang, { version: versionName })
    ]

    // Ajouter le copyright s'il est disponible
    if (copyright) {
      lines.push(formatMessage('COPYRIGHT', lang, { copyright }))
    }

    // Envoyer le message avec un délai pour éviter le spam
    await sleep(500)
    await sock.sendMessage(from, {
      text: lines.join('\n')
    }, { quoted: msg })

  } catch (error) {
    console.error('Erreur commande Bible:', error)

    let errorMessage

    // Gestion des erreurs spécifiques
    switch (error.message) {
      case 'LIVRE_NON_TROUVE':
        errorMessage = formatMessage('BOOK_NOT_FOUND', lang, { book: error.details?.book || '?' })
        break
      case 'CHAPITRE_INVALIDE':
        errorMessage = formatMessage('INVALID_CHAPTER', lang, { chapter: error.details?.chapter || '?' })
        break
      case 'VERSET_INVALIDE':
        errorMessage = formatMessage('INVALID_VERSE', lang, { verse: error.details?.verse || '?' })
        break
      case 'VERSET_NON_TROUVE':
      case 'VERSE_NOT_FOUND':
        errorMessage = formatMessage('VERSE_NOT_FOUND', lang, {
          reference: `${bookCanonical} ${chapter}:${verse}`
        })
        break
      case 'ECONNABORTED':
        errorMessage = formatMessage('API_ERROR', lang) + ' (Timeout)'
        break
      case 'ENOTFOUND':
      case 'ECONNREFUSED':
        errorMessage = formatMessage('API_ERROR', lang) + ' (Connexion impossible)'
        break
      default:
        // Pour les autres erreurs, afficher un message générique
        console.error('Détails de l\'erreur:', error.details || 'Aucun détail supplémentaire')
        errorMessage = formatMessage('API_ERROR', lang)
    }

    // Envoyer le message d'erreur
    await sock.sendMessage(from, {
      text: errorMessage
    }, { quoted: msg })
  }
}
