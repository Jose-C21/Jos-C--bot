import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"
import { isAllowedPrivate } from "./middleware/allowlist.js"
import chalk from "chalk"
import sticker from "../commands/sticker.js"
import play from "../commands/play.js"
import resetsession from "../commands/resetsession.js"

const COMMANDS = {
  resetsession,
  s: sticker,
  play
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
// TTL recomendado: 10 min (puedes subir a 30 si quieres aún menos requests)
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
    // si falla, guardamos algo corto para no insistir
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

  // ✅ Línea 2: name (+ group si aplica)
  const nameLine =
    chalk.whiteBright("name: ") +
    chalk.yellowBright(short(data.senderName || "SinNombre", 22))

  const groupLine = data.groupName
    ? chalk.whiteBright("group: ") + chalk.blueBright(short(data.groupName, 24))
    : ""

  // ✅ Línea 3: senderNumber COMPLETO
  const numLine =
    chalk.whiteBright("senderNumber: ") +
    chalk.cyanBright(String(data.senderNum || ""))

  // ✅ Línea 4: texto
  const txtLine =
    chalk.whiteBright("text: ") + chalk.cyanBright(`"${short(data.text || "", 40)}"`)

  // ✅ Resultado
  let res = ""
  if (data.action === "BLOCK") res = chalk.redBright("× BLOCK") + chalk.whiteBright(`  ${data.reason || ""}`)
  else if (data.action === "SKIP") res = chalk.yellowBright("↷ SKIP") + chalk.whiteBright(`  ${data.reason || ""}`)
  else if (data.action === "RUN") res = chalk.greenBright("▶ RUN") + chalk.cyanBright(`  .${data.command || ""}`)
  else res = chalk.whiteBright("…")

  console.log(head)
  console.log("  " + nameLine)
  if (groupLine) console.log("  " + groupLine)
  console.log("  " + numLine)
  console.log(padRightAnsi("  " + txtLine, OUT))
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

    // ✅ Nombre del grupo (solo si es grupo) con cache
    const groupName = isGroup ? await getGroupNameCached(sock, chatId) : ""

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