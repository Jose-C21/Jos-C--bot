// src/core/afkWatcher.js
//
// Se llama desde routeMessage() en router.js en CADA mensaje de grupo.
// 1. Si el que escribe está AFK → quitar AFK y anunciar que volvió.
// 2. Si el mensaje menciona a alguien AFK → avisar en el grupo.
//
// El estado es GLOBAL por JID de usuario → funciona en todos los grupos.

import fs   from "fs"
import path from "path"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const SIGNATURE =
  "\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦"

const DATA_DIR = path.join(process.cwd(), "data")
const AFK_PATH = path.join(DATA_DIR, "afk.json")

function readDB() {
  try {
    if (!fs.existsSync(AFK_PATH)) return {}
    return JSON.parse(fs.readFileSync(AFK_PATH, "utf8") || "{}")
  } catch { return {} }
}
function writeDB(db) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(AFK_PATH, JSON.stringify(db, null, 2))
  } catch {}
}

// ── Helpers ──────────────────────────────────────────────

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

// Quita el device suffix para comparar JIDs correctamente
function normalizeJid(jid = "") {
  return String(jid).replace(/:[\d]+@/, "@").trim()
}

// Extrae todas las menciones del mensaje (todos los tipos de mensaje)
function getMenciones(msg) {
  // Extrae el autor del mensaje citado (reply)
function getQuotedSender(msg) {
  const m = msg?.message || {}

  const inner =
    m?.ephemeralMessage?.message ||
    m?.viewOnceMessageV2?.message ||
    m?.viewOnceMessageV2Extension?.message ||
    m

  const ctx =
    inner?.extendedTextMessage?.contextInfo ||
    inner?.imageMessage?.contextInfo ||
    inner?.videoMessage?.contextInfo ||
    inner?.documentMessage?.contextInfo

  return ctx?.participant || null
}
  
  const m = msg?.message || {}
  const inner =
    m?.ephemeralMessage?.message ||
    m?.viewOnceMessageV2?.message ||
    m?.viewOnceMessageV2Extension?.message ||
    m
  return (
    inner?.extendedTextMessage?.contextInfo?.mentionedJid ||
    inner?.imageMessage?.contextInfo?.mentionedJid        ||
    inner?.videoMessage?.contextInfo?.mentionedJid        ||
    inner?.documentMessage?.contextInfo?.mentionedJid     ||
    []
  )
}

// Caché del nombre del grupo (10 min TTL)
const _groupCache = new Map()
async function getGroupName(sock, chatId) {
  const cached = _groupCache.get(chatId)
  if (cached && Date.now() - cached.t < 600_000) return cached.name
  try {
    const md   = await sock.groupMetadata(chatId)
    const name = (md?.subject || "este grupo").trim()
    _groupCache.set(chatId, { name, t: Date.now() })
    return name
  } catch { return "este grupo" }
}

// ── Mensaje: alguien mencionó a un usuario AFK ───────────

async function enviarAvisoAFK(sock, chatId, entry, quienMencionoJid, groupName) {
  const afkNum = entry.num
  const afkJid = entry.jid

  await sock.sendMessage(chatId, {
    text:
`╭─〔 🌙 𝗨𝗦𝗨𝗔𝗥𝗜𝗢 𝗔𝗨𝗦𝗘𝗡𝗧𝗘 〕─⬣

👤 𝗨𝘀𝘂𝗮𝗿𝗶𝗼:
@${afkNum}

📝 𝗥𝗮𝘇ó𝗻:
${entry.razon}

⏳ 𝗔𝘂𝘀𝗲𝗻𝘁𝗲 𝗱𝗲𝘀𝗱𝗲:
${tiempoTranscurrido(entry.activadoEn)}

🏷️ 𝗚𝗿𝘂𝗽𝗼:
${groupName}

💬 𝗘𝘀𝘁𝗲 𝘂𝘀𝘂𝗮𝗿𝗶𝗼 𝘀𝗲 𝗲𝗻𝗰𝘂𝗲𝗻𝘁𝗿𝗮 𝗔𝗙𝗞.
✨ 𝗧𝗲 𝗿𝗲𝘀𝗽𝗼𝗻𝗱𝗲𝗿á 𝗰𝘂𝗮𝗻𝗱𝗼 𝗿𝗲𝗴𝗿𝗲𝘀𝗲.

╰────────────────⬣${SIGNATURE}`,
    mentions: [afkJid, quienMencionoJid]
  }).catch(() => {})
}

// ── Mensaje: el usuario AFK volvió ───────────────────────

async function enviarAvisoVuelta(sock, chatId, entry, userJid) {
  const userNum = entry.num

  await sock.sendMessage(chatId, {
    text:
`╭─〔 🔔 𝗗𝗘 𝗩𝗨𝗘𝗟𝗧𝗔 𝗘𝗡 𝗟Í𝗡𝗘𝗔 〕─⬣

👤 𝗨𝘀𝘂𝗮𝗿𝗶𝗼:
@${userNum}

⏳ 𝗧𝗶𝗲𝗺𝗽𝗼 𝗔𝗙𝗞:
${tiempoTranscurrido(entry.activadoEn)}

📝 𝗠𝗼𝘁𝗶𝘃𝗼:
${entry.razon}

✅ 𝗬𝗮 𝘀𝗲 𝗲𝗻𝗰𝘂𝗲𝗻𝘁𝗿𝗮 𝗱𝗶𝘀𝗽𝗼𝗻𝗶𝗯𝗹𝗲.

╰────────────────⬣${SIGNATURE}`,
    mentions: [userJid]
  }).catch(() => {})
}

// ── HOOK PRINCIPAL ────────────────────────────────────────

export async function afkWatcher(sock, msg) {
  try {
    const chatId  = msg?.key?.remoteJid
    if (!chatId) return false

    // Solo grupos
    if (!String(chatId).endsWith("@g.us")) return false

    // Ignorar mensajes del propio bot
    if (msg.key?.fromMe) return false

    const db = readDB()
    if (Object.keys(db).length === 0) return false

    // Obtener JID del emisor
    const senderJid = getSenderJid(msg)
    let   decodedSender = senderJid
    try { if (sock?.decodeJid) decodedSender = sock.decodeJid(senderJid) } catch {}
    const normSender = normalizeJid(decodedSender)

    // ─────────────────────────────────────────────────────
    // 1. ¿El que escribe está AFK? → quitar y anunciar
    // ─────────────────────────────────────────────────────
    let volvioDe = null

    for (const [key, entry] of Object.entries(db)) {
      if (normalizeJid(key) !== normSender) continue

      // Guardar la entrada antes de borrarla para usarla en el aviso
      volvioDe = { ...entry }

      delete db[key]
      writeDB(db)
      break
    }

    if (volvioDe) {
      // Avisar en el grupo donde escribió
      await enviarAvisoVuelta(sock, chatId, volvioDe, decodedSender)
      console.log(`[afkWatcher] ${volvioDe.num} volvió → AFK eliminado`)

      // No hacemos return aquí para que el mensaje también
      // se procese normalmente (el comando que escribió funcione)
    }

    // ─────────────────────────────────────────────────────
// 2. ¿Mencionó o respondió a alguien AFK?
// ─────────────────────────────────────────────────────

const menciones = getMenciones(msg)
const quotedSender = getQuotedSender(msg)

// Unificar menciones + respuestas
const objetivos = [...menciones]

if (quotedSender) {
  objetivos.push(quotedSender)
}

// Nada que revisar
if (!objetivos.length) return false

// Eliminar duplicados
const objetivosUnicos = [...new Set(objetivos)]

// Recargar DB por si cambió en el paso anterior
const dbActual = readDB()
if (Object.keys(dbActual).length === 0) return false

// Cooldown: 1 aviso por usuario AFK por grupo cada 60 segundos
global._afkCooldown = global._afkCooldown || {}

let handled = false
const groupName = await getGroupName(sock, chatId)

for (const objetivoJid of objetivosUnicos) {
  const normObjetivo = normalizeJid(objetivoJid)

  for (const [key, entry] of Object.entries(dbActual)) {
    if (normalizeJid(key) !== normObjetivo) continue

    // Cooldown por grupo + usuario AFK
    const coolKey = `${chatId}:${normalizeJid(key)}`
    const lastSent = global._afkCooldown[coolKey] || 0

    if (Date.now() - lastSent < 60_000) {
      break
    }

    global._afkCooldown[coolKey] = Date.now()

    await enviarAvisoAFK(
      sock,
      chatId,
      entry,
      decodedSender,
      groupName
    )

    handled = true

    console.log(
      `[afkWatcher] Aviso AFK → ${entry.num} | por ${jidToNumber(decodedSender)} | grupo "${groupName}"`
    )

    break
  }
}

return handled

  } catch (e) {
    console.error("[afkWatcher] ERROR:", e)
    return false
  }
}
