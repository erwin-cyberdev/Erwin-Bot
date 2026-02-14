import { performance } from 'perf_hooks'

export default async function (sock, msg, args = []) {
  const from = msg.key.remoteJid
  const quoted = msg

  // Afficher les arguments en mode debug
  if (args.length > 0) {
    console.log(`[DEBUG] Arguments de la commande ping:`, args);
  }

  const now = Date.now()
  const rawTimestamp = msg.messageTimestamp ? Number(msg.messageTimestamp) : null
  const timestampMs = rawTimestamp
    ? (rawTimestamp < 1e12 ? rawTimestamp * 1000 : rawTimestamp)
    : null
  const inboundLatency = timestampMs ? Math.max(0, now - timestampMs) : null

  let networkLatency = null
  try {
    const start = performance.now()
    await sock.sendPresenceUpdate('composing', from)
    await sock.sendPresenceUpdate('paused', from)
    networkLatency = Math.max(0, Math.round(performance.now() - start))
  } catch (err) {
    console.error('ping: mesure de latence réseau échouée:', err)
  }

  // Ajouter des informations supplémentaires si des arguments sont fournis
  const additionalInfo = [];
  if (args.length > 0) {
    additionalInfo.push(`\n🔍 Arguments reçus: ${args.join(', ')}`);
    additionalInfo.push(`📊 Nombre d'arguments: ${args.length}`);
  }

  const parts = [
    '🏓 Pong ! Erwin-Bot est en ligne ✨',
    inboundLatency !== null ? `📥 Message reçu en: *${inboundLatency} ms*` : null,
    networkLatency !== null ? `📡 Latence réseau: *${networkLatency} ms*` : null,
    ...additionalInfo
  ].filter(Boolean)

  const text = parts.join('\n')
  await sock.sendMessage(from, { text }, { quoted })
}
