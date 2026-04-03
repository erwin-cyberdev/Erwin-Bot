import { chatCompletion, transcribeAudio, AI_MODELS } from '../utils/groq.js'
import fs from 'fs'
import path from 'path'

export default async function aiCommand(sock, msg, args) {
    const from = msg.key.remoteJid
    const prompt = args.join(' ').trim()
    const quotedInfo = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    
    const imageMsg = msg.message?.imageMessage || quotedInfo?.imageMessage
    const audioMsg = msg.message?.audioMessage || quotedInfo?.audioMessage

    if (audioMsg) {
        await sock.sendMessage(from, { text: '🎤 Transcription en cours...' }, { quoted: msg })
        let tempFile = null
        try {
            const buffer = await sock.downloadMediaMessage(msg.message?.extendedTextMessage?.contextInfo || msg)
            tempFile = path.join(process.cwd(), 'tmp', `voice_${Date.now()}.ogg`)
            if (!fs.existsSync(path.dirname(tempFile))) fs.mkdirSync(path.dirname(tempFile), { recursive: true })
            fs.writeFileSync(tempFile, buffer)
            const text = await transcribeAudio(tempFile)
            return await sock.sendMessage(from, { text: `🎤 *Transcription :*\n\n${text}` }, { quoted: msg })
        } catch (err) {
            return await sock.sendMessage(from, { text: `❌ Erreur : ${err.message}` }, { quoted: msg })
        } finally {
            if (tempFile && fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
        }
    }

    if (imageMsg) {
        await sock.sendMessage(from, { text: '👁️ Analyse de l\'image...' }, { quoted: msg })
        try {
            const buffer = await sock.downloadMediaMessage(msg.message?.extendedTextMessage?.contextInfo || msg)
            const messages = [{
                role: 'user',
                content: [
                    { type: 'text', text: prompt || "Décris cette image." },
                    { type: 'image_url', image_url: { url: `data:${imageMsg.mimetype || 'image/jpeg'};base64,${buffer.toString('base64')}` } }
                ]
            }]
            const res = await chatCompletion(AI_MODELS.VISION_LLAMA_11B, messages)
            return await sock.sendMessage(from, { text: `👁️ *Analyse :*\n\n${res}` }, { quoted: msg })
        } catch (err) {
            return await sock.sendMessage(from, { text: `❌ Erreur : ${err.message}` }, { quoted: msg })
        }
    }

    if (!prompt) return await sock.sendMessage(from, { text: '🤖 *Aide .ai*\n\n1. `.ai <question>`\n2. Réponds à une image avec `.ai` pour l\'analyser\n3. Réponds à un vocal avec `.ai` pour transcrire' }, { quoted: msg })

    await sock.sendMessage(from, { text: '🤖 Réflexion...' }, { quoted: msg })
    try {
        const res = await chatCompletion(AI_MODELS.LLAMA_3_3, [{ role: 'user', content: prompt }])
        return await sock.sendMessage(from, { text: `🤖 *Erwin-AI :*\n\n${res}` }, { quoted: msg })
    } catch (err) {
        return await sock.sendMessage(from, { text: `❌ Erreur : ${err.message}` }, { quoted: msg })
    }
}
