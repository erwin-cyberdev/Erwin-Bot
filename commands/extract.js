// commands/extract.js
import { downloadContentFromMessage } from '@whiskeysockets/baileys'
import fs from 'fs'
import path from 'path'

const tempDirRoot = path.join(process.cwd(), 'temp')

// helper pour répondre en mentionnant l'auteur si possible
async function replyWithTag(sock, remoteJid, msg, text) {
  try {
    const mention = msg.key.participant ? [msg.key.participant] : []
    await sock.sendMessage(remoteJid, { text }, { quoted: msg })
    // note : si tu veux explicitement mentionner :
    // await sock.sendMessage(remoteJid, { text, contextInfo: { mentionedJid: mention } })
  } catch (e) {
    console.error('replyWithTag error', e)
  }
}

export default async function (sock, msg, args = []) {
  const remoteJid = msg.key.remoteJid
  let tmpPath
  try {
    // vérifier que l'utilisateur a répondu (reply) au message contenant le média
    const ctxInfo = msg.message?.extendedTextMessage?.contextInfo
    const quotedMsg = ctxInfo?.quotedMessage

    if (!quotedMsg) {
      return await replyWithTag(sock, remoteJid, msg, '❌ Usage: réponds au message contenant le média (image / vidéo / note vocale) avec la commande `.extract`.')
    }

    // Support view once et message classique
    const mediaMsg =
      quotedMsg.viewOnceMessage?.message ||
      quotedMsg.viewOnceMessageV2?.message ||
      quotedMsg

    // détecter les types supportés
    const content =
      mediaMsg.imageMessage ||
      mediaMsg.videoMessage ||
      mediaMsg.audioMessage ||
      mediaMsg.stickerMessage

    if (!content) {
      return await replyWithTag(sock, remoteJid, msg, '❌ Le message répondu ne contient pas d\'image, vidéo, audio/voice note ou sticker.')
    }

    // déterminer type et extension
    let mediaType = 'image'
    let ext = 'jpg'
    if (mediaMsg.videoMessage) { mediaType = 'video'; ext = 'mp4' }
    else if (mediaMsg.audioMessage) { mediaType = 'audio'; ext = 'ogg' }
    else if (mediaMsg.stickerMessage) { mediaType = 'sticker'; ext = 'webp' }
    else if (mediaMsg.imageMessage) { mediaType = 'image'; ext = 'jpg' }

    // préparer dossier temp
    if (!fs.existsSync(tempDirRoot)) fs.mkdirSync(tempDirRoot, { recursive: true })
    const tmpName = `erwin_extract_${Date.now()}.${ext}`
    tmpPath = path.join(tempDirRoot, tmpName)

    await replyWithTag(sock, remoteJid, msg, '⏳ Téléchargement du média en cours...')

    // télécharger le contenu via baileys helper
    let buffer = Buffer.alloc(0)
    try {
      const stream = await downloadContentFromMessage(content, mediaType)
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk])
      }
      fs.writeFileSync(tmpPath, buffer)
    } catch (err) {
      console.error('[extract] downloadContentFromMessage error', err)
      return await replyWithTag(sock, remoteJid, msg, '❌ Échec du téléchargement du média (décryptage ou stream).')
    }

    // préparer objet d'envoi selon type
    let sendMsg
    if (mediaType === 'image') {
      sendMsg = { image: { url: tmpPath }, caption: '📸 Média extrait' }
    } else if (mediaType === 'video') {
      sendMsg = { video: { url: tmpPath }, caption: '🎬 Média extrait' }
    } else if (mediaType === 'audio') {
      sendMsg = { audio: { url: tmpPath }, mimetype: 'audio/ogg' }
    } else if (mediaType === 'sticker') {
      sendMsg = { sticker: { url: tmpPath } }
    } else {
      sendMsg = { document: { url: tmpPath }, caption: '📁 Média extrait' }
    }

    // envoyer le fichier à l'auteur du message (si participant present) ou au chat
    const reactorJid = msg.key.participant || remoteJid
    await sock.sendMessage(reactorJid, sendMsg)
    // aussi envoyer dans le chat d'origine si différent
    if (reactorJid !== remoteJid) {
      await sock.sendMessage(remoteJid, sendMsg)
    }

    await replyWithTag(sock, remoteJid, msg, '✅ Média extrait et envoyé.')

    // nettoyage (delai court pour s'assurer que baileys a fini de lire le fichier)

  } catch (err) {
    console.error('[extract] erreur générale', err)
    try { await replyWithTag(sock, remoteJid, msg, '❌ Erreur lors de l\'extraction du média.'); } catch {}
  } finally {
    // nettoyage (delai court pour s'assurer que baileys a fini de lire le fichier)
    if (tmpPath) {
      setTimeout(() => {
        try {
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
        } catch {}
      }, 2000)
    }
  }
}
