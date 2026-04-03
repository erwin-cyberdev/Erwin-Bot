// utils/ytUtils.js - Utilitaires pour yt-dlp et le bypass YouTube
import fs from 'fs/promises'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config()

const COOKIES_BASE64 = process.env.YOUTUBE_COOKIES_BASE64
const COOKIES_PATH = path.resolve('./tmp/youtube_cookies.txt')

/**
 * Prépare le fichier de cookies si une variable d'env est présente
 */
export async function prepareCookies() {
  if (!COOKIES_BASE64) return null

  try {
    const cookiesContent = Buffer.from(COOKIES_BASE64, 'base64').toString('utf-8')
    await fs.mkdir(path.dirname(COOKIES_PATH), { recursive: true })
    await fs.writeFile(COOKIES_PATH, cookiesContent)
    return COOKIES_PATH
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
    await fs.unlink(COOKIES_PATH)
  } catch { }
}
