import { GoogleGenerativeAI } from '@google/generative-ai'
import { chatCompletion, AI_MODELS } from '../utils/openRouter.js'

// Clé API Gemini fallback
const GEMINI_API_KEY = 'AIzaSyDztlCEel4jrWOcWWuUSfywtg4Z_N5MeHw'

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

export default async function aiCommand(sock, msg, args) {
    const from = msg.key.remoteJid
    const prompt = args.join(' ')

    if (!prompt) {
        await sock.sendMessage(from, { text: '💡 Utilisation : `.ai <votre question>`' }, { quoted: msg })
        return
    }

    await sock.sendMessage(from, { text: '🤖 Erwin-Bot réfléchit...' }, { quoted: msg })

    try {
        // 1. Essayer OpenRouter (Gemini via OpenRouter)
        try {
            const response = await chatCompletion(AI_MODELS.GEMINI, [{ role: 'user', content: prompt }])
            if (response) {
                return await sock.sendMessage(from, { text: `🤖 *Erwin-AI :*\n\n${response}` }, { quoted: msg })
            }
        } catch (orError) {
            console.error('Erreur OpenRouter, tentative fallback Gemini SDK:', orError.message)
        }

        // 2. Fallback sur Gemini SDK direct
        const result = await geminiModel.generateContent(prompt)
        const responseText = result.response.text()

        if (!responseText) throw new Error('Réponse vide de Gemini SDK')

        await sock.sendMessage(from, { text: `✨ *Erwin-AI (Fallback) :*\n\n${responseText}` }, { quoted: msg })

    } catch (error) {
        console.error('Erreur AI totale:', error)
        await sock.sendMessage(from, {
            text: '❌ Désolé, le système IA est temporairement indisponible. Réessaye plus tard.'
        }, { quoted: msg })
    }
}
