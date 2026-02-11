// src/core/router.js
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"
import { isAllowedPrivate } from "./middleware/allowlist.js"
import { antiLinkGuard } from "./antilinkGuard.js" // ✅ NUEVO
import chalk from "chalk"
import fs from "fs"
import path from "path"

import sticker from "../commands/sticker.js"
import play from "../commands/play.js"
import resetsession from "../commands/resetsession.js"
import mute from "../commands/mute.js"
import unmute from "../commands/unmute.js"
import img from "../commands/img.js"
import addlista from "../commands/addlista.js"
import textsticker from "../commands/textsticker.js"
import playvideo from "../commands/playvideo.js"
import golpear from "../commands/golpear.js"
import kiss from "../commands/kiss.js"
import totalmensajes from "../commands/totalmensajes.js"
import tiktok from "../commands/tiktok.js"
import decir from "../commands/decir.js"
import audiodoc from "../commands/audiodoc.js"
import bienvenida from "../commands/bienvenida.js"
import antilink from "../commands/antilink.js" // ✅ NUEVO (te faltaba en tu router)
import spotdl from "../commands/spotdl.js"


const COMMANDS = {
  resetsession,
  s: sticker,
  play,
  mute,
  unmute,
  img,
  addlista,
  ts: textsticker,
  playvideo,
  golpear,
  kiss,
  totalmensajes,
  tiktok,
  decir,
  audiodoc,
  bienvenida,
  antilink,
  spotify: spotdl
}

function getText(msg) {
  const m = msg?.message || {}
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ""
  ).trim()
}

function isTextMessage(msg) {
  const m = msg?.message || {}
  return !!(m.conversation || m.extendedTextMessage?.text)
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

// ─────────────────────────────────────────────
// ✅ CONTEO DE MENSAJES (persistente)
// ─────────────────────────────────────────────
const DATA_DIR = path.join(process.cwd(), "data")
const CONTEO_PATH = path.join(DATA_DIR, "conteo.json")

function ensureConteoDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(CONTEO_PATH)) fs.writeFileSync(CONTEO_PATH, "{}")
}

function readConteoSafe() {
  try {
    ensureConteoDB()
    return JSON.parse(fs.readFileSync(CONTEO_PATH, "utf8") || "{}")
  } catch {
    return {}
  }
}

function writeConteoSafe(db) {
  try {
    ensureConteoDB()
    fs.writeFileSync(CONTEO_PATH, JSON.stringify(db, null, 2))
  } catch {}
}

// ─────────────────────────────────────────────
// ✅ MUTE DB (persistente) + AUTO-CREAR ARCHIVO
// ─────────────────────────────────────────────
const MUTE_PATH = path.join(process.cwd(), "data", "mute.json")

function ensureMuteDB() {
  const dir = path.dirname(MUTE_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(MUTE_PATH)) fs.writeFileSync(MUTE_PATH, "{}")
}

function readMuteDBSafe() {
  try {
    ensureMuteDB()
    return JSON.parse(fs.readFileSync(MUTE_PATH, "utf8") || "{}")
  } catch {
    return {}
  }
}

function isMuted(chatId, senderNum) {
  const db = readMuteDBSafe()
  const list = db[chatId] || []
  return list.includes(String(senderNum))
}

// ─────────────────────────────────────────────
// ✅ LOG COMPACTO + NOMBRE + NUM COMPLETO + GRUPO (cache)
// ─────────────────────────────────────────────
const stripAnsi = (s = "") => String(s).replace(/\x1B\[[0-9;]*m/g, "")
const padRightAnsi = (txt, width) => {
  const raw = stripAnsi(txt)
  if (raw.length >= width) return txt
  return txt + " ".repeat(width - raw.length)
}
const short = (s = "", n = 46) => {
  s = String(s)
  if (s.length <= n) return s
  return s.slice(0, n - 1) + "…"
}
const now = () => {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  const ss = String(d.getSeconds()).padStart(2, "0")
  return `${hh}:${mm}:${ss}`
}

function getDisplayName(sock, msg, jid) {
  const push = (msg?.pushName || "").trim()
  if (push) return push

  const c = sock?.contacts?.[jid]
  const name = (c?.name || c?.notify || c?.verifiedName || "").trim()
  if (name) return name

  return "SinNombre"
}

// ✅ Cache de nombres de grupos (para NO trabar)
const GROUP_CACHE = new Map()
const GROUP_TTL_MS = 10 * 60 * 1000

async function getGroupNameCached(sock, groupJid) {
  if (!groupJid || !String(groupJid).endsWith("@g.us")) return ""

  const cached = GROUP_CACHE.get(groupJid)
  const t = Date.now()
  if (cached && t - cached.t < GROUP_TTL_MS) return cached.name

  try {
    const md = await sock.groupMetadata(groupJid)
    const name = (md?.subject || "Grupo").trim()
    GROUP_CACHE.set(groupJid, { name, t })
    return name
  } catch {
    const name = "Grupo"
    GROUP_CACHE.set(groupJid, { name, t })
    return name
  }
}

function logRouter(data) {
  if (config.debugRouter === false) return

  const OUT = 44
  const tag = padRightAnsi(chalk.cyanBright("[ROUTER]"), 10)

  const where = data.isGroup ? chalk.blueBright("GROUP") : chalk.magentaBright("PRIVATE")
  const role = data.isOwner ? chalk.greenBright("OWNER") : chalk.yellowBright("USER")
  const gate = data.allowed ? chalk.greenBright("ALLOW") : chalk.redBright("BLOCK")

  const head = `${tag} ${where} ${role} ${gate} ${chalk.cyanBright(now())}`

  const nameLine =
    chalk.whiteBright("name: ") +
    chalk.yellowBright(short(data.senderName || "SinNombre", 22))

  const groupLine = data.groupName
    ? chalk.whiteBright("group: ") + chalk.blueBright(short(data.groupName, 24))
    : ""

  const numLine =
    chalk.whiteBright("senderNumber: ") + chalk.cyanBright(String(data.senderNum || ""))

  const txtLine = chalk.whiteBright("text: ") + chalk.cyanBright(`"${data.text ?? ""}"`)

  let res = ""
  if (data.action === "BLOCK") res = chalk.redBright("× BLOCK") + chalk.whiteBright(`  ${data.reason || ""}`)
  else if (data.action === "SKIP") res = chalk.yellowBright("↷ SKIP") + chalk.whiteBright(`  ${data.reason || ""}`)
  else if (data.action === "RUN") res = chalk.greenBright("▶ RUN") + chalk.cyanBright(`  .${data.command || ""}`)
  else res = chalk.whiteBright("…")

  console.log(head)
  console.log("  " + nameLine)
  if (groupLine) console.log("  " + groupLine)
  console.log("  " + numLine)
  console.log("  " + txtLine)
  console.log("  " + res)
  console.log(chalk.cyanBright("─".repeat(OUT)))
}

export async function routeMessage(sock, msg) {
  try {
    if (!msg?.message) return

    const chatId = msg?.key?.remoteJid || "unknown"
    const isGroup = String(chatId).endsWith("@g.us")

    const rawSenderJid = getSenderJid(msg)
    const senderNum = jidToNumber(rawSenderJid)

    let decodedJid = rawSenderJid
    try {
      if (sock?.decodeJid) decodedJid = sock.decodeJid(rawSenderJid)
    } catch {}

    const senderNumDecoded = jidToNumber(decodedJid)
    const finalNum = senderNumDecoded || senderNum

    const isOwner = isOwnerByNumbers({ senderNum, senderNumDecoded })
    const text = getText(msg)

    const senderName = getDisplayName(sock, msg, decodedJid)
    const groupName = isGroup ? await getGroupNameCached(sock, chatId) : ""

    // ─────────────────────────────────────────────
    // ✅ PERMITIR COMANDOS DESDE EL MISMO BOT (fromMe)
    // ─────────────────────────────────────────────
    const fromMe = !!msg.key?.fromMe
    const prefix = config.prefix || "."
    if (fromMe && (!text || !text.startsWith(prefix))) return

    // ─────────────────────────────────────────────
    // ✅ ANTILINK GUARD (ANTES DE TODO)
    // - respeta admins/owner/bot
    // - orden: expulsa -> borra msg -> aviso
    // ─────────────────────────────────────────────
    try {
      const blocked = await antiLinkGuard(sock, msg)
      if (blocked) return
    } catch (e) {
      console.error("[antilinkGuard] error:", e)
    }

    // ─────────────────────────────────────────────
    // ✅ CONTADOR DE MENSAJES (solo texto, solo grupos) + antiflood (solo para conteo)
    // ─────────────────────────────────────────────
    try {
      if (isGroup && isTextMessage(msg)) {
        const senderId = msg.key.participant || msg.key.remoteJid

        const nowTs = Date.now()
        global.msgFlood = global.msgFlood || {}
        const u = global.msgFlood[senderId] || { last: 0, count: 0, blockedUntil: 0 }

        if (nowTs - u.last < 7000) u.count++
        else u.count = 1

        u.last = nowTs

        if (!fromMe && u.count >= 3) {
          u.blockedUntil = nowTs + 12000
          console.log(`⚡ [ANTIFLOOD] Usuario ${senderId} activó bloqueo de conteo. (${u.count} mensajes rápidos)`)
        }

        global.msgFlood[senderId] = u

        const blocked = !fromMe && u.blockedUntil && nowTs < u.blockedUntil

        if (!blocked) {
          const conteoData = readConteoSafe()
          if (!conteoData[chatId]) conteoData[chatId] = {}
          if (!conteoData[chatId][senderId]) conteoData[chatId][senderId] = 0
          conteoData[chatId][senderId] += 1
          writeConteoSafe(conteoData)
        }
      }
    } catch (e) {
      console.error("❌ Error en contador de mensajes:", e)
    }

    // ─────────────────────────────────────────────
    // ✅ MUTE BLOQUEO (SOLO GRUPOS, ANTES DEL PREFIX)
    // ─────────────────────────────────────────────
    if (isGroup && isMuted(chatId, finalNum) && !isOwner) {
      global._muteCounter = global._muteCounter || {}
      const key = `${chatId}:${finalNum}`
      global._muteCounter[key] = (global._muteCounter[key] || 0) + 1
      const count = global._muteCounter[key]

      const participantJid = msg.key.participant || decodedJid || rawSenderJid

      if (count === 8) {
        await sock.sendMessage(chatId, {
          text: `⚠️ @${String(finalNum)} estás muteado.\nSigue enviando mensajes y podrías ser eliminado.`,
          mentions: [participantJid]
        }).catch(() => {})
      }

      if (count === 13) {
        await sock.sendMessage(chatId, {
          text: `⛔ @${String(finalNum)} estás al límite.\nSi envías *otro mensaje*, serás eliminado del grupo.`,
          mentions: [participantJid]
        }).catch(() => {})
      }

      if (count >= 15) {
        try {
          const metadata = await sock.groupMetadata(chatId)
          const user = metadata.participants?.find((p) => p.id === participantJid)
          const isAdmin = user?.admin === "admin" || user?.admin === "superadmin"

          if (!isAdmin) {
            await sock.groupParticipantsUpdate(chatId, [participantJid], "remove").catch(() => {})
            await sock.sendMessage(chatId, {
              text: `❌ @${String(finalNum)} fue eliminado por ignorar el mute.`,
              mentions: [participantJid]
            }).catch(() => {})
            delete global._muteCounter[key]
          } else {
            await sock.sendMessage(chatId, {
              text: `🔇 @${String(finalNum)} es administrador y no se puede eliminar.`,
              mentions: [participantJid]
            }).catch(() => {})
          }
        } catch {}
      }

      try {
        await sock.sendMessage(chatId, {
          delete: {
            remoteJid: chatId,
            fromMe: false,
            id: msg.key.id,
            participant: participantJid
          }
        }).catch(() => {})
      } catch {}

      logRouter({
        isGroup,
        isOwner,
        allowed: true,
        senderNum: finalNum,
        senderName,
        groupName,
        text: text || "",
        action: "BLOCK",
        reason: `muted(count=${count})`
      })

      return
    }

    // ✅ privado: allowlist SOLO para no-owners
    const allowed = isAllowedPrivate(msg)
    if (!isOwner && !allowed) {
      logRouter({
        isGroup,
        isOwner,
        allowed: false,
        senderNum: finalNum,
        senderName,
        groupName,
        text: text || "",
        action: "BLOCK",
        reason: "allowlist(private)"
      })
      return
    }

    if (!text) {
      logRouter({
        isGroup,
        isOwner,
        allowed: true,
        senderNum: finalNum,
        senderName,
        groupName,
        text: "",
        action: "SKIP",
        reason: "no text/caption"
      })
      return
    }

    if (!text.startsWith(prefix)) {
      logRouter({
        isGroup,
        isOwner,
        allowed: true,
        senderNum: finalNum,
        senderName,
        groupName,
        text,
        action: "SKIP",
        reason: `no prefix (expect "${prefix}")`
      })
      return
    }

    const parts = text.slice(prefix.length).trim().split(/\s+/)
    const command = (parts.shift() || "").toLowerCase()
    const args = parts

    const handler = COMMANDS[command]
    if (!handler) {
      logRouter({
        isGroup,
        isOwner,
        allowed: true,
        senderNum: finalNum,
        senderName,
        groupName,
        text,
        action: "SKIP",
        reason: "command not found"
      })
      return
    }

    logRouter({
      isGroup,
      isOwner,
      allowed: true,
      senderNum: finalNum,
      senderName,
      groupName,
      text,
      action: "RUN",
      command
    })

    await handler(sock, msg, { args, command, isOwner, usedPrefix: prefix })
  } catch (e) {
    console.error(chalk.redBright("[ROUTER] error:"), e)
  }
}