import fs from "fs"
import path from "path"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const DATA_DIR = path.join(process.cwd(), "data")
const CONTEO_PATH = path.join(DATA_DIR, "conteo.json")

function ensureFile() {
  const dir = path.dirname(CONTEO_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(CONTEO_PATH)) fs.writeFileSync(CONTEO_PATH, "{}")
}

function readDB() {
  ensureFile()
  return JSON.parse(fs.readFileSync(CONTEO_PATH))
}

function writeDB(db) {
  fs.writeFileSync(CONTEO_PATH, JSON.stringify(db, null, 2))
}

export default async function sumar(sock, msg, { args, isOwner }) {
  const chatId = msg.key.remoteJid
  const isGroup = String(chatId).endsWith("@g.us")

  if (!isGroup) {
    await sock.sendMessage(chatId, { text: "❌ Solo en grupos." }, { quoted: msg })
    return
  }

  // 🔒 Solo owners (recomendado)
  if (!isOwner) {
    await sock.sendMessage(chatId, { text: "❌ Solo el owner puede usar este comando." }, { quoted: msg })
    return
  }

  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []

  let targetJid = ""
  let cantidad = 0

  // ✅ caso 1: con mención
  if (mentioned.length) {
    targetJid = mentioned[0]
    cantidad = Number(args[1])
  } else {
    // ✅ caso 2: con número
    const num = String(args[0] || "").replace(/\D/g, "")
    if (!num) {
      await sock.sendMessage(chatId, {
        text: "❌ Usa: .sumar @usuario 100\n o .sumar 504XXXXXXXX 100"
      }, { quoted: msg })
      return
    }

    targetJid = num + "@lid"
    cantidad = Number(args[1])
  }

  if (!cantidad || cantidad <= 0) {
    await sock.sendMessage(chatId, { text: "❌ Cantidad inválida." }, { quoted: msg })
    return
  }

  const db = readDB()

  if (!db[chatId]) db[chatId] = {}

  if (!db[chatId][targetJid]) db[chatId][targetJid] = 0

  db[chatId][targetJid] += cantidad

  writeDB(db)

  const num = jidToNumber(targetJid)

  await sock.sendMessage(chatId, {
    text: `✅ Se agregaron *${cantidad}* mensajes a @${num}`,
    mentions: [targetJid]
  }, { quoted: msg })
}