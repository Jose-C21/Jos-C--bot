// src/commands/antipersona.js
import fs from "fs"
import path from "path"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const DATA_DIR = path.join(process.cwd(), "data")
const ACTIVOS_PATH = path.join(DATA_DIR, "activos.json")

function ensureActivosDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(ACTIVOS_PATH)) {
    fs.writeFileSync(
      ACTIVOS_PATH,
      JSON.stringify({ bienvenida: {}, despedidas: {}, antilink: {}, antis: {}, antipersona: {} }, null, 2)
    )
    return
  }
  try {
    const j = JSON.parse(fs.readFileSync(ACTIVOS_PATH, "utf8") || "{}")
    if (!j.bienvenida) j.bienvenida = {}
    if (!j.despedidas) j.despedidas = {}
    if (!j.antilink) j.antilink = {}
    if (!j.antis) j.antis = {}
    if (!j.antipersona) j.antipersona = {}
    fs.writeFileSync(ACTIVOS_PATH, JSON.stringify(j, null, 2))
  } catch {
    fs.writeFileSync(
      ACTIVOS_PATH,
      JSON.stringify({ bienvenida: {}, despedidas: {}, antilink: {}, antis: {}, antipersona: {} }, null, 2)
    )
  }
}

function readActivosSafe() {
  try {
    ensureActivosDB()
    const j = JSON.parse(fs.readFileSync(ACTIVOS_PATH, "utf8") || "{}")
    if (!j.antipersona) j.antipersona = {}
    return j
  } catch {
    return { bienvenida: {}, despedidas: {}, antilink: {}, antis: {}, antipersona: {} }
  }
}

function writeActivosSafe(db) {
  try {
    ensureActivosDB()
    fs.writeFileSync(ACTIVOS_PATH, JSON.stringify(db, null, 2))
  } catch {}
}

function getMentionJid(sock, msg) {
  const raw = getSenderJid(msg)
  let decoded = raw
  try { if (sock?.decodeJid) decoded = sock.decodeJid(raw) } catch {}
  return decoded || raw
}

export default async function antipersona(sock, msg, { args = [], usedPrefix = ".", isOwner = false } = {}) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const isGroup = String(chatId).endsWith("@g.us")
  if (!isGroup) {
    await sock.sendMessage(chatId, { text: "❌ Este comando solo funciona en grupos." }, { quoted: msg })
    return
  }

  const sub = (args[0] || "").toLowerCase().trim()

  // ── verificar admin (si no es owner)
  let isAdmin = false
  if (!isOwner) {
    try {
      const md = await sock.groupMetadata(chatId)
      const me = msg?.key?.participant || getMentionJid(sock, msg)
      const p = md?.participants?.find(x => String(x.id) === String(me))
      isAdmin = (p?.admin === "admin" || p?.admin === "superadmin")
    } catch {}
    if (!isAdmin) {
      const jid = getMentionJid(sock, msg)
      const num = jidToNumber(jid) || String(jid).replace(/\D/g, "")
      await sock.sendMessage(chatId, {
        text: `⛔ @${num} solo admins pueden usar este ajuste.`,
        mentions: jid ? [jid] : []
      }, { quoted: msg })
      return
    }
  }

  const db = readActivosSafe()
  db.antipersona = db.antipersona || {}

  const current = !!db.antipersona[chatId]

  if (!sub || sub === "status") {
    await sock.sendMessage(chatId, {
      text:
        `╭─ 𝗔𝗡𝗧𝗜𝗣𝗘𝗥𝗦𝗢𝗡𝗔 (NOMBRE)\n` +
        `│ Estado: ${current ? "✅ ACTIVADO" : "❌ DESACTIVADO"}\n` +
        `│\n` +
        `│ Uso:\n` +
        `│ • ${usedPrefix}antipersona on\n` +
        `│ • ${usedPrefix}antipersona off\n` +
        `╰────────────`
    }, { quoted: msg })
    return
  }

  if (sub === "on" || sub === "activar") {
    db.antipersona[chatId] = true
    writeActivosSafe(db)
    await sock.sendMessage(chatId, {
      text:
        `✅ Antipersona activado.\n` +
        `📌 Detectará cuando alguien cambie su *nombre* (cuando envíe un mensaje).`
    }, { quoted: msg })
    return
  }

  if (sub === "off" || sub === "desactivar") {
    db.antipersona[chatId] = false
    writeActivosSafe(db)
    await sock.sendMessage(chatId, {
      text: `✅ Antipersona desactivado.`
    }, { quoted: msg })
    return
  }

  await sock.sendMessage(chatId, {
    text:
      `⚠️ Opción inválida.\n\n` +
      `Usa:\n` +
      `• ${usedPrefix}antipersona on\n` +
      `• ${usedPrefix}antipersona off\n` +
      `• ${usedPrefix}antipersona status`
  }, { quoted: msg })
}