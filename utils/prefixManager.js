import fs from 'fs'
import path from 'path'

const PREFIX_FILE = path.join(process.cwd(), 'config', 'prefix.json')

// Fonction utilitaire pour lire le fichier de configuration
function getConfig() {
  try {
    if (fs.existsSync(PREFIX_FILE)) {
      return JSON.parse(fs.readFileSync(PREFIX_FILE, 'utf8'))
    }
  } catch (error) {
    console.error('Erreur lors de la lecture du fichier de préfixe:', error)
  }
  return { prefix: '!' }
}

// Fonction utilitaire pour écrire dans le fichier de configuration
function setConfig(config) {
  try {
    const dir = path.dirname(PREFIX_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(PREFIX_FILE, JSON.stringify(config, null, 2))
    return true
  } catch (error) {
    console.error('Erreur lors de l\'écriture du fichier de préfixe:', error)
    return false
  }
}

export function getPrefix() {
  return getConfig().prefix || '!'
}

export function setPrefix(newPrefix) {
  if (typeof newPrefix !== 'string' || newPrefix.length === 0 || newPrefix.length > 3) {
    return { success: false, message: 'Le préfixe doit être une chaîne de 1 à 3 caractères' }
  }

  const config = getConfig()
  config.prefix = newPrefix

  if (setConfig(config)) {
    return {
      success: true,
      message: `Préfixe mis à jour avec succès : ${newPrefix}`,
      prefix: newPrefix
    }
  }

  return { success: false, message: 'Erreur lors de la mise à jour du préfixe' }
}

export function resetPrefix() {
  const config = getConfig()
  config.prefix = '!'

  if (setConfig(config)) {
    return {
      success: true,
      message: 'Préfixe réinitialisé avec succès',
      prefix: '!'
    }
  }

  return { success: false, message: 'Erreur lors de la réinitialisation du préfixe' }
}
