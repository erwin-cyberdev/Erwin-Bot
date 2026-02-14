import { downloadContentFromMessage } from '@whiskeysockets/baileys'
import fs from 'fs'
import path from 'path'

const tempDirRoot = path.join(process.cwd(), 'temp')

// helper pour répondre en mentionnant l'auteur si possible
async function replyWithTag(sock, remoteJid, msg, text) {
  try {
    const mention = msg.key.participant ? [msg.key.participant] : []
    await sock.sendMessage(remoteJid, { text }, { quoted: msg })
    // pour mention explicite :
    // await sock.sendMessage(remoteJid, { text, contextInfo: { mentionedJid: mention } })
  } catch (e) {
    console.error('replyWithTag error', e)
  }
}

export default async function (sock, msg, args = []) {
  const remoteJid = msg.key.remoteJid
  const executorJid = msg.key.participant || msg.key.remoteJid

  try {
    // vérifier que l'utilisateur a répondu (reply) au message contenant la story/status
    const ctxInfo = msg.message?.extendedTextMessage?.contextInfo
    const quotedMsg = ctxInfo?.quotedMessage

    if (!quotedMsg) {
      return await replyWithTag(sock, remoteJid, msg, '❌ Usage: réponds à la story (status) que tu veux télécharger avec la commande `.status`.')
    }

    // Certaines implémentations de WhatsApp délivrent les stories comme :
    // - quotedMsg.statusV3Message?.message
    // - quotedMsg.statusMessage
    // - quotedMsg.ephemeralMessage?.message
    // - ou simplement quotedMsg
    const statusMsg =
      quotedMsg.statusV3Message?.message ||
      quotedMsg.statusMessage ||
      quotedMsg.ephemeralMessage?.message ||
      quotedMsg

    const supportedKeys = [
      'imageMessage',
      'videoMessage',
      'audioMessage',
      'stickerMessage',
      'documentMessage'
    ]
    const mediaKey = supportedKeys.find(key => statusMsg?.[key])
    const content = mediaKey ? statusMsg[mediaKey] : null

    if (!content) {
      const isTextStatus = !!(
        statusMsg?.extendedTextMessage?.text ||
        statusMsg?.conversation
      )
      const noMediaMsg = isTextStatus
        ? "📝 Vous avez répondu à un statut textuel. Il n'y a rien à télécharger."
        : '❌ Le message répondu ne semble pas être une story contenant une image, vidéo, audio/voice note, sticker ou document.'
      return await replyWithTag(sock, remoteJid, msg, noMediaMsg)
    }

    const mediaTypeMap = {
      imageMessage: { mediaType: 'image', defaultExt: 'jpg' },
      videoMessage: { mediaType: 'video', defaultExt: 'mp4' },
      audioMessage: { mediaType: 'audio', defaultExt: 'ogg' },
      stickerMessage: { mediaType: 'sticker', defaultExt: 'webp' },
      documentMessage: { mediaType: 'document', defaultExt: 'bin' }
    }

    const { mediaType, defaultExt } = mediaTypeMap[mediaKey] || { mediaType: 'document', defaultExt: 'bin' }

    if (!content.mimetype && mediaType !== 'sticker') {
      return await replyWithTag(sock, remoteJid, msg, "📝 Vous avez répondu à un statut textuel. Il n'y a rien à télécharger.")
    }

    let ext = defaultExt
    const mime = content.mimetype || ''
    if (mime) {
      const parts = mime.split('/')
      if (parts.length > 1) {
        const sub = parts[1].split(';')[0].trim()
        if (sub) ext = sub
      }
    }

    const caption = (content.caption && content.caption.trim()) || null

    // préparer dossier temp
    if (!fs.existsSync(tempDirRoot)) fs.mkdirSync(tempDirRoot, { recursive: true })
    const tmpName = `status_extract_${Date.now()}.${ext}`
    const tmpPath = path.join(tempDirRoot, tmpName)

    await replyWithTag(sock, remoteJid, msg, '⏳ Téléchargement de la story en cours...')

    // télécharger le contenu via baileys helper
    let buffer = Buffer.alloc(0)
    try {
      const stream = await downloadContentFromMessage(content, mediaType)
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk])
      }
      fs.writeFileSync(tmpPath, buffer)
    } catch (err) {
      console.error('[status] downloadContentFromMessage error', err)
      return await replyWithTag(sock, remoteJid, msg, '❌ Échec du téléchargement du média (décryptage ou stream).')
    }

    // préparer objet d'envoi selon type
    let sendMsg
    if (mediaType === 'image') {
      sendMsg = { image: { url: tmpPath }, caption: caption || '📸 Story téléchargée' }
    } else if (mediaType === 'video') {
      sendMsg = { video: { url: tmpPath }, caption: caption || '🎬 Story téléchargée' }
    } else if (mediaType === 'audio') {
      sendMsg = { audio: { url: tmpPath }, mimetype: 'audio/ogg' }
    } else if (mediaType === 'sticker') {
      sendMsg = { sticker: { url: tmpPath } }
    } else if (mediaType === 'document') {
      const fileName = content.fileName || `status_document.${ext}`
      sendMsg = {
        document: { url: tmpPath },
        mimetype: content.mimetype || 'application/octet-stream',
        fileName,
        caption: caption || '📁 Story téléchargée'
      }
    } else {
      sendMsg = { document: { url: tmpPath }, caption: caption || '📁 Story téléchargée' }
    }

    // ENVOI UNIQUEMENT à l'exécutant de la commande
    try {
      await sock.sendMessage(executorJid, sendMsg)
    } catch (err) {
      console.error('[status] sendMessage to executor failed', err)
      await replyWithTag(sock, remoteJid, msg, '❌ Échec de l\'envoi de la story à l\'exécutant.')
      // nettoyage
      setTimeout(() => { try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath) } catch (e) {} }, 2000)
      return
    }

    // informer dans le chat d'origine sans joindre le média
    await replyWithTag(sock, remoteJid, msg, '✅ Story téléchargée et envoyée **seulement** à l\'exécutant de la commande.')

    // nettoyage (délai court pour s'assurer que baileys a fini de lire le fichier)
    setTimeout(() => {
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath) } catch (e) {}
    }, 2000)

  } catch (err) {
    console.error('[status] erreur générale', err)
    try { await replyWithTag(sock, remoteJid, msg, '❌ Erreur lors du téléchargement de la story.') } catch {}
  }
}
