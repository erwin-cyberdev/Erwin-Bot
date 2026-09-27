// utils/ytUtils.js - Utilitaires pour yt-dlp et le bypass YouTube
import fs from 'fs/promises'
import { createWriteStream } from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import dotenv from 'dotenv'
dotenv.config()

const execAsync = promisify(exec)

const COOKIES_BASE64 = process.env.YOUTUBE_COOKIES_BASE64
const LOCAL_COOKIES_FILE = path.resolve('./youtube_cookies.txt')
const TMP_COOKIES_PATH = path.resolve('./tmp/youtube_cookies.txt')

// Chemin du binaire yt-dlp — placé dans /tmp pour Render (filesystem éphémère, mais accessible)
const YTDLP_BIN = path.resolve('./tmp/yt-dlp')
const YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp'

let ytdlpReady = false

/**
 * Télécharge le binaire yt-dlp si absent (nécessaire sur Render qui n'a pas yt-dlp dans PATH)
 */
export async function ensureYtdlp() {
  if (ytdlpReady) return YTDLP_BIN

  try {
    await fs.access(YTDLP_BIN)
    // Vérifie que le binaire est exécutable et fonctionnel
    await execAsync(`${YTDLP_BIN} --version`)
    ytdlpReady = true
    console.log('[yt-dlp] Binaire déjà présent et fonctionnel.')
    return YTDLP_BIN
  } catch {
    // Binaire absent ou non fonctionnel → on le télécharge
  }

  console.log('[yt-dlp] Téléchargement du binaire en cours...')
  await fs.mkdir(path.dirname(YTDLP_BIN), { recursive: true })

  try {
    // On utilise curl (disponible sur Render/Linux) pour télécharger yt-dlp
    await execAsync(`curl -L "${YTDLP_URL}" -o "${YTDLP_BIN}"`)
    await execAsync(`chmod +x "${YTDLP_BIN}"`)
    const { stdout } = await execAsync(`${YTDLP_BIN} --version`)
    console.log(`[yt-dlp] Binaire prêt, version : ${stdout.trim()}`)
    ytdlpReady = true
    return YTDLP_BIN
  } catch (err) {
    console.error('[yt-dlp] Échec du téléchargement du binaire :', err.message)
    throw new Error('Impossible de préparer yt-dlp. Vérifie la connexion réseau de Render.')
  }
}

/**
 * Prépare le fichier de cookies (utilise le fichier local ou la variable d'env)
 */
export async function prepareCookies() {
  // 1. Fichier cookies local dans le projet
  try {
    const stats = await fs.stat(LOCAL_COOKIES_FILE)
    if (stats.isFile()) {
      return LOCAL_COOKIES_FILE
    }
  } catch {
    // Pas de fichier local, on continue
  }

  // 2. Variable d'environnement base64 (idéal pour Render / Railway)
  if (!COOKIES_BASE64) return null

  try {
    const cookiesContent = Buffer.from(COOKIES_BASE64, 'base64').toString('utf-8')
    await fs.mkdir(path.dirname(TMP_COOKIES_PATH), { recursive: true })
    await fs.writeFile(TMP_COOKIES_PATH, cookiesContent)
    return TMP_COOKIES_PATH
  } catch (err) {
    console.error('[yt-dlp] Erreur préparation cookies :', err.message)
    return null
  }
}

/**
 * Retourne les options optimisées pour yt-dlp-exec
 * Compatible avec Render (IPv4 forcé, headers custom, bypass restrictions)
 *
 * @param {string} url   - L'URL YouTube
 * @param {Object} extra - Options supplémentaires (format, output, etc.)
 */
export async function getYtdlpOptions(url, extra = {}) {
  // S'assure que le binaire est dispo et récupère son chemin
  const binPath = await ensureYtdlp()

  const cookies = await prepareCookies()

  const options = {
    // ── Chemin vers le binaire téléchargé ──────────────────────────────
    binaryPath: binPath,

    // ── Options passées par l'appelant (format, output, audioFormat…) ──
    ...extra,

    // ── Comportement général ───────────────────────────────────────────
    quiet: true,
    noWarnings: true,
    noCallHome: true,
    noCheckCertificate: true,
    noPlaylist: true,
    forceIpv4: true,      // Indispensable sur Render pour éviter les blocages IPv6

    // ── Headers HTTP pour imiter un vrai navigateur ────────────────────
    // yt-dlp-exec accepte addHeader comme tableau de strings "Nom: valeur"
    addHeader: [
      'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'referer:https://www.youtube.com/',
      ...(extra.addHeader || [])
    ],

    // ── Clients YouTube à essayer (format correct pour yt-dlp-exec) ────
    // La clé camelCase "extractorArgs" est convertie en --extractor-args
    // La valeur doit être une string "youtube:player_client=..."
    extractorArgs: 'youtube:player_client=android_vr,web_creator,ios,android',
  }

  // Ajout des cookies si disponibles
  if (cookies) {
    options.cookies = cookies
  }

  return options
}

/**
 * Nettoie le fichier de cookies temporaire après usage
 */
export async function cleanupCookies() {
  try {
    await fs.unlink(TMP_COOKIES_PATH)
  } catch { }
}
