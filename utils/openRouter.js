/**
 * utils/openRouter.js
 * Client unifié pour OpenRouter AI par Erwin-Bot
 */
import fetch from 'node-fetch'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MAX_RETRIES = 3
const TIMEOUT_MS = 60000 // 60s timeout pour les modèles lents

/**
 * Modèles recommandés (Free Tier ou Low Cost)
 */
export const AI_MODELS = {
    GEMINI: 'google/gemini-2.0-flash-exp:free',
    MISTRAL: 'mistralai/mistral-7b-instruct:free',
    GPT4: 'openai/gpt-4o-mini', // Low cost
    DEFAULT: 'google/gemini-2.0-flash-exp:free'
}

/**
 * Appel générique à l'API OpenRouter
 * @param {string} model - ID du modèle OpenRouter (ex: google/gemini-pro)
 * @param {Array} messages - Historique des messages [{role: 'user', content: '...'}]
 * @param {Object} options - Options supplémentaires (temperature, max_tokens...)
 */
export async function chatCompletion(model, messages, options = {}) {
    const apiKey = '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'
    if (!apiKey) throw new Error('OPENROUTER_API_KEY manquante')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://erwin-bot.onrender.com',
        'X-Title': 'Erwin-Bot'
    }

    const body = JSON.stringify({
        model: model || AI_MODELS.DEFAULT,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 4000,
        top_p: options.top_p || 1,
        ...options
    })

    try {
        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers,
            body,
            signal: controller.signal
        })

        const json = await response.json().catch(() => null)

        if (!response.ok) {
            const errorMsg = json?.error?.message || `Erreur OpenRouter ${response.status}`
            throw new Error(errorMsg)
        }

        if (!json?.choices?.length) {
            throw new Error('Réponse vide de OpenRouter')
        }

        return json.choices[0].message.content

    } catch (error) {
        if (error.name === 'AbortError') throw new Error('Timeout OpenRouter (60s)')
        throw error
    } finally {
        clearTimeout(timeoutId)
    }
}
