const units = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 }

function parseDelay(input) {
  if (!input) return null
  const matches = [...input.toLowerCase().matchAll(/(\d+)([smhdw])/g)]
  if (!matches.length) return null
  let total = 0
  for (const [, value, unit] of matches) {
    total += Number(value) * units[unit]
  }
  if (!total || total > 604800000) return null
  return total
}

function formatDelay(ms) {
  const parts = []
  const entries = [
    ['sem', 604800000],
    ['j', 86400000],
    ['h', 3600000],
    ['min', 60000],
    ['s', 1000]
  ]
  let remaining = ms
  for (const [label, value] of entries) {
    if (remaining >= value) {
      const qty = Math.floor(remaining / value)
      remaining %= value
      parts.push(`${qty}${label}`)
    }
  }
  return parts.join(' ') || 'quelques secondes'
}

export default async function (sock, msg, args = []) {
  const from = msg.key.remoteJid
  if (args.length < 2) {
    return sock.sendMessage(from, { text: '❗ Usage : `.remind <temps> <message>`.' }, { quoted: msg })
  }

  const delayToken = args[0]
  const delay = parseDelay(delayToken)
  if (!delay) {
    return sock.sendMessage(from, { text: '❗ Durée invalide (formats acceptés : 10m, 1h30m, 2d, max 7j).' }, { quoted: msg })
  }

  const note = args.slice(1).join(' ').trim()
  if (!note) {
    return sock.sendMessage(from, { text: '❗ Fournis un message pour le rappel.' }, { quoted: msg })
  }

  const sender = msg.key.participant || msg.key.remoteJid
  const acknowledgment = `⏳ Rappel programmé dans ${formatDelay(delay)}.`
  await sock.sendMessage(from, { text: acknowledgment }, { quoted: msg })

  setTimeout(() => {
    const text = `⏰ *Rappel*
${note}`
    const options = { quoted: msg }
    if (from.endsWith('@g.us') && sender) {
      options.mentions = [sender]
      options.text = `${text}

@${sender.split('@')[0]}`
    } else {
      options.text = text
    }
    sock.sendMessage(from, options).catch(err => console.error('Erreur rappel .remind:', err))
  }, delay)
}
