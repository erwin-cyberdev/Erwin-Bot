/**
 * commands/chat.js
 * AI conversation with memory (using Groq)
 */
import { chatCompletion, AI_MODELS } from '../utils/groq.js'
import { getConversation, addMessage, clearConversation } from '../utils/chatMemory.js'

export default async function chatCommand(sock, msg, args = []) {
    const from = msg.key.remoteJid
    const sender = msg.key.participant || msg.key.remoteJid
    const input = args.join(' ').trim()

    // Check for clear command
    if (input.toLowerCase() === 'clear' || input.toLowerCase() === 'reset') {
        clearConversation(sender)
        return sock.sendMessage(from, {
            text: '🗑️ Conversation effacée. Nouveau départ !'
        }, { quoted: msg })
    }

    if (!input) {
        return sock.sendMessage(from, {
            text: `💬 *Chat IA avec mémoire*

📝 Usage :
• \`.chat <message>\` - Conversation continue
• \`.chat clear\` - Effacer l'historique

💡 L'IA se souviendra des 10 derniers messages (30 min).`
        }, { quoted: msg })
    }

    // Check API key
    // API Key is hardcoded in groq.js

    await sock.sendMessage(from, { text: '💭 Je réfléchis...' }, { quoted: msg })

    try {
        // Get conversation history
        const history = getConversation(sender)

        // Add user message to history
        addMessage(sender, 'user', input)

        // Build messages array for API
        const messages = [
            { role: 'system', content: 'Tu es un assistant IA serviable et amical. Réponds de manière concise et utile.' },
            ...history,
            { role: 'user', content: input }
        ]

        const response = await chatCompletion(AI_MODELS.MIXTRAL, messages)

        // Add AI response to history
        addMessage(sender, 'assistant', response)

        const MAX_TEXT = 6500
        const safeReply = response.length > MAX_TEXT
            ? `${response.slice(0, MAX_TEXT - 200)}\n\n(↘️ tronqué)`
            : response

        await sock.sendMessage(from, {
            text: `💬 ${safeReply}`
        }, { quoted: msg })

    } catch (err) {
        console.error('❌ Erreur .chat:', err)
        let message = `❗ Erreur : ${err.message}`
        if (err.message.includes('Timeout')) message = '⌛ Délai dépassé.'
        if (err.message.includes('401')) message = '⚠️ Clé API invalide.'
        if (err.message.includes('429')) message = '⚠️ Trop de requêtes.'

        await sock.sendMessage(from, { text: message }, { quoted: msg })
    }
}
