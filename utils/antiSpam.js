// utils/antiSpam.js - Système anti-spam avancé

import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { isOwner } from './permissions.js'

const SPAM_DB = path.resolve('./data/spam.json')

// Configuration anti-spam
const CONFIG = {
  maxCommandsPerMinute: 20,      // Max commandes/minute par user (RÉDUIT de 10)
  maxSameCommandRepeat: 6,        // Max répétition même commande (RÉDUIT de 3)
  blacklistDuration: 1800000,     // Durée blacklist (30min au lieu de 1h)
  warningThreshold: 5,            // Avertissements avant blacklist (RÉDUIT de 3)
  cooldownBetweenCommands: 1000,  // 1s entre commandes (RÉDUIT de 2s)
  maxMediaPerHour: 40,            // Max média/heure (RÉDUIT de 20)
  suspiciousPatternThreshold: 10  // Seuil pattern suspect (RÉDUIT de 5)
}

// Données en mémoire
let spamData = {
  userCommands: {},      // Historique commandes par user
  userWarnings: {},      // Avertissements
  blacklist: {},         // Users blacklistés
  suspiciousPatterns: {} // Patterns suspects détectés
}

// Debounce pour sauvegardes
let saveTimeout = null
let isSaving = false

// Charger données (sync au démarrage uniquement)
function loadSpamData() {
  try {
    if (fsSync.existsSync(SPAM_DB)) {
      const content = fsSync.readFileSync(SPAM_DB, 'utf-8')
      if (content && content.trim()) {
        spamData = JSON.parse(content)
      }
    }
  } catch (err) {
    console.error('Erreur chargement spam data:', err)
  }
}

// Sauvegarder données (async avec debounce)
async function saveSpamDataAsync() {
  if (isSaving) return

  try {
    isSaving = true
    const dir = path.dirname(SPAM_DB)
    if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true })
    await fs.writeFile(SPAM_DB, JSON.stringify(spamData, null, 2), 'utf-8')
  } catch (err) {
    console.error('Erreur sauvegarde spam data:', err)
  } finally {
    isSaving = false
  }
}

// Debounced save (évite les écritures excessives)
function saveSpamData() {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => saveSpamDataAsync(), 1000) // 1s debounce
}

// Initialiser
loadSpamData()

/**
 * Vérifie si un user est blacklisté
 */
export function isBlacklisted(userId) {
  if (isOwner(userId)) {
    if (spamData.blacklist[userId]) {
      delete spamData.blacklist[userId]
      saveSpamData()
    }
    return false
  }
  if (!spamData.blacklist[userId]) return false

  const blacklistEntry = spamData.blacklist[userId]
  const now = Date.now()

  // Vérifier expiration
  if (now > blacklistEntry.until) {
    delete spamData.blacklist[userId]
    saveSpamData()
    return false
  }

  return true
}

/**
 * Ajoute un user à la blacklist
 */
export function addToBlacklist(userId, reason, duration = CONFIG.blacklistDuration) {
  spamData.blacklist[userId] = {
    reason,
    since: Date.now(),
    until: Date.now() + duration
  }

  console.warn(`🚫 User blacklisté: ${userId} - Raison: ${reason}`)
  saveSpamData()
}

/**
 * Retire un user de la blacklist
 */
export function removeFromBlacklist(userId) {
  delete spamData.blacklist[userId]
  saveSpamData()
}

/**
 * Vérifie le spam de commandes
 */
export function checkCommandSpam(userId, command) {
  const now = Date.now()
  const oneMinuteAgo = now - 60000

  // Initialiser si nécessaire
  if (!spamData.userCommands[userId]) {
    spamData.userCommands[userId] = []
  }

  const userHistory = spamData.userCommands[userId]

  // Nettoyer vieilles entrées
  spamData.userCommands[userId] = userHistory.filter(entry => entry.timestamp > oneMinuteAgo)

  // Compter commandes dans la dernière minute
  const recentCommands = spamData.userCommands[userId]

  if (recentCommands.length >= CONFIG.maxCommandsPerMinute) {
    addWarning(userId, 'Too many commands per minute')
    return false
  }

  // Vérifier répétition même commande
  const sameCommandCount = recentCommands.filter(e => e.command === command).length

  if (sameCommandCount >= CONFIG.maxSameCommandRepeat) {
    addWarning(userId, `Repeating command: ${command}`)
    return false
  }

  // Ajouter commande
  spamData.userCommands[userId].push({
    command,
    timestamp: now
  })

  return true
}

/**
 * Ajoute un avertissement
 */
function addWarning(userId, reason) {
  if (!spamData.userWarnings[userId]) {
    spamData.userWarnings[userId] = []
  }

  spamData.userWarnings[userId].push({
    reason,
    timestamp: Date.now()
  })

  const warningCount = spamData.userWarnings[userId].length

  console.warn(`⚠️ Avertissement ${warningCount}/${CONFIG.warningThreshold} pour ${userId}: ${reason}`)

  // Blacklist si trop d'avertissements
  if (warningCount >= CONFIG.warningThreshold) {
    addToBlacklist(userId, `${warningCount} warnings - Spam detected`)
  }

  saveSpamData()
}

/**
 * Détecte patterns suspects
 */
export function detectSuspiciousPattern(userId, action) {
  if (!spamData.suspiciousPatterns[userId]) {
    spamData.suspiciousPatterns[userId] = {
      actions: [],
      score: 0
    }
  }

  const pattern = spamData.suspiciousPatterns[userId]
  pattern.actions.push({
    action,
    timestamp: Date.now()
  })

  // Nettoyer vieilles actions (>10 min)
  const tenMinutesAgo = Date.now() - 600000
  pattern.actions = pattern.actions.filter(a => a.timestamp > tenMinutesAgo)

  // Calculer score de suspicion
  const recentActions = pattern.actions.length

  // Pattern suspect: beaucoup d'actions en peu de temps
  if (recentActions > CONFIG.suspiciousPatternThreshold) {
    pattern.score++

    if (pattern.score >= 3) {
      addWarning(userId, 'Suspicious activity pattern detected')
      pattern.score = 0 // Reset
    }
  }

  saveSpamData()
}

/**
 * Vérifie le spam de média
 */
export function checkMediaSpam(userId, mediaType) {
  const now = Date.now()
  const oneHourAgo = now - 3600000

  if (!spamData.userCommands[userId]) {
    spamData.userCommands[userId] = []
  }

  // Compter médias envoyés dans l'heure
  const mediaCount = spamData.userCommands[userId].filter(entry =>
    entry.timestamp > oneHourAgo && entry.mediaType
  ).length

  if (mediaCount >= CONFIG.maxMediaPerHour) {
    addWarning(userId, 'Too many media requests per hour')
    return false
  }

  // Ajouter l'entrée média
  spamData.userCommands[userId].push({
    mediaType,
    timestamp: now
  })

  return true
}

/**
 * Réinitialise les warnings d'un user
 */
export function resetWarnings(userId) {
  delete spamData.userWarnings[userId]
  saveSpamData()
  console.log(`✅ Warnings réinitialisés pour ${userId}`)
}

/**
 * Obtenir stats anti-spam
 */
export function getSpamStats() {
  return {
    blacklistedUsers: Object.keys(spamData.blacklist).length,
    usersWithWarnings: Object.keys(spamData.userWarnings).length,
    totalWarnings: Object.values(spamData.userWarnings).reduce((sum, warnings) => sum + warnings.length, 0),
    suspiciousUsers: Object.keys(spamData.suspiciousPatterns).filter(
      userId => spamData.suspiciousPatterns[userId].score > 0
    ).length
  }
}

/**
 * Nettoie les données anciennes
 */
export function cleanupOldData() {
  const now = Date.now()
  const oneWeekAgo = now - 7 * 24 * 3600000

  // Nettoyer warnings > 1 semaine
  for (const userId in spamData.userWarnings) {
    spamData.userWarnings[userId] = spamData.userWarnings[userId].filter(
      w => w.timestamp > oneWeekAgo
    )

    if (spamData.userWarnings[userId].length === 0) {
      delete spamData.userWarnings[userId]
    }
  }

  // Nettoyer commandes > 1 jour
  const oneDayAgo = now - 24 * 3600000
  for (const userId in spamData.userCommands) {
    spamData.userCommands[userId] = spamData.userCommands[userId].filter(
      c => c.timestamp > oneDayAgo
    )

    if (spamData.userCommands[userId].length === 0) {
      delete spamData.userCommands[userId]
    }
  }

  // Nettoyer patterns > 1 jour
  for (const userId in spamData.suspiciousPatterns) {
    spamData.suspiciousPatterns[userId].actions = spamData.suspiciousPatterns[userId].actions.filter(
      a => a.timestamp > oneDayAgo
    )

    if (spamData.suspiciousPatterns[userId].actions.length === 0) {
      delete spamData.suspiciousPatterns[userId]
    }
  }

  saveSpamData()
  console.log('🧹 Nettoyage des données anti-spam effectué')
}

// Nettoyage automatique toutes les 6 heures
setInterval(cleanupOldData, 6 * 3600000)

/**
 * Configuration personnalisée
 */
export function setAntiSpamConfig(newConfig) {
  Object.assign(CONFIG, newConfig)
  console.log('⚙️ Config anti-spam mise à jour')
}
