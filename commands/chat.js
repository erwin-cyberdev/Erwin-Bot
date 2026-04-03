import { chatCompletion, AI_MODELS } from '../utils/groq.js'
import { getConversation, addMessage, clearConversation } from '../utils/chatMemory.js'

export default async function chatCommand(sock, msg, args) {
    const from = msg.key.remoteJid
    const sender = msg.key.participant || msg.key.remoteJid
    const prompt = args.join(' ').trim()

    if (prompt.toLowerCase() === 'reset' || prompt.toLowerCase() === 'clear') {
        clearConversation(sender)
        return await sock.sendMessage(from, { text: '🗑️ Mémoire effacée !' }, { quoted: msg })
    }

    if (!prompt) {
        return await sock.sendMessage(from, { 
            text: '💬 *Chat IA avec Mémoire*\n\nUtilisation : `.chat <votre message>`\nEffacer : `.chat reset`\n\n💡 Je me souviens des 10 derniers échanges.' 
        }, { quoted: msg })
    }

    await sock.sendMessage(from, { text: '💭 Réflexion...' }, { quoted: msg })

    try {
        const history = getConversation(sender)
        const messages = [
            { role: 'system', content: 'Tu es Erwin-Bot, un assistant intelligent et serviable.' },
            ...history,
            { role: 'user', content: prompt }
        ]

        const response = await chatCompletion(AI_MODELS.LLAMA_3_3, messages)

        // Sauvegarder dans la mémoire
        addMessage(sender, 'user', prompt)
        addMessage(sender, 'assistant', response)

        return await sock.sendMessage(from, { text: `💬 *Chat :*\n\n${response}` }, { quoted: msg })
    } catch (err) {
        console.error('Erreur Chat AI:', err)
        return await sock.sendMessage(from, { text: `❌ Erreur : ${err.message}` }, { quoted: msg })
    }
}
