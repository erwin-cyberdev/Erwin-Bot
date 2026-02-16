import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import FormData from 'form-data'

const writeFile = promisify(fs.writeFile)
const unlink = promisify(fs.unlink)

const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const GROQ_API_KEY = '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'
const TIMEOUT_MS = 60000

export default async function transcribeCommand(sock, msg, args) {
    const from = msg.key.remoteJid

    const quotedInfo = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const audioMsg = msg.message?.audioMessage || quotedInfo?.audioMessage

    if (!audioMsg) {
        return sock.sendMessage(from, {
            text: `🎤 *Transcription Vocale (Groq)*
            
❌ Usage :
Réponds à un message vocal avec \`.transcribe\`

💡 Rapide et précis avec Groq Whisper.`
        }, { quoted: msg })
    }

    await sock.sendMessage(from, { text: '🎤 Transcription en cours (Groq)...' }, { quoted: msg })

    let tempFile = null

    try {
        const mediaSource = msg.message?.extendedTextMessage?.contextInfo || msg
        const buffer = await sock.downloadMediaMessage(mediaSource, { timeout: 20000 })

        if (!buffer || !Buffer.isBuffer(buffer)) {
            throw new Error('Impossible de télécharger l\'audio')
        }

        const tmpDir = path.join(process.cwd(), 'tmp')
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

        tempFile = path.join(tmpDir, `voice_${Date.now()}.ogg`)
        await writeFile(tempFile, buffer)

        const formData = new FormData()
        formData.append('file', fs.createReadStream(tempFile))
        formData.append('model', 'whisper-large-v3-turbo')

        const response = await fetch(GROQ_WHISPER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                ...formData.getHeaders()
            },
            body: formData,
            timeout: TIMEOUT_MS
        })

        const json = await response.json()

        if (!response.ok) {
            throw new Error(json?.error?.message || `Erreur API Groq ${response.status}`)
        }

        const transcription = json?.text?.trim()

        if (!transcription) {
            throw new Error('Aucune transcription générée')
        }

        await sock.sendMessage(from, {
            text: `🎤 *Transcription :*\n\n${transcription}`
        }, { quoted: msg })

    } catch (err) {
        console.error('❌ Erreur .transcribe Groq:', err)
        await sock.sendMessage(from, { text: `❗ Erreur : ${err.message}` }, { quoted: msg })
    } finally {
        if (tempFile && fs.existsSync(tempFile)) {
            try { await unlink(tempFile) } catch { }
        }
    }
}
