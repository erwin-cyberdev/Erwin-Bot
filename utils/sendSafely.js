// utils/sendSafely.js
import axios from 'axios'
import { isOptedIn } from './consent.js'

const token = process.env.WABA_ACCESS_TOKEN

export async function sendSafely(jid, payload) {
  if (!token) throw new Error('WABA_ACCESS_TOKEN manquant')
  if (!isOptedIn(jid)) throw new Error('Utilisateur non opt-in')

  try {
    const res = await axios.post('https://graph.facebook.com/v18.0/messages', {
      messaging_product: 'whatsapp',
      to: jid,
      ...payload
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    return res.data
  } catch (err) {
    console.error('Erreur sendSafely:', err.message)
    throw err
  }
}
