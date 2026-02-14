/**
 * utils/chatMemory.js
 * Manage conversation history for .chat command
 */

// Store conversations in memory (per user)
const conversations = new Map()
const MAX_HISTORY = 10 // Keep last 10 messages
const TTL = 30 * 60 * 1000 // 30 minutes

/**
 * Get conversation history for a user
 */
export function getConversation(userId) {
    const conv = conversations.get(userId)
    if (!conv) return []

    // Check TTL
    if (Date.now() - conv.lastUpdate > TTL) {
        conversations.delete(userId)
        return []
    }

    return conv.messages
}

/**
 * Add message to conversation
 */
export function addMessage(userId, role, content) {
    let conv = conversations.get(userId)

    if (!conv) {
        conv = { messages: [], lastUpdate: Date.now() }
        conversations.set(userId, conv)
    }

    conv.messages.push({ role, content })
    conv.lastUpdate = Date.now()

    // Keep only last MAX_HISTORY messages
    if (conv.messages.length > MAX_HISTORY) {
        conv.messages = conv.messages.slice(-MAX_HISTORY)
    }
}

/**
 * Clear conversation for a user
 */
export function clearConversation(userId) {
    conversations.delete(userId)
}

/**
 * Get conversation count
 */
export function getConversationCount() {
    return conversations.size
}
