// src/core/antipersonaWatch.js
import fs from "fs"
import path from "path"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const DATA_DIR = path.join(process.cwd(), "data")
const DB_PATH = path.join(DATA_DIR, "antipersona_names.json")

const COOLDOWN_MS = 10 * 60 * 1000 // 10 min por usuario por grupo
const cooldown = new Map() // key: `${chatId}:${num}` -> ts

function ensureDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, "{}")
}

function readDB() {
  try {
    ensureDB()
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8") || "{}")
  } catch {
    return {}
  }
}

function writeDB(db) {
  try {
    ensureDB()
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
  } catch {}
}

function getMentionJid(sock, msg) {
  // participante real en grupos
  const raw = msg?.key?.participant || getSenderJid(msg)
  let decoded = raw
  try { if (sock?.decodeJid) decoded = sock.decodeJid(raw) } catch {}
  return decoded || raw
}

function normalizeName(name) {
  return String(name || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)
}

function nowHHMM() {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

/**
 * Detecta cambios de nombre SOLO si el grupo tiene antipersona ON.
 * - No requiere contacts.update
 * - Detecta cuando la persona envía mensaje (pushName)
 */
export async function antiPersonaObserve(sock, msg, { activos, isOwnerByNumbers } = {}) {
  try {
    const chatId = msg?.key?.remoteJid
    if (!chatId) return
    const isGroup = String(chatId).endsWith("@g.us")
    if (!isGroup) return

    const enabled = !!activos?.antipersona?.[chatId]
    if (!enabled) return

    if (!msg?.message) return
    if (msg?.key?.fromMe) return

    const jid = getMentionJid(sock, msg) // decodeJid incluido (LID/JID)
    const num = jidToNumber(jid) || String(jid).replace(/\D/g, "")
    if (!num) return

    // owner bypass (si quieres que owners no sean anunciados)
    if (typeof isOwnerByNumbers === "function") {
      const owner = isOwnerByNumbers({ senderNum: num, senderNumDecoded: num })
      if (owner) return
    }

    const newName = normalizeName(msg?.pushName)
    if (!newName) return

    const db = readDB()
    db[chatId] = db[chatId] || {}
    const prev = normalizeName(db[chatId][num]?.name)

    // primera vez: solo guarda (no avisa)
    if (!prev) {
      db[chatId][num] = { name: newName, ts: Date.now() }
      writeDB(db)
      return
    }

    if (prev === newName) return

    // cooldown anti-spam
    const key = `${chatId}:${num}`
    const last = cooldown.get(key) || 0
    if (Date.now() - last < COOLDOWN_MS) {
      // solo actualiza DB sin spamear
      db[chatId][num] = { name: newName, ts: Date.now() }
      writeDB(db)
      return
    }
    cooldown.set(key, Date.now())

    // actualizar DB
    db[chatId][num] = { name: newName, ts: Date.now() }
    writeDB(db)

    const mentionTag = `@${num}`
    const time = nowHHMM()

    const text =
      `╭─ 𝗔𝗩𝗜𝗦𝗢 𝗗𝗘 𝗡𝗢𝗠𝗕𝗥𝗘\n` +
      `│ 👤 Usuario: ${mentionTag}\n` +
      `│ 🕒 Hora: ${time}\n` +
      `│\n` +
      `│ ✏️ Antes: ${prev}\n` +
      `│ ✅ Ahora: ${newName}\n` +
      `╰────────────`

    await sock.sendMessage(chatId, {
      text,
      mentions: jid ? [jid] : []
    }).catch(() => {})
  } catch (e) {
    console.error("[antipersonaObserve] error:", e)
  }
}