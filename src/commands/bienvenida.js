
// src/commands/bienvenida.js
import fs from "fs"
import path from "path"
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const ACTIVOS_PATH = path.join(process.cwd(), "data", "activos.json")

function ensureActivos() {
  const dir = path.dirname(ACTIVOS_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(ACTIVOS_PATH)) {
    fs.writeFileSync(ACTIVOS_PATH, JSON.stringify({ bienvenida: {}, despedidas: {} }, null, 2))
  }
}

function readActivosSafe() {
  try {
    ensureActivos()
    const j = JSON.parse(fs.readFileSync(ACTIVOS_PATH, "utf8") || "{}")
    if (!j.bienvenida) j.bienvenida = {}
    if (!j.despedidas) j.despedidas = {}
    return j
  } catch {
    return { bienvenida: {}, despedidas: {} }
  }
}

function writeActivosSafe(j) {
  ensureActivos()
  fs.writeFileSync(ACTIVOS_PATH, JSON.stringify(j, null, 2))
}

function isOwnerByNumbers({ senderNum, senderNumDecoded }) {
  const owners = (config.owners || []).map(String)
  const ownersLid = (config.ownersLid || []).map(String)
  return (
    owners.includes(String(senderNum)) ||
    owners.includes(String(senderNumDecoded)) ||
    ownersLid.includes(String(senderNum)) ||
    ownersLid.includes(String(senderNumDecoded))
  )
}

export default async function bienvenida(sock, msg, { args = [] }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const isGroup = String(chatId).endsWith("@g.us")
  if (!isGroup) {
    await sock.sendMessage(chatId, { text: "❌ Este comando solo puede usarse en grupos." }, { quoted: msg })
    return
  }

  const senderJid = getSenderJid(msg)
  const senderNum = jidToNumber(senderJid)

  let decodedJid = senderJid
  try { if (sock?.decodeJid) decodedJid = sock.decodeJid(senderJid) } catch {}
  const senderNumDecoded = jidToNumber(decodedJid)

  const isOwner = isOwnerByNumbers({ senderNum, senderNumDecoded })
  const fromMe = !!msg.key?.fromMe

  // admin?
  let isAdmin = false
  try {
    const md = await sock.groupMetadata(chatId)
    const p = md.participants?.find(x => x.id === senderJid || x.id === decodedJid)
    isAdmin = p?.admin === "admin" || p?.admin === "superadmin"
  } catch {}

  if (!isAdmin && !isOwner && !fromMe) {
    await sock.sendMessage(chatId, { text: "🚫 Solo administradores, owner o el bot pueden usar este comando." }, { quoted: msg })
    return
  }

  const mode = (args[0] || "").toLowerCase()
  const target = (args[1] || "bienvenida").toLowerCase() // bienvenida | despedidas

  if (!["on", "off"].includes(mode) || !["bienvenida", "despedidas"].includes(target)) {
    await sock.sendMessage(chatId, {
      text:
        "⚙️ Usa:\n" +
        "• *bienvenida on* (activa bienvenida)\n" +
        "• *bienvenida off* (desactiva bienvenida)\n" +
        "• *bienvenida on despedidas* (activa despedidas)\n" +
        "• *bienvenida off despedidas* (desactiva despedidas)"
    }, { quoted: msg })
    return
  }

  const activos = readActivosSafe()

  if (mode === "on") {
    activos[target][chatId] = true
    writeActivosSafe(activos)
    await sock.sendMessage(chatId, { text: `✅ *${target} activadas* en este grupo.` }, { quoted: msg })
  } else {
    delete activos[target][chatId]
    writeActivosSafe(activos)
    await sock.sendMessage(chatId, { text: `🛑 *${target} desactivadas* en este grupo.` }, { quoted: msg })
  }

  await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
}
