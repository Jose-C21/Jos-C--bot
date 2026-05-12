import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const ACTIVOS_PATH = path.join(DATA_DIR, "activos.json")

function readJsonSafe() {
  try {
    return JSON.parse(fs.readFileSync(ACTIVOS_PATH, "utf8") || "{}")
  } catch {
    return {}
  }
}

function writeJsonSafe(data) {
  fs.writeFileSync(ACTIVOS_PATH, JSON.stringify(data, null, 2))
}

export default async function pausarconteo(sock, msg, { isOwner }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  if (!isOwner) {
    await sock.sendMessage(chatId, {
      text: "❌ Solo los owners pueden usar este comando."
    }, { quoted: msg })
    return
  }

  const db = readJsonSafe()

  if (!db.conteooff) db.conteooff = {}

  db.conteooff[chatId] = true

  writeJsonSafe(db)

  await sock.sendMessage(chatId, {
    text:
`╭━━〔📊 CONTEO〕━━╮
┃
┃ ⏸️ Estado:
┃    Pausado
┃
┃ 📛 Acción:
┃    Ya no se contarán
┃    mensajes en este grupo
┃
╰━━━━━━━━━━━━━━╯`
  }, { quoted: msg })
}