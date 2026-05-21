// commands/say.js - Text-to-Speech (TTS)
// Version optimisée avec support Opus (.ogg) pour WhatsApp voice notes
import gtts from 'gtts'
import fs from 'fs'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'

const tempDir = path.join(process.cwd(), 'tmp')
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true })
}

/**
 * Fonction pour convertir un fichier audio en Opus (.ogg) avec option de voix grave
 * @param {string} inputPath 
 * @param {string} outputPath 
 * @param {boolean} deepVoice
 * @returns {Promise<void>}
 */
async function convertToOpus(inputPath, outputPath, deepVoice = false) {
  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath)
      .toFormat('ogg')
      .audioCodec('libopus')

    if (deepVoice) {
      // Baisse le pitch (asetrate) et compense la vitesse (atempo)
      // 0.8 = ~20% plus grave
      command.audioFilters([
        'asetrate=44100*0.8',
        'atempo=1.25'
      ])
    }

    command
      .on('error', (err) => {
        console.error('Erreur conversion FFmpeg:', err)
        reject(err)
      })
      .on('end', () => resolve())
      .save(outputPath)
  })
}

export default async function (sock, msg, args) {
  const from = msg.key.remoteJid

  if (!args.length) {
    return sock.sendMessage(from, {
      text: `╭──────────────────────╮ 
             │ 🎤 *TEXT TO SPEECH*  │
             ╰──────────────────────╯

❌ *Usage :*
-say <texte>
-say <langue> <texte>
-say ai <texte> - Avec IA

📝 *Exemples :*
• -say Bonjour tout le monde
• -say en Hello everyone
• -say ai Raconte-moi une blague

🌍 *Langues :* fr, en, es, de, it, pt, ar, ja, ko...

━━━━━━━━━━━━━━━━━━━━
🎤 Convertit texte en vocal!`
    }, { quoted: msg })
  }

  const audioPathMp3 = path.join(tempDir, `tts_${Date.now()}.mp3`)
  const audioPathOpus = path.join(tempDir, `tts_${Date.now()}.opus`)

  try {
    // 1. Analyse des arguments
    const useAI = args[0]?.toLowerCase() === 'ai'
    let text = args.join(' ')
    let lang = 'fr'

    if (useAI) {
      const prompt = args.slice(1).join(' ')
      if (!prompt) {
        return sock.sendMessage(from, { text: '❌ Précise un texte après "ai".' }, { quoted: msg })
      }

      const { chatCompletion, AI_MODELS } = await import('../utils/groq.js')
      const response = await chatCompletion(AI_MODELS.LLAMA_3_1_8B, [{ role: 'user', content: prompt }])
      text = response.trim().substring(0, 500)
    } else {
      const supportedLangs = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ar', 'ja', 'ko', 'zh', 'ru']
      if (supportedLangs.includes(args[0]?.toLowerCase())) {
        lang = args[0].toLowerCase()
        text = args.slice(1).join(' ')
      }
    }

    if (!text || text.trim().length === 0) {
      return sock.sendMessage(from, { text: '❌ Texte vide.' }, { quoted: msg })
    }

    // 2. Génération MP3 via gTTS
    const tts = new gtts(text, lang)
    await new Promise((resolve, reject) => {
      tts.save(audioPathMp3, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    // 3. Conversion en Opus pour WhatsApp (avec voix grave forcée)
    await convertToOpus(audioPathMp3, audioPathOpus, true)

    // 4. Envoi de l'audio
    const audioBuffer = fs.readFileSync(audioPathOpus)

    await sock.sendMessage(from, {
      audio: audioBuffer,
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true
    }, { quoted: msg })

  } catch (err) {
    console.error('Erreur .say:', err)
    await sock.sendMessage(from, { text: `❌ Erreur : ${err.message || 'Inconnue'}` }, { quoted: msg })
  } finally {
    // Nettoyage des fichiers temporaires
    try {
      if (fs.existsSync(audioPathMp3)) fs.unlinkSync(audioPathMp3)
      if (fs.existsSync(audioPathOpus)) fs.unlinkSync(audioPathOpus)
    } catch (e) {}
  }
}
