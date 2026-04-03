import { transcribeAudio } from '../utils/groq.js'
import fs from 'fs'
import path from 'path'

export default async function transcribeCommand(sock, msg, args) {
    const from = msg.key.remoteJid
    const quotedInfo = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    
    // Detect audio in current message or quoted message
    const audioMsg = msg.message?.audioMessage || quotedInfo?.audioMessage

    if (!audioMsg) {
        return await sock.sendMessage(from, { 
            text: '🎤 *Transcription Vocale*\n\nUsage : Répondez à un vocal avec `-transcribe` pour obtenir le texte.' 
        }, { quoted: msg })
    }

    await sock.sendMessage(from, { text: '🎤 Transcription en cours (Groq)...' }, { quoted: msg })

    let tempFile = null
    try {
        // Download audio
        const mediaSource = msg.message?.extendedTextMessage?.contextInfo || msg
        const buffer = await sock.downloadMediaMessage(mediaSource, { timeout: 30000 })
        
        if (!buffer) throw new Error('Impossible de télécharger l\'audio')

        // Save to temp file
        const tmpDir = path.join(process.cwd(), 'tmp')
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
        
        tempFile = path.join(tmpDir, `transcribe_${Date.now()}.ogg`)
        fs.writeFileSync(tempFile, buffer)

        // Transcribe using Groq
        const transcription = await transcribeAudio(tempFile)

        if (!transcription) throw new Error('Aucun texte n\'a pu être extrait de cet audio.')

        return await sock.sendMessage(from, { 
            text: `🎤 *Transcription :*\n\n${transcription}` 
        }, { quoted: msg })

    } catch (err) {
        console.error('Erreur Transcribe:', err)
        return await sock.sendMessage(from, { 
            text: `❌ Erreur lors de la transcription : ${err.message}` 
        }, { quoted: msg })
    } finally {
        // Cleanup
        if (tempFile && fs.existsSync(tempFile)) {
            try { fs.unlinkSync(tempFile) } catch (e) {}
        }
    }
}
