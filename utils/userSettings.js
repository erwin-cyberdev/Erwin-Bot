import fs from 'fs'
import path from 'path'

const dataDir = path.join(process.cwd(), 'data')
const settingsFile = path.join(dataDir, 'userSettings.json')

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

if (!fs.existsSync(settingsFile)) {
  fs.writeFileSync(settingsFile, JSON.stringify({}, null, 2))
}

function readSettings() {
  try {
    const raw = fs.readFileSync(settingsFile, 'utf8')
    return raw ? JSON.parse(raw) : {}
  } catch (err) {
    console.error('Erreur lecture userSettings:', err)
    return {}
  }
}

function writeSettings(data) {
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(data, null, 2))
    return true
  } catch (err) {
    console.error('Erreur écriture userSettings:', err)
    return false
  }
}

const defaultSettings = {
  language: 'fr'
}

export function getUserSettings(userJid) {
  if (!userJid) return { ...defaultSettings }
  const settings = readSettings()
  if (!settings[userJid]) {
    settings[userJid] = { ...defaultSettings }
    writeSettings(settings)
    return settings[userJid]
  }

  const current = settings[userJid]
  let modified = false

  for (const [key, defaultValue] of Object.entries(defaultSettings)) {
    if (current[key] === undefined) {
      current[key] = defaultValue
      modified = true
    }
  }

  if (modified) {
    writeSettings(settings)
  }

  return current
}

export function updateUserSetting(userJid, key, value) {
  if (!userJid || !key) return false
  const settings = readSettings()
  if (!settings[userJid]) {
    settings[userJid] = { ...defaultSettings }
  }
  settings[userJid][key] = value
  return writeSettings(settings)
}
