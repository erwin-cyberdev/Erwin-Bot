// commands/song.js
import { randomUUID } from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import yts from 'yt-search'
import ytdlp from 'yt-dlp-exec'
import { getYtdlpOptions } from '../utils/ytUtils.js'

// /tmp est accessible en écriture sur Render (contrairement au dossier du projet)
const TEMP_DIR = path.resolve('./tmp/song')
const MAX_AUDIO_BYTES = 30 * 1024 * 1024 // 30 MB

async function ensureTempDir() {
  await fs.mkdir(TEMP_DIR, { recursive: true })
}

export default async function songCommand(sock, msg, args) {
  const from = msg.key.remoteJid
  const query = args.join(' ').trim()

  if (!query) {
    return sock.sendMessage(from, {
      text: '❗ *Usage:* .song <titre de la chanson>'
    }, { quoted: msg })
  }

  await ensureTempDir()

  // ── 1. Recherche YouTube ─────────────────────────────────────────────
  let video
  try {
    const search = await yts(query)
    video = search?.videos?.[0]
    if (!video) {
      return sock.sendMessage(from, {
        text: '🔍 Aucun résultat trouvé.'
      }, { quoted: msg })
    }
  } catch (err) {
    console.error('[song] Erreur recherche yts :', err.message)
    return sock.sendMessage(from, {
      text: '❗ Impossible de chercher cette chanson. Essaie à nouveau.'
    }, { quoted: msg })
  }

  const { title, url, timestamp, views, ago, author, thumbnail } = video
  const viewsFormatted = typeof views === 'number'
    ? views.toLocaleString('fr-FR')
    : views ?? '—'

  // ── 2. Message d'info + miniature ───────────────────────────────────
  const infoText = `
╭─────────────────────╮
│  🎵 *SONG DOWNLOADER*  │
╰─────────────────────╯

🎶 *Titre :*
   ${title}

🎤 *Artiste/Chaîne :*
   ${author?.name ?? 'Inconnu'}

⏱️ *Durée :* ${timestamp}
👁️ *Vues :* ${viewsFormatted}
📅 *Publié :* ${ago}

🔗 *Lien :*
   ${url}

⏳ *Téléchargement en cours...*
━━━━━━━━━━━━━━━━━━━━
📥 Extraction audio MP3 via yt-dlp
⌛ Patiente quelques secondes...
  `.trim()

  try {
    if (thumbnail) {
      await sock.sendMessage(from, {
        image: { url: thumbnail },
        caption: infoText
      }, { quoted: msg })
    } else {
      await sock.sendMessage(from, { text: infoText }, { quoted: msg })
    }
  } catch {
    // Si l'envoi de la miniature échoue, on envoie juste le texte
    await sock.sendMessage(from, { text: infoText }, { quoted: msg })
  }

  // ── 3. Téléchargement audio ──────────────────────────────────────────
  const tempId = randomUUID()
  const outputPath = path.join(TEMP_DIR, `${tempId}.m4a`)

  try {
    const ytdlpOptions = await getYtdlpOptions(url, {
      output: outputPath,
      format: 'bestaudio[ext=m4a]/bestaudio/best',
      extractAudio: true,
      audioFormat: 'm4a',
      audioQuality: '0',
      // Taille max passée à yt-dlp pour éviter de télécharger un fichier géant
      maxFilesize: `${Math.floor(MAX_AUDIO_BYTES / (1024 * 1024))}M`
    })

    // yt-dlp-exec ne retourne PAS stdout/stderr — il throw si ça échoue
    await ytdlp(url, ytdlpOptions)

    // ── 4. Vérification du fichier produit ──────────────────────────────
    let fileData
    try {
      fileData = await fs.readFile(outputPath)
    } catch {
      throw new Error('Fichier audio introuvable après téléchargement.')
    }

    if (!fileData.length) {
      throw new Error('Fichier audio vide.')
    }

    if (fileData.length > MAX_AUDIO_BYTES) {
      const sizeMB = (fileData.length / (1024 * 1024)).toFixed(2)
      return sock.sendMessage(from, {
        text: `🚫 Fichier trop volumineux (${sizeMB} MB). Limite : ${Math.round(MAX_AUDIO_BYTES / 1024 / 1024)} MB.`
      }, { quoted: msg })
    }

    // ── 5. Envoi de l'audio ─────────────────────────────────────────────
    const sizeInMB = (fileData.length / (1024 * 1024)).toFixed(2)

    await sock.sendMessage(from, {
      audio: fileData,
      mimetype: 'audio/mp4',
      fileName: `${title}.m4a`
    }, { quoted: msg })

    await sock.sendMessage(from, {
      text: `✅ *Téléchargement terminé !*\n\n🎵 *Titre :* ${title}\n💾 *Taille :* ${sizeInMB} MB\n🎶 *Format :* M4A\n━━━━━━━━━━━━━━━━━\n🎵 Bonne écoute !`
    }, { quoted: msg })

  } catch (downloadErr) {
    console.error('[song] Erreur yt-dlp :', downloadErr?.message ?? downloadErr)

    // Message d'erreur lisible selon la cause probable
    let errMsg = '❗ Impossible de télécharger cette chanson.'
    const msg_ = downloadErr?.message ?? ''
    if (msg_.includes('Sign in') || msg_.includes('cookies')) {
      errMsg += '\n🍪 YouTube demande une authentification. Configure la variable `YOUTUBE_COOKIES_BASE64`.'
    } else if (msg_.includes('too large') || msg_.includes('maxfilesize')) {
      errMsg += '\n📦 Le fichier dépasse la limite de taille autorisée.'
    } else if (msg_.includes('unavailable') || msg_.includes('private')) {
      errMsg += '\n🔒 La vidéo est privée ou indisponible dans ta région.'
    } else {
      errMsg += '\n💡 La vidéo est peut-être restreinte. Essaie un autre titre.'
    }

    await sock.sendMessage(from, { text: errMsg }, { quoted: msg })

  } finally {
    // Nettoyage du fichier temporaire dans tous les cas
    try { await fs.rm(outputPath, { force: true }) } catch { }
  }
}
