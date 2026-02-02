import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"
import { isAllowedPrivate } from "./middleware/allowlist.js"
import chalk from "chalk"
import fs from "fs"
import path from "path"

import sticker from "../commands/sticker.js"
import play from "../commands/play.js"
import resetsession from "../commands/resetsession.js"
import mute from "../commands/mute.js" // ✅ NUEVO

const COMMANDS = {
  resetsession,
  s: sticker,
  play,
  mute // ✅ NUEVO
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
// ✅ MUTE DB (persistente)
// ─────────────────────────────────────────────
const MUTE_PATH = path.join(process.cwd(), "data", "mute.json")

function readMuteDBSafe() {
  try {
    if (!fs.existsSync(MUTE_PATH)) return {}
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
  if (cached && (t - cached.t) < GROUP_TTL_MS) return cached.name

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
    chalk.whiteBright("senderNumber: ") +
    chalk.cyanBright(String(data.senderNum || ""))

  const txtLine =
    chalk.whiteBright("text: ") + chalk.cyanBright(`"${data.text ?? ""}"`)

  let res = ""
  if (data.action === "BLOCK") res = chalk.redBright("× BLOCK") + chalk.whiteBright(`  ${data.reason || ""}`)
  else if (data.action === "SKIP") res = chalk.yellowBright("↷ SKIP") + chalk.whiteBright(`  ${data.reason || ""}`)
  else if (data.action === "RUN") res = chalk.greenBright("▶ RUN") + chalk.cyanBright(`  .${data.command || ""}`)
  else res = chalk.whiteBright("…")

  console.log(head)
  console.log("  " + nameLine)
  if (groupLine) console.log("  " + groupLine)
  console.log("  " + numLine)

  // ✅ texto COMPLETO (sin recortes)
  console.log("  " + txtLine)

  console.log("  " + res)
  console.log(chalk.cyanBright("─".repeat(OUT)))
}

export async function routeMessage(sock, msg) {
  try {
    if (!msg?.message) return
    if (msg.key?.fromMe) return

    const chatId = msg?.key?.remoteJid || "unknown"
    const isGroup = String(chatId).endsWith("@g.us")

    const rawSenderJid = getSenderJid(msg)
    const senderNum = jidToNumber(rawSenderJid)

    let decodedJid = rawSenderJid
    try { if (sock?.decodeJid) decodedJid = sock.decodeJid(rawSenderJid) } catch {}

    const senderNumDecoded = jidToNumber(decodedJid)
    const finalNum = senderNumDecoded || senderNum

    const isOwner = isOwnerByNumbers({ senderNum, senderNumDecoded })
    const text = getText(msg)

    const senderName = getDisplayName(sock, msg, decodedJid)
    const groupName = isGroup ? await getGroupNameCached(sock, chatId) : ""

    // ─────────────────────────────────────────────
    // ✅ MUTE BLOQUEO (SOLO GRUPOS, ANTES DEL PREFIX)
    // ─────────────────────────────────────────────
    // ✅ si es owner, el mute NO aplica jamás
if (isGroup && isMuted(chatId, finalNum) && !isOwner) {
      global._muteCounter = global._muteCounter || {}
      const key = `${chatId}:${finalNum}`
      global._muteCounter[key] = (global._muteCounter[key] || 0) + 1
      const count = global._muteCounter[key]

      const senderJidForGroup = msg.key.participant || msg.key.remoteJid

      if (count === 8) {
        await sock.sendMessage(chatId, {
          text: `⚠️ @${String(finalNum)} estás muteado.\nSigue enviando mensajes y podrías ser eliminado.`,
          mentions: [senderJidForGroup]
        }).catch(() => {})
      }

      if (count === 13) {
        await sock.sendMessage(chatId, {
          text: `⛔ @${String(finalNum)} estás al límite.\nSi envías *otro mensaje*, serás eliminado del grupo.`,
          mentions: [senderJidForGroup]
        }).catch(() => {})
      }

      if (count >= 15) {
        try {
          const metadata = await sock.groupMetadata(chatId)
          const user = metadata.participants?.find(p => p.id === senderJidForGroup)
          const isAdmin = user?.admin === "admin" || user?.admin === "superadmin"

          if (!isAdmin) {
            await sock.groupParticipantsUpdate(chatId, [senderJidForGroup], "remove").catch(() => {})
            await sock.sendMessage(chatId, {
              text: `❌ @${String(finalNum)} fue eliminado por ignorar el mute.`,
              mentions: [senderJidForGroup]
            }).catch(() => {})
            delete global._muteCounter[key]
          } else {
            await sock.sendMessage(chatId, {
              text: `🔇 @${String(finalNum)} es administrador y no se puede eliminar.`,
              mentions: [senderJidForGroup]
            }).catch(() => {})
          }
        } catch {}
      }

      // 🧹 borrar cualquier tipo de mensaje
      try {
        await sock.sendMessage(chatId, {
          delete: {
            remoteJid: chatId,
            fromMe: false,
            id: msg.key.id,
            participant: senderJidForGroup
          }
        }).catch(() => {})
      } catch {}

      // log mínimo (opcional)
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

    const prefix = config.prefix || "."
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