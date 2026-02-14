// commands/dlt.js — suppression silencieuse sans message admin

export default async function dltCommand(sock, msg, owner) {
    const from = msg.key.remoteJid
    const sender = msg.key.participant || msg.key.remoteJid
    const isGroup = from.endsWith('@g.us')

    try {
        const contextInfo =
            msg.message?.extendedTextMessage?.contextInfo ||
            msg.message?.imageMessage?.contextInfo ||
            msg.message?.videoMessage?.contextInfo

        if (!contextInfo?.stanzaId) {
            return await sock.sendMessage(
                from,
                { text: '❌ Réponds à un message avec `.dlt`.' },
                { quoted: msg }
            )
        }

        // ===== PERMISSIONS UTILISATEUR =====
        if (isGroup) {
            const metadata = await sock.groupMetadata(from)
            const user = metadata.participants.find(p => p.id === sender)
            const isUserAdmin =
                user?.admin === 'admin' || user?.admin === 'superadmin'
            const isOwner = sender === owner

            if (!isUserAdmin && !isOwner) {
                return await sock.sendMessage(
                    from,
                    { text: '❌ Tu n’as pas la permission d’utiliser cette commande.' },
                    { quoted: msg }
                )
            }
        } else if (sender !== owner) {
            return await sock.sendMessage(
                from,
                { text: '❌ Commande réservée au propriétaire.' },
                { quoted: msg }
            )
        }

        // ===== SUPPRESSION (SILENCIEUSE) =====
        await sock.sendMessage(from, {
            delete: {
                remoteJid: from,
                id: contextInfo.stanzaId,
                participant: contextInfo.participant
            }
        })

        // Confirmation éphémère optionnelle
        if (isGroup) {
            const confirm = await sock.sendMessage(
                from,
                { text: '✅ Message supprimé.' },
                { quoted: msg }
            )

            setTimeout(async () => {
                try {
                    await sock.sendMessage(from, { delete: confirm.key })
                } catch {}
            }, 2000)
        }

    } catch (err) {
        // ❌ AUCUN message admin ici
        console.error('Erreur .dlt :', err)

        await sock.sendMessage(
            from,
            { text: '❌ Impossible de supprimer ce message.' },
            { quoted: msg }
        )
    }
}
