export const LANGUAGES = {
  fr: 'fr',
  en: 'en'
}

const translations = {
  menu: {
    header: {
      fr: '╭────────────────────────────╮\n│        MENU ERWIN-BOT        │\n╰────────────────────────────╯',
      en: '╭────────────────────────────╮\n│        ERWIN-BOT MENU        │\n╰────────────────────────────╯'
    },
    availableCount: {
      fr: count => `Commandes disponibles : ${count}`,
      en: count => `Commands available: ${count}`
    },
    categories: {
      user: { fr: 'UTILISATEURS', en: 'USERS' },
      admin: { fr: 'ADMINISTRATEURS', en: 'ADMINS' },
      owner: { fr: 'PROPRIÉTAIRE', en: 'OWNER' }
    },
    footerError: {
      fr: '❌ Impossible d’afficher le menu.',
      en: '❌ Unable to display the menu.'
    }
  },
  disclaimer: {
    title: {
      fr: '⚠️ *DISCLAIMER / AVERTISSEMENT*',
      en: '⚠️ *DISCLAIMER / WARNING*'
    },
    intro: {
      fr: 'Erwin-Bot est fourni "tel quel". Son propriétaire est responsable de son utilisation et du respect des conditions d\'utilisation de WhatsApp ainsi que des lois locales.',
      en: 'Erwin-Bot is provided "as is". Its owner is responsible for its use and for complying with WhatsApp\'s terms of service and local laws.'
    },
    bullets: {
      consent: {
        fr: '✉️ Les conversations peuvent être stockées selon les commandes utilisées (ex. antidelete, extraction). Obtenez toujours le consentement explicite des membres.',
        en: '✉️ Conversations may be stored depending on the commands used (e.g. antidelete, extract). Always obtain explicit consent from members.'
      },
      personalInfo: {
        fr: '🔐 Ne partagez jamais d\'informations personnelles sensibles via le bot.',
        en: '🔐 Never share sensitive personal information through the bot.'
      },
      abuse: {
        fr: '🤖 N\'utilisez pas le bot pour spammer ou harceler.',
        en: '🤖 Do not use the bot to spam or harass.'
      },
      banRisk: {
        fr: '🚫 En cas de violation des règles WhatsApp, votre numéro peut être suspendu.',
        en: '🚫 WhatsApp may suspend your number if you violate its rules.'
      }
    },
    acceptance: {
      fr: 'En continuant à utiliser le bot, tu acceptes ces conditions.',
      en: 'By continuing to use the bot, you accept these terms.'
    }
  },
  errors: {
    unknownCommand: {
      fr: '❌ Commande inconnue. Tape {prefix}menu pour voir la liste.',
      en: '❌ Unknown command. Type {prefix}menu to see the list.'
    }
  }
}

function getLanguageList(langPreference) {
  switch (langPreference) {
    case LANGUAGES.fr:
      return ['fr']
    case LANGUAGES.en:
      return ['en']
    default:
      return ['fr']
  }
}

export function formatMenuSections(sections, langPreference) {
  const langs = getLanguageList(langPreference)
  const lines = []

  langs.forEach((lang, index) => {
    lines.push(translations.menu.header[lang])
    lines.push(translations.menu.availableCount[lang](sections.total))
    lines.push('')

    sections.categories.forEach(({ key, commands }) => {
      if (!commands.length) return
      lines.push(`[${translations.menu.categories[key][lang]}]`)
      commands.forEach(({ name, description }) => {
        lines.push(`- ➤ .${name} — ${description[lang] || description.fr || description.en || ''}`)
      })
      lines.push('')
    })

    if (index < langs.length - 1) {
      lines.push('──────────────────────────────')
      lines.push('')
    }
  })

  return lines.join('\n')
}

export function buildDisclaimer(langPreference) {
  const langs = getLanguageList(langPreference)
  const lines = []

  langs.forEach((lang, index) => {
    lines.push(translations.disclaimer.title[lang])
    lines.push('')
    lines.push(translations.disclaimer.intro[lang])
    lines.push('')
    Object.values(translations.disclaimer.bullets).forEach(item => {
      lines.push(`• ${item[lang]}`)
    })
    lines.push('')
    lines.push(translations.disclaimer.acceptance[lang])
    lines.push('')

    if (index < langs.length - 1) {
      lines.push('──────────────────────────────')
      lines.push('')
    }
  })

  return lines.join('\n').trim()
}

export function getErrorMessage(key, langPreference, replacements = {}) {
  const langs = getLanguageList(langPreference)
  const messages = translations.errors[key]
  if (!messages) return ''

  const formatted = langs
    .map(lang => messages[lang] || messages.fr || messages.en || '')
    .filter(Boolean)
    .map(msg => {
      let resolved = msg
      for (const [placeholder, value] of Object.entries(replacements)) {
        resolved = resolved.replace(`{${placeholder}}`, value)
      }
      return resolved
    })

  return formatted.join('\n')
}

export function getMenuErrorMessage(langPreference) {
  const langs = getLanguageList(langPreference)
  return langs
    .map(lang => translations.menu.footerError[lang] || translations.menu.footerError.fr || translations.menu.footerError.en || '')
    .filter(Boolean)
    .join('\n')
}
