/**
 * commands/transcribe.js
 * Convert voice/audio message to text using OpenRouter
 */
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const writeFile = promisify(fs.writeFile)
const unlink = promisify(fs.unlink)

const WHISPER_API_URL = 'https://openrouter.ai/api/v1/audio/transcriptions'
const TIMEOUT_MS = 60000

export default async function transcribeCommand(sock, msg, args) {
    const from = msg.key.remoteJid

    // Check for audio message (quoted or direct)
    const quotedInfo = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const audioMsg = msg.message?.audioMessage || quotedInfo?.audioMessage

    if (!audioMsg) {
        return sock.sendMessage(from, {
            text: `🎤 *Transcription Vocale*

❌ Usage :
Réponds à un message vocal avec \`.transcribe\`

💡 Fonctionne avec :
• Messages vocaux WhatsApp
• Notes audio
• Fichiers audio courts

⚠️ Limite : ~10 min`
        }, { quoted: msg })
    }

    // Check API key
    // API Key is hardcoded below

    await sock.sendMessage(from, {
        text: '🎤 Transcription en cours...'
    }, { quoted: msg })

    let tempFile = null

    try {
        // Download audio
        const mediaSource = msg.message?.extendedTextMessage?.contextInfo || msg
        const buffer = await sock.downloadMediaMessage(mediaSource, { timeout: 20000 })

        if (!buffer || !Buffer.isBuffer(buffer)) {
            throw new Error('Impossible de télécharger l\'audio')
        }

        // Save to temp file
        const tmpDir = path.join(process.cwd(), 'tmp')
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

        tempFile = path.join(tmpDir, `voice_${Date.now()}.ogg`)
        await writeFile(tempFile, buffer)

        // Prepare form data
        const formData = new FormData()
        formData.append('file', buffer, {
            filename: 'audio.ogg',
            contentType: audioMsg.mimetype || 'audio/ogg'
        })
        formData.append('model', 'whisper-1')

        // Call OpenRouter Whisper API
        const response = await fetch(WHISPER_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer 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`,
                'HTTP-Referer': 'https://erwin-bot.onrender.com',
                'X-Title': 'Erwin-Bot'
            },
            body: formData,
            timeout: TIMEOUT_MS
        })

        const json = await response.json()

        if (!response.ok) {
            throw new Error(json?.error?.message || `Erreur API ${response.status}`)
        }

        const transcription = json?.text?.trim()

        if (!transcription) {
            throw new Error('Aucune transcription générée')
        }

        await sock.sendMessage(from, {
            text: `🎤 *Transcription :*\n\n${transcription}`
        }, { quoted: msg })

    } catch (err) {
        console.error('❌ Erreur .transcribe:', err)

        let message = `❗ Erreur : ${err.message}`
        if (err.message.includes('Timeout')) message = '⌛ Délai dépassé (fichier trop long ?)'
        if (err.message.includes('télécharger')) message = '⚠️ Impossible de télécharger l\'audio'
        if (err.message.includes('401')) message = '⚠️ Clé API invalide'

        await sock.sendMessage(from, { text: message }, { quoted: msg })
    } finally {
        // Clean up temp file
        if (tempFile && fs.existsSync(tempFile)) {
            try {
                await unlink(tempFile)
            } catch (e) {
                console.warn('Could not delete temp file:', e)
            }
        }
    }
}
