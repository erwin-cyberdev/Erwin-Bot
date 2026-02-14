import fs from 'fs'
import path from 'path'

const dataDir = path.join(process.cwd(), 'data')
const storePath = path.join(dataDir, 'commandUsers.json')

let loaded = false
let users = new Set()

function loadStore() {
  if (loaded) return
  try {
    if (fs.existsSync(storePath)) {
      const content = fs.readFileSync(storePath, 'utf8')
      if (content) {
        const parsed = JSON.parse(content)
        if (Array.isArray(parsed)) {
          users = new Set(parsed)
        } else if (parsed && Array.isArray(parsed.users)) {
          users = new Set(parsed.users)
        }
      }
    }
  } catch {}
  loaded = true
}

function persistStore() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
    const payload = Array.from(users)
    fs.writeFileSync(storePath, JSON.stringify(payload, null, 2))
  } catch {}
}

export function recordCommandUser(jid) {
  if (!jid) return
  loadStore()
  if (users.has(jid)) return
  users.add(jid)
  persistStore()
}

export function getRecordedCommandUsers() {
  loadStore()
  return Array.from(users)
}
