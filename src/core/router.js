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
// ✅ LOG COMPACTO + NOMBRE + COLORES VISIBLES
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

const shortNum = (n = "") => {
  const s = String(n)
  if (s.length <= 10) return s
  return s.slice(0, 6) + "…" + s.slice(-4)
}

const now = () => {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  const ss = String(d.getSeconds()).padStart(2, "0")
  return `${hh}:${mm}:${ss}`
}

function getDisplayName(sock, msg, jid) {
  // 1) pushName (WhatsApp lo manda casi siempre)
  const push = (msg?.pushName || "").trim()
  if (push) return push

  // 2) contactos cacheados por Baileys (si existen)
  const c = sock?.contacts?.[jid]
  const name = (c?.name || c?.notify || c?.verifiedName || "").trim()
  if (name) return name

  return "SinNombre"
}

function logRouter(data, sock, msg) {
  // Toggle: si quieres apagar logs, pon en config: debugRouter: false
  if (config.debugRouter === false) return

  const OUT = 44 // ancho cómodo en panel
  const tag = padRightAnsi(chalk.cyanBright("[ROUTER]"), 10)

  const where = data.isGroup ? chalk.blueBright("GROUP") : chalk.magentaBright("PRIVATE")
  const role = data.isOwner ? chalk.greenBright("OWNER") : chalk.yellowBright("USER")
  const gate = data.allowed ? chalk.greenBright("ALLOW") : chalk.redBright("BLOCK")

  // Header en 1 línea
  const head = `${tag} ${where} ${role} ${gate} ${chalk.cyanBright(now())}`

  const senderNumber = shortNum(data.senderNum || "")
  const displayName = data.senderName || "SinNombre"

  // Línea 2: nombre + senderNumber + texto
  const fromLine =
    chalk.whiteBright("name: ") +
    chalk.yellowBright(short(displayName, 18)) +
    chalk.whiteBright("  |  senderNumber: ") +
    chalk.cyanBright(senderNumber)

  const txtLine =
    chalk.whiteBright("text: ") + chalk.cyanBright(`"${short(data.text || "", 40)}"`)

  // Línea 3: acción (RUN/SKIP/BLOCK)
  let res = ""
  if (data.action === "BLOCK") {
    res = chalk.redBright("× BLOCK") + chalk.whiteBright(`  ${data.reason || ""}`)
  } else if (data.action === "SKIP") {
    res = chalk.yellowBright("↷ SKIP") + chalk.whiteBright(`  ${data.reason || ""}`)
  } else if (data.action === "RUN") {
    res = chalk.greenBright("▶ RUN") + chalk.cyanBright(`  .${data.command || ""}`)
  } else {
    res = chalk.whiteBright("…")
  }

  console.log(head)
  console.log(padRightAnsi("  " + fromLine, OUT))
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
    try {
      if (sock?.decodeJid) decodedJid = sock.decodeJid(rawSenderJid)
    } catch {}

    const senderNumDecoded = jidToNumber(decodedJid)
    const finalNum = senderNumDecoded || senderNum

    const isOwner = isOwnerByNumbers({ senderNum, senderNumDecoded })
    const text = getText(msg)

    // ✅ nombre (privado/grupo)
    const senderName = getDisplayName(sock, msg, decodedJid)

    // allowlist SOLO aplica en privado y solo para no-owners
    const allowed = isAllowedPrivate(msg)
    if (!isOwner && !allowed) {
      logRouter(
        {
          isGroup,
          isOwner,
          allowed: false,
          senderNum: finalNum,
          senderName,
          text: text || "",
          action: "BLOCK",
          reason: "allowlist(private)"
        },
        sock,
        msg
      )
      return
    }

    if (!text) {
      logRouter(
        {
          isGroup,
          isOwner,
          allowed: true,
          senderNum: finalNum,
          senderName,
          text: "",
          action: "SKIP",
          reason: "no text/caption"
        },
        sock,
        msg
      )
      return
    }

    const prefix = config.prefix || "."
    if (!text.startsWith(prefix)) {
      logRouter(
        {
          isGroup,
          isOwner,
          allowed: true,
          senderNum: finalNum,
          senderName,
          text,
          action: "SKIP",
          reason: `no prefix (expect "${prefix}")`
        },
        sock,
        msg
      )
      return
    }

    // NO permitimos ". comando" (solo ".comando") -> tu lógica actual ya lo hace
    const parts = text.slice(prefix.length).trim().split(/\s+/)
    const command = (parts.shift() || "").toLowerCase()
    const args = parts

    const handler = COMMANDS[command]
    if (!handler) {
      logRouter(
        {
          isGroup,
          isOwner,
          allowed: true,
          senderNum: finalNum,
          senderName,
          text,
          action: "SKIP",
          reason: "command not found"
        },
        sock,
        msg
      )
      return
    }

    logRouter(
      {
        isGroup,
        isOwner,
        allowed: true,
        senderNum: finalNum,
        senderName,
        text,
        action: "RUN",
        command
      },
      sock,
      msg
    )

    await handler(sock, msg, { args, command, isOwner, usedPrefix: prefix })
  } catch (e) {
    console.error(chalk.redBright("[ROUTER] error:"), e)
  }
}