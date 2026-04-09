import fs from "fs"
import path from "path"
import { jidToNumber } from "../utils/jid.js"

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

  // ❌ solo grupos
  if (!isGroup) {
    await sock.sendMessage(chatId, {
      text: "❌ Este comando solo funciona en grupos."
    }, { quoted: msg })
    return
  }

  // 🔒 solo owner
  if (!isOwner) {
    await sock.sendMessage(chatId, {
      text: "❌ Solo el owner puede usar este comando."
    }, { quoted: msg })
    return
  }

  // ❌ requiere mención
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []

  if (!mentioned.length) {
    await sock.sendMessage(chatId, {
      text: "❌ Debes mencionar al usuario.\nEjemplo:\n.sumar @usuario 100"
    }, { quoted: msg })
    return
  }

  const targetJid = mentioned[0]
  const cantidad = Number(args[1])

  // ❌ validar cantidad
  if (!cantidad || cantidad <= 0) {
    await sock.sendMessage(chatId, {
      text: "❌ Cantidad inválida."
    }, { quoted: msg })
    return
  }

  // ✅ guardar
  const db = readDB()

  if (!db[chatId]) db[chatId] = {}
  if (!db[chatId][targetJid]) db[chatId][targetJid] = 0

  db[chatId][targetJid] += cantidad

  writeDB(db)

  const num = jidToNumber(targetJid)

  await sock.sendMessage(chatId, {
    text: `> ✅ ꜱᴇ ᴀɢʀᴇɢᴀʀᴏɴ *${cantidad}* ᴍᴇɴꜱᴀᴊᴇꜱ ᴀ @${num}`,
    mentions: [targetJid]
  }, { quoted: msg })
}