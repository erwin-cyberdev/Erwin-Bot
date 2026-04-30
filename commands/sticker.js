// commands/sticker.js - Convertit image/vidéo en sticker
import fs from 'fs/promises'
import path from 'path'
import { Sticker, StickerTypes } from 'wa-sticker-formatter'
import { downloadMediaMessage } from 'baileys'

const TEMP_DIR = path.resolve('./tmp/stickers')
const MAX_IMAGE_BYTES = 1024 * 1024 // 1MB
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 // 2MB

async function ensureTempDir() {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true })
  } catch {}
}

export default async function (sock, msg) {
  const from = msg.key.remoteJid

  try {
    let mediaMsg = null
    let mediaType = null

    // 1. Vérifier si c'est une réponse à un message
    if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      const quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage
      
      // Image quotée
      if (quotedMsg.imageMessage) {
        mediaMsg = { message: { imageMessage: quotedMsg.imageMessage }, key: msg.key }
        mediaType = 'image'
      }
      // Vidéo quotée
      else if (quotedMsg.videoMessage) {
        mediaMsg = { message: { videoMessage: quotedMsg.videoMessage }, key: msg.key }
        mediaType = 'video'
      }
      // Sticker quoté (pour convertir en image)
      else if (quotedMsg.stickerMessage) {
        mediaMsg = { message: { stickerMessage: quotedMsg.stickerMessage }, key: msg.key }
        mediaType = 'sticker'
      }
    }
    // 2. Vérifier si le message contient directement une image
    else if (msg.message?.imageMessage) {
      mediaMsg = msg
      mediaType = 'image'
    }
    // 3. Vérifier si le message contient directement une vidéo
    else if (msg.message?.videoMessage) {
      mediaMsg = msg
      mediaType = 'video'
    }

    // Aucun média trouvé
    if (!mediaMsg || !mediaType) {
      return await sock.sendMessage(from, {
        text: '🖼️ *Créateur de Sticker*\n\n*Usage :*\n1. Réponds à une image/vidéo avec `.sticker`\n2. Envoie une image avec `.sticker` en légende\n\n*Exemples :*\n• Réponds à une photo → `.sticker`\n• Envoie une photo avec légende `.sticker`\n\n💡 Vidéos max 10 secondes'
      }, { quoted: msg })
    }

    // Vérifier durée vidéo (max 10s pour stickers)
    if (mediaType === 'video') {
      const videoMsg = mediaMsg.message.videoMessage
      const duration = videoMsg?.seconds || 0
      
      if (duration > 10) {
        return await sock.sendMessage(from, {
          text: '⚠️ La vidéo est trop longue. Maximum 10 secondes pour un sticker.'
        }, { quoted: msg })
      }
    }

    await ensureTempDir()
    await sock.sendMessage(from, {
      text: '⏳ Création du sticker en cours...'
    }, { quoted: msg })

    // Télécharger le média
    const buffer = await downloadMediaMessage(
      mediaMsg,
      'buffer',
      {},
      {
        logger: console,
        reuploadRequest: sock.updateMediaMessage
      }
    )

    if (!buffer) {
      throw new Error('Impossible de télécharger le média')
    }

    if (mediaType === 'image' && buffer.length > MAX_IMAGE_BYTES) {
      return await sock.sendMessage(from, {
        text: '❗ Image trop volumineuse. Taille max 1MB pour les stickers.'
      }, { quoted: msg })
    }

    if (mediaType === 'video' && buffer.length > MAX_VIDEO_BYTES) {
      return await sock.sendMessage(from, {
        text: '❗ Vidéo trop volumineuse. Taille max 2MB pour les stickers animés.'
      }, { quoted: msg })
    }

    const tempPath = path.join(TEMP_DIR, `${Date.now()}-${Math.random().toString(36).slice(2)}.${mediaType === 'video' ? 'mp4' : 'webp'}`)

    try {
      await fs.writeFile(tempPath, buffer)

      const sticker = new Sticker(buffer, {
        pack: 'Erwin-Bot',
        author: 'Created by Erwin-Bot',
        type: mediaType === 'video' ? StickerTypes.FULL : StickerTypes.CROPPED,
        quality: mediaType === 'video' ? 40 : 60
      })

      const stickerBuffer = await sticker.toBuffer()

      await sock.sendMessage(from, {
        sticker: stickerBuffer
      }, { quoted: msg })

      await sock.sendMessage(from, {
        text: `✅ *Sticker créé !*\n\n🎨 Type : ${mediaType === 'image' ? 'Image' : 'Vidéo animée'}\n📦 Pack : Erwin-Bot`
      }, { quoted: msg })

    } finally {
      try { await fs.rm(tempPath, { force: true }) } catch {}
    }

  } catch (err) {
    console.error('Erreur .sticker:', err)

    let errorMsg = '❗ Impossible de créer le sticker.'
    
    if (err.message?.includes('download')) {
      errorMsg = '❗ Erreur lors du téléchargement du média. Réessaie.'
    } else if (err.message?.includes('format')) {
      errorMsg = '❗ Format de média non supporté. Utilise une image JPG/PNG ou vidéo MP4.'
    } else if (err.message?.includes('size')) {
      errorMsg = '❗ Le fichier est trop volumineux. Max 1MB pour les images, 2MB pour les vidéos.'
    } else if (err.message?.includes('10 seconds')) {
      errorMsg = '❗ La vidéo dépasse 10 secondes. Raccourcis-la avant de créer un sticker.'
    }

    await sock.sendMessage(from, {
      text: errorMsg
    }, { quoted: msg })
  }
}
