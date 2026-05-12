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

export default async function estadoconteo(sock, msg) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const db = readJsonSafe()

  const pausado = !!db?.conteooff?.[chatId]

  await sock.sendMessage(chatId, {
    text:
`╭━━〔📊 ESTADO〕━━╮
┃
┃ Estado actual:
┃    ${pausado ? "⏸️ Pausado" : "✅ Activado"}
┃
╰━━━━━━━━━━━━━━╯`
  }, { quoted: msg })
}