// utils/permissions.js — Système de rôles OWNER / ADMIN sécurisé
import fs from 'fs'
import path from 'path'

const dataDir = path.join(process.cwd(), 'data')
const adminsFile = path.join(dataDir, 'admins.json')
const bannedFile = path.join(dataDir, 'banned.json')
const auditLogFile = path.join(dataDir, 'audit.log')

// Créer le dossier data s'il n'existe pas
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// Initialiser les fichiers s'ils n'existent pas
if (!fs.existsSync(adminsFile)) {
  fs.writeFileSync(adminsFile, JSON.stringify([], null, 2))
}
if (!fs.existsSync(bannedFile)) {
  fs.writeFileSync(bannedFile, JSON.stringify([], null, 2))
}

// ============ OWNER_IDS (fixe, depuis .env ou fallback hardcodé) ============
const OWNER_IDS = (() => {
  const envVal = process.env.OWNER_IDS
  if (envVal && envVal.trim()) {
    return envVal.split(',').map(id => id.trim()).filter(Boolean)
  }
  // Fallback hardcodé — les numéros propriétaires
  return ['237674151474', '237679137132', '78529702158422']
})()

console.log(`🔐 OWNER_IDS chargés: ${OWNER_IDS.join(', ')}`)

// ============ HELPERS ============

function readJSON(file) {
  try {
    const data = fs.readFileSync(file, 'utf8')
    return JSON.parse(data)
  } catch (e) {
    return []
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2))
    return true
  } catch (e) {
    console.error(`Erreur écriture ${file}:`, e)
    return false
  }
}

/**
 * Normalise un JID WhatsApp : extrait le numéro de téléphone pur.
 * Ex: "237674151474:12@s.whatsapp.net" → "237674151474"
 */
function normalizeJid(jid) {
  if (!jid) return ''
  const beforeAt = jid.split('@')[0]
  return beforeAt.split(':')[0]
}

/**
 * Vérifie qu'un JID est un JID utilisateur valide (pas un groupe).
 * Les JIDs de groupe se terminent par @g.us ou ont > 15 chiffres.
 */
function isValidUserJid(jid) {
  if (!jid) return false
  if (jid.includes('@g.us')) return false
  const num = normalizeJid(jid)
  // Un numéro de téléphone WhatsApp valide fait entre 7 et 15 chiffres
  return /^\d{7,15}$/.test(num)
}

/**
 * Enregistre une action sensible dans le journal d'audit.
 */
function auditLog(action, actor, target = null, details = '') {
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] ${action} | actor=${normalizeJid(actor)} | target=${target ? normalizeJid(target) : 'N/A'} | ${details}\n`
  try {
    fs.appendFileSync(auditLogFile, line)
  } catch (e) {
    console.error('Erreur écriture audit log:', e)
  }
  console.log(`📋 AUDIT: ${line.trim()}`)
}

// ============ OWNER ============

export function getOwners() {
  return [...OWNER_IDS]
}

export function isOwner(jid) {
  if (!jid) return false
  const normalized = normalizeJid(jid)
  return OWNER_IDS.some(owner => normalizeJid(owner) === normalized)
}

// ============ ADMINS ============

export function getAdmins() {
  return readJSON(adminsFile)
}

export function isAdmin(jid) {
  if (!jid) return false
  // Les owners sont automatiquement admins
  if (isOwner(jid)) return true
  const admins = getAdmins()
  const normalized = normalizeJid(jid)
  return admins.some(a => normalizeJid(a) === normalized)
}

export function addAdmin(jid, actor = 'system') {
  if (!jid) return false
  // Validation : seuls les JIDs utilisateur valides
  if (!isValidUserJid(jid)) {
    console.warn(`⚠️ Tentative d'ajout d'un JID invalide comme admin: ${jid}`)
    return false
  }
  const normalized = normalizeJid(jid)
  const admins = getAdmins()
  if (admins.some(a => normalizeJid(a) === normalized)) return false // déjà admin
  admins.push(`${normalized}@s.whatsapp.net`)
  const success = writeJSON(adminsFile, admins)
  if (success) {
    auditLog('ADD_ADMIN', actor, jid, `Admin ajouté avec succès`)
  }
  return success
}

export function removeAdmin(jid, actor = 'system') {
  if (!jid) return false
  const normalized = normalizeJid(jid)
  // Empêcher la suppression d'un owner de la liste admin
  if (isOwner(jid)) {
    console.warn(`⚠️ Tentative de retirer un OWNER de la liste admin: ${jid}`)
    return false
  }
  let admins = getAdmins()
  const before = admins.length
  admins = admins.filter(a => normalizeJid(a) !== normalized)
  if (admins.length === before) return false // n'était pas admin
  const success = writeJSON(adminsFile, admins)
  if (success) {
    auditLog('REMOVE_ADMIN', actor, jid, `Admin retiré avec succès`)
  }
  return success
}

// ============ BANNED ============

export function getBanned() {
  return readJSON(bannedFile)
}

export function isBanned(jid) {
  if (!jid) return false
  // Les owners ne peuvent JAMAIS être bannis
  if (isOwner(jid)) return false
  const banned = getBanned()
  return banned.some(b => normalizeJid(b) === normalizeJid(jid))
}

export function banUser(jid, actor = 'system') {
  if (!jid) return false
  // Impossible de bannir un owner
  if (isOwner(jid)) {
    console.warn(`⚠️ Tentative de bannir un OWNER: ${jid}`)
    return false
  }
  const normalized = normalizeJid(jid)
  const banned = getBanned()
  if (banned.some(b => normalizeJid(b) === normalized)) return false // déjà banni
  banned.push(`${normalized}@s.whatsapp.net`)
  const success = writeJSON(bannedFile, banned)
  if (success) {
    auditLog('BAN_USER', actor, jid, `Utilisateur banni`)
  }
  return success
}

export function unbanUser(jid, actor = 'system') {
  if (!jid) return false
  const normalized = normalizeJid(jid)
  let banned = getBanned()
  const before = banned.length
  banned = banned.filter(b => normalizeJid(b) !== normalized)
  if (banned.length === before) return false // n'était pas banni
  const success = writeJSON(bannedFile, banned)
  if (success) {
    auditLog('UNBAN_USER', actor, jid, `Utilisateur débanni`)
  }
  return success
}

// ============ DÉCORATEURS DE PERMISSIONS ============

/**
 * Wraps un handler de commande pour le restreindre aux OWNERS uniquement.
 * Usage: export default ownerOnly(async (sock, msg, args) => { ... })
 */
export function ownerOnly(handler) {
  return async function (sock, msg, args) {
    const sender = msg.key.participant || msg.key.remoteJid
    if (!isOwner(sender)) {
      const from = msg.key.remoteJid
      return await sock.sendMessage(from, {
        text: '⛔ Cette commande est réservée aux *propriétaires* du bot.'
      }, { quoted: msg })
    }
    return handler(sock, msg, args)
  }
}

/**
 * Wraps un handler de commande pour le restreindre aux ADMINS (et OWNERS).
 * Usage: export default adminRequired(async (sock, msg, args) => { ... })
 */
export function adminRequired(handler) {
  return async function (sock, msg, args) {
    const sender = msg.key.participant || msg.key.remoteJid
    if (!isAdmin(sender)) {
      const from = msg.key.remoteJid
      return await sock.sendMessage(from, {
        text: '⛔ Cette commande est réservée aux *administrateurs* du bot.'
      }, { quoted: msg })
    }
    return handler(sock, msg, args)
  }
}

// ============ MIDDLEWARE HELPERS ============

export function requireOwner(jid) {
  return isOwner(jid)
}

export function requireAdmin(jid) {
  return isAdmin(jid)
}

export function checkBanned(jid) {
  return !isBanned(jid)
}

// ============ NETTOYAGE INITIAL ============

/**
 * Nettoie admins.json au démarrage : retire les JIDs invalides (groupes, etc.)
 */
function cleanAdminsOnStartup() {
  const admins = getAdmins()
  const before = admins.length
  const cleaned = admins.filter(jid => isValidUserJid(jid))
  if (cleaned.length < before) {
    writeJSON(adminsFile, cleaned)
    console.log(`🧹 admins.json nettoyé: ${before - cleaned.length} entrée(s) invalide(s) retirée(s)`)
    auditLog('CLEANUP_ADMINS', 'system', null, `${before - cleaned.length} entrées invalides retirées`)
  }
}

cleanAdminsOnStartup()
