import fs from 'fs/promises'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import sharp from 'sharp'
import { fileTypeFromBuffer } from 'file-type'
import { downloadMediaMessage } from '@whiskeysockets/baileys'

const execFileP = promisify(execFile)

async function tmpFilePath(ext = '') {
  const name = `toimage_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`
  return `${os.tmpdir()}/${name}`
}

async function convertAnimatedWebpWithFFmpeg(buffer, animatedOutput = 'mp4') {
  try {
    await execFileP('ffmpeg', ['-version'])
  } catch {
    throw new Error('ffmpeg requis pour convertir les stickers animés mais indisponible.')
  }

  const inputPath = await tmpFilePath('.webp')
  const outputExt = animatedOutput === 'mp4' ? '.mp4' : '.gif'
  const outputPath = await tmpFilePath(outputExt)
  let palettePath = null

  try {
    await fs.writeFile(inputPath, buffer)

    if (animatedOutput === 'mp4') {
      await execFileP('ffmpeg', ['-y', '-i', inputPath, '-movflags', 'faststart', '-pix_fmt', 'yuv420p', outputPath])
    } else {
      palettePath = await tmpFilePath('.png')
      try {
        await execFileP('ffmpeg', ['-y', '-i', inputPath, '-vf', 'fps=15,palettegen', palettePath])
        await execFileP('ffmpeg', ['-y', '-i', inputPath, '-i', palettePath, '-lavfi', 'fps=15,paletteuse', outputPath])
      } finally {
        if (palettePath) {
          await fs.unlink(palettePath).catch(() => {})
        }
      }
    }

    const outBuffer = await fs.readFile(outputPath)
    return {
      buffer: outBuffer,
      ext: outputExt.slice(1),
      mime: animatedOutput === 'mp4' ? 'video/mp4' : 'image/gif'
    }
  } finally {
    await fs.unlink(inputPath).catch(() => {})
    await fs.unlink(outputPath).catch(() => {})
  }
}

async function stickerToImage(buffer, options = {}) {
  const { format = 'png', animatedOutput = 'mp4', quality = 90 } = options

  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('Le paramètre doit être un Buffer.')
  }

  const ft = await fileTypeFromBuffer(buffer)
  if (!ft || !ft.mime.includes('webp')) {
    throw new Error('Le buffer fourni n\'est pas un fichier WebP (sticker attendu).')
  }

  try {
    const meta = await sharp(buffer, { animated: true }).metadata()
    const pages = meta.pages || 1
    const isAnimated = pages > 1

    if (!isAnimated) {
      if (format === 'png') {
        return {
          buffer: await sharp(buffer).png().toBuffer(),
          ext: 'png',
          mime: 'image/png'
        }
      }
      if (format === 'jpeg' || format === 'jpg') {
        return {
          buffer: await sharp(buffer).jpeg({ quality }).toBuffer(),
          ext: 'jpg',
          mime: 'image/jpeg'
        }
      }
      throw new Error('Format non supporté (utiliser png ou jpeg).')
    }

    return await convertAnimatedWebpWithFFmpeg(buffer, animatedOutput)
  } catch (err) {
    try {
      return await convertAnimatedWebpWithFFmpeg(buffer, animatedOutput)
    } catch (e2) {
      throw new Error(`Impossible de convertir le sticker: ${err.message} / ${e2.message}`)
    }
  }
}

async function saveBufferToFile(buffer, filePath) {
  await fs.writeFile(filePath, buffer)
  return filePath
}

export default async function (sock, msg) {
  const from = msg.key.remoteJid
  let outputPath = null

  try {
    let stickerMsg = null

    if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage) {
      const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage.stickerMessage
      stickerMsg = { message: { stickerMessage: quoted }, key: msg.key }
    } else if (msg.message?.stickerMessage) {
      stickerMsg = msg
    }

    if (!stickerMsg?.message?.stickerMessage) {
      await sock.sendMessage(from, {
        text: '🖼️ *Conversion Sticker → Image*\n\nRéponds à un sticker avec `.toimage` pour le convertir en image.'
      }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, {
      text: '⏳ Conversion du sticker en image...'
    }, { quoted: msg })

    const buffer = await downloadMediaMessage(
      stickerMsg,
      'buffer',
      {},
      {
        logger: console,
        reuploadRequest: sock.updateMediaMessage
      }
    )

    if (!buffer) {
      throw new Error('Sticker vide ou introuvable')
    }

    const result = await stickerToImage(buffer, { format: 'png', animatedOutput: 'mp4' })
    outputPath = await tmpFilePath(`.${result.ext}`)
    await saveBufferToFile(result.buffer, outputPath)

    if (result.mime.startsWith('image/')) {
      await sock.sendMessage(from, {
        image: { url: outputPath },
        caption: '✅ Sticker converti en image.'
      }, { quoted: msg })
    } else if (result.mime === 'video/mp4') {
      await sock.sendMessage(from, {
        video: { url: outputPath },
        gifPlayback: true,
        caption: '✅ Sticker animé converti en vidéo.'
      }, { quoted: msg })
    } else {
      await sock.sendMessage(from, {
        document: { url: outputPath, mimetype: result.mime, fileName: `sticker.${result.ext}` },
        caption: '✅ Sticker converti.'
      }, { quoted: msg })
    }

  } catch (err) {
    console.error('Erreur .toimage:', err)

    await sock.sendMessage(from, {
      text: '❌ Impossible de convertir ce sticker en image.'
    }, { quoted: msg })
  } finally {
    if (outputPath) {
      try {
        await fs.unlink(outputPath)
      } catch {}
    }
  }
}
