// src/commands/addlista.js
import fs from "fs"
import path from "path"
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const ALLOW_PATH = path.join(process.cwd(), "data", "allowlist.json")

function ensureDB() {
  const dir = path.dirname(ALLOW_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(ALLOW_PATH)) fs.writeFileSync(ALLOW_PATH, "[]") // ✅ formato simple
}

function readList() {
  try {
    ensureDB()
    const raw = fs.readFileSync(ALLOW_PATH, "utf8") || "[]"
    const parsed = JSON.parse(raw)

    // ✅ soporta: []  o  { users: [] }
    if (Array.isArray(parsed)) return parsed.map(String)
    if (parsed && Array.isArray(parsed.users)) return parsed.users.map(String)

    return []
  } catch {
    return []
  }
}

function writeList(list) {
  ensureDB()
  const clean = Array.from(new Set(list.map(String)))
  fs.writeFileSync(ALLOW_PATH, JSON.stringify(clean, null, 2))
}

function isOwnerNumber(num) {
  const owners = (config.owners || []).map(String)
  const ownersLid = (config.ownersLid || []).map(String)
  const s = String(num)
  return owners.includes(s) || ownersLid.includes(s)
}

function normalizeToNum(x = "") {
  return String(x).replace(/[^0-9]/g, "")
}

function getTargetNum(sock, msg, args) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo

  let targetJid = ctx?.participant
  if (!targetJid && ctx?.mentionedJid?.length) targetJid = ctx.mentionedJid[0]

  if (targetJid) {
    let decoded = targetJid
    try { if (sock?.decodeJid) decoded = sock.decodeJid(targetJid) } catch {}
    return (
      jidToNumber(decoded) ||
      jidToNumber(targetJid) ||
      normalizeToNum(targetJid)
    )
  }

  const raw = (args || []).join(" ").trim()
  return normalizeToNum(raw)
}

export default async function addlista(sock, msg, { args = [], isOwner, usedPrefix = "." }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  // ✅ SOLO PRIVADO (como dijimos desde el inicio)
  if (String(chatId).endsWith("@g.us")) {
    await sock.sendMessage(chatId, { text: "❌ Este comando solo se usa en *privado*." }, { quoted: msg })
    return
  }

  // ✅ solo owners (tu router ya calcula isOwner con lid/real)
  if (!isOwner) {
    await sock.sendMessage(chatId, { text: "⛔ Solo *owners* pueden usar este comando." }, { quoted: msg })
    return
  }

  const targetNum = getTargetNum(sock, msg, args)

  if (!targetNum || targetNum.length < 6) {
    await sock.sendMessage(chatId, {
      text:
        `⚠️ Usa:\n` +
        `• ${usedPrefix}addlista 504XXXXXXXX\n` +
        `• o responde / menciona al usuario`
    }, { quoted: msg })
    return
  }

  if (isOwnerNumber(targetNum)) {
    await sock.sendMessage(chatId, { text: "✅ Ese número es *owner*, no necesita allowlist." }, { quoted: msg })
    return
  }

  const list = readList()

  if (!list.includes(String(targetNum))) {
    list.push(String(targetNum))
    writeList(list)

    await sock.sendMessage(chatId, {
      text: `✅ Agregado a allowlist:\n• ${targetNum}\n\n📁 Guardado en la lista.`
    }, { quoted: msg })
  } else {
    await sock.sendMessage(chatId, { text: `⚠️ Ya estaba en allowlist:\n• ${targetNum}` }, { quoted: msg })
  }
}