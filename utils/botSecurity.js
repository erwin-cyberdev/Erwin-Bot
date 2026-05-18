// utils/botSecurity.js - Système de sécurité central anti-ban

import { checkCooldown, checkUserRate, canSend } from './rateLimiter.js'
import { isBlacklisted, checkCommandSpam, detectSuspiciousPattern, checkMediaSpam } from './antiSpam.js'
import { isOptedIn } from './consent.js'
import { enqueueMessage, getStats as getQueueStats } from './messageQueue.js'
import { isOwner, isAdmin } from './permissions.js'

// Statistiques globales
const securityStats = {
  totalRequests: 0,
  blockedRequests: 0,
  allowedRequests: 0,
  reasons: {}
}

/**
 * Vérifie si un utilisateur peut utiliser une commande
 */
export function canUserExecuteCommand(userId, command, isMediaCommand = false) {
  securityStats.totalRequests++

  if (isAdmin(userId)) {
    securityStats.allowedRequests++
    return { allowed: true }
  }
  
  // 1. Vérifier blacklist
  if (isBlacklisted(userId)) {
    recordBlock(userId, 'blacklisted')
    return { allowed: false, reason: '🚫 Vous êtes temporairement bloqué pour spam.' }
  }
  
  // 2. Vérifier rate limit global (MOINS STRICT)
  if (!canSend(userId, 1000, 15, 60000)) {
    recordBlock(userId, 'rate_limit')
    return { allowed: false, reason: '⏳ Ralentis ! Trop de commandes. Attends quelques secondes.' }
  }
  
  // 3. Vérifier spam de commandes
  if (!checkCommandSpam(userId, command)) {
    recordBlock(userId, 'command_spam')
    return { allowed: false, reason: '⚠️ Spam détecté. Fais une pause.' }
  }
  
  // 4. Vérifier spam de média si applicable
  if (isMediaCommand && !checkMediaSpam(userId, command)) {
    recordBlock(userId, 'media_spam')
    return { allowed: false, reason: '📊 Trop de requêtes média. Limite horaire atteinte.' }
  }
  
  // 5. Détecter patterns suspects
  detectSuspiciousPattern(userId, command)
  
  // Tout OK
  securityStats.allowedRequests++
  return { allowed: true }
}

/**
 * Enregistre un blocage
 */
function recordBlock(userId, reason) {
  securityStats.blockedRequests++
  
  if (!securityStats.reasons[reason]) {
    securityStats.reasons[reason] = 0
  }
  securityStats.reasons[reason]++
  
  console.warn(`🛡️ Requête bloquée - User: ${userId.substring(0, 15)}... - Raison: ${reason}`)
}

/**
 * Wrapper sécurisé pour envoyer des messages
 */
export async function secureMessageSend(sock, jid, content, options = {}) {
  try {
    // Utiliser la file d'attente pour tous les messages
    return await enqueueMessage(sock, jid, content, options)
  } catch (err) {
    console.error('❌ Erreur envoi sécurisé:', err.message)
    throw err
  }
}

/**
 * Obtenir statistiques de sécurité
 */
export function getSecurityStats() {
  const queueStats = getQueueStats()
  
  return {
    security: securityStats,
    queue: queueStats,
    blockRate: securityStats.totalRequests > 0 
      ? ((securityStats.blockedRequests / securityStats.totalRequests) * 100).toFixed(2) + '%'
      : '0%'
  }
}

/**
 * Réinitialiser les statistiques
 */
export function resetSecurityStats() {
  securityStats.totalRequests = 0
  securityStats.blockedRequests = 0
  securityStats.allowedRequests = 0
  securityStats.reasons = {}
  console.log('📊 Statistiques de sécurité réinitialisées')
}

/**
 * Mode prudent (active limites strictes)
 */
let cautionMode = false

export function enableCautionMode() {
  cautionMode = true
  console.log('⚠️ Mode prudent activé - Limites strictes en place')
}

export function disableCautionMode() {
  cautionMode = false
  console.log('✅ Mode prudent désactivé')
}

export function isCautionMode() {
  return cautionMode
}

/**
 * Vérifie la santé du bot (détection surcharge)
 */
export function checkBotHealth() {
  const queueStats = getQueueStats()
  const health = {
    status: 'healthy',
    warnings: [],
    critical: false
  }
  
  // Vérifier taille de la file (SEUILS AUGMENTÉS)
  if (queueStats.queueSize > 100) {
    health.status = 'warning'
    health.warnings.push('Queue size high')
  }
  
  if (queueStats.queueSize > 150) {
    health.status = 'critical'
    health.critical = true
    health.warnings.push('Queue size critical')
  }
  
  // Vérifier taux de rejet
  if (queueStats.rejected > 20) {
    health.status = 'warning'
    health.warnings.push('High rejection rate')
  }
  
  // Vérifier taux horaire (SEUIL AUGMENTÉ)
  if (queueStats.hourlyRate > 200) {
    health.status = 'warning'
    health.warnings.push('High hourly rate')
    
    if (!cautionMode) {
      enableCautionMode()
    }
  }
  
  // Vérifier taux de blocage
  const blockRate = securityStats.totalRequests > 0
    ? (securityStats.blockedRequests / securityStats.totalRequests) * 100
    : 0
  
  if (blockRate > 30) {
    health.status = 'warning'
    health.warnings.push('High block rate (possible attack)')
  }
  
  return health
}

/**
 * Monitoring automatique
 */
let monitoringInterval = null

export function startHealthMonitoring(intervalMs = 60000) {
  if (monitoringInterval) return
  
  monitoringInterval = setInterval(() => {
    const health = checkBotHealth()
    
    if (health.status === 'critical') {
      console.error('🚨 ALERTE CRITIQUE:', health.warnings.join(', '))
    } else if (health.status === 'warning') {
      console.warn('⚠️ Avertissement santé:', health.warnings.join(', '))
    }
    
    // Log stats toutes les heures
    const now = new Date()
    if (now.getMinutes() === 0) {
      console.log('📊 Stats sécurité horaires:', getSecurityStats())
    }
  }, intervalMs)
  
  console.log('🔍 Monitoring de santé démarré')
}

export function stopHealthMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval)
    monitoringInterval = null
    console.log('🔍 Monitoring de santé arrêté')
  }
}
