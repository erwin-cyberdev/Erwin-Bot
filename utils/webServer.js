// utils/webServer.js — Serveur Express + routes QR/Stats + keep-alive
import express from 'express'
import axios from 'axios'
import chalk from 'chalk'
import QRCode from 'qrcode'
import { getStats } from './statsTracker.js'
import { getServiceStatus } from './render.js'

export let lastQR = null
export let lastQRTimestamp = null
export function setQR(qr) { lastQR = qr; lastQRTimestamp = new Date() }
export function clearQR() { lastQR = null; lastQRTimestamp = null }

const app = express()
const PORT = process.env.PORT || 3000
const SERVICE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : (process.env.RENDER_URL || process.env.RENDER_EXTERNAL_URL || '')

// --- Routes de base ---
app.get('/', (_req, res) => res.send('Erwin-Bot is running!'))
app.get('/health', (_req, res) => res.status(200).send('OK'))

// --- Route QR ---
app.get('/qr', async (req, res) => {
  const fmt = req.query.format || 'html'

  if (!lastQR) {
    if (fmt === 'json') return res.status(503).json({ error: 'QR not available', status: 'waiting' })
    return res.status(503).send(waitingHtml())
  }

  if (fmt === 'json' || fmt === 'base64') {
    return res.json({ qrCode: lastQR, timestamp: lastQRTimestamp, status: 'active' })
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(qrHtml(lastQR))
})

// --- Route Stats ---
app.get('/stats', async (_req, res) => {
  const stats = getStats()
  let renderInfo = {}
  try { renderInfo = await getServiceStatus() } catch { renderInfo = {} }

  const uptime = (stats.uptime / 3_600_000).toFixed(2) + 'h'
  const mem = (process.memoryUsage().rss / 1_048_576).toFixed(2) + ' MB'
  const topCmds = Object.entries(stats.commandUsage || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([c, n]) => `<div class="usage-item"><span>!${c}</span><strong>${n}</strong></div>`)
    .join('') || '<p>Aucune commande tracée</p>'

  res.setHeader('Content-Type', 'text/html')
  res.send(statsHtml({ uptime, mem, topCmds, stats, renderInfo }))
})

// --- Keep-alive ---
export function startKeepAlive() {
  if (global.keepAliveStarted) return
  const url = SERVICE_URL
  if (!url) return
  global.keepAliveStarted = true
  setInterval(async () => {
    try { await axios.get(url); console.log(chalk.gray('⚓ keep-alive OK')) }
    catch (e) { console.error('⚓ keep-alive fail:', e.message) }
  }, 30_000)
  console.log(chalk.blue(`⚓ Keep-alive démarré: ${url}`))
}

export function startServer() {
  app.listen(PORT, () => {
    console.log(chalk.green(`🌐 Serveur web sur le port ${PORT}`))
    startKeepAlive()
  })
}

// ─── Templates HTML minifiés ────────────────────────────────────────────────

function waitingHtml() {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Erwin-Bot - QR Code</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;justify-content:center;align-items:center;min-height:100vh}
.box{background:#fff;border-radius:20px;padding:40px;text-align:center;max-width:420px;width:90%}
h1{font-size:24px;margin:16px 0 8px}
.badge{background:#fff3cd;border:2px solid #ffc107;color:#856404;padding:12px;border-radius:10px;margin:16px 0;font-weight:600}
.spin{display:inline-block;width:32px;height:32px;border:4px solid #f3f3f3;border-top-color:#667eea;border-radius:50%;animation:s 1s linear infinite;vertical-align:middle;margin-right:8px}
@keyframes s{to{transform:rotate(360deg)}}
p{color:#666;margin:16px 0}
button{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600}
</style></head>
<body><div class="box"><div style="font-size:60px">📦</div><h1>Erwin-Bot</h1>
<div class="badge"><span class="spin"></span>En attente du QR code...</div>
<p>Le bot démarre, patientez quelques secondes.</p>
<button onclick="location.reload()">🔄 Actualiser</button></div>
<script>setTimeout(()=>location.reload(),5000)</script></body></html>`
}

function qrHtml(qrData) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Erwin-Bot - Scan QR</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;justify-content:center;align-items:center;min-height:100vh}
.box{background:#fff;border-radius:20px;padding:40px;text-align:center;max-width:480px;width:90%;animation:up .4s ease-out}
@keyframes up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
h1{font-size:28px;font-weight:700;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin:12px 0 4px}
.badge{display:inline-block;background:#10b981;color:#fff;padding:6px 18px;border-radius:50px;font-size:12px;font-weight:600;letter-spacing:1px;margin:12px 0}
.qr{background:#f5f7fa;padding:20px;border-radius:12px;display:inline-block;margin:16px 0}
.qr img{width:260px;height:260px;border-radius:8px;border:3px solid #667eea}
.steps{background:#f0fdf4;border:2px solid #10b981;border-radius:10px;padding:20px;text-align:left;margin:16px 0}
.step{display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;font-size:14px;color:#374151}
.n{background:#10b981;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;font-size:12px}
.timer{color:#888;font-size:12px;margin-top:16px;border-top:1px solid #e5e7eb;padding-top:12px}
</style></head>
<body><div class="box">
<div style="font-size:64px">📱</div>
<h1>Erwin-Bot</h1><p style="color:#666;font-size:14px">Scan &amp; Connect</p>
<div class="badge">🟢 ACTIF</div>
<div class="qr"><img src="${qrData}" alt="QR Code WhatsApp"></div>
<div class="steps">
  <div style="font-weight:700;color:#047857;margin-bottom:12px">📋 Instructions</div>
  <div class="step"><div class="n">1</div><span>Ouvrez <strong>WhatsApp</strong> sur votre téléphone</span></div>
  <div class="step"><div class="n">2</div><span>Allez dans <strong>Paramètres (⋮)</strong></span></div>
  <div class="step"><div class="n">3</div><span>Sélectionnez <strong>Appareils liés</strong></span></div>
  <div class="step"><div class="n">4</div><span>Appuyez sur <strong>Lier un appareil</strong></span></div>
  <div class="step"><div class="n">5</div><span>Scannez ce <strong>QR code</strong></span></div>
</div>
<div class="timer">⏱️ Généré le: <strong id="ts"></strong> — expire dans 60s</div>
</div>
<script>
document.getElementById('ts').textContent=new Date().toLocaleString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'});
setTimeout(()=>location.reload(),60000);
</script></body></html>`
}

function statsHtml({ uptime, mem, topCmds, stats, renderInfo }) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Erwin-Bot Dashboard</title>
<style>:root{--p:#00ffcc;--bg:#0f172a;--card:#1e293b;--t:#f8fafc;--a:#3b82f6}
*{margin:0;padding:0;box-sizing:border-box}body{background:var(--bg);color:var(--t);font-family:system-ui,sans-serif;padding:1.5rem}
h1{font-size:2rem;color:var(--p);text-shadow:0 0 20px rgba(0,255,204,.3);margin-bottom:.5rem}
.header{text-align:center;margin-bottom:2rem}.header p{color:#94a3b8}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1.5rem;max-width:1100px;margin:0 auto}
.card{background:var(--card);border-radius:1.2rem;padding:1.5rem;border:1px solid rgba(255,255,255,.05)}
.label{font-size:.85rem;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:.4rem}
.val{font-size:2rem;font-weight:800}
.dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:6px}
.live{background:#22c55e;box-shadow:0 0 8px #22c55e}
.usage-item{display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:.9rem}
footer{text-align:center;margin-top:2rem;color:#64748b;font-size:.85rem}
footer a{color:var(--p);text-decoration:none}
</style></head>
<body>
<div class="header"><h1>📊 Erwin-Bot Dashboard</h1><p>Statistiques en temps réel</p></div>
<div class="grid">
  <div class="card"><div class="label">Statut</div><div class="val"><span class="dot live"></span>Actif</div><p style="color:#94a3b8;margin-top:.4rem">Uptime: ${uptime}</p></div>
  <div class="card"><div class="label">Messages reçus</div><div class="val">${stats.messagesReceived}</div></div>
  <div class="card"><div class="label">Commandes exécutées</div><div class="val">${stats.commandsExecuted}</div></div>
  <div class="card"><div class="label">RAM (RSS)</div><div class="val">${mem}</div></div>
  <div class="card" style="grid-column:1/-1"><div class="label">Top commandes</div><div style="margin-top:.8rem">${topCmds}</div></div>
  <div class="card"><div class="label">Render</div>
    <p>Service: <strong>${renderInfo.name || 'N/A'}</strong></p>
    <p>Status: <span style="color:${renderInfo.status === 'live' ? '#22c55e' : '#ef4444'}">${(renderInfo.status || 'offline').toUpperCase()}</span></p>
  </div>
</div>
<footer><a href="/qr">Voir QR Code</a> · Erwin-Bot © 2026</footer>
</body></html>`
}
