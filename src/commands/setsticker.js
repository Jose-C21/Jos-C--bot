import fs from "fs"
import path from "path"

const DB_DIR = path.join(process.cwd(), "data")
const DB_PATH = path.join(DB_DIR, "stickerCommands.json")

function ensureDB() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true })
  }

  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify({}, null, 2)
    )
  }
}

export default async function setsticker(sock, msg, { args = [], isOwner = false } = {}) {
  try {
    const chatId = msg?.key?.remoteJid

    if (!isOwner) return

    const action = String(args[0] || "").toLowerCase()

    if (!action) {
      return await sock.sendMessage(chatId, {
        text: "📝 Uso: .setsticker ban"
      }, { quoted: msg })
    }

    const quoted =
      msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage

    if (!quoted?.stickerMessage) {
      return await sock.sendMessage(chatId, {
        text: "⚠️ Debes responder a un sticker."
      }, { quoted: msg })
    }

    const hash =
      quoted.stickerMessage.fileSha256?.toString("base64")

    if (!hash) {
      return await sock.sendMessage(chatId, {
        text: "❌ No pude obtener el hash del sticker."
      }, { quoted: msg })
    }

    ensureDB()

    const db = JSON.parse(
      fs.readFileSync(DB_PATH, "utf8")
    )

    db[action] = hash

    fs.writeFileSync(
      DB_PATH,
      JSON.stringify(db, null, 2)
    )

    await sock.sendMessage(chatId, {
      text: `✅ Sticker '${action}' registrado correctamente.`
    }, { quoted: msg })

  } catch (e) {
    console.error("[setsticker]", e)
  }
}