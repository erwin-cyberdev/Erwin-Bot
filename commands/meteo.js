// commands/meteo.js
import axios from 'axios'

const WEATHER_EMOJI = {
  thunderstorm: '⛈️',
  drizzle: '🌦️',
  rain: '🌧️',
  snow: '❄️',
  mist: '🌫️',
  smoke: '🌫️',
  haze: '🌫️',
  dust: '🌫️',
  fog: '🌫️',
  sand: '🌫️',
  ash: '🌋',
  squall: '💨',
  tornado: '🌪️',
  clear: '☀️',
  clouds: '☁️'
}

function pickEmoji(weather = []) {
  const code = weather[0]?.main?.toLowerCase() || ''
  return WEATHER_EMOJI[code] || WEATHER_EMOJI[weather[0]?.description?.toLowerCase?.()] || '🌤️'
}

function formatTemperature(value) {
  return typeof value === 'number' ? `${Math.round(value)}°C` : 'N/A'
}

function formatWind(speedMs) {
  if (typeof speedMs !== 'number') return 'N/A'
  return `${Math.round(speedMs * 3.6)} km/h`
}

function formatTime(timestamp, timezone) {
  if (!timestamp || typeof timezone !== 'number') return null
  const date = new Date((timestamp + timezone) * 1000)
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

export default async function (sock, msg, args) {
  const from = msg.key.remoteJid

  if (!args.length) {
    return await sock.sendMessage(from, {
      text: '🌤️ *Météo*\n\n*Usage :* `.meteo <ville>`\n\n*Exemples :*\n• `.meteo Douala`\n• `.meteo Paris`\n• `.meteo New York`'
    }, { quoted: msg })
  }

  const city = args.join(' ').trim()
  if (!city) {
    return await sock.sendMessage(from, { text: '❗ Merci de préciser une ville valide.' }, { quoted: msg })
  }

  const apiKey = '6712b56eadfa17faaedf05e03c6593c0'

  if (!apiKey) {
    return await sock.sendMessage(from, {
      text: '⚠️ Clé API OpenWeather manquante.\n\n💡 Obtiens une clé gratuite sur:\nhttps://openweathermap.org/api\n\nPuis ajoute dans .env:\nOPENWEATHER_API_KEY=ta_clé'
    }, { quoted: msg })
  }

  try {
    await sock.sendMessage(from, { text: `⏳ Recherche de la météo pour *${city}*...` }, { quoted: msg })

    const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
      params: {
        q: city,
        appid: apiKey,
        units: 'metric',
        lang: 'fr'
      },
      timeout: 9000,
      validateStatus: status => [200, 404].includes(status)
    })

    if (response.status === 404 || !response.data) {
      await sock.sendMessage(from, { text: `❗ Ville introuvable : *${city}*.` }, { quoted: msg })
      return
    }

    const data = response.data
    const {
      name = city,
      sys = {},
      main = {},
      weather = [],
      wind = {},
      clouds = {},
      timezone = 0,
      visibility
    } = data

    const emoji = pickEmoji(weather)
    const description = weather[0]?.description || 'Conditions inconnues'
    const sunrise = formatTime(sys.sunrise, timezone)
    const sunset = formatTime(sys.sunset, timezone)
    const feelsLike = formatTemperature(main.feels_like)
    const tempMin = formatTemperature(main.temp_min)
    const tempMax = formatTemperature(main.temp_max)

    const lines = []
    lines.push('╭─────────────────────╮')
    lines.push('│  🌍 *MÉTÉO ACTUELLE*  │')
    lines.push('╰─────────────────────╯')
    lines.push('')
    lines.push(`📍 *Ville :* ${name}${sys.country ? `, ${sys.country}` : ''}`)
    lines.push('')
    lines.push(`${emoji} *Temps :* ${description}`)
    lines.push(`🌡️ *Température :* ${formatTemperature(main.temp)}`)
    lines.push(`🤚 *Ressenti :* ${feelsLike}`)
    lines.push(`📊 *Min/Max :* ${tempMin} / ${tempMax}`)
    if (typeof main.humidity === 'number') lines.push(`💧 *Humidité :* ${main.humidity}%`)
    if (typeof main.pressure === 'number') lines.push(`🔆 *Pression :* ${main.pressure} hPa`)
    lines.push(`🌬️ *Vent :* ${formatWind(wind.speed)}`)
    if (typeof wind.gust === 'number') lines.push(`💨 *Rafales :* ${formatWind(wind.gust)}`)
    if (typeof clouds.all === 'number') lines.push(`☁️ *Couverture nuageuse :* ${clouds.all}%`)
    if (typeof visibility === 'number') lines.push(`👁️ *Visibilité :* ${(visibility / 1000).toFixed(1)} km`)
    if (sunrise) lines.push(`🌅 *Lever :* ${sunrise}`)
    if (sunset) lines.push(`🌇 *Coucher :* ${sunset}`)
    lines.push('')
    lines.push('━━━━━━━━━━━━━━━━━━━━')
    lines.push('🌤️ Météo en temps réel')

    await sock.sendMessage(from, { text: lines.join('\n') }, { quoted: msg })

  } catch (err) {
    console.error('Erreur .meteo:', err?.response?.data || err?.message || err)
    await sock.sendMessage(from, { text: '❗ Impossible de récupérer la météo pour le moment.' }, { quoted: msg })
  }
}
