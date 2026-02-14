// commands/add.js
export default async function(sock, msg, args) {
  const from = msg.key.remoteJid
  const sender = msg.key.participant || msg.key.remoteJid

  try {
    // --- Vérifier si c’est un groupe ---
    if (!from.endsWith('@g.us')) {
      return await sock.sendMessage(from, { text: '❌ Cette commande ne fonctionne que dans un groupe.' })
    }

    let metadata
    try {
      metadata = await sock.groupMetadata(from)
    } catch (err) {
      console.error('Erreur groupMetadata .add:', err)
      return await sock.sendMessage(from, { text: '❌ Impossible de récupérer les informations du groupe.' })
    }

    if (!metadata) {
      return await sock.sendMessage(from, { text: '❌ Impossible de récupérer les informations du groupe.' })
    }

    // --- Vérifier si expéditeur admin ---
    const admins = metadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin')
    const isAdmin = admins.some(a => a.id === sender)
    if (!isAdmin) return await sock.sendMessage(from, { text: '⚠️ Seuls les admins peuvent ajouter des membres.' })

    const botIdRaw = sock.user?.id || ''
    const botJid = botIdRaw.includes(':') ? `${botIdRaw.split(':')[0]}@s.whatsapp.net` : botIdRaw
    const isBotAdmin = admins.some(a => a.id === botJid)
    if (!isBotAdmin) {
      return await sock.sendMessage(from, { text: '⚠️ Je dois être admin du groupe pour ajouter des membres.' })
    }

    // --- Vérifier qu’au moins un numéro est fourni ---
    if (!Array.isArray(args) || !args.length) {
      return await sock.sendMessage(from, { text: '📞 *Usage:* .add <numéro1> <numéro2> ...' })
    }

    const botNumberRaw = process.env.WA_NUMBER || sock.user?.id || ''
    const botDigits = (botNumberRaw || '').replace(/[^0-9]/g, '')
    const defaultCountryCode = botDigits.length > 9 ? botDigits.slice(0, botDigits.length - 9) : '237'

    const seen = new Set()
    const results = []
    for (let raw of args) {
      const cleaned = (raw || '').replace(/[^0-9]/g, '')
      if (!cleaned) {
        results.push(`❌ Numéro invalide fourni: "${raw}"`)
        continue
      }

      let number = cleaned.replace(/^0+/, '')
      if (number.length === 0) number = cleaned

      if (number.length <= 9) {
        number = `${defaultCountryCode}${number}`
      }

      if (number.length < 10 || number.length > 15) {
        results.push(`❌ Format non supporté pour ${raw} (10 à 15 chiffres attendus)`)
        continue
      }

      const jid = `${number}@s.whatsapp.net`

      if (seen.has(jid)) {
        results.push(`ℹ️ ${raw} déjà traité dans cette commande`)
        continue
      }
      seen.add(jid)

      // --- Déjà dans le groupe ? ---
      if (metadata.participants.some(p => p.id === jid)) {
        results.push(`ℹ️ ${raw} est déjà dans le groupe`)
        continue
      }

      // --- Essayer d’ajouter ---
      try {
        await sock.groupParticipantsUpdate(from, [jid], 'add')
        results.push(`✅ ${raw} ajouté avec succès`)
        metadata.participants.push({ id: jid, admin: null })
      } catch (err) {
        // gérer toutes les erreurs possibles
        const message = err?.message || ''
        if (err?.status === 400 || message.includes('bad-request')) {
          results.push(`❌ Impossible d’ajouter ${raw} (numéro invalide ou compte WhatsApp inexistant)`)
        } else if (message.includes('403')) {
          results.push(`🚫 Impossible d’ajouter ${raw} (bot doit être admin)`)
        } else if (message.includes('409') || message.toLowerCase().includes('exists')) {
          results.push(`ℹ️ ${raw} est déjà dans le groupe`)
        } else if (message.includes('not-authorized')) {
          results.push(`⛔ Ajout refusé pour ${raw} (paramètres du groupe ou restrictions WhatsApp).`)
        } else {
          console.error('Erreur add:', err)
          results.push(`❌ Erreur inconnue pour ${raw}`)
        }
      }
    }

    // --- Retour résultat ---
    if (results.length) {
      await sock.sendMessage(from, { text: results.join('\n') })
    } else {
      await sock.sendMessage(from, { text: 'ℹ️ Aucun numéro valide fourni.' })
    }

  } catch (err) {
    console.error('Erreur .add globale:', err)
    await sock.sendMessage(from, { text: '❌ Une erreur est survenue lors de l’ajout des membres.' })
  }
}
