// index.js — Erwin-Bot : version optimisée
import dotenv from 'dotenv'
dotenv.config()

import makeWASocket, {
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import fs from 'fs'
import path from 'path'
import https from 'https'
import chalk from 'chalk'
import figlet from 'figlet'
import P from 'pino'
import express from 'express'
import axios from 'axios'
import { pathToFileURL } from 'url'
import { cache } from './utils/cache.js'

// --- utils sécurisés ---
import { canSend, recordSend } from './utils/rateLimiter.js'
import { isBanned, isAdmin, isOwner } from './utils/permissions.js'
import { getGroupSettings } from './utils/groupSettings.js'
import { canUserExecuteCommand, startHealthMonitoring, secureMessageSend } from './utils/botSecurity.js'
import { getPrefix } from './utils/prefixManager.js'
import { sendText, attachSendWrapper } from './utils/messageQueue.js'
import { initAntiDelete, handleRevoke } from './handlers/antideleteHandler.js'
import { initAutoPing } from './utils/autoPing.js'
import { isAdminOnly } from './config/adminOnly.js'
import { handleAutoReact } from './utils/autoReact.js'

// --- constantes & chemins ---
const __dirname = process.cwd()
const authDir = path.join(__dirname, 'auth_info')
const cmdDir = path.join(__dirname, 'commands')

// --- helpers ---
const sleep = (ms) => new Promise(res => setTimeout(res, ms))
const rand = (n) => Math.floor(Math.random() * n)

// --- Serveur Web & Keep-Alive ---
const app = express()
const PORT = 3000
let lastQR = null

app.get('/', (req, res) => res.send('Erwin-Bot is running!'))
app.get('/health', (req, res) => res.status(200).send('OK')) // Ajout de l\'endpoint health

const RENDER_URL = process.env.RENDER_URL || ''
const BOT_NAME = 'Erwin-Bot'

app.get('/qr', (req, res) => {
  if (lastQR) {
    res.setHeader('Content-Type', 'text/html')
    const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(lastQR)}`
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Erwin-Bot QR Code</title>
          <style>
            body { background: #121212; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }
            img { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
            h1 { margin-bottom: 20px; color: #00ffcc; }
            p { margin-top: 20px; color: #888; }
          </style>
        </head>
        <body>
          <h1>📦 Erwin-Bot Connection</h1>
          <img src="${qrImage}" alt="QR Code">
          <p>Scannez ce code pour connecter le bot</p>
          <script>setTimeout(() => location.reload(), 20000);</script>
        </body>
      </html>
    `)
  } else {
    res.send('QR Code non généré ou déjà scanné. <a href="/">Retour</a>')
  }
})

app.listen(PORT, () => {
  console.log(chalk.green(`🌐 Serveur Web actif sur le port ${PORT}`))
  if (RENDER_URL) startKeepAlive()
})

function startKeepAlive() {
  const url = RENDER_URL
  if (!url) return

  // Singleton pour éviter les doublons de ping
  if (global.keepAliveStarted) return
  global.keepAliveStarted = true

  setInterval(async () => {
    try {
      await axios.get(url)
      console.log(chalk.gray('⚓ Keep-alive ping success'))
    } catch (e) {
      console.error('⚓ Keep-alive ping failed:', e.message)
    }
  }, 30 * 1000) // 30 secondes (Anti-veille Render)
  console.log(chalk.blue('⚓ Keep-alive system started'))
}

// --- Cache optimisé pour les métadonnées ---
async function getGroupMetadataCached(sock, groupJid) {
  const cacheKey = `metadata_${groupJid}`
  const cached = cache.get(cacheKey)

  if (cached) {
    return cached
  }

  const metadata = await sock.groupMetadata(groupJid)
  cache.set(cacheKey, metadata, 300000) // 5 minutes de cache
  return metadata
}

// Cache pour les vérifications d'admin
async function isAdminCached(sock, groupId, userId) {
  const cacheKey = `admin_${groupId}_${userId}`
  const cached = cache.get(cacheKey)

  if (cached !== undefined) {
    return cached
  }

  try {
    const metadata = await getGroupMetadataCached(sock, groupId)
    const isAdmin = metadata.participants.some(
      p => p.id === userId && (p.admin === 'admin' || p.admin === 'superadmin')
    )

    cache.set(cacheKey, isAdmin, 300000) // 5 minutes de cache
    return isAdmin
  } catch (e) {
    console.error('Erreur vérification admin:', e)
    return false
  }
}

// --- header console ---
function header() {
  console.clear()
  console.log(chalk.cyan(figlet.textSync('Erwin-Bot', { horizontalLayout: 'full' })))
  console.log(chalk.gray('by ') + chalk.magenta('FUDJING Manuel Erwin'))
  console.log(chalk.gray('────────────────────────────────────────────────────'))
}

// --- vérification réseau ---
function checkNetworkTimeout(url = 'https://web.whatsapp.com', timeout = 3000) {
  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      res.resume()
      resolve({ ok: true, statusCode: res.statusCode })
    })
    req.on('error', (err) => resolve({ ok: false, err: err.message }))
    req.setTimeout(timeout, () => {
      req.destroy()
      resolve({ ok: false, err: 'timeout' })
    })
  })
}

// --- loader de commandes dynamiques ---
async function loadCommands() {
  const map = new Map()
  console.log(`📂 Chemin des commandes: ${cmdDir}`)

  if (!fs.existsSync(cmdDir)) {
    console.log(`⚠️ Le répertoire des commandes n'existe pas, création...`)
    fs.mkdirSync(cmdDir, { recursive: true })
  }

  const files = fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'))
  console.log(`🔍 Fichiers trouvés dans ${cmdDir}:`, files)
  console.log(chalk.cyan(`🔍 Chargement de ${files.length} commandes...`))

  for (const f of files) {
    try {
      const mod = await import(pathToFileURL(path.join(cmdDir, f)).href)
      const def = mod?.default
      if (def) {
        const cmdName = f.replace('.js', '').toLowerCase()
        map.set(cmdName, def)
        console.log(chalk.green(`✅ Commande chargée: !${cmdName}`))
      } else {
        console.log(chalk.yellow(`⚠️ ${f} ne contient pas de "export default" valide`))
      }
    } catch (err) {
      console.error(chalk.red(`❌ Erreur lors du chargement de ${f}:`), err.message)
    }
  }

  console.log('📋 Commandes chargées avec succès:', [...map.keys()].join(', '))
  return map
}

// --- reply helper ---
function reply(sock, remoteJid, msg, text) {
  return sendText(sock, remoteJid, text, { quoted: msg })
}

// --- fonction principale ---
async function start() {
  startKeepAlive() // Démarrage immédiat du keep-alive
  header()
  const net = await checkNetworkTimeout()
  if (!net.ok) console.log(chalk.red('⚠️ Vérification réseau échouée :'), net.err)
  else console.log(chalk.green(`🌐 Réseau OK (HTTP ${net.statusCode})`))

  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true })

  let version
  try {
    const fetched = await fetchLatestBaileysVersion()
    version = fetched.version
    console.log(chalk.gray('ℹ️ Protocol version:'), version)
  } catch {
    console.log(chalk.yellow('⚠️ Impossible de récupérer la version — valeur par défaut utilisée.'))
  }

  const commands = await loadCommands()

  // Logic for Render Session Persistence
  if (!fs.existsSync(path.join(authDir, 'creds.json')) && process.env.SESSION_DATA) {
    try {
      console.log(chalk.blue('📁 Restoring session from SESSION_DATA...'))
      const decrypted = Buffer.from(process.env.SESSION_DATA, 'base64').toString('utf-8')
      fs.writeFileSync(path.join(authDir, 'creds.json'), decrypted)
      console.log(chalk.green('✅ Session restored successfully.'))
    } catch (e) {
      console.error('❌ Failed to restore session:', e.message)
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDir)
  const logger = P({ level: 'info' })
  let reconnectAttempts = 0
  let creating = false

  async function createSocket() {
    if (creating) return
    creating = true

    const delay = reconnectAttempts === 0 ? 0 : Math.min(1000 * 2 ** reconnectAttempts, 60000) + rand(500)
    if (delay > 0) {
      console.log(chalk.yellow(`⏱ tentative de reconnexion #${reconnectAttempts} dans ${delay}ms`))
      await sleep(delay)
    }

    try {
      const isRegistered = !!state?.creds?.registered
      if (!isRegistered) {
        console.log(chalk.cyan('📱 Mode QR Code activé par défaut'))
      }

      const sock = makeWASocket({
        logger,
        printQRInTerminal: false,
        auth: state,
        version,
        browser: ['Erwin-Bot', 'Chrome', '121.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,  // Keep-alive optimisé à 25s
        markOnlineOnConnect: true,
        syncFullHistory: false,
        getMessage: async (key) => {
          return { conversation: '' }
        },
        shouldIgnoreJid: (jid) => {
          return jid === 'status@broadcast'
        }
      })

      attachSendWrapper(sock)
      initAntiDelete(sock)
      initAutoPing(sock)

      sock.ev.on('creds.update', saveCreds)

      // Timer pour QR code
      let qrTimeout = null
      let qrCount = 0
      const MAX_QR_ATTEMPTS = 5

      sock.ev.on('connection.update', async (upd) => {
        const { connection, lastDisconnect, qr } = upd

        // Gestion améliorée du QR code
        if (qr) {
          lastQR = qr
          qrCount++

          // Nettoyer l'ancien timeout
          if (qrTimeout) clearTimeout(qrTimeout)

          console.log(chalk.cyan('\n' + '═'.repeat(60)))
          console.log(chalk.green.bold(`\n📱 QR CODE WHATSAPP (${qrCount}/${MAX_QR_ATTEMPTS})`))
          console.log(chalk.cyan('═'.repeat(60) + '\n'))

          // Afficher le QR code en GRAND pour être bien visible
          qrcode.generate(qr, { small: false })

          console.log(chalk.cyan('\n' + '═'.repeat(60)))
          console.log(chalk.yellow.bold('\n📝 INSTRUCTIONS:'))
          console.log(chalk.gray('   1️⃣  Ouvre WhatsApp sur ton téléphone'))
          console.log(chalk.gray('   2️⃣  Va dans: Paramètres (⋮) > Appareils liés'))
          console.log(chalk.gray('   3️⃣  Appuie sur "Lier un appareil"'))
          console.log(chalk.gray('   4️⃣  Pointe ton téléphone vers ce QR code'))
          console.log(chalk.gray('   5️⃣  Le bot se connectera automatiquement\n'))

          console.log(chalk.yellow('⏰ Ce QR code expire dans 60 secondes'))
          console.log(chalk.gray('   Un nouveau sera généré automatiquement si besoin\n'))
          console.log(chalk.cyan('═'.repeat(60) + '\n'))

          // Timer d'expiration du QR (60s)
          qrTimeout = setTimeout(() => {
            if (!state.creds.registered) {
              console.log(chalk.yellow('\n⏱️  QR code expiré. Génération d\'un nouveau...'))
              lastQR = null
              if (qrCount >= MAX_QR_ATTEMPTS) {
                console.log(chalk.red('\n❌ Nombre maximum de tentatives atteint.'))
                console.log(chalk.yellow('💡 Conseils:'))
                console.log(chalk.gray('   • Vérifie ta connexion internet'))
                console.log(chalk.gray('   • Relance le bot'))
                console.log(chalk.gray('   • Assure-toi que WhatsApp fonctionne sur ton téléphone\n'))
              }
            }
          }, 60000)
        }
        if (connection === 'open') {
          reconnectAttempts = 0
          qrCount = 0  // Reset compteur QR
          lastQR = null
          if (qrTimeout) clearTimeout(qrTimeout)  // Nettoyer timeout

          // Démarrer le monitoring de sécurité
          console.log(chalk.green.bold('✅ CONNEXION RÉUSSIE!'))
          console.log(chalk.green('═'.repeat(60)))
          console.log(chalk.cyan(`\n📱 Bot connecté à WhatsApp`))
          console.log(chalk.gray(`🤖 Numéro: ${sock.user?.id?.split(':')[0] || 'inconnu'}`))
          console.log(chalk.gray(`👤 Nom: ${sock.user?.name || 'Erwin-Bot'}`))

          // Démarrer le monitoring de sécurité
          console.log(chalk.blue('\n🛡️ Démarrage du système de sécurité anti-ban...'))
          startHealthMonitoring(60000) // Monitoring toutes les minutes
          console.log(chalk.green('✅ Protections anti-ban activées (mode souple)'))

          // Générer le SESSION_DATA pour Render (Persistence)
          try {
            const creds = JSON.parse(fs.readFileSync(path.join(authDir, 'creds.json'), 'utf-8'))
            const sessionData = Buffer.from(JSON.stringify(creds)).toString('base64')
            console.log(chalk.magenta('\n🔑 SESSION_DATA (Copie ceci pour Render) :'))
            console.log(chalk.gray(sessionData))
            console.log(chalk.yellow('\n💡 Instructions: Ajoute cette chaîne dans tes variables d\'env Render sous le nom "SESSION_DATA" pour rester connecté H24.\n'))
          } catch (e) {
            console.error('Erreur génération SESSION_DATA:', e.message)
          }
          console.log(chalk.green('\n' + '═'.repeat(60) + '\n'))
          console.log(chalk.yellow('📬 En attente de messages...\n'))
        }
        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode
          console.log(chalk.red(`❌ Connexion fermée (${statusCode || 'Unknown'})`))
          if (statusCode === 401) {
            fs.rmSync(authDir, { recursive: true, force: true })
            fs.mkdirSync(authDir, { recursive: true })
            reconnectAttempts = 0
            creating = false
            await start()
            return
          }
          reconnectAttempts++
          creating = false
          await createSocket()
        }
      })

      // Ensure creation status is reset
      creating = false
      reconnectAttempts = 0

      // --- Gestion optimisée des messages ---
      console.log('✅ Bot connecté et en attente de messages...')

      sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages?.[0]
        if (!msg || !msg.message) return

        console.log('📩 Message reçu:', {
          from: msg.key.remoteJid,
          sender: msg.key.participant || msg.key.remoteJid,
          text: msg.message.conversation || msg.message.extendedTextMessage?.text || ''
        })

        const from = msg.key.remoteJid
        const sender = msg.key.participant || msg.key.remoteJid
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''

        // Capturer le message pour l'anti-delete
        import('../handlers/antiDeleteHandler.js').then(m => m.captureMessageForAntiDelete(sock, msg)).catch(() => { })

        // Gestion des auto-réactions (non-bloquant)
        if (from.endsWith('@g.us')) {
          handleAutoReact(sock, msg, from, text).catch(() => { })
        }

        // Vérification antilink en parallèle si nécessaire
        if (from.endsWith('@g.us')) {
          const [settings, isAdmin] = await Promise.all([
            getGroupSettings(from),
            isAdminCached(sock, from, sender)
          ])

          // Vérification antilink
          if (settings.antilink && text) {
            const hasLink = /(https?:\/\/|www\.|wa\.me\/|whatsapp\.com\/)/i.test(text)
            if (hasLink && !isAdmin) {
              try {
                await Promise.all([
                  sock.sendMessage(from, { delete: msg.key }).catch(console.error),
                  sendText(sock, from, `🚫 @${sender.split('@')[0]}, les liens sont interdits dans ce groupe.`, {
                    mentions: [sender],
                    delay: 100 // Petit délai pour éviter le flood
                  })
                ])
                return
              } catch (e) {
                console.error('Erreur antilink:', e)
              }
            }
          }
        }

        // Vérifier si le message commence par le préfixe
        const prefix = getPrefix()
        if (!text.startsWith(prefix)) return

        // Extraire la commande et les arguments
        const [cmdRaw, ...args] = text.slice(prefix.length).trim().split(/\s+/)
        const cmd = cmdRaw.toLowerCase()

        // Vérifier si la commande existe
        const commandFunc = commands.get(cmd)
        if (!commandFunc) return

        // Vérifier si le mode admin-only est activé
        if (isAdminOnly() && !(isAdmin(sender) || isOwner(sender))) {
          return;
        }

        // vérif ban
        if (isBanned(sender)) {
          await sendText(sock, from, '⛔ Tu es banni du bot.', { quoted: msg })
          return
        }

        const isMediaCommand = ['sticker', 'yt', 'song', 'vision', 'wallpaper', 'movie'].includes(cmd)
        const canExecute = canUserExecuteCommand(sender, cmd, isMediaCommand)
        if (!canExecute.allowed) {
          await sendText(sock, from, canExecute.reason || '⏳ Commande limitée, réessaie plus tard.', { quoted: msg })
          return
        }

        try {
          await commandFunc(sock, msg, args)
        } catch (err) {
          console.error(`Erreur commande ${cmd}:`, err)
          await reply(sock, from, msg, `⚠️ Erreur: ${err.message}`)
        }
      })

      // --- antidelete ---
      sock.ev.on('messages.delete', async (deletion) => {
        try {
          const { keys } = deletion
          if (!keys || !keys.length) return

          for (const key of keys) {
            await handleRevoke(sock, key, key?.participant)
          }
        } catch (e) {
          console.error('Erreur antidelete:', e)
        }
      })

      // --- Gestion optimisée des événements de groupe ---
      sock.ev.on('group-participants.update', async (update) => {
        try {
          const { id, participants, action } = update
          if (!id || !participants?.length) return

          const [settings, groupMetadata] = await Promise.all([
            getGroupSettings(id),
            getGroupMetadataCached(sock, id)
          ])

          const groupName = groupMetadata?.subject || 'ce groupe'
          const messagePromises = []

          if (action === 'add' && settings.welcome) {
            for (const participant of participants) {
              const text = settings.welcome
                .replace(/{user}/g, `@${participant.split('@')[0]}`)
                .replace(/{group}/g, groupName)

              messagePromises.push(
                sock.sendMessage(id, {
                  text: text,
                  mentions: [participant]
                }).catch(console.error)
              )
            }
          }

          if (action === 'remove' && settings.goodbye) {
            for (const participant of participants) {
              const text = settings.goodbye
                .replace(/{user}/g, `@${participant.split('@')[0]}`)
                .replace(/{group}/g, groupName)

              messagePromises.push(
                sock.sendMessage(id, {
                  text: text,
                  mentions: [participant]
                }).catch(console.error)
              )
            }
          }

          if (action === 'add' && settings.antibot) {
            for (const participant of participants) {
              const isLikelyBot = !participant.startsWith('1') && !participant.startsWith('2') &&
                !participant.startsWith('3') && !participant.startsWith('4') &&
                !participant.startsWith('5') && !participant.startsWith('6') &&
                !participant.startsWith('7') && !participant.startsWith('8') &&
                !participant.startsWith('9')

              if (isLikelyBot) {
                try {
                  await sock.groupParticipantsUpdate(id, [participant], 'remove')
                  await secureMessageSend(sock, id, {
                    text: `🤖 Bot détecté et expulsé : @${participant.split('@')[0]}\n\n💡 Antibot est activé dans ce groupe.`,
                    mentions: [participant]
                  })
                } catch (e) {
                  console.error('Erreur antibot expulsion:', e)
                }
              }
            }
          }

          if (messagePromises.length > 0) {
            await Promise.all(messagePromises)
          }

        } catch (e) {
          console.error('Erreur group-participants.update:', e)
        }
      })

      return sock
    } catch (err) {
      creating = false
      reconnectAttempts++
      console.error('createSocket error', err?.message || err)
      const wait = Math.min(1000 * (2 ** reconnectAttempts), 60000) + rand(500)
      console.log(chalk.yellow(`⏱ Nouvelle tentative dans ${wait}ms`))
      await sleep(wait)
      return createSocket()
    }
  }

  try { await createSocket() }
  catch (e) { console.error('Erreur createSocket', e) }

  process.on('uncaughtException', (err) => console.error('uncaughtException', err))
  process.on('unhandledRejection', (err) => console.error('unhandledRejection', err))
}

start().catch(err => console.error('start() failed', err))