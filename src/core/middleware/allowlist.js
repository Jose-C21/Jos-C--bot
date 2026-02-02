import fs from "fs"
import path from "path"
import config from "../../config.js"
import { jidToNumber, getSenderJid } from "../../utils/jid.js"

function loadAllowlist() {
  const p = path.join(process.cwd(), config.allowlistFile)
  if (!fs.existsSync(p)) {
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, JSON.stringify([], null, 2))
  }
  try { return JSON.parse(fs.readFileSync(p, "utf8")) } catch { return [] }
}

export function isAllowedPrivate(msg) {
  const chatId = msg?.key?.remoteJid || ""
  const isGroup = chatId.endsWith("@g.us")
  if (isGroup) return true // grupos siempre pasan

  const allowlist = loadAllowlist()
  const num = jidToNumber(getSenderJid(msg))
  return allowlist.includes(num)
}
