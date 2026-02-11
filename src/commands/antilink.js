// src/commands/antilink.js
import fs from "fs"
import path from "path"
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const DATA_DIR = path.join(process.cwd(), "data")
const ACTIVOS_PATH = path.join(DATA_DIR, "activos.json")

function ensureActivos() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

  // ✅ si no existe, lo creamos SOLO con antilink
  if (!fs.existsSync(ACTIVOS_PATH)) {
    fs.writeFileSync(ACTIVOS_PATH, JSON.stringify({ antilink: {} }, null, 2))
    return
  }

  // ✅ si existe pero está mal, arreglar SOLO antilink
  try {
    const j = JSON.parse(fs.readFileSync(ACTIVOS_PATH, "utf8") || "{}")
    if (!j.antilink) j.antilink = {}
    fs.writeFileSync(ACTIVOS_PATH, JSON.stringify(j, null, 2))
  } catch {
    fs.writeFileSync(ACTIVOS_PATH, JSON.stringify({ antilink: {} }, null, 2))
  }
}

function readActivosSafe() {
  try {
    ensureActivos()
    const j = JSON.parse(fs.readFileSync(ACTIVOS_PATH, "utf8") || "{}")
    if (!j.antilink) j.antilink = {}
    return j
  } catch {
    return { antilink: {} }
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

export default async function antilink(sock, msg, { args = [] }) {
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
      text: `⚙️ Usa:\n• *antilink on*\n• *antilink off*`
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

  const activos = readActivosSafe()

  if (mode === "on") {
    activos.antilink[chatId] = true
    writeActivosSafe(activos)
    await sock.sendMessage(chatId, { text: "✅ *Antilink activado en este grupo.*" }, { quoted: msg })
  } else {
    delete activos.antilink[chatId]
    writeActivosSafe(activos)
    await sock.sendMessage(chatId, { text: "🛑 *Antilink desactivado en este grupo.*" }, { quoted: msg })
  }

  await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
}