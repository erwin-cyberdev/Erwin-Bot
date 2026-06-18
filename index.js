// index.js — Erwin-Bot : version optimisée
import dotenv from 'dotenv'
dotenv.config()// index.js — Erwin-Bot : version optimisée
import dotenv from 'dotenv'
dotenv.config()

import { 
  makeWASocket, 
  fetchLatestBaileysVersion, 
  useMultiFileAuthState, 
  downloadContentFromMessage,
  DisconnectReason
} from 'baileys'
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
import { execSync } from 'child_process'

// --- utils sécurisés ---
import { canSend, recordSend } from './utils/rateLimiter.js'
import { ownerOnly, isOwner, isAdmin, getOwners, isBanned } from './utils/permissions.js'
import { getGroupSettings, addWarn, getWarns } from './utils/groupSettings.js'
import { canUserExecuteCommand, startHealthMonitoring, secureMessageSend } from './utils/botSecurity.js'
import { getPrefix } from './utils/prefixManager.js'
import { sendText, attachSendWrapper } from './utils/messageQueue.js'
import { initAntiDelete, handleRevoke, isAntideleteEnabled, setAntideleteEnabled } from './handlers/antideleteHandler.js'
import { initAutoPing } from './utils/autoPing.js'
import { isAdminOnly } from './config/adminOnly.js'
import { handleAutoReact } from './utils/autoReact.js'
import { getStats, trackCommand, trackMessage } from './utils/statsTracker.js'
import { getServiceStatus, updateRenderEnvVar } from './utils/render.js'

// --- constantes & chemins ---
const __dirname = process.cwd()
const authDir = path.join(__dirname, 'auth_info')
const cmdDir = path.join(__dirname, 'commands')

// --- helpers ---
const sleep = (ms) => new Promise(res => setTimeout(res, ms))
const rand = (n) => Math.floor(Math.random() * n)

// --- Serveur Web & Keep-Alive ---
const app = express()
const PORT = process.env.PORT || 3000
let lastQR = null
let lastQRTimestamp = null

app.get('/', (req, res) => res.send('Erwin-Bot is running!'))
app.get('/health', (req, res) => res.status(200).send('OK')) // Ajout de l'endpoint health

// URL du service (Railway ou Render)
const SERVICE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : (process.env.RENDER_URL || process.env.RENDER_EXTERNAL_URL || '')
const BOT_NAME = 'Erwin-Bot'

// ============================================
// 🔴 ROUTE QR CODE AMÉLIORÉE
// ============================================
app.get('/qr', async (req, res) => {
  const format = req.query.format || 'html'
  
  if (!lastQR) {
    if (format === 'json') {
      return res.status(503).json({
        error: 'QR code not available',
        status: 'waiting',
        message: 'Bot is initializing or already connected'
      })
    }
    return res.status(503).send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Erwin-Bot - QR Code</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 500px;
            width: 100%;
          }
          .logo { font-size: 60px; margin-bottom: 20px; }
          h1 { color: #333; font-size: 28px; margin-bottom: 10px; font-weight: 700; }
          .status {
            background: #fff3cd;
            border: 2px solid #ffc107;
            color: #856404;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
          }
          .spinner {
            display: inline-block;
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .message { color: #666; font-size: 16px; line-height: 1.6; margin: 20px 0; }
          .refresh-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            margin-top: 20px;
            transition: transform 0.2s;
          }
          .refresh-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(102,126,234,0.3); }
          .footer { color: #999; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">📦</div>
          <h1>Erwin-Bot</h1>
          <div class="status">
            <div class="spinner"></div>
            <span>En attente du QR code...</span>
          </div>
          <p class="message">Le bot est en cours de démarrage. Veuillez patienter quelques secondes.</p>
          <button class="refresh-btn" onclick="location.reload()">🔄 Actualiser</button>
          <div class="footer">
            ℹ️ Cette page se rafraîchira automatiquement toutes les 5 secondes
          </div>
        </div>
        <script>
          setTimeout(() => location.reload(), 5000);
        </script>
      </body>
      </html>
    `)
  }

  // Format JSON avec QR code en base64
  if (format === 'json') {
    return res.json({
      qrCode: lastQR,
      timestamp: lastQRTimestamp,
      status: 'active'
    })
  }

  // Format base64
  if (format === 'base64') {
    return res.json({
      qrCode: lastQR,
      format: 'base64_data_url',
      timestamp: lastQRTimestamp
    })
  }

  // Format HTML (default) - Interface professionnelle
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Erwin-Bot - Scan QR Code</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
        }

        .container {
          background: white;
          border-radius: 20px;
          padding: 50px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          text-align: center;
          max-width: 550px;
          width: 100%;
          animation: slideIn 0.5s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .header {
          margin-bottom: 40px;
        }

        .logo {
          font-size: 80px;
          margin-bottom: 20px;
          animation: bounce 2s ease-in-out infinite;
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        h1 {
          color: #333;
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 10px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .subtitle {
          color: #666;
          font-size: 16px;
          margin-bottom: 30px;
        }

        .qr-container {
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          padding: 30px;
          border-radius: 15px;
          margin: 30px 0;
          display: inline-block;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          animation: glow 2s ease-in-out infinite;
        }

        @keyframes glow {
          0%, 100% { box-shadow: 0 10px 30px rgba(102,126,234,0.2); }
          50% { box-shadow: 0 10px 30px rgba(102,126,234,0.4); }
        }

        .qr-container img {
          max-width: 100%;
          width: 300px;
          height: 300px;
          border-radius: 10px;
          border: 3px solid #667eea;
        }

        .status-badge {
          display: inline-block;
          background: #10b981;
          color: white;
          padding: 8px 20px;
          border-radius: 50px;
          font-size: 13px;
          font-weight: 600;
          margin: 20px 0;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .instructions {
          background: #f0fdf4;
          border: 2px solid #10b981;
          border-radius: 12px;
          padding: 25px;
          margin: 30px 0;
          text-align: left;
        }

        .instructions h3 {
          color: #047857;
          font-size: 18px;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .instruction-step {
          color: #374151;
          margin-bottom: 12px;
          display: flex;
          gap: 12px;
          font-size: 15px;
          line-height: 1.6;
        }

        .step-number {
          background: #10b981;
          color: white;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          flex-shrink: 0;
          font-size: 14px;
        }

        .timer {
          color: #666;
          font-size: 13px;
          margin-top: 25px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }

        .timer strong {
          color: #333;
        }

        .footer {
          color: #999;
          font-size: 12px;
          margin-top: 30px;
        }

        .footer a {
          color: #667eea;
          text-decoration: none;
          font-weight: 600;
        }

        .footer a:hover {
          text-decoration: underline;
        }

        @media (max-width: 480px) {
          .container {
            padding: 30px 20px;
          }
          h1 {
            font-size: 26px;
          }
          .logo {
            font-size: 60px;
          }
          .qr-container img {
            width: 250px;
            height: 250px;
          }
          .instructions {
            padding: 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">📱</div>
          <h1>Erwin-Bot</h1>
          <p class="subtitle">Scan & Connect</p>
        </div>

        <div class="status-badge">🟢 Actif</div>

        <div class="qr-container">
          <img src="${lastQR}" alt="QR Code WhatsApp">
        </div>

        <div class="instructions">
          <h3>📋 Instructions</h3>
          <div class="instruction-step">
            <div class="step-number">1</div>
            <span><strong>Ouvrez WhatsApp</strong> sur votre téléphone</span>
          </div>
          <div class="instruction-step">
            <div class="step-number">2</div>
            <span>Allez dans <strong>Paramètres (⋮)</strong></span>
          </div>
          <div class="instruction-step">
            <div class="step-number">3</div>
            <span>Sélectionnez <strong>Appareils liés</strong></span>
          </div>
          <div class="instruction-step">
            <div class="step-number">4</div>
            <span>Appuyez sur <strong>Lier un appareil</strong></span>
          </div>
          <div class="instruction-step">
            <div class="step-number">5</div>
            <span>Scannez ce <strong>QR code</strong> avec votre téléphone</span>
          </div>
        </div>

        <div class="timer">
          ⏱️ QR code généré le: <strong id="timestamp"></strong>
          <br>
          <small>Ce QR code expire dans 60 secondes</small>
        </div>

        <div class="footer">
          <p>Erwin-Bot v1.0 | Made with ❤️</p>
        </div>
      </div>

      <script>
        // Afficher l'heure actuelle
        const now = new Date();
        document.getElementById('timestamp').textContent = now.toLocaleString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });

        // Rafraîchir après 60 secondes (nouveau QR code)
        setTimeout(() => {
          location.reload();
        }, 60000);
      </script>
    </body>
    </html>
  `)
})

app.get('/stats', async (req, res) => {
  const stats = getStats()
  let renderInfo = null
  try {
    renderInfo = await getServiceStatus()
  } catch (e) {
    renderInfo = { error: 'API Render non configurée' }
  }

  const uptimeStr = (stats.uptime / (1000 * 60 * 60)).toFixed(2) + 'h'
  const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(2) + ' MB'

  res.setHeader('Content-Type', 'text/html')
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Erwin-Bot Dashboard</title>
        <style>
          :root { --primary: #00ffcc; --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --accent: #3b82f6; }
          body { background: var(--bg); color: var(--text); font-family: 'Outfit', sans-serif; margin: 0; padding: 1.5rem; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; max-width: 1200px; margin: 0 auto; }
          .card { background: var(--card); border-radius: 1.5rem; padding: 1.5rem; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
          .header { text-align: center; margin-bottom: 2.5rem; }
          h1 { font-size: 2.5rem; margin: 0; color: var(--primary); text-shadow: 0 0 20px rgba(0,255,204,0.3); }
          .stat-val { font-size: 2.5rem; font-weight: 800; color: var(--text); margin: 0.5rem 0; }
          .stat-label { font-size: 1rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
          .status-dot { height: 12px; width: 12px; border-radius: 50%; display: inline-block; margin-right: 8px; }
          .live { background: #22c55e; box-shadow: 0 0 10px #22c55e; }
          .btn { background: var(--accent); color: white; border: none; padding: 0.8rem 1.5rem; border-radius: 0.8rem; cursor: pointer; text-decoration: none; font-weight: 600; display: inline-block; margin-top: 1rem; }
          .usage-list { margin-top: 1rem; list-style: none; padding: 0; }
          .usage-item { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📊 Erwin-Bot Dashboard</h1>
          <p>Statistiques en temps réel du bot WhatsApp</p>
        </div>
        <div class="grid">
          <div class="card">
            <div class="stat-label">Statut Global</div>
            <div class="stat-val"><span class="status-dot live"></span> Actif</div>
            <p>Uptime: <strong>${uptimeStr}</strong></p>
          </div>
          <div class="card">
            <div class="stat-label">Messages Reçus</div>
            <div class="stat-val">${stats.messagesReceived}</div>
            <p>Depuis le dernier démarrage</p>
          </div>
          <div class="card">
            <div class="stat-label">Commandes Exécutées</div>
            <div class="stat-val">${stats.commandsExecuted}</div>
            <p>Usage total</p>
          </div>
          <div class="card">
            <div class="stat-label">Consommation RAM</div>
            <div class="stat-val">${mem}</div>
            <p>Mémoire vive RSS</p>
          </div>
          <div class="card" style="grid-column: span 1 / -1">
            <div class="stat-label">Popularité des Commandes</div>
            <div class="usage-list">
              ${Object.entries(stats.commandUsage || {})
                .sort((a,b) => b[1] - a[1])
                .slice(0, 5)
                .map(([cmd, count]) => `
                  <div class="usage-item">
                    <span>!${cmd}</span>
                    <strong>${count}</strong>
                  </div>
                `).join('') || '<p>Aucune commande tracée</p>'}
            </div>
          </div>
          <div class="card">
            <div class="stat-label">Render Instance</div>
            <p>Service: <strong>${renderInfo.name || 'N/A'}</strong></p>
            <p>Status: <span style="color: ${renderInfo.status === 'live' ? '#22c55e' : '#ef4444'}">${renderInfo.status?.toUpperCase() || 'OFFLINE'}</span></p>
            <p>Suspended: ${renderInfo.suspended === 'suspended' ? 'YES' : 'NO'}</p>
          </div>
        </div>
        <div style="text-align: center; margin-top: 3rem; color: #64748b; font-size: 0.9rem;">
          Erwin-Bot Dashboard &copy; 2026 - <a href="/qr" style="color: var(--primary)">Voir QR Code</a>
        </div>
      </body>
    </html>
  `)
})

app.listen(PORT, () => {
  console.log(chalk.green(`🌐 Serveur Web actif sur le port ${PORT}`))
  if (SERVICE_URL) startKeepAlive()
})

function startKeepAlive() {
  if (global.keepAliveStarted) return

  let url = SERVICE_URL

  // Fallback : détecter l'URL via l'API Render si disponible
  if (!url && process.env.RENDER_API_KEY && process.env.RENDER_SERVICE_ID) {
    getServiceStatus().then(service => {
      if (service.serviceDetails?.url) {
        url = service.serviceDetails.url
        console.log(chalk.blue(`⚓ URL détectée via API: ${url}`))
        setupInterval(url)
      }
    }).catch(() => {})
  } else if (url) {
    setupInterval(url)
  }
}

function setupInterval(url) {
  if (global.keepAliveStarted) return
  global.keepAliveStarted = true

  setInterval(async () => {
    try {
      await axios.get(url)
      console.log(chalk.gray('⚓ Keep-alive ping success'))
    } catch (e) {
      console.error('⚓ Keep-alive ping failed:', e.message)
    }
  }, 30 * 1000) // 30 secondes (Suffisant pour éviter la veille)
  console.log(chalk.blue(`⚓ Keep-alive system started on: ${url}`))
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

  const authDir = path.join(process.cwd(), 'auth_info')

  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true })

  // --- Gestion Session Persistence (Railway/Render) ---
  if (process.env.SESSION_DATA && !fs.existsSync(path.join(authDir, 'creds.json'))) {
    try {
      console.log(chalk.blue('📦 Chargement de la session depuis SESSION_DATA...'))
      const sessionData = process.env.SESSION_DATA.trim()
      let credsContent = ''
      
      if (sessionData.startsWith('{')) {
        credsContent = sessionData
      } else {
        credsContent = Buffer.from(sessionData, 'base64').toString('utf-8')
      }
      
      fs.writeFileSync(path.join(authDir, 'creds.json'), credsContent)
      console.log(chalk.green('✅ Session restaurée avec succès.'))
    } catch (e) {
      console.error(chalk.red('❌ Erreur lors de la restauration de la session:'), e.message)
    }
  }

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
          // Générer QR code en base64
          try {
            lastQR = await QRCode.toDataURL(qr, {
              errorCorrectionLevel: 'H',
              type: 'image/png',
              quality: 0.95,
              margin: 1,
              width: 300
            })
            lastQRTimestamp = new Date()
          } catch (err) {
            console.error('Erreur génération QR base64:', err)
            // Fallback: utiliser l'API externe
            lastQR = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`
          }
          
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
          
          console.log(chalk.blue('🌐 Accédez à /qr dans votre navigateur pour voir le code en ligne\n'))

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

      // Note: creating/reconnectAttempts sont reset dans le handler connection=open

      // --- Gestion optimisée des messages ---
      console.log('✅ Bot configuré, en attente de connexion et messages...')

      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return
        
        for (const msg of messages) {
          try {
            if (!msg.message) continue

            const from = msg.key.remoteJid
            const isGroup = from.endsWith('@g.us')
            const sender = msg.key.participant || from
            const senderNumber = sender.split('@')[0]
            
            // Extraire le contenu textuel et le type
            const messageType = Object.keys(msg.message)[0]
            const text = msg.message.conversation || 
                         msg.message.extendedTextMessage?.text || 
                         msg.message.imageMessage?.caption || 
                         msg.message.videoMessage?.caption || ''

            // Magnifique log dans la console
            const timestamp = new Date().toLocaleTimeString()
            const typeLabel = isGroup ? chalk.black.bgYellow(' 👥 GROUPE ') : chalk.black.bgMagenta(' 👤 PRIVÉ ')
            
            console.log(`\n${chalk.gray(`[${timestamp}]`)} ${typeLabel} ${chalk.cyan('📩 Nouveau Message')}`)
            console.log(`${chalk.gray('   ├─ Expéditeur:')} ${chalk.green(senderNumber)} ${chalk.gray(`(${sender})`)}`)
            if (isGroup) {
              console.log(`${chalk.gray('   ├─ Groupe ID:')} ${chalk.blue(from)}`)
            }
            console.log(`${chalk.gray('   ├─ Type:')} ${chalk.yellow(messageType)}`)
            if (text) {
              console.log(`${chalk.gray('   └─ Contenu:')} ${chalk.white(text.length > 100 ? text.slice(0, 100) + '...' : text)}`)
            } else {
              console.log(`${chalk.gray('   └─ Contenu:')} ${chalk.italic.gray('(Pas de texte)')}`)
            }

            // Anti-delete est initialisé une seule fois via initAntiDelete(sock) au démarrage

            // Tracker de statistiques
            trackMessage()

            // Gestion des auto-réactions (non-bloquant)
            if (from.endsWith('@g.us')) {
              handleAutoReact(sock, msg, from, text).catch(() => { })
            }

            // Vérification antilink en parallèle si nécessaire
            if (from.endsWith('@g.us')) {
              let settings = {}
              let groupMetadata = null
              try {
                [settings, groupMetadata] = await Promise.all([
                  getGroupSettings(from),
                  sock.groupMetadata(from).catch(() => null)
                ])
              } catch {
                settings = {}
                groupMetadata = null
              }

              const senderParticipant = groupMetadata?.participants?.find(p => p.id === sender)
              const isGroupAdmin = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin'

              // Vérification antilink
              if (settings?.antilink && text) {
                const hasLink = /(https?:\/\/|www\.|wa\.me\/|whatsapp\.com\/)/i.test(text)
                if (hasLink && !isGroupAdmin && !isAdmin(sender)) {
                  try {
                    await sock.sendMessage(from, { delete: msg.key }).catch(console.error)
                    await sendText(sock, from, `🚫 @${sender.split('@')[0]}, les liens sont interdits dans ce groupe.`, {
                      mentions: [sender],
                      delay: 100 
                    })
                    continue
                  } catch (e) {
                    console.error('Erreur antilink:', e)
                  }
                }
              }
            }

            // Vérifier si le message commence par le préfixe
            const prefix = getPrefix()
            if (!text.startsWith(prefix)) continue

            // Extraire la commande et les arguments
            const [cmdRaw, ...args] = text.slice(prefix.length).trim().split(/\s+/)
            const cmd = cmdRaw.toLowerCase()

            // Vérifier si la commande existe
            const commandFunc = commands.get(cmd)
            if (!commandFunc) continue

            // Vérifier si le mode admin-only est activé
            if (isAdminOnly() && !(isAdmin(sender) || isOwner(sender))) {
              continue
            }

            // vérif ban
            if (isBanned(sender)) {
              await sendText(sock, from, '⛔ Tu es banni du bot.', { quoted: msg })
              continue
            }

            const isMediaCommand = ['sticker', 'yt', 'song', 'vision', 'wallpaper', 'movie'].includes(cmd)
            const canExecute = canUserExecuteCommand(sender, cmd, isMediaCommand)
            if (!canExecute.allowed) {
              await sendText(sock, from, canExecute.reason || '⏳ Commande limitée, réessaie plus tard.', { quoted: msg })
              continue
            }

            trackCommand(cmd)
            await commandFunc(sock, msg, args)

          } catch (err) {
            console.error('Erreur traitement message:', err)
          }
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
            sock.groupMetadata(id).catch(() => null)
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

import { 
  makeWASocket, 
  fetchLatestBaileysVersion, 
  useMultiFileAuthState, 
  downloadContentFromMessage,
  DisconnectReason
} from 'baileys'
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
import { execSync } from 'child_process'

// --- utils sécurisés ---
import { canSend, recordSend } from './utils/rateLimiter.js'
import { ownerOnly, isOwner, isAdmin, getOwners, isBanned } from './utils/permissions.js'
import { getGroupSettings, addWarn, getWarns } from './utils/groupSettings.js'
import { canUserExecuteCommand, startHealthMonitoring, secureMessageSend } from './utils/botSecurity.js'
import { getPrefix } from './utils/prefixManager.js'
import { sendText, attachSendWrapper } from './utils/messageQueue.js'
import { initAntiDelete, handleRevoke, isAntideleteEnabled, setAntideleteEnabled } from './handlers/antideleteHandler.js'
import { initAutoPing } from './utils/autoPing.js'
import { isAdminOnly } from './config/adminOnly.js'
import { handleAutoReact } from './utils/autoReact.js'
import { getStats, trackCommand, trackMessage } from './utils/statsTracker.js'
import { getServiceStatus, updateRenderEnvVar } from './utils/render.js'

// --- constantes & chemins ---
const __dirname = process.cwd()
const authDir = path.join(__dirname, 'auth_info')
const cmdDir = path.join(__dirname, 'commands')

// --- helpers ---
const sleep = (ms) => new Promise(res => setTimeout(res, ms))
const rand = (n) => Math.floor(Math.random() * n)

// --- Serveur Web & Keep-Alive ---
const app = express()
const PORT = process.env.PORT || 3000
let lastQR = null

app.get('/', (req, res) => res.send('Erwin-Bot is running!'))
app.get('/health', (req, res) => res.status(200).send('OK')) // Ajout de l'endpoint health

// URL du service (Railway ou Render)
const SERVICE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : (process.env.RENDER_URL || process.env.RENDER_EXTERNAL_URL || '')
const BOT_NAME = 'Erwin-Bot'

app.get('/qr', (req, res) => {
  if (lastQR) {
    res.setHeader('Content-Type', 'text/html')
    const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(lastQR)}`
    res.send(`
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Erwin-Bot - Connexion</title>
          <style>
            :root { --primary: #00ffcc; --bg: #0f172a; --card: #1e293b; --text: #f8fafc; }
            body { background: var(--bg); color: var(--text); display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; font-family: 'Inter', sans-serif; }
            .container { background: var(--card); padding: 2rem; border-radius: 1.5rem; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; border: 1px solid rgba(255,255,255,0.1); }
            img { background: white; padding: 1rem; border-radius: 1rem; box-shadow: 0 4px 15px rgba(0,0,0,0.3); margin: 1.5rem 0; }
            h1 { font-size: 2rem; margin: 0; color: var(--primary); text-shadow: 0 0 15px rgba(0,255,204,0.3); }
            p { color: #94a3b8; font-size: 1.1rem; }
            .status { margin-top: 1rem; padding: 0.5rem 1rem; background: rgba(0,255,204,0.1); border-radius: 2rem; color: var(--primary); font-weight: 600; font-size: 0.9rem; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>📦 Erwin-Bot</h1>
            <div class="status">En attente de scan...</div>
            <img src="${qrImage}" alt="QR Code">
            <p>Scannez ce code pour connecter le bot</p>
          </div>
          <script>setTimeout(() => location.reload(), 20000);</script>
        </body>
      </html>
    `)
  } else {
    res.send('QR Code non généré ou déjà scanné. <a href="/">Retour</a>')
  }
})

app.get('/stats', async (req, res) => {
  const stats = getStats()
  let renderInfo = null
  try {
    renderInfo = await getServiceStatus()
  } catch (e) {
    renderInfo = { error: 'API Render non configurée' }
  }

  const uptimeStr = (stats.uptime / (1000 * 60 * 60)).toFixed(2) + 'h'
  const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(2) + ' MB'

  res.setHeader('Content-Type', 'text/html')
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Erwin-Bot Dashboard</title>
        <style>
          :root { --primary: #00ffcc; --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --accent: #3b82f6; }
          body { background: var(--bg); color: var(--text); font-family: 'Outfit', sans-serif; margin: 0; padding: 1.5rem; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; max-width: 1200px; margin: 0 auto; }
          .card { background: var(--card); border-radius: 1.5rem; padding: 1.5rem; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
          .header { text-align: center; margin-bottom: 2.5rem; }
          h1 { font-size: 2.5rem; margin: 0; color: var(--primary); text-shadow: 0 0 20px rgba(0,255,204,0.3); }
          .stat-val { font-size: 2.5rem; font-weight: 800; color: var(--text); margin: 0.5rem 0; }
          .stat-label { font-size: 1rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
          .status-dot { height: 12px; width: 12px; border-radius: 50%; display: inline-block; margin-right: 8px; }
          .live { background: #22c55e; box-shadow: 0 0 10px #22c55e; }
          .btn { background: var(--accent); color: white; border: none; padding: 0.8rem 1.5rem; border-radius: 0.8rem; cursor: pointer; text-decoration: none; font-weight: 600; display: inline-block; margin-top: 1rem; }
          .usage-list { margin-top: 1rem; list-style: none; padding: 0; }
          .usage-item { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📊 Erwin-Bot Dashboard</h1>
          <p>Statistiques en temps réel du bot WhatsApp</p>
        </div>
        <div class="grid">
          <div class="card">
            <div class="stat-label">Statut Global</div>
            <div class="stat-val"><span class="status-dot live"></span> Actif</div>
            <p>Uptime: <strong>${uptimeStr}</strong></p>
          </div>
          <div class="card">
            <div class="stat-label">Messages Reçus</div>
            <div class="stat-val">${stats.messagesReceived}</div>
            <p>Depuis le dernier démarrage</p>
          </div>
          <div class="card">
            <div class="stat-label">Commandes Exécutées</div>
            <div class="stat-val">${stats.commandsExecuted}</div>
            <p>Usage total</p>
          </div>
          <div class="card">
            <div class="stat-label">Consommation RAM</div>
            <div class="stat-val">${mem}</div>
            <p>Mémoire vive RSS</p>
          </div>
          <div class="card" style="grid-column: span 1 / -1">
            <div class="stat-label">Popularité des Commandes</div>
            <div class="usage-list">
              ${Object.entries(stats.commandUsage || {})
                .sort((a,b) => b[1] - a[1])
                .slice(0, 5)
                .map(([cmd, count]) => `
                  <div class="usage-item">
                    <span>!${cmd}</span>
                    <strong>${count}</strong>
                  </div>
                `).join('') || '<p>Aucune commande tracée</p>'}
            </div>
          </div>
          <div class="card">
            <div class="stat-label">Render Instance</div>
            <p>Service: <strong>${renderInfo.name || 'N/A'}</strong></p>
            <p>Status: <span style="color: ${renderInfo.status === 'live' ? '#22c55e' : '#ef4444'}">${renderInfo.status?.toUpperCase() || 'OFFLINE'}</span></p>
            <p>Suspended: ${renderInfo.suspended === 'suspended' ? 'YES' : 'NO'}</p>
          </div>
        </div>
        <div style="text-align: center; margin-top: 3rem; color: #64748b; font-size: 0.9rem;">
          Erwin-Bot Dashboard &copy; 2026 - <a href="/qr" style="color: var(--primary)">Voir QR Code</a>
        </div>
      </body>
    </html>
  `)
})

app.listen(PORT, () => {
  console.log(chalk.green(`🌐 Serveur Web actif sur le port ${PORT}`))
  if (SERVICE_URL) startKeepAlive()
})

function startKeepAlive() {
  if (global.keepAliveStarted) return

  let url = SERVICE_URL

  // Fallback : détecter l'URL via l'API Render si disponible
  if (!url && process.env.RENDER_API_KEY && process.env.RENDER_SERVICE_ID) {
    getServiceStatus().then(service => {
      if (service.serviceDetails?.url) {
        url = service.serviceDetails.url
        console.log(chalk.blue(`⚓ URL détectée via API: ${url}`))
        setupInterval(url)
      }
    }).catch(() => {})
  } else if (url) {
    setupInterval(url)
  }
}

function setupInterval(url) {
  if (global.keepAliveStarted) return
  global.keepAliveStarted = true

  setInterval(async () => {
    try {
      await axios.get(url)
      console.log(chalk.gray('⚓ Keep-alive ping success'))
    } catch (e) {
      console.error('⚓ Keep-alive ping failed:', e.message)
    }
  }, 30 * 1000) // 30 secondes (Suffisant pour éviter la veille)
  console.log(chalk.blue(`⚓ Keep-alive system started on: ${url}`))
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

  const authDir = path.join(process.cwd(), 'auth_info')

  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true })

  // --- Gestion Session Persistence (Railway/Render) ---
  if (process.env.SESSION_DATA && !fs.existsSync(path.join(authDir, 'creds.json'))) {
    try {
      console.log(chalk.blue('📦 Chargement de la session depuis SESSION_DATA...'))
      const sessionData = process.env.SESSION_DATA.trim()
      let credsContent = ''
      
      if (sessionData.startsWith('{')) {
        credsContent = sessionData
      } else {
        credsContent = Buffer.from(sessionData, 'base64').toString('utf-8')
      }
      
      fs.writeFileSync(path.join(authDir, 'creds.json'), credsContent)
      console.log(chalk.green('✅ Session restaurée avec succès.'))
    } catch (e) {
      console.error(chalk.red('❌ Erreur lors de la restauration de la session:'), e.message)
    }
  }

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

      // Note: creating/reconnectAttempts sont reset dans le handler connection=open

      // --- Gestion optimisée des messages ---
      console.log('✅ Bot configuré, en attente de connexion et messages...')

      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return
        
        for (const msg of messages) {
          try {
            if (!msg.message) continue

            const from = msg.key.remoteJid
            const isGroup = from.endsWith('@g.us')
            const sender = msg.key.participant || from
            const senderNumber = sender.split('@')[0]
            
            // Extraire le contenu textuel et le type
            const messageType = Object.keys(msg.message)[0]
            const text = msg.message.conversation || 
                         msg.message.extendedTextMessage?.text || 
                         msg.message.imageMessage?.caption || 
                         msg.message.videoMessage?.caption || ''

            // Magnifique log dans la console
            const timestamp = new Date().toLocaleTimeString()
            const typeLabel = isGroup ? chalk.black.bgYellow(' 👥 GROUPE ') : chalk.black.bgMagenta(' 👤 PRIVÉ ')
            
            console.log(`\n${chalk.gray(`[${timestamp}]`)} ${typeLabel} ${chalk.cyan('📩 Nouveau Message')}`)
            console.log(`${chalk.gray('   ├─ Expéditeur:')} ${chalk.green(senderNumber)} ${chalk.gray(`(${sender})`)}`)
            if (isGroup) {
              console.log(`${chalk.gray('   ├─ Groupe ID:')} ${chalk.blue(from)}`)
            }
            console.log(`${chalk.gray('   ├─ Type:')} ${chalk.yellow(messageType)}`)
            if (text) {
              console.log(`${chalk.gray('   └─ Contenu:')} ${chalk.white(text.length > 100 ? text.slice(0, 100) + '...' : text)}`)
            } else {
              console.log(`${chalk.gray('   └─ Contenu:')} ${chalk.italic.gray('(Pas de texte)')}`)
            }

            // Anti-delete est initialisé une seule fois via initAntiDelete(sock) au démarrage

            // Tracker de statistiques
            trackMessage()

            // Gestion des auto-réactions (non-bloquant)
            if (from.endsWith('@g.us')) {
              handleAutoReact(sock, msg, from, text).catch(() => { })
            }

            // Vérification antilink en parallèle si nécessaire
            if (from.endsWith('@g.us')) {
              let settings = {}
              let groupMetadata = null
              try {
                [settings, groupMetadata] = await Promise.all([
                  getGroupSettings(from),
                  sock.groupMetadata(from).catch(() => null)
                ])
              } catch {
                settings = {}
                groupMetadata = null
              }

              const senderParticipant = groupMetadata?.participants?.find(p => p.id === sender)
              const isGroupAdmin = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin'

              // Vérification antilink
              if (settings?.antilink && text) {
                const hasLink = /(https?:\/\/|www\.|wa\.me\/|whatsapp\.com\/)/i.test(text)
                if (hasLink && !isGroupAdmin && !isAdmin(sender)) {
                  try {
                    await sock.sendMessage(from, { delete: msg.key }).catch(console.error)
                    await sendText(sock, from, `🚫 @${sender.split('@')[0]}, les liens sont interdits dans ce groupe.`, {
                      mentions: [sender],
                      delay: 100 
                    })
                    continue
                  } catch (e) {
                    console.error('Erreur antilink:', e)
                  }
                }
              }
            }

            // Vérifier si le message commence par le préfixe
            const prefix = getPrefix()
            if (!text.startsWith(prefix)) continue

            // Extraire la commande et les arguments
            const [cmdRaw, ...args] = text.slice(prefix.length).trim().split(/\s+/)
            const cmd = cmdRaw.toLowerCase()

            // Vérifier si la commande existe
            const commandFunc = commands.get(cmd)
            if (!commandFunc) continue

            // Vérifier si le mode admin-only est activé
            if (isAdminOnly() && !(isAdmin(sender) || isOwner(sender))) {
              continue
            }

            // vérif ban
            if (isBanned(sender)) {
              await sendText(sock, from, '⛔ Tu es banni du bot.', { quoted: msg })
              continue
            }

            const isMediaCommand = ['sticker', 'yt', 'song', 'vision', 'wallpaper', 'movie'].includes(cmd)
            const canExecute = canUserExecuteCommand(sender, cmd, isMediaCommand)
            if (!canExecute.allowed) {
              await sendText(sock, from, canExecute.reason || '⏳ Commande limitée, réessaie plus tard.', { quoted: msg })
              continue
            }

            trackCommand(cmd)
            await commandFunc(sock, msg, args)

          } catch (err) {
            console.error('Erreur traitement message:', err)
          }
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
            sock.groupMetadata(id).catch(() => null)
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
