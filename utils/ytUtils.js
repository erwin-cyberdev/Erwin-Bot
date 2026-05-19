// utils/ytUtils.js - Utilitaires pour yt-dlp et le bypass YouTube
import fs from 'fs/promises'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config()

const COOKIES_BASE64 = process.env.YOUTUBE_COOKIES_BASE64
const LOCAL_COOKIES_FILE = path.resolve('./youtube_cookies.txt')
const TMP_COOKIES_PATH = path.resolve('./tmp/youtube_cookies.txt')

/**
 * Prépare le fichier de cookies (utilise le fichier local ou la variable d'env)
 */
export async function prepareCookies() {
  // 1. Vérifier si l'utilisateur a mis le fichier .txt directement dans le projet
  try {
    const stats = await fs.stat(LOCAL_COOKIES_FILE)
    if (stats.isFile()) {
      return LOCAL_COOKIES_FILE // On utilise directement son fichier
    }
  } catch (err) {
    // Le fichier local n'existe pas, on continue
  }

  // 2. Sinon, on utilise la variable d'environnement base64 (idéal pour Railway)
  if (!COOKIES_BASE64) return null

  try {
    const cookiesContent = Buffer.from(COOKIES_BASE64, 'base64').toString('utf-8')
    await fs.mkdir(path.dirname(TMP_COOKIES_PATH), { recursive: true })
    await fs.writeFile(TMP_COOKIES_PATH, cookiesContent)
    return TMP_COOKIES_PATH
  } catch (err) {
    console.error('Erreur lors de la préparation des cookies YouTube:', err.message)
    return null
  }
}

/**
 * Retourne les options optimisées pour yt-dlp
 * @param {string} url - L'URL YouTube
 * @param {Object} extra - Options supplémentaires (format, output, etc.)
 */
export async function getYtdlpOptions(url, extra = {}) {
  const cookies = await prepareCookies()
  
  const options = {
    ...extra,
    quiet: true,
    noWarnings: true,
    noCallHome: true,
    noCheckCertificate: true,
    noPlaylist: true,
    forceIpv4: true, // Souvent nécessaire sur Render pour éviter les blocs IP terminaux
    addHeader: [
      'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer: https://www.youtube.com/',
      ...(extra.addHeader || [])
    ],
    // Utilisation de clients variés pour contourner les restrictions
    extractorArgs: 'youtube:player_client=android_vr,web_creator,ios,android'
  }

  if (cookies) {
    options.cookies = cookies
  }

  return options
}

/**
 * Nettoie le fichier de cookies après usage (optionnel)
 */
export async function cleanupCookies() {
  try {
    await fs.unlink(TMP_COOKIES_PATH)
  } catch { }
}
