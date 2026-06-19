// index.js — Erwin-Bot (tout-en-un)
import 'dotenv/config'

import { makeWASocket, fetchLatestBaileysVersion, useMultiFileAuthState, DisconnectReason } from 'baileys'
import qrcode from 'qrcode-terminal'
import QRCode from 'qrcode'
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
import { canUserExecuteCommand, startHealthMonitoring, secureMessageSend } from './utils/botSecurity.js'
import { isOwner, isAdmin, isBanned } from './utils/permissions.js'
import { getGroupSettings } from './utils/groupSettings.js'
import { getPrefix } from './utils/prefixManager.js'
import { sendText, attachSendWrapper } from './utils/messageQueue.js'
import { initAntiDelete, handleRevoke } from './handlers/antideleteHandler.js'
import { initAutoPing } from './utils/autoPing.js'
import { isAdminOnly } from './config/adminOnly.js'
import { handleAutoReact } from './utils/autoReact.js'
import { trackCommand, trackMessage, getStats } from './utils/statsTracker.js'
import { getServiceStatus } from './utils/render.js'

// ─── Constantes ──────────────────────────────────────────────────────────────
const __dirname    = process.cwd()
const authDir      = path.join(__dirname, 'auth_info')
const cmdDir       = path.join(__dirname, 'commands')
const PORT         = process.env.PORT || 3000
const SERVICE_URL  = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : (process.env.RENDER_URL || process.env.RENDER_EXTERNAL_URL || '')

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const rand  = (n)  => Math.floor(Math.random() * n)

// ─── État QR partagé ─────────────────────────────────────────────────────────
let lastQR          = null   // data-url base64 de l'image QR
let lastQRTimestamp = null

// ─── Serveur Express ─────────────────────────────────────────────────────────
const app = express()

app.get('/', (_req, res) => res.send('Erwin-Bot is running!'))
app.get('/health', (_req, res) => res.status(200).send('OK'))

// --- /qr : affiche le QR code pour connecter WhatsApp ---
app.get('/qr', (req, res) => {
  const fmt = req.query.format || 'html'

  if (!lastQR) {
    if (fmt === 'json') return res.status(503).json({ error: 'QR non disponible', status: 'waiting' })
    return res.status(503).setHeader('Content-Type', 'text/html; charset=utf-8').send(`
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Erwin-Bot - QR Code</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);
  display:flex;justify-content:center;align-items:center;min-height:100vh}
.box{background:#fff;border-radius:20px;padding:40px;text-align:center;max-width:420px;width:90%}
h1{font-size:24px;margin:16px 0 8px}
.badge{background:#fff3cd;border:2px solid #ffc107;color:#856404;padding:12px;
  border-radius:10px;margin:16px 0;font-weight:600;display:flex;align-items:center;justify-content:center;gap:10px}
.spin{width:28px;height:28px;border:4px solid #f3f3f3;border-top-color:#667eea;
  border-radius:50%;animation:s 1s linear infinite}
@keyframes s{to{transform:rotate(360deg)}}
p{color:#666;margin:16px 0}
button{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;
  padding:10px 24px;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600}
</style></head>
<body><div class="box">
  <div style="font-size:60px">📦</div>
  <h1>Erwin-Bot</h1>
  <div class="badge"><div class="spin"></div>En attente du QR code...</div>
  <p>Le bot démarre, patientez quelques secondes.</p>
  <button onclick="location.reload()">🔄 Actualiser</button>
</div>
<script>setTimeout(()=>location.reload(),5000)</script>
</body></html>`)
  }

  if (fmt === 'json' || fmt === 'base64') {
    return res.json({ qrCode: lastQR, timestamp: lastQRTimestamp, status: 'active' })
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(`
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Erwin-Bot - Scanner le QR</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);
  display:flex;justify-content:center;align-items:center;min-height:100vh}
.box{background:#fff;border-radius:20px;padding:40px;text-align:center;max-width:480px;width:90%;
  animation:up .4s ease-out}
@keyframes up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
h1{font-size:28px;font-weight:700;
  background:linear-gradient(135deg,#667eea,#764ba2);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  margin:12px 0 4px}
.badge{display:inline-block;background:#10b981;color:#fff;padding:6px 18px;border-radius:50px;
  font-size:12px;font-weight:600;letter-spacing:1px;margin:12px 0}
.qr-wrap{background:#f5f7fa;padding:20px;border-radius:12px;display:inline-block;margin:16px 0}
.qr-wrap img{width:280px;height:280px;border-radius:8px;border:3px solid #667eea;display:block}
.steps{background:#f0fdf4;border:2px solid #10b981;border-radius:10px;padding:20px;
  text-align:left;margin:16px 0}
.step{display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;font-size:14px;color:#374151}
.n{background:#10b981;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;
  align-items:center;justify-content:center;font-weight:700;flex-shrink:0;font-size:12px}
.timer{color:#888;font-size:12px;margin-top:16px;border-top:1px solid #e5e7eb;padding-top:12px}
</style></head>
<body><div class="box">
  <div style="font-size:64px">📱</div>
  <h1>Erwin-Bot</h1>
  <p style="color:#666;font-size:14px">Scan &amp; Connect</p>
  <div class="badge">🟢 QR CODE PRÊT</div>
  <div class="qr-wrap"><img src="${lastQR}" alt="QR Code WhatsApp"></div>
  <div class="steps">
    <div style="font-weight:700;color:#047857;margin-bottom:12px">📋 Instructions</div>
    <div class="step"><div class="n">1</div><span>Ouvrez <strong>WhatsApp</strong> sur votre téléphone</span></div>
    <div class="step"><div class="n">2</div><span>Allez dans <strong>Paramètres (⋮)</strong></span></div>
    <div class="step"><div class="n">3</div><span>Sélectionnez <strong>Appareils liés</strong></span></div>
    <div class="step"><div class="n">4</div><span>Appuyez sur <strong>Lier un appareil</strong></span></div>
    <div class="step"><div class="n">5</div><span>Pointez votre téléphone vers ce <strong>QR code</strong></span></div>
  </div>
  <div class="timer">⏱️ Généré le : <strong id="ts"></strong> — se rafraîchit dans 60s</div>
</div>
<script>
document.getElementById('ts').textContent = new Date().toLocaleString('fr-FR',{
  hour:'2-digit',minute:'2-digit',second:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'
});
setTimeout(()=>location.reload(), 60000);
</script>
</body></html>`)
})

// --- /stats : tableau de bord ---
app.get('/stats', async (_req, res) => {
  const stats = getStats()
  let renderInfo = {}
  try { renderInfo = await getServiceStatus() } catch {}

  const uptime  = (stats.uptime / 3_600_000).toFixed(2) + 'h'
  const mem     = (process.memoryUsage().rss / 1_048_576).toFixed(2) + ' MB'
  const topCmds = Object.entries(stats.commandUsage || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([c, n]) => `<div class="usage-item"><span>!${c}</span><strong>${n}</strong></div>`)
    .join('') || '<p style="color:#94a3b8">Aucune commande tracée</p>'

  res.setHeader('Content-Type', 'text/html')
  res.send(`
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Erwin-Bot Dashboard</title>
<style>
:root{--p:#00ffcc;--bg:#0f172a;--card:#1e293b;--t:#f8fafc}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--t);font-family:system-ui,sans-serif;padding:1.5rem}
h1{font-size:2rem;color:var(--p);text-shadow:0 0 20px rgba(0,255,204,.3)}
.header{text-align:center;margin-bottom:2rem}.header p{color:#94a3b8;margin-top:.4rem}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.5rem;max-width:1100px;margin:0 auto}
.card{background:var(--card);border-radius:1.2rem;padding:1.5rem;border:1px solid rgba(255,255,255,.05)}
.label{font-size:.8rem;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:.4rem}
.val{font-size:2rem;font-weight:800;margin-top:.2rem}
.dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:6px;
  background:#22c55e;box-shadow:0 0 8px #22c55e}
.usage-item{display:flex;justify-content:space-between;padding:.4rem 0;
  border-bottom:1px solid rgba(255,255,255,.05);font-size:.9rem}
footer{text-align:center;margin-top:2rem;color:#64748b;font-size:.85rem}
footer a{color:var(--p);text-decoration:none}
</style></head>
<body>
<div class="header"><h1>📊 Erwin-Bot Dashboard</h1><p>Statistiques en temps réel</p></div>
<div class="grid">
  <div class="card"><div class="label">Statut</div>
    <div class="val"><span class="dot"></span>Actif</div>
    <p style="color:#94a3b8;margin-top:.4rem;font-size:.9rem">Uptime: ${uptime}</p>
  </div>
  <div class="card"><div class="label">Messages reçus</div><div class="val">${stats.messagesReceived}</div></div>
  <div class="card"><div class="label">Commandes exécutées</div><div class="val">${stats.commandsExecuted}</div></div>
  <div class="card"><div class="label">RAM (RSS)</div><div class="val">${mem}</div></div>
  <div class="card" style="grid-column:1/-1">
    <div class="label">Top commandes</div>
    <div style="margin-top:.8rem">${topCmds}</div>
  </div>
  <div class="card">
    <div class="label">Render</div>
    <p style="margin-top:.4rem;font-size:.9rem">Service : <strong>${renderInfo.name || 'N/A'}</strong></p>
    <p style="font-size:.9rem">Status : <span style="color:${renderInfo.status==='live'?'#22c55e':'#ef4444'};font-weight:700">
      ${(renderInfo.status || 'offline').toUpperCase()}</span></p>
  </div>
</div>
<footer><a href="/qr">Voir QR Code</a> · Erwin-Bot © 2026</footer>
</body></html>`)
})

// --- Démarrage serveur + keep-alive ---
app.listen(PORT, () => {
  console.log(chalk.green(`🌐 Serveur web actif sur le port ${PORT}`))
  if (SERVICE_URL) startKeepAlive()
})

function startKeepAlive() {
  if (global.keepAliveStarted) return
  global.keepAliveStarted = true
  setInterval(async () => {
    try { await axios.get(SERVICE_URL); console.log(chalk.gray('⚓ keep-alive OK')) }
    catch (e) { console.error('⚓ keep-alive fail:', e.message) }
  }, 30_000)
  console.log(chalk.blue(`⚓ Keep-alive démarré: ${SERVICE_URL}`))
}

// ─── Cache métadonnées groupe ─────────────────────────────────────────────────
async function getGroupMeta(sock, jid) {
  const key = `meta_${jid}`
  const hit = cache.get(key)
  if (hit) return hit
  const meta = await sock.groupMetadata(jid)
  cache.set(key, meta, 300_000)
  return meta
}

// ─── Console header ───────────────────────────────────────────────────────────
function printHeader() {
  console.clear()
  console.log(chalk.cyan(figlet.textSync('Erwin-Bot', { horizontalLayout: 'full' })))
  console.log(chalk.gray('by ') + chalk.magenta('FUDJING Manuel Erwin'))
  console.log(chalk.gray('─'.repeat(50)))
}

// ─── Chargement des commandes ─────────────────────────────────────────────────
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
    const raw     = process.env.SESSION_DATA.trim()
    const content = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8')
    fs.mkdirSync(authDir, { recursive: true })
    fs.writeFileSync(credsPath, content)
    console.log(chalk.green('✅ Session restaurée depuis SESSION_DATA.'))
  } catch (e) {
    console.error(chalk.red('❌ Restauration session échouée:'), e.message)
  }
}

// ─── Traitement des messages ──────────────────────────────────────────────────
async function handleMessage(sock, msg, commands) {
  if (!msg.message) return

  const from   = msg.key.remoteJid
  const sender = msg.key.participant || from
  const text   = msg.message.conversation
              || msg.message.extendedTextMessage?.text
              || msg.message.imageMessage?.caption
              || msg.message.videoMessage?.caption
              || ''

  // Log console
  const ts    = new Date().toLocaleTimeString()
  const label = from.endsWith('@g.us') ? chalk.black.bgYellow(' 👥 GRP ') : chalk.black.bgMagenta(' 👤 MP ')
  console.log(`\n${chalk.gray(`[${ts}]`)} ${label} ${chalk.green(sender.split('@')[0])} ${text ? chalk.white(text.slice(0, 80)) : chalk.gray('(media)')}`)

  trackMessage()

  // Auto-réactions groupe (non-bloquant)
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

      let qrTimeout = null
      let qrCount   = 0

      // ── Connexion / QR ────────────────────────────────────────────────────
      sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {

        // Nouveau QR code reçu → générer l'image et l'exposer sur /qr
        if (qr) {
          qrCount++
          if (qrTimeout) clearTimeout(qrTimeout)

          try {
            lastQR = await QRCode.toDataURL(qr, { errorCorrectionLevel: 'H', width: 300, margin: 1 })
          } catch {
            lastQR = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`
          }
          lastQRTimestamp = new Date()

          // Affichage terminal compact
          qrcode.generate(qr, { small: true })
          console.log(chalk.cyan(`\n📱 QR #${qrCount} généré → accédez à ${SERVICE_URL || 'http://localhost:' + PORT}/qr`))

          // Expiration au bout de 60s
          qrTimeout = setTimeout(() => {
            if (!state.creds?.registered) { lastQR = null; lastQRTimestamp = null }
          }, 60_000)
        }

        if (connection === 'open') {
          reconnectAttempts = 0
          creating = false
          lastQR = null
          if (qrTimeout) clearTimeout(qrTimeout)
          console.log(chalk.green.bold(`\n✅ Connecté ! Numéro: ${sock.user?.id?.split(':')[0]} | Nom: ${sock.user?.name}`))
          startHealthMonitoring(60_000)
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

      // ── Messages entrants ─────────────────────────────────────────────────
      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return
        for (const msg of messages) {
          try { await handleMessage(sock, msg, commands) }
          catch (err) { console.error('Erreur message:', err.message) }
        }
      })

      // ── Antidelete ────────────────────────────────────────────────────────
      sock.ev.on('messages.delete', async ({ keys }) => {
        if (!keys?.length) return
        for (const key of keys) {
          try { await handleRevoke(sock, key, key?.participant) } catch {}
        }
      })

      // ── Événements groupe (welcome / goodbye / antibot) ───────────────────
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

            if (action === 'add' && settings.antibot && !/^[1-9]/.test(p)) {
              await sock.groupParticipantsUpdate(id, [p], 'remove').catch(() => {})
              await secureMessageSend(sock, id, {
                text: `🤖 Bot expulsé : ${tag}`,
                mentions: [p]
              }).catch(() => {})
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
