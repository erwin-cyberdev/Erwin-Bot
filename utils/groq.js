import fetch from 'node-fetch'
import FormData from 'form-data'
import fs from 'fs'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const WHISPER_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const TIMEOUT_MS = 60000

export const AI_MODELS = {
    LLAMA_3_3: 'llama-3.3-70b-versatile',
    MIXTRAL: 'mixtral-8x7b-32768',
    LLAMA_3_1_8B: 'llama-3.1-8b-instant',
    VISION_LLAMA_11B: 'llama-3.2-11b-vision-preview',
    WHISPER: 'whisper-large-v3-turbo',
    DEFAULT: 'llama-3.3-70b-versatile'
}

export async function chatCompletion(model, messages, options = {}) {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new Error('GROQ_API_KEY non configurée')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model || AI_MODELS.DEFAULT,
                messages,
                temperature: options.temperature || 0.7,
                max_tokens: options.max_tokens || 4000,
                ...options
            }),
            signal: controller.signal
        })

        const json = await response.json().catch(() => null)
        if (!response.ok) throw new Error(json?.error?.message || `Erreur Groq ${response.status}`)
        return json.choices[0].message.content
    } finally {
        clearTimeout(timeoutId)
    }
}

export async function transcribeAudio(filePath) {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new Error('GROQ_API_KEY non configurée')

    const formData = new FormData()
    formData.append('file', fs.createReadStream(filePath))
    formData.append('model', AI_MODELS.WHISPER)

    const response = await fetch(WHISPER_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            ...formData.getHeaders()
        },
        body: formData,
        timeout: TIMEOUT_MS
    })

    const json = await response.json()
    if (!response.ok) throw new Error(json?.error?.message || `Erreur Groq ${response.status}`)
    return json.text?.trim()
}
