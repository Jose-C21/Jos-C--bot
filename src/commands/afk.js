// src/commands/afk.js
import fs from "fs"
import path from "path"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const SIGNATURE =
  "\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦"

const DATA_DIR = path.join(process.cwd(), "data")
const AFK_PATH = path.join(DATA_DIR, "afk.json")

function ensureDB() {
  try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}
  try { if (!fs.existsSync(AFK_PATH))  fs.writeFileSync(AFK_PATH, "{}") } catch {}
}
function readDB() {
  try { ensureDB(); return JSON.parse(fs.readFileSync(AFK_PATH, "utf8") || "{}") } catch { return {} }
}
function writeDB(db) {
  try { ensureDB(); fs.writeFileSync(AFK_PATH, JSON.stringify(db, null, 2)) } catch {}
}

// Tiempo transcurrido legible
function tiempoTranscurrido(ts) {
  const diff = Date.now() - ts
  const s = Math.floor(diff / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d >= 1)  return `${d}d ${h % 24}h`
  if (h >= 1)  return `${h}h ${m % 60}m`
  if (m >= 1)  return `${m}m`
  return "unos segundos"
}

export default async function afk(sock, msg, { args = [], usedPrefix = "." }) {
  try {
    const chatId = msg?.key?.remoteJid
    if (!chatId) return

    const senderJid = getSenderJid(msg)
    let decodedJid  = senderJid
    try { if (sock?.decodeJid) decodedJid = sock.decodeJid(senderJid) } catch {}
    const userNum = jidToNumber(decodedJid) || jidToNumber(senderJid)
    const userKey = decodedJid || senderJid

    const subCmd = (args[0] || "").toLowerCase()
    const db     = readDB()

    // ── Sin argumentos o .afk on → activar ─────────────────
    if (!subCmd || subCmd === "on") {
      const razon = args.slice(subCmd === "on" ? 1 : 0).join(" ").trim() || "Sin razón"

      db[userKey] = {
        jid:        userKey,
        num:        userNum,
        razon,
        activadoEn: Date.now()
      }
      writeDB(db)

      try { await sock.sendMessage(chatId, { react: { text: "🌙", key: msg.key } }) } catch {}

      return await sock.sendMessage(chatId, {
        text:
`┌─────────────────────────
│  🌙  *MODO AFK ACTIVADO*
├─────────────────────────
│  👤  *Usuario:*  @${userNum}
│  📝  *Razón:*    ${razon}
├─────────────────────────
│  💡  Si alguien te menciona
│  en cualquier grupo, el bot
│  avisará que estás AFK.
│
│  ✍️  Al escribir un mensaje
│  el modo AFK se quita solo.
└─────────────────────────${SIGNATURE}`,
        mentions: [userKey]
      }, { quoted: msg })
    }

    // ── .afk off → desactivar manualmente ──────────────────
    if (subCmd === "off") {
      if (!db[userKey]) {
        return await sock.sendMessage(chatId, {
          text:
`┌─────────────────────────
│  ℹ️  *SIN AFK ACTIVO*
├─────────────────────────
│  👤  @${userNum}
│  No tienes el modo AFK
│  activado actualmente.
└─────────────────────────${SIGNATURE}`,
          mentions: [userKey]
        }, { quoted: msg })
      }

      const entry = db[userKey]
      const tiempo = tiempoTranscurrido(entry.activadoEn)
      delete db[userKey]
      writeDB(db)

      try { await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }) } catch {}

      return await sock.sendMessage(chatId, {
        text:
`┌─────────────────────────
│  ✅  *MODO AFK DESACTIVADO*
├─────────────────────────
│  👤  *Usuario:*  @${userNum}
│  ⏱️  *Duración:* ${tiempo}
│  📝  *Razón fue:* ${entry.razon}
├─────────────────────────
│  🔔  Ya estás disponible.
└─────────────────────────${SIGNATURE}`,
        mentions: [userKey]
      }, { quoted: msg })
    }

    // ── .afk estado → ver si está activo ───────────────────
    if (subCmd === "estado" || subCmd === "status") {
      const entry = db[userKey]
      if (!entry) {
        return await sock.sendMessage(chatId, {
          text:
`┌─────────────────────────
│  📋  *ESTADO AFK*
├─────────────────────────
│  👤  @${userNum}
│  ❌  Sin modo AFK activo
└─────────────────────────${SIGNATURE}`,
          mentions: [userKey]
        }, { quoted: msg })
      }

      return await sock.sendMessage(chatId, {
        text:
`┌─────────────────────────
│  🌙  *ESTADO AFK*
├─────────────────────────
│  👤  *Usuario:*  @${userNum}
│  📝  *Razón:*    ${entry.razon}
│  ⏱️  *Tiempo:*   ${tiempoTranscurrido(entry.activadoEn)}
└─────────────────────────${SIGNATURE}`,
        mentions: [userKey]
      }, { quoted: msg })
    }

    // ── Tratar el texto como razón directa ──────────────────
    // Ej: .afk comiendo, .afk durmiendo
    const razonDirecta = args.join(" ").trim()
    if (razonDirecta) {
      db[userKey] = {
        jid:        userKey,
        num:        userNum,
        razon:      razonDirecta,
        activadoEn: Date.now()
      }
      writeDB(db)

      try { await sock.sendMessage(chatId, { react: { text: "🌙", key: msg.key } }) } catch {}

      return await sock.sendMessage(chatId, {
        text:
`┌─────────────────────────
│  🌙  *MODO AFK ACTIVADO*
├─────────────────────────
│  👤  *Usuario:*  @${userNum}
│  📝  *Razón:*    ${razonDirecta}
├─────────────────────────
│  💡  Si alguien te menciona
│  en cualquier grupo, el bot
│  avisará que estás AFK.
│
│  ✍️  Al escribir un mensaje
│  el modo AFK se quita solo.
└─────────────────────────${SIGNATURE}`,
        mentions: [userKey]
      }, { quoted: msg })
    }

  } catch (e) {
    console.error("[afk cmd] ERROR:", e)
    try {
      await sock.sendMessage(msg?.key?.remoteJid, {
        text: `❌ Error en el comando AFK.${SIGNATURE}`
      }, { quoted: msg })
    } catch {}
  }
}
