// ✅ Ajusta tu middleware allowlist.js (si aún no lo tienes así)
// src/core/middleware/allowlist.js
import fs from "fs"
import path from "path"
import { getSenderJid, jidToNumber } from "../../utils/jid.js"

const ALLOW_PATH = path.join(process.cwd(), "data", "allowlist.json")

function ensureDB() {
  const dir = path.dirname(ALLOW_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(ALLOW_PATH)) fs.writeFileSync(ALLOW_PATH, JSON.stringify({ users: [] }, null, 2))
}

function readDB() {
  try {
    ensureDB()
    const raw = fs.readFileSync(ALLOW_PATH, "utf8") || ""
    const db = raw ? JSON.parse(raw) : { users: [] }
    if (!Array.isArray(db.users)) db.users = []
    return db
  } catch {
    return { users: [] }
  }
}

export function isAllowedPrivate(msg) {
  const chatId = msg?.key?.remoteJid || ""
  const isGroup = String(chatId).endsWith("@g.us")
  if (isGroup) return true // allowlist solo aplica en privado

  const senderJid = getSenderJid(msg)
  let decoded = senderJid
  // decodeJid aquí no existe, pero el router ya calcula finalNum para owners.
  // Para allowlist, con jidToNumber del senderJid es suficiente.
  const num = jidToNumber(decoded)

  const db = readDB()
  return db.users.includes(String(num))
}