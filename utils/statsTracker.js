// utils/statsTracker.js - Suivi des statistiques du bot
import fs from 'fs'
import path from 'path'

const STATS_PATH = path.resolve('./data/bot_stats.json')

let stats = {
  commandsExecuted: 0,
  messagesReceived: 0,
  startTime: Date.now(),
  lastRestart: new Date().toISOString(),
  errors: 0,
  commandUsage: {}
}

/**
 * Charge les stats depuis le disque
 */
export function loadStats() {
  try {
    if (fs.existsSync(STATS_PATH)) {
      const data = JSON.parse(fs.readFileSync(STATS_PATH, 'utf-8'))
      stats = { ...stats, ...data, startTime: stats.startTime } // Garder l'uptime actuel
    }
  } catch (e) {
    console.error('Erreur chargement stats:', e.message)
  }
}

/**
 * Sauvegarde les stats sur le disque
 */
export function saveStats() {
  try {
    const dir = path.dirname(STATS_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2))
  } catch (e) {
    console.error('Erreur sauvegarde stats:', e.message)
  }
}

/**
 * Incrémente le compteur de messages
 */
export function trackMessage() {
  stats.messagesReceived++
}

/**
 * Incrémente le compteur de commandes
 */
export function trackCommand(cmdName) {
  stats.commandsExecuted++
  stats.commandUsage[cmdName] = (stats.commandUsage[cmdName] || 0) + 1
  saveStats()
}

/**
 * Incrémente le compteur d'erreurs
 */
export function trackError() {
  stats.errors++
  saveStats()
}

/**
 * Récupère les stats actuelles
 */
export function getStats() {
  return {
    ...stats,
    uptime: Date.now() - stats.startTime
  }
}

// Chargement initial
loadStats()
setInterval(saveStats, 60000) // Sauvegarde auto toutes les minutes
