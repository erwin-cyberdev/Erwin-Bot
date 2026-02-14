/**
 * ai.js — Commande générique AI via OpenRouter
 * Utilise gpt-4o-mini ou gemini-2.0-flash selon dispo
 */
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
