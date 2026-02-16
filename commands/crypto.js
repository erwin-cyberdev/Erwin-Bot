// commands/crypto.js
import axios from 'axios'

export default async function (sock, msg, args) {
  const from = msg.key.remoteJid

  if (!args.length) {
    return await sock.sendMessage(from, {
      text: '💰 *Crypto*\n\n*Usage :* `.crypto <coin>`\n\n*Exemples :*\n• `.crypto bitcoin`\n• `.crypto ethereum`\n• `.crypto bnb`'
    }, { quoted: msg })
  }

  const query = args[0].toLowerCase()

  // Mapping des symboles courants vers les IDs CoinGecko
  const coinMap = {
    'btc': 'bitcoin',
    'eth': 'ethereum',
    'bnb': 'binancecoin',
    'sol': 'solana',
    'xrp': 'ripple',
    'ada': 'cardano',
    'avax': 'avalanche-2',
    'dot': 'polkadot',
    'matic': 'polygon',
    'doge': 'dogecoin',
    'shib': 'shiba-inu',
    'trx': 'tron',
    'ltc': 'litecoin',
    'link': 'chainlink',
    'xlm': 'stellar'
  }

  const coinId = coinMap[query] || query

  try {
    const loadingMsg = await sock.sendMessage(from, { text: `⏳ Récupération du prix pour *${query.toUpperCase()}*...` }, { quoted: msg })

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd,eur&include_24hr_change=true&include_market_cap=true`
    const res = await axios.get(url, {
      timeout: 10000,
      headers: { 'Accept': 'application/json' }
    })

    if (!res.data || !res.data[coinId]) {
      throw new Error('Crypto introuvable')
    }

    const data = res.data[coinId]
    const priceUSD = data.usd?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 }) || 'N/A'
    const priceEUR = data.eur?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 8 }) || 'N/A'
    const change24h = data.usd_24h_change?.toFixed(2) || '0.00'
    const emoji = parseFloat(change24h) >= 0 ? '📈' : '📉'
    const marketCap = data.usd_market_cap ? (data.usd_market_cap / 1e9).toFixed(2) : 'N/A'

    const message = `
╭─────────────────────╮
│  💰 *CRYPTO PRICE*  │
╰─────────────────────╯

🪙 *Nom :* ${coinId.charAt(0).toUpperCase() + coinId.slice(1)}
🔠 *Symbole :* ${query.toUpperCase()}

💵 *Prix USD :* $${priceUSD}
💶 *Prix EUR :* €${priceEUR}

${emoji} *Variation 24h :* ${change24h}%
📊 *Cap. Boursière :* $${marketCap}B

━━━━━━━━━━━━━━━━━━━━
💰 Prix en temps réel (CoinGecko)
    `.trim()

    await sock.sendMessage(from, { text: message }, { quoted: msg })

    if (loadingMsg?.key?.id) {
      await sock.sendMessage(from, { delete: loadingMsg.key }).catch(() => { })
    }

  } catch (err) {
    console.error('Erreur .crypto:', err.message)

    if (err.response?.status === 429) {
      await sock.sendMessage(from, { text: '⚠️ Limite de débit atteinte (CoinGecko). Réessayez dans une minute.' }, { quoted: msg })
    } else if (err.message === 'Crypto introuvable') {
      await sock.sendMessage(from, { text: `❗ Crypto "${query}" introuvable.\n\n💡 Utilise le nom complet (ex: bitcoin) ou un symbole connu (btc, eth, sol).` }, { quoted: msg })
    } else {
      await sock.sendMessage(from, { text: '❗ Impossible de récupérer les prix. Le service est peut-être indisponible.' }, { quoted: msg })
    }
  }
}
