// utils/groupSettings.js
import fs from 'fs'
import path from 'path'

const dataDir = path.join(process.cwd(), 'data')
const settingsFile = path.join(dataDir, 'groupSettings.json')

// Créer le dossier data s'il n'existe pas
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// Initialiser le fichier s'il n'existe pas
if (!fs.existsSync(settingsFile)) {
  fs.writeFileSync(settingsFile, JSON.stringify({}, null, 2))
}

// Helpers pour lire/écrire
function readSettings() {
  try {
    const data = fs.readFileSync(settingsFile, 'utf8')
    return JSON.parse(data)
  } catch (e) {
    return {}
  }
}

function writeSettings(data) {
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(data, null, 2))
    return true
  } catch (e) {
    console.error('Erreur écriture groupSettings:', e)
    return false
  }
}

// Paramètres par défaut pour un groupe
const defaultSettings = {
  antilink: false,
  antidelete: false,
  antibot: false,
  welcome: null,
  goodbye: null,
  warns: {}, // { jid: count }
  // Paramètres d'auto-réaction
  autoreact: true, // Activer/désactiver l'auto-réaction
  autoreactChance: 0.25, // Probabilité de réagir à un message (0-1)
  lockSettings: {
    links: false,
    stickers: false,
    media: false,
    bots: false
  },
  language: 'fr'
}

// Obtenir les paramètres d'un groupe
export function getGroupSettings(groupJid) {
  const settings = readSettings()
  let modified = false

  if (!settings[groupJid]) {
    settings[groupJid] = { ...defaultSettings }
    modified = true
  } else {
    const current = settings[groupJid]
    for (const [key, defaultValue] of Object.entries(defaultSettings)) {
      if (current[key] === undefined) {
        current[key] = typeof defaultValue === 'object' && defaultValue !== null && !Array.isArray(defaultValue)
          ? { ...defaultValue }
          : defaultValue
        modified = true
      }
    }
  }

  if (modified) {
    writeSettings(settings)
  }

  return settings[groupJid]
}

export function getGroupSetting(groupJid, key) {
  const settings = getGroupSettings(groupJid)
  return settings?.[key]
}

// Mettre à jour un paramètre spécifique
export function updateGroupSetting(groupJid, key, value) {
  const settings = readSettings()
  if (!settings[groupJid]) {
    settings[groupJid] = { ...defaultSettings }
  }
  settings[groupJid][key] = value
  return writeSettings(settings)
}

export function updateGroupSettings(groupJid, updates) {
  if (!updates || typeof updates !== 'object') return false
  const settings = readSettings()
  if (!settings[groupJid]) {
    settings[groupJid] = { ...defaultSettings }
  }
  const current = settings[groupJid]
  let modified = false

  for (const [key, value] of Object.entries(updates)) {
    if (current[key] !== value) {
      current[key] = value
      modified = true
    }
  }

  return modified ? writeSettings(settings) : true
}

// Toggle un paramètre (true/false)
export function toggleGroupSetting(groupJid, key) {
  const current = getGroupSettings(groupJid)
  const newValue = !current[key]
  updateGroupSetting(groupJid, key, newValue)
  return newValue
}

// Warns système
export function addWarn(groupJid, userJid) {
  const settings = getGroupSettings(groupJid)
  if (!settings.warns[userJid]) settings.warns[userJid] = 0
  settings.warns[userJid]++
  updateGroupSetting(groupJid, 'warns', settings.warns)
  return settings.warns[userJid]
}

export function removeWarn(groupJid, userJid) {
  const settings = getGroupSettings(groupJid)
  if (!settings.warns[userJid] || settings.warns[userJid] <= 0) return 0
  settings.warns[userJid]--
  updateGroupSetting(groupJid, 'warns', settings.warns)
  return settings.warns[userJid]
}

export function getWarns(groupJid, userJid) {
  const settings = getGroupSettings(groupJid)
  return settings.warns[userJid] || 0
}

export function resetWarns(groupJid, userJid) {
  const settings = getGroupSettings(groupJid)
  if (settings.warns[userJid]) {
    delete settings.warns[userJid]
    updateGroupSetting(groupJid, 'warns', settings.warns)
  }
  return true
}
