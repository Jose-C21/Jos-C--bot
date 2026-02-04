// src/core/middleware/allowlist.js
import fs from "fs"
import path from "path"
import { getSenderJid, jidToNumber } from "../../utils/jid.js"

const ALLOW_PATH = path.join(process.cwd(), "data", "allowlist.json")

function ensureDB() {
  const dir = path.dirname(ALLOW_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(ALLOW_PATH)) fs.writeFileSync(ALLOW_PATH, "[]")
}

function readList() {
  try {
    ensureDB()
    const raw = fs.readFileSync(ALLOW_PATH, "utf8") || "[]"
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String)
    if (parsed && Array.isArray(parsed.users)) return parsed.users.map(String)
    return []
  } catch {
    return []
  }
}

export function isAllowedPrivate(msg) {
  const chatId = msg?.key?.remoteJid || ""
  if (String(chatId).endsWith("@g.us")) return true // allowlist solo privado

  const senderJid = getSenderJid(msg)
  const num = jidToNumber(senderJid)

  const list = readList()
  return list.includes(String(num))
}