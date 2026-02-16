import fetch from 'node-fetch'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const TIMEOUT_MS = 60000

export const AI_MODELS = {
    LLAMA_3_3: 'llama-3.3-70b-versatile',
    MIXTRAL: 'mixtral-8x7b-32768',
    LLAMA_3_1_8B: 'llama-3.1-8b-instant',
    DEFAULT: 'llama-3.3-70b-versatile'
}

export async function chatCompletion(model, messages, options = {}) {
    const apiKey = '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'

    if (!apiKey) throw new Error('GROQ_API_KEY manquante')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    }

    const body = JSON.stringify({
        model: model || AI_MODELS.DEFAULT,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 4000,
        ...options
    })

    try {
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers,
            body,
            signal: controller.signal
        })

        const json = await response.json().catch(() => null)

        if (!response.ok) {
            const errorMsg = json?.error?.message || `Erreur Groq ${response.status}`
            throw new Error(errorMsg)
        }

        if (!json?.choices?.length) {
            throw new Error('Réponse vide de Groq')
        }

        return json.choices[0].message.content

    } catch (error) {
        if (error.name === 'AbortError') throw new Error('Timeout Groq (60s)')
        throw error
    } finally {
        clearTimeout(timeoutId)
    }
}
