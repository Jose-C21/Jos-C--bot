// src/commands/antiarabe.js
import fs from "fs"
import path from "path"
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const DATA_DIR = path.join(process.cwd(), "data")
const ACTIVOS_PATH = path.join(DATA_DIR, "activos.json")

function ensureActivos() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(ACTIVOS_PATH)) {
    fs.writeFileSync(
      ACTIVOS_PATH,
      JSON.stringify({ bienvenida: {}, despedidas: {}, antilink: {}, antis: {}, antiarabe: {} }, null, 2)
    )
    return
  }
  try {
    const j = JSON.parse(fs.readFileSync(ACTIVOS_PATH, "utf8") || "{}")
    if (!j.bienvenida) j.bienvenida = {}
    if (!j.despedidas) j.despedidas = {}
    if (!j.antilink) j.antilink = {}
    if (!j.antis) j.antis = {}
    if (!j.antiarabe) j.antiarabe = {}
    fs.writeFileSync(ACTIVOS_PATH, JSON.stringify(j, null, 2))
  } catch {
    fs.writeFileSync(
      ACTIVOS_PATH,
      JSON.stringify({ bienvenida: {}, despedidas: {}, antilink: {}, antis: {}, antiarabe: {} }, null, 2)
    )
  }
}

function readActivosSafe() {
  try {
    ensureActivos()
    return JSON.parse(fs.readFileSync(ACTIVOS_PATH, "utf8") || "{}")
  } catch {
    return { bienvenida: {}, despedidas: {}, antilink: {}, antis: {}, antiarabe: {} }
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

export default async function antiarabe(sock, msg, { args = [] }) {
  try {
    const chatId = msg?.key?.remoteJid
    if (!chatId) return

    const isGroup = String(chatId).endsWith("@g.us")
    if (!isGroup) {
      await sock.sendMessage(chatId, { text: "⚠️ *Este comando solo se puede usar en grupos.*" }, { quoted: msg })
      return
    }

    const mode = (args[0] || "").toLowerCase()
    if (!["on", "off"].includes(mode)) {
      const p = config.prefix || "."
      await sock.sendMessage(chatId, {
        text: `⚙️ Usa:\n• *${p}antiarabe on*\n• *${p}antiarabe off*`
      }, { quoted: msg })
      return
    }

    const senderJid = getSenderJid(msg)
    const senderNum = jidToNumber(senderJid)

    let decoded = senderJid
    try { if (sock?.decodeJid) decoded = sock.decodeJid(senderJid) } catch {}
    const senderNumDecoded = jidToNumber(decoded)

    const isOwner = isOwnerByNumbers({ senderNum, senderNumDecoded })
    const fromMe = !!msg.key?.fromMe

    // admin?
    let isAdmin = false
    try {
      const md = await sock.groupMetadata(chatId)
      const p = md.participants?.find(x => x.id === senderJid || x.id === decoded)
      isAdmin = p?.admin === "admin" || p?.admin === "superadmin"
    } catch {}

    if (!isAdmin && !isOwner && !fromMe) {
      await sock.sendMessage(chatId, { text: "⚠️ *Solo los administradores, owner o el bot pueden usar este comando.*" }, { quoted: msg })
      return
    }

    const activos = readActivosSafe()
    if (!activos.antiarabe) activos.antiarabe = {}

    if (mode === "on") {
      activos.antiarabe[chatId] = true
      writeActivosSafe(activos)
      await sock.sendMessage(chatId, { text: "✅ *Antiarabe activado en este grupo.*" }, { quoted: msg })
    } else {
      delete activos.antiarabe[chatId]
      writeActivosSafe(activos)
      await sock.sendMessage(chatId, { text: "🛑 *Antiarabe desactivado en este grupo.*" }, { quoted: msg })
    }

    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
  } catch (error) {
    console.error("❌ Error en el comando antiarabe:", error)
    await sock.sendMessage(msg.key.remoteJid, { text: "❌ *Ocurrió un error al ejecutar el comando antiarabe.*" }, { quoted: msg })
  }
}