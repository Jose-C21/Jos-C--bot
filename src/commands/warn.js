// src/commands/warn.js
import fs from "fs"
import path from "path"
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

// ─────────────────────────────────────────────
// ✅ CONFIG
// ─────────────────────────────────────────────
const LIMIT = 3
const ACTION = "kick" // fijo: kick al llegar a 3
const DATA_DIR = path.join(process.cwd(), "data")
const WARNS_PATH = path.join(DATA_DIR, "warns.json")

const onlyDigits = (x) => String(x || "").replace(/\D/g, "")
const nowISO = () => new Date().toISOString()

function signature() {
  return `\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`
}

function ensureDB() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    if (!fs.existsSync(WARNS_PATH)) fs.writeFileSync(WARNS_PATH, JSON.stringify({}, null, 2))
  } catch {}
}

function readDB() {
  try {
    ensureDB()
    return JSON.parse(fs.readFileSync(WARNS_PATH, "utf8") || "{}")
  } catch {
    return {}
  }
}

function writeDB(db) {
  try {
    ensureDB()
    fs.writeFileSync(WARNS_PATH, JSON.stringify(db, null, 2))
  } catch {}
}

function unwrapMessage(msg) {
  let m = msg?.message || {}
  while (true) {
    if (m?.ephemeralMessage?.message) { m = m.ephemeralMessage.message; continue }
    if (m?.viewOnceMessageV2?.message) { m = m.viewOnceMessageV2.message; continue }
    if (m?.viewOnceMessageV2Extension?.message) { m = m.viewOnceMessageV2Extension.message; continue }
    break
  }
  return m
}

function getText(msg) {
  const m = unwrapMessage(msg)
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    ""
  ).trim()
}

function getMentionJid(sock, msg) {
  const raw = getSenderJid(msg)
  let decoded = raw
  try { if (sock?.decodeJid) decoded = sock.decodeJid(raw) } catch {}
  return decoded || raw
}

function getMentionTagFromJid(jid) {
  return `@${jidToNumber(jid) || onlyDigits(jid) || "usuario"}`
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

function getQuotedTargetJid(msg) {
  const m = unwrapMessage(msg)
  const ctx =
    m?.extendedTextMessage?.contextInfo ||
    m?.imageMessage?.contextInfo ||
    m?.videoMessage?.contextInfo ||
    m?.documentMessage?.contextInfo ||
    null

  // 1) mention directa
  const mentioned = ctx?.mentionedJid?.[0]
  if (mentioned) return mentioned

  // 2) reply a alguien
  const participant = ctx?.participant
  if (participant) return participant

  return null
}

async function getAdminsAndBot(sock, chatId) {
  const md = await sock.groupMetadata(chatId)
  const botJid = sock?.user?.id ? (sock.decodeJid ? sock.decodeJid(sock.user.id) : sock.user.id) : ""
  const botId = botJid || ""

  const parts = md?.participants || []
  const admins = new Set(
    parts
      .filter(p => p.admin === "admin" || p.admin === "superadmin")
      .map(p => String(p.id))
  )

  return { md, admins, botId }
}

function getWarnKey(jid) {
  // guardar por JID exacto, pero también normalizamos por número para LID/JID raros
  const num = jidToNumber(jid) || onlyDigits(jid)
  return num ? `num:${String(num)}` : `jid:${String(jid)}`
}

function getUserBucket(db, chatId) {
  if (!db[chatId]) db[chatId] = {}
  return db[chatId]
}

function formatHistory(list = [], max = 6) {
  const slice = list.slice(-max).reverse()
  if (!slice.length) return "• (sin historial)"
  return slice.map((w, i) => {
    const by = w.byTag || "mod"
    const rs = (w.reason || "").trim() || "Sin razón"
    const dt = w.at ? w.at.replace("T", " ").replace("Z", "") : ""
    return `• ${i + 1}) ${rs}\n  ↳ ${by}  •  ${dt}`
  }).join("\n")
}

// ─────────────────────────────────────────────
// ✅ COMMAND HANDLER (warn / warns / unwarn / resetwarns / warncfg)
// ─────────────────────────────────────────────
export default async function warnSystem(sock, msg, { args = [], command = "", usedPrefix = "." } = {}) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const isGroup = String(chatId).endsWith("@g.us")
  if (!isGroup) {
    await sock.sendMessage(chatId, {
      text: `⚠️ Este sistema solo funciona en *grupos*.${signature()}`
    }, { quoted: msg }).catch(() => {})
    return
  }

  // sender / owner
  const rawSender = getSenderJid(msg)
  const senderNum = jidToNumber(rawSender)
  let decodedSender = rawSender
  try { if (sock?.decodeJid) decodedSender = sock.decodeJid(rawSender) } catch {}
  const senderNumDecoded = jidToNumber(decodedSender)
  const isOwner = isOwnerByNumbers({ senderNum, senderNumDecoded })

  // permisos: solo admins/owner
  let admins = null
  let botId = null
  try {
    const info = await getAdminsAndBot(sock, chatId)
    admins = info.admins
    botId = info.botId
  } catch {
    admins = new Set()
    botId = ""
  }

  const senderJid = getMentionJid(sock, msg)
  const senderIsAdmin = admins.has(String(senderJid)) || admins.has(String(rawSender)) || admins.has(String(decodedSender))

  if (!isOwner && !senderIsAdmin) {
    await sock.sendMessage(chatId, {
      text: `⛔ Solo *administradores* pueden usar este comando.${signature()}`
    }, { quoted: msg }).catch(() => {})
    return
  }

  const cmd = String(command || "").toLowerCase()

  // config view
  if (cmd === "warncfg") {
    await sock.sendMessage(chatId, {
      text:
        `╭─ 𝗪𝗔𝗥𝗡 𝗦𝗬𝗦𝗧𝗘𝗠\n` +
        `│ ✅ Límite: ${LIMIT}\n` +
        `│ ✅ Acción: ${ACTION.toUpperCase()}\n` +
        `│ ✅ Expiran: NO\n` +
        `│ ✅ Auto-borrado: SI (cuando llega a ${LIMIT}/${LIMIT} y se expulsa)\n` +
        `╰────────────${signature()}`
    }, { quoted: msg }).catch(() => {})
    return
  }

  // target
  const targetJid = getQuotedTargetJid(msg)
  if (!targetJid) {
    const example =
      cmd === "warn"
        ? `${usedPrefix}warn @usuario spam`
        : cmd === "warns"
          ? `${usedPrefix}warns @usuario`
          : cmd === "unwarn"
            ? `${usedPrefix}unwarn @usuario 1`
            : `${usedPrefix}resetwarns @usuario`

    await sock.sendMessage(chatId, {
      text:
        `📌 Uso:\n` +
        `• ${example}\n\n` +
        `💡 Tip: también puedes *responder* al mensaje del usuario y usar el comando.\n` +
        signature()
    }, { quoted: msg }).catch(() => {})
    return
  }

  // no permitir warn al bot o a admins si quieres (opcional). Yo bloqueo al bot para evitar bugs.
  const targetTag = getMentionTagFromJid(targetJid)
  const senderTag = getMentionTagFromJid(senderJid)

  if (botId && String(targetJid) === String(botId)) {
    await sock.sendMessage(chatId, { text: `🤖 No puedo aplicarme warns a mí mismo.${signature()}` }, { quoted: msg }).catch(() => {})
    return
  }

  // DB
  const db = readDB()
  const bucket = getUserBucket(db, chatId)
  const key = getWarnKey(targetJid)
  const row = bucket[key] || { count: 0, history: [], lastKnownJid: String(targetJid) }

  // ─────────────────────────────────────────────
  // ✅ WARNS VIEW
  // ─────────────────────────────────────────────
  if (cmd === "warns") {
    const cnt = Math.max(0, row.count || 0)
    const hist = Array.isArray(row.history) ? row.history : []
    await sock.sendMessage(chatId, {
      text:
        `╭─ 𝗪𝗔𝗥𝗡𝗦\n` +
        `│ 👤 Usuario: ${targetTag}\n` +
        `│ ⚠️ Total: ${cnt}/${LIMIT}\n` +
        `├─ Historial (últimos ${Math.min(6, hist.length)}):\n` +
        `${formatHistory(hist, 6)}\n` +
        `╰────────────${signature()}`,
      mentions: [targetJid]
    }, { quoted: msg }).catch(() => {})
    return
  }

  // ─────────────────────────────────────────────
  // ✅ RESET WARNS (ENGLISH COMMAND)
  // ─────────────────────────────────────────────
  if (cmd === "resetwarns" || cmd === "resetwarnings") {
    delete bucket[key]
    writeDB(db)

    await sock.sendMessage(chatId, {
      text:
        `✅ *Warns restablecidos.*\n` +
        `👤 ${targetTag} ahora está en *0/${LIMIT}*.\n` +
        `${signature()}`,
      mentions: [targetJid]
    }, { quoted: msg }).catch(() => {})
    return
  }

  // ─────────────────────────────────────────────
  // ✅ UNWARN
  // ─────────────────────────────────────────────
  if (cmd === "unwarn") {
    const n = parseInt(args?.[1] || args?.[0] || "1", 10)
    const dec = Number.isFinite(n) && n > 0 ? n : 1

    row.count = Math.max(0, (row.count || 0) - dec)
    row.lastKnownJid = String(targetJid)
    bucket[key] = row
    writeDB(db)

    await sock.sendMessage(chatId, {
      text:
        `✅ *Unwarn aplicado.*\n` +
        `👤 ${targetTag}\n` +
        `📉 -${dec}  →  *${row.count}/${LIMIT}*\n` +
        `${signature()}`,
      mentions: [targetJid]
    }, { quoted: msg }).catch(() => {})
    return
  }

  // ─────────────────────────────────────────────
  // ✅ WARN (DEFAULT)
  // ─────────────────────────────────────────────
  if (cmd !== "warn") {
    await sock.sendMessage(chatId, { text: `⚠️ Comando inválido.${signature()}` }, { quoted: msg }).catch(() => {})
    return
  }

  const reason = (args || []).slice(1).join(" ").trim() || (args || []).join(" ").trim() || "Sin razón"
  row.count = (row.count || 0) + 1
  row.lastKnownJid = String(targetJid)
  row.history = Array.isArray(row.history) ? row.history : []
  row.history.push({
    at: nowISO(),
    byJid: String(senderJid),
    byTag: senderTag,
    reason
  })

  bucket[key] = row
  writeDB(db)

  // aviso pro
  await sock.sendMessage(chatId, {
    text:
      `╭─ ⚠️ 𝗔𝗗𝗩𝗘𝗥𝗧𝗘𝗡𝗖𝗜𝗔\n` +
      `│ 👤 Usuario: ${targetTag}\n` +
      `│ 🧾 Razón: ${reason}\n` +
      `│ 👮 Moderador: ${senderTag}\n` +
      `│ 📌 Estado: *${row.count}/${LIMIT}*\n` +
      `╰────────────${signature()}`,
    mentions: [targetJid, senderJid]
  }, { quoted: msg }).catch(() => {})

  // llegó al límite => kick
  if (row.count >= LIMIT) {
    // verificar bot admin
    const botIsAdmin = botId ? admins.has(String(botId)) : false
    if (!botIsAdmin) {
      await sock.sendMessage(chatId, {
        text:
          `⛔ ${targetTag} llegó a *${LIMIT}/${LIMIT}*.\n` +
          `Pero no puedo expulsar porque *no soy admin*.\n` +
          `✅ Dale admin al bot y vuelve a intentar.\n` +
          `${signature()}`,
        mentions: [targetJid]
      }, { quoted: msg }).catch(() => {})
      return
    }

    // intentar kick
    try {
      await sock.sendMessage(chatId, {
        text:
          `🚫 *Límite alcanzado* (${LIMIT}/${LIMIT}).\n` +
          `👤 ${targetTag} será expulsado del grupo.\n` +
          `${signature()}`,
        mentions: [targetJid]
      }, { quoted: msg }).catch(() => {})

      await sock.groupParticipantsUpdate(chatId, [targetJid], "remove").catch(() => {})

      // ✅ auto-borrar warns si fue por límite
      delete bucket[key]
      writeDB(db)

      await sock.sendMessage(chatId, {
        text:
          `✅ ${targetTag} fue expulsado.\n` +
          `🧹 Warns borrados automáticamente (acción por límite).\n` +
          `${signature()}`,
        mentions: [targetJid]
      }, { quoted: msg }).catch(() => {})
    } catch {
      await sock.sendMessage(chatId, {
        text:
          `⚠️ ${targetTag} llegó a *${LIMIT}/${LIMIT}* pero ocurrió un error al expulsar.\n` +
          `Intenta de nuevo.\n` +
          `${signature()}`,
        mentions: [targetJid]
      }, { quoted: msg }).catch(() => {})
    }
  }
}