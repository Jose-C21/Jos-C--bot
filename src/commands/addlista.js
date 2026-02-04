// src/commands/addlista.js
import fs from "fs"
import path from "path"
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

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

function writeDB(db) {
  ensureDB()
  fs.writeFileSync(ALLOW_PATH, JSON.stringify(db, null, 2))
}

function isOwnerNumber(num) {
  const owners = (config.owners || []).map(String)
  const ownersLid = (config.ownersLid || []).map(String)
  const s = String(num)
  return owners.includes(s) || ownersLid.includes(s)
}

function normalizeToNum(input = "") {
  const s = String(input).trim()

  // si viene jid tipo 504xxxx@s.whatsapp.net
  if (s.includes("@")) return s.replace(/[^0-9]/g, "")

  // si viene con +, espacios, etc
  return s.replace(/[^0-9]/g, "")
}

function getTargetNum(sock, msg, args) {
  // 1) reply / mention
  const ctx = msg.message?.extendedTextMessage?.contextInfo
  let targetJid = ctx?.participant
  if (!targetJid && ctx?.mentionedJid?.length) targetJid = ctx.mentionedJid[0]

  if (targetJid) {
    let decoded = targetJid
    try { if (sock?.decodeJid) decoded = sock.decodeJid(targetJid) } catch {}
    return jidToNumber(decoded) || jidToNumber(targetJid) || normalizeToNum(targetJid)
  }

  // 2) args
  const raw = (args || []).join(" ").trim()
  if (!raw) return ""
  return normalizeToNum(raw)
}

export default async function addlista(sock, msg, { args = [], isOwner, usedPrefix = "." }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  // ✅ solo en privado (como tu bot viejo)
  const isGroup = String(chatId).endsWith("@g.us")
  if (isGroup) {
    await sock.sendMessage(chatId, { text: "❌ Este comando solo se usa en *privado*." }, { quoted: msg })
    return
  }

  // ✅ permitir si: es owner O el mensaje es del bot (fromMe)
  const fromMe = !!msg?.key?.fromMe
  if (!isOwner && !fromMe) {
    await sock.sendMessage(chatId, { text: "⛔ Solo *owners* pueden usar este comando." }, { quoted: msg })
    return
  }

  const targetNum = getTargetNum(sock, msg, args)

  if (!targetNum) {
    await sock.sendMessage(chatId, {
      text:
        `⚠️ Usa:\n` +
        `• ${usedPrefix}addlista 504XXXXXXXX\n` +
        `• o responde / menciona al usuario`
    }, { quoted: msg })
    return
  }

  // ✅ no agregar owners a la lista (no tiene sentido, y evita errores)
  if (isOwnerNumber(targetNum)) {
    await sock.sendMessage(chatId, { text: "✅ Ese número es *owner*, no necesita allowlist." }, { quoted: msg })
    return
  }

  const db = readDB()
  if (!db.users.includes(String(targetNum))) {
    db.users.push(String(targetNum))
    writeDB(db)

    await sock.sendMessage(chatId, {
      text: `✅ Agregado a allowlist:\n• ${targetNum}`
    }, { quoted: msg })
  } else {
    await sock.sendMessage(chatId, { text: `⚠️ Ya estaba en allowlist:\n• ${targetNum}` }, { quoted: msg })
  }
}