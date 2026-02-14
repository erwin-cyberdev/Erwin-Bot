// index.js — Erwin-Bot : QR ONLY + PAGE WEB
import dotenv from 'dotenv'
dotenv.config()

import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} from '@whiskeysockets/baileys'

import fs from 'fs'
import path from 'path'
import https from 'https'
import chalk from 'chalk'
import figlet from 'figlet'
import P from 'pino'
import { pathToFileURL } from 'url'
import fetch from 'node-fetch'
import { cache } from './utils/cache.js'
import express from 'express'

// 🌐 TERMINAL QR
// (Web logic removed for Render stability)

// --- utils sécurisés ---
import { getPrefix } from './utils/prefixManager.js'
import { sendText, attachSendWrapper } from './utils/messageQueue.js'
import { initAntiDelete } from './handlers/antiDeleteHandler.js'
import { initAutoPing } from './utils/autoPing.js'
import { startHealthMonitoring } from './utils/botSecurity.js'

// --- constantes ---
const __dirname = process.cwd()
const authDir = path.join(__dirname, 'auth_info')
const cmdDir = path.join(__dirname, 'commands')

// --- état QR ---
let isConnected = false

// --- serveur web (Requis pour Render) ---
const app = express()
const PORT = process.env.PORT || 3000

app.get('/', (req, res) => {
  res.send('🤖 Erwin-Bot is running!')
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌍 Server listening on port ${PORT}`)
})



const sleep = (ms) => new Promise(res => setTimeout(res, ms))

function header() {
  console.clear()
  console.log(chalk.cyan(figlet.textSync('Erwin-Bot', { horizontalLayout: 'full' })))
  console.log(chalk.gray('by ') + chalk.magenta('FUDJING Manuel Erwin'))
  console.log(chalk.gray('────────────────────────────────────────────'))
}

// --- réseau ---
function checkNetworkTimeout(url = 'https://web.whatsapp.com', timeout = 3000) {
  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      res.resume()
      resolve({ ok: true })
    })
    req.on('error', () => resolve({ ok: false }))
    req.setTimeout(timeout, () => {
      req.destroy()
      resolve({ ok: false })
    })
  })
}

// --- keep-alive ---
function startKeepAlive() {
  const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`
  console.log(`📡 Keep-Alive activé sur: ${url}`)

  setInterval(async () => {
    try {
      const res = await fetch(url)
      if (res.ok) console.log(`📡 Keep-Alive ping OK (${res.status})`)
      else console.log(`⚠️ Keep-Alive ping error: ${res.status}`)
    } catch (e) {
      console.log(`⚠️ Keep-Alive ping failed: ${e.message}`)
    }
  }, 14 * 60 * 1000) // 14 minutes (Render sleep = 15min)
}

// --- loader commandes ---
async function loadCommands() {
  const map = new Map()
  if (!fs.existsSync(cmdDir)) fs.mkdirSync(cmdDir, { recursive: true })

  for (const f of fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'))) {
    const mod = await import(pathToFileURL(path.join(cmdDir, f)).href)
    if (mod?.default) map.set(f.replace('.js', ''), mod.default)
  }
  return map
}

// --- reply ---
function reply(sock, jid, msg, text) {
  return sendText(sock, jid, text, { quoted: msg })
}

// --- START ---
async function start() {
  header()

  /* original code */
  const net = await checkNetworkTimeout()
  console.log(net.ok ? '🌐 Réseau OK' : '⚠️ Réseau KO')

  startKeepAlive()

  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true })

  const { version } = await fetchLatestBaileysVersion()
  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  const commands = await loadCommands()
  const logger = P({ level: 'silent' })

  async function createSocket() {
    const sock = makeWASocket({
      logger,
      auth: state,
      version,
      printQRInTerminal: true,
      browser: ['Erwin-Bot', 'Chrome', '121'],
      markOnlineOnConnect: true,
      syncFullHistory: false,
      getMessage: async () => ({ conversation: '' })
    })

    attachSendWrapper(sock)
    initAntiDelete(sock)
    initAutoPing(sock)

    // 🔁 AUTO-PING toutes les 5 minutes (anti-sleep / keep-alive)
    setInterval(() => {
      if (!isConnected) return

      try {
        // ping léger vers WhatsApp (soi-même)
        sock.sendPresenceUpdate('available')
        console.log('💓 Auto-ping envoyé (5 min)')
      } catch (e) {
        console.log('⚠️ Auto-ping échoué')
      }
    }, 1 * 60 * 1000)

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (upd) => {
      const { connection, lastDisconnect, qr } = upd

      // 📲 QR TERMINAL (géré par printQRInTerminal: true)
      if (qr && !state.creds.registered) {
        console.log('📲 QR généré (voir terminal/logs)')
      }

      if (connection === 'open') {
        isConnected = true
        console.log('✅ WhatsApp connecté')
        startHealthMonitoring(60000)
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut
        isConnected = false
        console.log('❌ Déconnecté', shouldReconnect ? ', reconnexion…' : ', session terminée.')
        if (shouldReconnect) createSocket()
      }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages?.[0]
      if (!msg?.message) return

      const from = msg.key.remoteJid
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        ''

      if (!text.startsWith(getPrefix())) return

      const [cmd, ...args] = text.slice(getPrefix().length).trim().split(/\s+/)
      const fn = commands.get(cmd.toLowerCase())
      if (!fn) return

      try {
        await fn(sock, msg, args)
      } catch {
        reply(sock, from, msg, '⚠️ Erreur commande')
      }
    })
  }

  createSocket()
}

start().catch(console.error)