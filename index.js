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
import readline from 'readline'
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
import { initAntiDelete, handleRevoke } from './handlers/antiDeleteHandler.js'
import { initAutoPing } from './utils/autoPing.js'
import { isAdminOnly } from './config/adminOnly.js'
import { handleAutoReact } from './utils/autoReact.js'

// --- constantes & chemins ---
const __dirname = process.cwd()
const authDir = path.join(__dirname, 'auth_info')
const cmdDir = path.join(__dirname, 'commands')
const LOGIN_METHOD = (process.env.LOGIN_METHOD || 'ask').toLowerCase()
const loginModeFile = path.join(authDir, '.login_mode')
function readSavedLoginMode() {
  try {
    if (fs.existsSync(loginModeFile)) {
      const value = fs.readFileSync(loginModeFile, 'utf8').trim().toLowerCase()
      if (value === 'qr' || value === 'code') return value
    }
  } catch { }
  return null
}
function persistLoginMode(mode) {
  try {
    if (mode === 'qr' || mode === 'code') {
      if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true })
      fs.writeFileSync(loginModeFile, mode)
    }
  } catch { }
}
let chosenLoginMode = readSavedLoginMode() || LOGIN_METHOD

// --- helpers ---
const sleep = (ms) => new Promise(res => setTimeout(res, ms))
const rand = (n) => Math.floor(Math.random() * n)
function promptInput(q) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(q, ans => { rl.close(); resolve(ans) })
  })
}

// --- Serveur Web & Keep-Alive ---
const app = express()
const PORT = process.env.PORT || 3000
let lastQR = null
let lastPairCode = null

app.get('/', (req, res) => res.send('Erwin-Bot is running!'))
app.get('/qr', (req, res) => {
  if (lastQR) {
    res.setHeader('Content-Type', 'image/png')
    qrcode.toBuffer(lastQR, (err, buffer) => {
      if (err) res.status(500).send('Error generating QR')
      else res.send(buffer)
    })
  } else {
    res.send('QR Code non généré ou déjà scanné.')
  }
})
app.get('/pair', (req, res) => res.send(lastPairCode ? `Code de jumelage : ${lastPairCode}` : 'Code non généré.'))

app.listen(PORT, () => console.log(chalk.green(`🌐 Serveur Web actif sur le port ${PORT}`)))

function startKeepAlive() {
  const url = process.env.RENDER_EXTERNAL_URL || process.env.RENDER_URL
  if (!url) return
  setInterval(async () => {
    try {
      await axios.get(url)
      console.log(chalk.gray('⚓ Keep-alive ping success'))
    } catch (e) {
      console.error('⚓ Keep-alive ping failed:', e.message)
    }
  }, 3 * 60 * 1000) // 3 minutes
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
async function chooseLoginMode() {
  console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log(chalk.yellow('🔐 Méthode de connexion WhatsApp'))
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log(chalk.gray('1. qr   - Connexion par QR Code (rapide)'))
  console.log(chalk.gray('2. code - Connexion par code à 8 chiffres'))
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'))

  const ans = (await promptInput('Choisis ta méthode (qr/code) [qr]: ')).trim().toLowerCase()

  if (ans === 'code') {
    console.log(chalk.green('✅ Méthode sélectionnée: CODE DE LIAISON'))
    return 'code'
  } else {
    console.log(chalk.green('✅ Méthode sélectionnée: QR CODE'))
    return 'qr'
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
      // Decide login mode BEFORE creating socket to avoid missing early QR events
      let loginMode = chosenLoginMode
      const isRegistered = !!state?.creds?.registered
      if (!isRegistered) {
        if (loginMode === 'ask' || (loginMode !== 'qr' && loginMode !== 'code')) {
          loginMode = await chooseLoginMode()
        }
        chosenLoginMode = loginMode
      } else if (loginMode !== 'qr') {
        loginMode = 'qr'
        chosenLoginMode = loginMode
      }

      if (chosenLoginMode !== loginMode) {
        chosenLoginMode = loginMode
      }

      if (chosenLoginMode === 'qr' || chosenLoginMode === 'code') {
        persistLoginMode(chosenLoginMode)
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
          // Optimisation: récupération rapide des messages
          return { conversation: '' }
        },
        shouldIgnoreJid: (jid) => {
          // Ignorer les statuts pour réduire la charge
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
        if (qr && loginMode !== 'code') {
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
                console.log(chalk.gray('   • Relance le bot et essaie avec le code de liaison'))
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

          startKeepAlive()

          console.log(chalk.green('\n' + '═'.repeat(60)))
          console.log(chalk.green.bold('✅ CONNEXION RÉUSSIE!'))
          console.log(chalk.green('═'.repeat(60)))
          console.log(chalk.cyan(`\n📱 Bot connecté à WhatsApp`))
          console.log(chalk.gray(`🤖 Numéro: ${sock.user?.id?.split(':')[0] || 'inconnu'}`))
          console.log(chalk.gray(`👤 Nom: ${sock.user?.name || 'Erwin-Bot'}`))

          // Démarrer le monitoring de sécurité
          console.log(chalk.blue('\n🛡️ Démarrage du système de sécurité anti-ban...'))
          startHealthMonitoring(60000) // Monitoring toutes les minutes
          console.log(chalk.green('✅ Protections anti-ban activées (mode souple)'))
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
            chosenLoginMode = readSavedLoginMode() || LOGIN_METHOD
            await start()
            return
          }
          reconnectAttempts++
          creating = false
          chosenLoginMode = readSavedLoginMode() || chosenLoginMode || LOGIN_METHOD
          await createSocket()
        }
      })

      // --- Pairing code support ---
      if (!state.creds.registered && loginMode === 'code') {
        const phoneNumber = await promptInput(chalk.cyan('📱 Entre ton numéro (ex: 237xxxxxx) : '))
        setTimeout(async () => {
          try {
            const code = await sock.requestPairingCode(phoneNumber.replace(/[+-\s]/g, ''))
            lastPairCode = code
            console.log(chalk.white.bold('\n🔑 TON CODE DE JUMELAGE : ') + chalk.yellow.bold(code))
            console.log(chalk.gray('🔗 Utilise ce code sur ton téléphone (Appareils liés > Lier avec le numéro de téléphone)\n'))
          } catch (e) {
            console.error('❌ Erreur génération code pairing:', e.message)
          }
        }, 3000)
      } else if (!state.creds.registered) {
        console.log('📱 Connexion par QR code (pairing code désactivé)')
      }

      // --- Gestion optimisée des messages ---
      console.log('✅ Bot connecté et en attente de messages...')

      // Afficher toutes les commandes chargées
      console.log('📋 Commandes chargées:', [...commands.keys()].join(', '))

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
        console.log('🔍 Vérification du préfixe pour:', text, '(préfixe attendu:', prefix + ')')
        if (!text.startsWith(prefix)) {
          console.log(`❌ Le message ne commence pas par le préfixe ${prefix}`)
          return
        }

        // Extraire la commande et les arguments
        const [cmdRaw, ...args] = text.slice(prefix.length).trim().split(/\s+/)
        const cmd = cmdRaw.toLowerCase()

        // Vérifier si la commande existe
        console.log(`🔎 Recherche de la commande: ${cmd}`)
        const commandFunc = commands.get(cmd)
        if (!commandFunc) {
          console.log(`❌ Commande inconnue: ${cmd}`)
          // Ignorer silencieusement les commandes inconnues
          return
        }
        console.log(`✅ Commande trouvée: ${cmd}`)

        // Vérifier si le mode admin-only est activé
        if (isAdminOnly() && !(isAdmin(sender) || isOwner(sender))) {
          // Ne rien faire, ignorer simplement la commande
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

      // --- antidelete : écoute des messages supprimés ---
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

      // Gestion des erreurs non capturées
      process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      });

      process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
      });

      // --- Gestion optimisée des événements de groupe ---
      sock.ev.on('group-participants.update', async (update) => {
        try {
          const { id, participants, action } = update
          if (!id || !participants?.length) return

          // Récupération en parallèle des paramètres et métadonnées
          const [settings, groupMetadata] = await Promise.all([
            getGroupSettings(id),
            getGroupMetadataCached(sock, id)
          ])

          const groupName = groupMetadata?.subject || 'ce groupe'
          const now = Date.now()

          // Traitement des arrivées et départs en parallèle
          const messagePromises = []

          // Gestion des messages de bienvenue
          if (action === 'add' && settings.welcome) {
            for (const participant of participants) {
              const text = settings.welcome
                .replace(/{user}/g, `@${participant.split('@')[0]}`)
                .replace(/{group}/g, groupName)

              messagePromises.push(
                secureMessageSend(sock, id, {
                  text: `👋 ${text}`,
                  mentions: [participant],
                  delay: 100 // Petit délai entre les messages
                }).catch(console.error)
              )
            }
          }

          // Gestion des messages d'au revoir
          if (action === 'remove' && settings.goodbye) {
            for (const participant of participants) {
              const text = settings.goodbye
                .replace(/{user}/g, `@${participant.split('@')[0]}`)
                .replace(/{group}/g, groupName)

              messagePromises.push(
                secureMessageSend(sock, id, {
                  text: `👋 ${text}`,
                  mentions: [participant],
                  delay: 100 // Petit délai entre les messages
                }).catch(console.error)
              )
            }
          }

          // Antibot
          if (action === 'add' && settings.antibot) {
            const groupMetadata = await getGroupMetadataCached(sock, id)

            for (const participant of participants) {
              // Vérifier si c'est un bot (JID commence par un préfixe spécifique)
              // Baileys et autres bots ont souvent des JIDs qui ne sont pas des numéros purs
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

          // Exécution en parallèle de tous les envois de messages
          if (messagePromises.length > 0) {
            await Promise.all(messagePromises)
          }

        } catch (e) {
          console.error('Erreur group-participants.update:', e)
        }
      })

      creating = false
      reconnectAttempts = 0
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