import { chatCompletion, AI_MODELS } from '../utils/groq.js'

export default async function aiCommand(sock, msg, args) {
    const from = msg.key.remoteJid
    const prompt = args.join(' ')

    if (!prompt) {
        await sock.sendMessage(from, { text: '💡 Utilisation : `.ai <votre question>`' }, { quoted: msg })
        return
    }

    await sock.sendMessage(from, { text: '🤖 Erwin-Bot (Groq) réfléchit...' }, { quoted: msg })

    try {
        const response = await chatCompletion(AI_MODELS.LLAMA_3_3, [{ role: 'user', content: prompt }])
        if (response) {
            return await sock.sendMessage(from, { text: `🤖 *Erwin-AI :*\n\n${response}` }, { quoted: msg })
        } else {
            throw new Error('Réponse vide de Groq')
        }
    } catch (error) {
        console.error('Erreur AI Groq:', error)
        await sock.sendMessage(from, {
            text: '❌ Désolé, le système IA est temporairement indisponible. Réessaye plus tard.'
        }, { quoted: msg })
    }
}
