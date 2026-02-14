import { GoogleGenerativeAI } from '@google/generative-ai'

// Clé API Gemini fournie par l'utilisateur
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

if (!GEMINI_API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY manquant dans le fichier .env ! La commande .ai ne fonctionnera pas.')
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

export default async function aiCommand(sock, msg, args) {
    const from = msg.key.remoteJid
    const prompt = args.join(' ')

    if (!prompt) {
        await sock.sendMessage(from, { text: '💡 Utilisation : `.ai <votre question>`' }, { quoted: msg })
        return
    }

    await sock.sendMessage(from, { text: '🧠 Gemini réfléchit...' }, { quoted: msg })

    try {
        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()

        if (!text) throw new Error('Réponse vide de Gemini')

        await sock.sendMessage(from, { text: `✨ *Réponse Gemini :*\n\n${text}` }, { quoted: msg })

    } catch (error) {
        console.error('Erreur Gemini SDK:', error)
        await sock.sendMessage(from, {
            text: '❌ Une erreur est survenue avec Gemini. Vérifiez la clé API ou réessayez plus tard.'
        }, { quoted: msg })
    }
}
