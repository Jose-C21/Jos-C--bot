// src/commands/antiestado.js
import fs from "fs"
import path from "path"
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const DATA_DIR = path.join(process.cwd(), "data")
const ACTIVOS_PATH = path.join(DATA_DIR, "activos.json")

function ensureActivos() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

  if (!fs.existsSync(ACTIVOS_PATH)) {
    fs.writeFileSync(ACTIVOS_PATH, JSON.stringify({ antiestado: {} }, null, 2))
    return
  }

  try {
    const j = JSON.parse(fs.readFileSync(ACTIVOS_PATH, "utf8") || "{}")
    if (!j.antiestado) j.antiestado = {}
    fs.writeFileSync(ACTIVOS_PATH, JSON.stringify(j, null, 2))
  } catch {
    fs.writeFileSync(ACTIVOS_PATH, JSON.stringify({ antiestado: {} }, null, 2))
  }
}

function readActivosSafe() {
  try {
    ensureActivos()
    const j = JSON.parse(fs.readFileSync(ACTIVOS_PATH, "utf8") || "{}")
    if (!j.antiestado) j.antiestado = {}
    return j
  } catch {
    return { antiestado: {} }
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

export default async function antiestado(sock, msg, { args = [] }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const isGroup = String(chatId).endsWith("@g.us")
  if (!isGroup) {
    await sock.sendMessage(chatId, { text: "⚠️ *Este comando solo se usa en grupos.*" }, { quoted: msg })
    return
  }

  const mode = (args[0] || "").toLowerCase()
  if (!["on", "off"].includes(mode)) {
    await sock.sendMessage(chatId, {
      text: `⚙️ Usa:\n• *antiestado on*\n• *antiestado off*`
    }, { quoted: msg })
    return
  }

  const senderJid = getSenderJid(msg)
  const senderNum = jidToNumber(senderJid)

  let decodedJid = senderJid
  try { if (sock?.decodeJid) decodedJid = sock.decodeJid(senderJid) } catch {}
  const senderNumDecoded = jidToNumber(decodedJid)

  const isOwner = isOwnerByNumbers({ senderNum, senderNumDecoded })
  const fromMe = !!msg.key?.fromMe

  // admin check
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

  const activos = readActivosSafe()

  if (mode === "on") {
    activos.antiestado[chatId] = true
    writeActivosSafe(activos)
    await sock.sendMessage(chatId, { text: "✅ *Anti-estado activado en este grupo.*" }, { quoted: msg })
  } else {
    delete activos.antiestado[chatId]
    writeActivosSafe(activos)
    await sock.sendMessage(chatId, { text: "🛑 *Anti-estado desactivado en este grupo.*" }, { quoted: msg })
  }

  await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
}