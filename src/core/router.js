// src/core/router.js
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"
import { isAllowedPrivate } from "./middleware/allowlist.js"
import { antiLinkGuard } from "./antilinkGuard.js" // ✅ FIX: nombre correcto
import chalk from "chalk"
import fs from "fs"
import path from "path"

// ✅ RATE LIMIT
import { checkRateLimit, buildUserMentionJid, buildUserMentionTag } from "./ratelimit.js"

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

// ✅ ytsearch + hook (replies)
import ytsearch, { ytsearchReplyHook } from "../commands/ytsearch.js"

// ✅ NUEVO: antipersona (toggle) + watcher
import antipersona from "../commands/antipersona.js"
import { antiPersonaObserve } from "./antipersonaWatch.js"

// ✅ IMPORTA PAGE TAMBIÉN
import totalmensajes, { totalmensajesPage } from "../commands/totalmensajes.js"

import tiktok from "../commands/tiktok.js"
import decir from "../commands/decir.js"
import audiodoc from "../commands/audiodoc.js"
import bienvenida from "../commands/bienvenida.js"
import antilink from "../commands/antilink.js"
import antis from "../commands/antis.js"
import open from "../commands/open.js"
import close from "../commands/close.js"
import menu from "../commands/menu.js"
import ver from "../commands/ver.js"
import perfil from "../commands/perfil.js"
import kick from "../commands/kick.js"
import tag from "../commands/tag.js"
import antiarabe from "../commands/antiarabe.js"
import fantasma, { fantasmaPage } from "../commands/fantasma.js"
import fankick from "../commands/fankick.js"
import add from "../commands/add.js"
import warnSystem from "../commands/warn.js"
import reiniciarConteo from "../commands/reiniciarconteo.js"

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
  reiniciarconteo: reiniciarConteo,
  kiss,
  
  warn: warnSystem,
  warns: warnSystem,
  unwarn: warnSystem,

  // ✅ "restablecer advertencias" en inglés:
  resetwarns: warnSystem,
  resetwarnings: warnSystem, // alias opcional

  warncfg: warnSystem,

  // ✅ ytsearch
  ytsearch,
  yts: ytsearch,

  // ✅ antipersona toggle
  antipersona,

  totalmensajes,
  totalmensajes2: (sock, msg, ctx) => totalmensajesPage(sock, msg, { ...ctx, page: 2 }),
  totalmensajes3: (sock, msg, ctx) => totalmensajesPage(sock, msg, { ...ctx, page: 3 }),
  totalmensajes4: (sock, msg, ctx) => totalmensajesPage(sock, msg, { ...ctx, page: 4 }),
  totalmensajes5: (sock, msg, ctx) => totalmensajesPage(sock, msg, { ...ctx, page: 5 }),
  totalmensajes6: (sock, msg, ctx) => totalmensajesPage(sock, msg, { ...ctx, page: 6 }),
  totalmensajes7: (sock, msg, ctx) => totalmensajesPage(sock, msg, { ...ctx, page: 7 }),
  totalmensajes8: (sock, msg, ctx) => totalmensajesPage(sock, msg, { ...ctx, page: 8 }),
  totalmensajes9: (sock, msg, ctx) => totalmensajesPage(sock, msg, { ...ctx, page: 9 }),
  totalmensajes10: (sock, msg, ctx) => totalmensajesPage(sock, msg, { ...ctx, page: 10 }),

  tiktok,
  decir,
  audiodoc,
  bienvenida,
  antilink,
  antis,
  open,
  close,
  menu,
  ver,
  add,
  perfil,
  kick,
  ban: kick,
  tag,
  antiarabe,

  fantasma,
  fantasmas: fantasma,
  fankick,

  fantasma2: (sock, msg, ctx) => fantasmaPage(sock, msg, { ...ctx, page: 2 }),
  fantasma3: (sock, msg, ctx) => fantasmaPage(sock, msg, { ...ctx, page: 3 }),
  fantasma4: (sock, msg, ctx) => fantasmaPage(sock, msg, { ...ctx, page: 4 }),
  fantasma5: (sock, msg, ctx) => fantasmaPage(sock, msg, { ...ctx, page: 5 }),
  fantasma6: (sock, msg, ctx) => fantasmaPage(sock, msg, { ...ctx, page: 6 }),
  fantasma7: (sock, msg, ctx) => fantasmaPage(sock, msg, { ...ctx, page: 7 }),
  fantasma8: (sock, msg, ctx) => fantasmaPage(sock, msg, { ...ctx, page: 8 }),
  fantasma9: (sock, msg, ctx) => fantasmaPage(sock, msg, { ...ctx, page: 9 }),
  fantasma10: (sock, msg, ctx) => fantasmaPage(sock, msg, { ...ctx, page: 10 }),
}

function getText(msg) {
  const m = msg?.message || {}
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
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
// ✅ DATA DIR
// ─────────────────────────────────────────────
const DATA_DIR = path.join(process.cwd(), "data")

// ─────────────────────────────────────────────
// ✅ ACTIVOS (persistente) -> data/activos.json
// ─────────────────────────────────────────────
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
    if (!j.antipersona) j.antipersona = {} // ✅ NUEVO
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
    if (!j.bienvenida) j.bienvenida = {}
    if (!j.despedidas) j.despedidas = {}
    if (!j.antilink) j.antilink = {}
    if (!j.antis) j.antis = {}
    if (!j.antipersona) j.antipersona = {} // ✅ NUEVO
    return j
  } catch {
    return { bienvenida: {}, despedidas: {}, antilink: {}, antis: {}, antipersona: {} }
  }
}

// ─────────────────────────────────────────────
// ✅ CONTEO DE MENSAJES (persistente)
// ─────────────────────────────────────────────
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
// ✅ MUTE DB (persistente)
// ─────────────────────────────────────────────
const MUTE_PATH = path.join(DATA_DIR, "mute.json")

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
// ✅ LOG COMPACTO
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
    try { if (sock?.decodeJid) decodedJid = sock.decodeJid(rawSenderJid) } catch {}

    const senderNumDecoded = jidToNumber(decodedJid)
    const finalNum = senderNumDecoded || senderNum

    const isOwner = isOwnerByNumbers({ senderNum, senderNumDecoded })
    const text = getText(msg)

    const senderName = getDisplayName(sock, msg, decodedJid)
    const groupName = isGroup ? await getGroupNameCached(sock, chatId) : ""

    const fromMe = !!msg.key?.fromMe
    const prefix = config.prefix || "."
    if (fromMe && (!text || !text.startsWith(prefix))) return

    // ─────────────────────────────────────────────
    // ✅ ANTILINK GUARD
    // ─────────────────────────────────────────────
    try {
      const blocked = await antiLinkGuard(sock, msg)
      if (blocked) return
    } catch (e) {
      console.error("[antilinkGuard] error:", e)
    }

    // ─────────────────────────────────────────────
    // ✅ ANTIPERSONA WATCH (solo cambio de nombre)
    // ─────────────────────────────────────────────
    try {
      const activos = readActivosSafe()
      await antiPersonaObserve(sock, msg, { activos, isOwnerByNumbers })
    } catch (e) {
      console.error("[antipersona] error:", e)
    }

    // ─────────────────────────────────────────────
    // ✅ ANTISTICKERS GUARD (LOG SIEMPRE)
    // ─────────────────────────────────────────────
    try {
      const activos = readActivosSafe()
      const antisOn = !!activos?.antis?.[chatId]

      function unwrapMessage(m) {
        let msgObj = m?.message || {}
        while (true) {
          if (msgObj?.ephemeralMessage?.message) { msgObj = msgObj.ephemeralMessage.message; continue }
          if (msgObj?.viewOnceMessageV2?.message) { msgObj = msgObj.viewOnceMessageV2.message; continue }
          if (msgObj?.viewOnceMessageV2Extension?.message) { msgObj = msgObj.viewOnceMessageV2Extension.message; continue }
          break
        }
        return msgObj
      }

      const mUnwrapped = unwrapMessage(msg)

      const stickerMsg = mUnwrapped?.stickerMessage
      const lottieMsg = mUnwrapped?.lottieStickerMessage
      const animatedMsg = mUnwrapped?.animatedStickerMessage

      const docMsg = mUnwrapped?.documentMessage
      const isWebpDoc =
        !!docMsg &&
        (
          String(docMsg.mimetype || "").toLowerCase().includes("image/webp") ||
          String(docMsg.fileName || "").toLowerCase().endsWith(".webp")
        )

      const isStickerLike = !!stickerMsg || !!lottieMsg || !!animatedMsg || isWebpDoc

      console.log("[antisGuard] chat:", chatId, "antisOn:", antisOn, "fromMe:", fromMe, "types:", {
        sticker: !!stickerMsg,
        lottie: !!lottieMsg,
        animated: !!animatedMsg,
        webpDoc: !!isWebpDoc
      })
      if (!isStickerLike) console.log("[antisGuard] keys:", Object.keys(mUnwrapped || {}))

      if (isGroup && antisOn && !fromMe && isStickerLike) {
        const rawUser = msg.key.participant || msg.key.remoteJid
        const normalize = (id) => String(id || "").replace(/\D/g, "")

        console.log("[antisGuard] user:", rawUser, "norm:", normalize(rawUser))

        const whitelist = [
          "19580839829625",
          "129004208173107",
          "229639687504053",
          "4321307529361",
          "12370160128176",
          "208272208490541",
          "+1(805)7074359",
          "+573043427408",
          "+1(865)3128591",
          "+573186904935",
          "+50431864641",
          "+50432213256"
        ]

        const normalizedUser = normalize(rawUser)
        const isWhitelisted = whitelist.some((num) => normalize(num) === normalizedUser)
        console.log("[antisGuard] whitelisted:", isWhitelisted)
        if (isWhitelisted) return

        global.antisSpam = global.antisSpam || {}
        global.antisSpam[chatId] = global.antisSpam[chatId] || {}

        const nowTs = Date.now()
        const userKey = String(rawUser)

        const u = global.antisSpam[chatId][userKey] || {
          count: 0,
          last: nowTs,
          warned: false,
          strikes: 0
        }

        const timePassed = nowTs - u.last

        if (timePassed > 15000) {
          u.count = 1
          u.last = nowTs
          u.warned = false
          u.strikes = 0
        } else {
          u.count++
          u.last = nowTs
        }

        global.antisSpam[chatId][userKey] = u
        console.log("[antisGuard] count:", u.count, "strikes:", u.strikes, "timePassed:", timePassed)

        if (u.count === 5 && !u.warned) {
          await sock.sendMessage(chatId, {
            text:
              `⚠️ @${normalize(userKey)} has enviado 5 stickers.\n` +
              `Espera *15 segundos* o se borrarán y podrías ser eliminado.`,
            mentions: [userKey]
          }).catch(() => {})
          u.warned = true
          global.antisSpam[chatId][userKey] = u
        }

        if (u.count >= 5 && timePassed < 15000) {
          await sock.sendMessage(chatId, {
            delete: {
              remoteJid: chatId,
              fromMe: false,
              id: msg.key.id,
              participant: userKey
            }
          }).catch(() => {})

          u.strikes++
          global.antisSpam[chatId][userKey] = u

          if (u.strikes >= 3) {
            await sock.sendMessage(chatId, {
              text: `❌ @${normalize(userKey)} fue eliminado por abusar de los stickers.`,
              mentions: [userKey]
            }).catch(() => {})
            await sock.groupParticipantsUpdate(chatId, [userKey], "remove").catch(() => {})
            delete global.antisSpam[chatId][userKey]
          }

          logRouter({
            isGroup,
            isOwner,
            allowed: true,
            senderNum: finalNum,
            senderName,
            groupName,
            text: "[sticker]",
            action: "BLOCK",
            reason: `antis(count=${u.count}, strikes=${u.strikes})`
          })
          return
        }
      }
    } catch (e) {
      console.error("[antisGuard] error:", e)
    }

    // ─────────────────────────────────────────────
    // ✅ CONTADOR DE MENSAJES
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
    // ✅ MUTE BLOQUEO
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

    // ✅ privado allowlist
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

    // ✅ REPLIES (ytsearch: siguiente/anterior/N1) — sin comandos
    // Va antes del prefijo para que funcione respondiendo al bot.
    try {
      const handled = await ytsearchReplyHook(sock, msg)
      if (handled) return
    } catch {}

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

    // ─────────────────────────────────────────────
    // ✅ RATE LIMIT (solo play y sticker/s) — por usuario, owners bypass
    // ─────────────────────────────────────────────
    try {
      const rl = checkRateLimit(sock, msg, { command, isOwner })
      if (rl?.blocked) {
        const mentionJid = buildUserMentionJid(sock, msg)
        const tag = buildUserMentionTag(sock, msg)

        await sock.sendMessage(chatId, {
          text: `⏳ ${tag}\nEspera ${rl.waitSec}s para volver a usar .${command}`,
          mentions: [mentionJid]
        }, { quoted: msg }).catch(() => {})

        logRouter({
          isGroup,
          isOwner,
          allowed: true,
          senderNum: finalNum,
          senderName,
          groupName,
          text,
          action: "BLOCK",
          reason: `ratelimit(.${command}, wait=${rl.waitSec}s)`
        })
        return
      }
    } catch (e) {
      console.error("[ratelimit] error:", e)
    }

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

    await handler(sock, msg, {
  args,
  command,
  isOwner,
  usedPrefix: prefix,
  senderNum: finalNum
})
  } catch (e) {
    console.error(chalk.redBright("[ROUTER] error:"), e)
  }
}