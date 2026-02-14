// commands/screenshot.js
import puppeteer from 'puppeteer'
import { sendWithTyping } from '../utils/sendWithTyping.js'

const PUPPETEER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--no-zygote',
  '--disable-gpu'
]

function sanitizeUrl(raw) {
  if (!raw) return null
  let candidate = raw.trim()
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`
  }
  try {
    const parsed = new URL(candidate)
    if (!parsed.protocol.startsWith('http')) return null
    return parsed.toString()
  } catch {
    return null
  }
}

export default async function screenshotCommand(sock, msg, args) {
  const from = msg.key.remoteJid

  if (!args.length) {
    await sock.sendMessage(from, {
      text: '📸 *Capture de site web*\n\nUsage : `.screenshot <url>`\nExemple : `.screenshot https://example.com`'
    }, { quoted: msg })
    return
  }

  const targetUrl = sanitizeUrl(args[0])
  if (!targetUrl) {
    await sock.sendMessage(from, {
      text: '❌ URL invalide. Fournis un lien valide, ex. `.screenshot https://example.com`'
    }, { quoted: msg })
    return
  }

  let browser
  let page

  try {
    // Message "en train de capturer"
    if (typeof sendWithTyping === 'function') {
      await sendWithTyping(sock, from, { text: '📸 Capture en cours, patiente un instant…' }, { quoted: msg })
    } else {
      await sock.sendMessage(from, { text: '📸 Capture en cours, patiente un instant…' }, { quoted: msg })
    }

    browser = await puppeteer.launch({ headless: 'new', args: PUPPETEER_ARGS })
    page = await browser.newPage()
    await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 })

    const navigationTimeout = 60000
    try {
      await page.goto(targetUrl, {
        waitUntil: ['networkidle2', 'domcontentloaded'],
        timeout: navigationTimeout
      })
    } catch (err) {
      if (err?.name === 'TimeoutError') {
        console.warn('screenshot: navigation timeout, retrying with relaxed waitUntil')
        await page.goto(targetUrl, {
          waitUntil: 'domcontentloaded',
          timeout: navigationTimeout
        })
      } else {
        throw err
      }
    }

    // ✅ Remplacement de page.waitForTimeout()
    await new Promise(resolve => setTimeout(resolve, 1500))

    const buffer = await page.screenshot({ type: 'png', fullPage: true })

    await sock.sendMessage(from, {
      image: buffer,
      mimetype: 'image/png',
      caption: `✅ Capture de ${targetUrl}`
    }, { quoted: msg })
  } catch (err) {
    console.error('Erreur .screenshot:', err)
    await sock.sendMessage(from, {
      text: '⚠️ Impossible de capturer ce site pour le moment. Vérifie le lien et réessaie.'
    }, { quoted: msg })
  } finally {
    if (page) try { await page.close() } catch {}
    if (browser) try { await browser.close() } catch {}
  }
}
