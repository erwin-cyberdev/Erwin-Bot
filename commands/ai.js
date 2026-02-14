/**
 * ai.js — Commande générique AI via OpenRouter
 * Utilise gpt-4o-mini ou gemini-2.0-flash selon dispo
 */
import { chatCompletion, AI_MODELS } from '../utils/openRouter.js'

export default async function aiCommand(sock, msg, args = []) {
    const from = msg.key.remoteJid
    const prompt = args.join(' ').trim()

    if (!prompt) {
        return sock.sendMessage(
            from,
            { text: '💡 Utilisation : `.ai <question>`' },
            { quoted: msg }
        )
    }

    // Vérification de la clé OpenRouter
    if (!process.env.OPENROUTER_API_KEY) {
        return sock.sendMessage(
            from,
            { text: '⚠️ OPENROUTER_API_KEY manquante dans le fichier .env' },
            { quoted: msg }
        )
    }

    await sock.sendMessage(from, { text: '🤔 Je réfléchis...' }, { quoted: msg })

    try {
        // Utilise le modèle par défaut défini dans openRouter.js (Gemini Flash ou GPT-4o-mini)
        const response = await chatCompletion(
            AI_MODELS.DEFAULT,
            [{ role: 'user', content: prompt }]
        )

        const MAX_WH_TEXT = 6500
        const safeReply =
            response.length > MAX_WH_TEXT
                ? `${response.slice(0, MAX_WH_TEXT - 200)}\n\n(↘️ tronqué)`
                : response

        await sock.sendMessage(
            from,
            { text: `🤖 *IA :*\n\n${safeReply}` },
            { quoted: msg }
        )

    } catch (err) {
        console.error('❌ Erreur AI (OpenRouter) :', err)
        let message = `❗ Erreur : ${err.message}`
        await sock.sendMessage(from, { text: message }, { quoted: msg })
    }
}
