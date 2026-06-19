// index.js — Erwin-Bot
import 'dotenv/config'

import { makeWASocket, fetchLatestBaileysVersion, useMultiFileAuthState, DisconnectReason } from 'baileys'
import qrcode from 'qrcode-terminal'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import figlet from 'figlet'
import P from 'pino'
import { pathToFileURL } from 'url'

import { cache } from './utils/cache.js'
import { canUserExecuteCommand, startHealthMonitoring, secureMessageSend } from './utils/botSecurity.js'
import { ownerOnly, isOwner, isAdmin, isBanned } from './utils/permissions.js'
import { getGroupSettings } from './utils/groupSettings.js'
import { getPrefix } from './utils/prefixManager.js'
import { sendText, attachSendWrapper } from './utils/messageQueue.js'
import { initAntiDelete, handleRevoke } from './handlers/antideleteHandler.js'
import { initAutoPing } from './utils/autoPing.js'
import { isAdminOnly } from './config/adminOnly.js'
import { handleAutoReact } from './utils/autoReact.js'
import { trackCommand, trackMessage } from './utils/statsTracker.js'
import { startServer, setQR, clearQR } from './utils/webServer.js'

// ─── Constantes ─────────────────────────────────────────────────────────────
const __dirname = process.cwd()
const authDir   = path.join(__dirname, 'auth_info')
const cmdDir    = path.join(__dirname, 'commands')
const sleep     = (ms) => new Promise(r => setTimeout(r, ms))
const rand      = (n)  => Math.floor(Math.random() * n)

// ─── Serveur web (QR + stats + keep-alive) ──────────────────────────────────
startServer()

// ─── Console header ─────────────────────────────────────────────────────────
function printHeader() {
  console.clear()
  console.log(chalk.cyan(figlet.textSync('Erwin-Bot', { horizontalLayout: 'full' })))
  console.log(chalk.gray('by ') + chalk.magenta('FUDJING Manuel Erwin'))
  console.log(chalk.gray('─'.repeat(50)))
}

// ─── Chargement dynamique des commandes ──────────────────────────────────────
async function loadCommands() {
  const map = new Map()
  fs.mkdirSync(cmdDir, { recursive: true })
  const files = fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'))
  console.log(chalk.cyan(`🔍 Chargement de ${files.length} commandes...`))

  await Promise.all(files.map(async f => {
    try {
      const mod = await import(pathToFileURL(path.join(cmdDir, f)).href)
      if (mod?.default) {
        const name = f.replace('.js', '').toLowerCase()
        map.set(name, mod.default)
        console.log(chalk.green(`  ✅ !${name}`))
      }
    } catch (err) {
      console.error(chalk.red(`  ❌ ${f}:`), err.message)
    }
  }))

  console.log(chalk.gray(`📋 ${map.size} commandes prêtes.`))
  return map
}

// ─── Restauration session depuis env ─────────────────────────────────────────
function restoreSession() {
  const credsPath = path.join(authDir, 'creds.json')
  if (!process.env.SESSION_DATA || fs.existsSync(credsPath)) return

  try {
    const raw = process.env.SESSION_DATA.trim()
    const content = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8')
    fs.mkdirSync(authDir, { recursive: true })
    fs.writeFileSync(credsPath, content)
    console.log(chalk.green('✅ Session restaurée depuis SESSION_DATA.'))
  } catch (e) {
    console.error(chalk.red('❌ Restauration session échouée:'), e.message)
  }
}

// ─── Cache métadonnées groupe ─────────────────────────────────────────────────
async function getGroupMeta(sock, jid) {
  const key = `meta_${jid}`
  return cache.get(key) ?? (() => {
    const p = sock.groupMetadata(jid).then(m => { cache.set(key, m, 300_000); return m })
    return p
  })()
}

// ─── Traitement d'un message ─────────────────────────────────────────────────
async function handleMessage(sock, msg, commands) {
  if (!msg.message) return

  const from   = msg.key.remoteJid
  const sender = msg.key.participant || from
  const text   = msg.message.conversation
              || msg.message.extendedTextMessage?.text
              || msg.message.imageMessage?.caption
              || msg.message.videoMessage?.caption
              || ''

  // Logs
  const ts    = new Date().toLocaleTimeString()
  const label = from.endsWith('@g.us') ? chalk.black.bgYellow(' 👥 GRP ') : chalk.black.bgMagenta(' 👤 MP ')
  console.log(`\n${chalk.gray(`[${ts}]`)} ${label} ${chalk.green(sender.split('@')[0])} ${text ? chalk.white(text.slice(0, 80)) : chalk.gray('(media)')}`)

  trackMessage()

  // Auto-réactions groupe
  if (from.endsWith('@g.us')) handleAutoReact(sock, msg, from, text).catch(() => {})

  // Antilink groupe
  if (from.endsWith('@g.us') && text) {
    try {
      const [settings, meta] = await Promise.all([
        getGroupSettings(from),
        getGroupMeta(sock, from).catch(() => null)
      ])
      const isGrpAdmin = meta?.participants?.find(p => p.id === sender)?.admin != null
      if (settings?.antilink && !isGrpAdmin && !isAdmin(sender)) {
        if (/(https?:\/\/|www\.|wa\.me\/|whatsapp\.com\/)/i.test(text)) {
          await sock.sendMessage(from, { delete: msg.key }).catch(() => {})
          await sendText(sock, from, `🚫 @${sender.split('@')[0]}, les liens sont interdits.`, { mentions: [sender] })
          return
        }
      }
    } catch {}
  }

  // Commandes
  const prefix = getPrefix()
  if (!text.startsWith(prefix)) return

  const [cmdRaw, ...args] = text.slice(prefix.length).trim().split(/\s+/)
  const cmd = cmdRaw.toLowerCase()
  const fn  = commands.get(cmd)
  if (!fn) return

  if (isAdminOnly() && !isAdmin(sender) && !isOwner(sender)) return
  if (isBanned(sender)) { await sendText(sock, from, '⛔ Tu es banni du bot.', { quoted: msg }); return }

  const check = canUserExecuteCommand(sender, cmd, ['sticker','yt','song','vision','wallpaper','movie'].includes(cmd))
  if (!check.allowed) { await sendText(sock, from, check.reason || '⏳ Réessaie plus tard.', { quoted: msg }); return }

  trackCommand(cmd)
  await fn(sock, msg, args)
}

// ─── Fonction principale ──────────────────────────────────────────────────────
async function start() {
  printHeader()
  restoreSession()
  fs.mkdirSync(authDir, { recursive: true })

  let version
  try { ({ version } = await fetchLatestBaileysVersion()) }
  catch { console.log(chalk.yellow('⚠️ Version Baileys par défaut.')) }

  const commands = await loadCommands()
  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  const logger = P({ level: 'silent' })

  let reconnectAttempts = 0
  let creating = false

  async function createSocket() {
    if (creating) return
    creating = true

    if (reconnectAttempts > 0) {
      const wait = Math.min(1000 * 2 ** reconnectAttempts, 60_000) + rand(500)
      console.log(chalk.yellow(`⏱ Reconnexion #${reconnectAttempts} dans ${wait}ms`))
      await sleep(wait)
    }

    try {
      const sock = makeWASocket({
        logger,
        printQRInTerminal: false,
        auth: state,
        version,
        browser: ['Erwin-Bot', 'Chrome', '121.0.0'],
        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: 60_000,
        keepAliveIntervalMs: 25_000,
        markOnlineOnConnect: true,
        syncFullHistory: false,
        getMessage: async () => ({ conversation: '' }),
        shouldIgnoreJid: jid => jid === 'status@broadcast'
      })

      attachSendWrapper(sock)
      initAntiDelete(sock)
      initAutoPing(sock)
      sock.ev.on('creds.update', saveCreds)

      // QR Code
      let qrTimeout = null
      let qrCount = 0

      sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) {
          qrCount++
          if (qrTimeout) clearTimeout(qrTimeout)
          try {
            const dataUrl = await QRCode.toDataURL(qr, { errorCorrectionLevel: 'H', width: 300, margin: 1 })
            setQR(dataUrl)
          } catch {
            setQR(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`)
          }
          qrcode.generate(qr, { small: true })
          console.log(chalk.blue(`🌐 QR disponible sur /qr (tentative ${qrCount})`))
          qrTimeout = setTimeout(() => { if (!state.creds.registered) clearQR() }, 60_000)
        }

        if (connection === 'open') {
          reconnectAttempts = 0
          clearQR()
          if (qrTimeout) clearTimeout(qrTimeout)
          console.log(chalk.green.bold(`\n✅ Connecté! Numéro: ${sock.user?.id?.split(':')[0]} | Nom: ${sock.user?.name}`))
          startHealthMonitoring(60_000)
          creating = false
        }

        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode
          console.log(chalk.red(`❌ Déconnecté (code: ${code || '?'})`))
          if (code === DisconnectReason.loggedOut) {
            fs.rmSync(authDir, { recursive: true, force: true })
            fs.mkdirSync(authDir, { recursive: true })
            reconnectAttempts = 0
            creating = false
            return start()
          }
          reconnectAttempts++
          creating = false
          createSocket()
        }
      })

      // Messages
      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return
        for (const msg of messages) {
          try { await handleMessage(sock, msg, commands) }
          catch (err) { console.error('Erreur message:', err.message) }
        }
      })

      // Antidelete
      sock.ev.on('messages.delete', async ({ keys }) => {
        if (!keys?.length) return
        for (const key of keys) {
          try { await handleRevoke(sock, key, key?.participant) }
          catch {}
        }
      })

      // Événements groupe
      sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
        if (!id || !participants?.length) return
        try {
          const [settings, meta] = await Promise.all([
            getGroupSettings(id),
            sock.groupMetadata(id).catch(() => null)
          ])
          const groupName = meta?.subject || 'ce groupe'

          await Promise.all(participants.map(async p => {
            const tag = `@${p.split('@')[0]}`
            if (action === 'add' && settings.welcome) {
              await sock.sendMessage(id, {
                text: settings.welcome.replace(/{user}/g, tag).replace(/{group}/g, groupName),
                mentions: [p]
              }).catch(() => {})
            }
            if (action === 'remove' && settings.goodbye) {
              await sock.sendMessage(id, {
                text: settings.goodbye.replace(/{user}/g, tag).replace(/{group}/g, groupName),
                mentions: [p]
              }).catch(() => {})
            }
            if (action === 'add' && settings.antibot) {
              const likely = !/^[1-9]/.test(p)
              if (likely) {
                await sock.groupParticipantsUpdate(id, [p], 'remove').catch(() => {})
                await secureMessageSend(sock, id, {
                  text: `🤖 Bot expulsé: ${tag}`,
                  mentions: [p]
                }).catch(() => {})
              }
            }
          }))
        } catch (e) { console.error('Erreur group update:', e.message) }
      })

      return sock
    } catch (err) {
      creating = false
      reconnectAttempts++
      console.error('createSocket error:', err?.message || err)
      return createSocket()
    }
  }

  await createSocket()

  process.on('uncaughtException',  err => console.error('uncaughtException:', err))
  process.on('unhandledRejection', err => console.error('unhandledRejection:', err))
}

start().catch(err => console.error('start() failed:', err))
