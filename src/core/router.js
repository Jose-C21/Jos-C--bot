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
// ✅ LOG COMPACTO (móvil/panel friendly)
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

function logRouter(chalk, data) {
  // Toggle: si quieres apagar logs, pon en config: debugRouter: false
  if (config.debugRouter === false) return

  const OUT = 44 // ancho cómodo en panel
  const tag = padRightAnsi(chalk.cyanBright("[ROUTER]"), 10)

  const where = data.isGroup ? chalk.blueBright("GROUP") : chalk.magentaBright("PRIVATE")
  const owner = data.isOwner ? chalk.greenBright("OWNER") : chalk.gray("USER")
  const allow = data.allowed ? chalk.greenBright("ALLOW") : chalk.redBright("BLOCK")

  // header compacto en una línea
  const head = `${tag} ${where} ${owner} ${allow} ${chalk.gray(now())}`

  // segunda línea: lo importante
  const from = chalk.white(`from:${data.senderNum}`)
  const txt = chalk.gray(`txt:`) + chalk.white(`"${short(data.text, 40)}"`)

  // tercera línea: resultado mínimo
  let res = ""
  if (data.action === "BLOCK") res = chalk.redBright(`× BLOCK`) + chalk.gray(` ${data.reason}`)
  else if (data.action === "SKIP") res = chalk.yellowBright(`↷ SKIP`) + chalk.gray(` ${data.reason}`)
  else if (data.action === "RUN") res = chalk.greenBright(`▶ RUN`) + chalk.cyanBright(` .${data.command}`)
  else res = chalk.gray("…")

  // imprime compacto (3 líneas máximo)
  console.log(head)
  console.log(padRightAnsi("  " + from, OUT) + "  " + txt)
  console.log("  " + res)
  console.log(chalk.gray("─".repeat(OUT)))
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

    const isOwner = isOwnerByNumbers({ senderNum, senderNumDecoded })

    const text = getText(msg)

    // allowlist SOLO aplica en privado y solo para no-owners (como ya lo tenías)
    const allowed = isAllowedPrivate(msg)
    if (!isOwner && !allowed) {
      logRouter(chalk, {
        isGroup,
        isOwner,
        allowed: false,
        senderNum: senderNumDecoded || senderNum,
        text: text || "",
        action: "BLOCK",
        reason: "allowlist(private)"
      })
      return
    }

    if (!text) {
      // si quieres, puedes comentar este log
      logRouter(chalk, {
        isGroup,
        isOwner,
        allowed: true,
        senderNum: senderNumDecoded || senderNum,
        text: "",
        action: "SKIP",
        reason: "no text/caption"
      })
      return
    }

    const prefix = config.prefix || "."
    if (!text.startsWith(prefix)) {
      logRouter(chalk, {
        isGroup,
        isOwner,
        allowed: true,
        senderNum: senderNumDecoded || senderNum,
        text,
        action: "SKIP",
        reason: "no prefix"
      })
      return
    }

    // NO permitimos ". comando" (solo ".comando") -> tu lógica actual ya lo hace
    const parts = text.slice(prefix.length).trim().split(/\s+/)
    const command = (parts.shift() || "").toLowerCase()
    const args = parts

    const handler = COMMANDS[command]
    if (!handler) {
      logRouter(chalk, {
        isGroup,
        isOwner,
        allowed: true,
        senderNum: senderNumDecoded || senderNum,
        text,
        action: "SKIP",
        reason: "command not found"
      })
      return
    }

    logRouter(chalk, {
      isGroup,
      isOwner,
      allowed: true,
      senderNum: senderNumDecoded || senderNum,
      text,
      action: "RUN",
      command
    })

    await handler(sock, msg, { args, command, isOwner, usedPrefix: prefix })
  } catch (e) {
    console.error("[ROUTER] error:", e)
  }
}