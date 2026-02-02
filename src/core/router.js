import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"
import { isAllowedPrivate } from "./middleware/allowlist.js"

import sticker from "../commands/sticker.js"
import play from "../commands/play.js"
import resetsession from "../commands/resetsession.js"

import chalk from "chalk"

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
// ✅ LOG UI (bonito y ordenado)
// ─────────────────────────────────────────────
const LOG = (() => {
  const stripAnsi = (s = "") => String(s).replace(/\x1B\[[0-9;]*m/g, "")
  const OUT = 62

  const centerAnsi = (txt, width = OUT) => {
    const raw = stripAnsi(txt)
    if (raw.length >= width) return txt
    const left = Math.floor((width - raw.length) / 2)
    const right = width - raw.length - left
    return " ".repeat(left) + txt + " ".repeat(right)
  }

  const hr = (len = OUT) => chalk.gray("─".repeat(len))
  const tag = (t) => chalk.gray("[") + chalk.cyanBright(t) + chalk.gray("]")

  const k = (key) => chalk.gray(key)
  const v = (val) => chalk.white(val)
  const dim = (val) => chalk.gray(val)

  const ok = (s) => chalk.greenBright(s)
  const warn = (s) => chalk.yellowBright(s)
  const bad = (s) => chalk.redBright(s)

  const badge = {
    owner: (b) => (b ? ok("OWNER") : dim("USER")),
    allow: (b) => (b ? ok("ALLOW") : bad("BLOCK")),
    chat: (jid = "") => {
      if (jid.endsWith("@g.us")) return chalk.magentaBright("GROUP")
      if (jid.endsWith("@s.whatsapp.net")) return chalk.blueBright("PRIVATE")
      if (jid.endsWith("@lid")) return chalk.blueBright("PRIVATE")
      return chalk.gray("CHAT")
    }
  }

  const lineKV = (key, val) => {
    return "  " + k(key.padEnd(14)) + dim("• ") + v(val)
  }

  return {
    OUT,
    centerAnsi,
    hr,
    tag,
    badge,
    lineKV,
    dim,
    ok,
    warn,
    bad
  }
})()

function shortText(s = "", max = 80) {
  s = String(s || "")
  if (s.length <= max) return s
  return s.slice(0, max - 1) + "…"
}

export async function routeMessage(sock, msg) {
  const t0 = Date.now()

  try {
    if (!msg?.message) return
    if (msg.key?.fromMe) return

    const chatId = msg?.key?.remoteJid || "unknown"

    const rawSenderJid = getSenderJid(msg)
    const senderNum = jidToNumber(rawSenderJid)

    let decodedJid = rawSenderJid
    try {
      if (sock?.decodeJid) decodedJid = sock.decodeJid(rawSenderJid)
    } catch {}
    const senderNumDecoded = jidToNumber(decodedJid)

    const isOwner = isOwnerByNumbers({ senderNum, senderNumDecoded })
    const allowed = isAllowedPrivate(msg)

    const prefix = config.prefix || "."
    const text = getText(msg)

    // ── HEADER
    console.log(LOG.hr())
    console.log(
      LOG.centerAnsi(
        LOG.tag("ROUTER") +
          "  " +
          LOG.badge.chat(chatId) +
          "  " +
          LOG.badge.owner(isOwner) +
          "  " +
          (chatId.endsWith("@g.us") ? LOG.dim("") : LOG.badge.allow(isOwner ? true : allowed))
      )
    )
    console.log(LOG.hr())

    console.log(LOG.lineKV("chatId", chatId))
    console.log(LOG.lineKV("rawJid", rawSenderJid))
    console.log(LOG.lineKV("decodedJid", decodedJid))
    console.log(LOG.lineKV("num(raw)", String(senderNum)))
    console.log(LOG.lineKV("num(dec)", String(senderNumDecoded)))
    console.log(LOG.lineKV("prefix", JSON.stringify(prefix)))
    console.log(LOG.lineKV("text", JSON.stringify(shortText(text, 110))))

    // ✅ privado: allowlist SOLO para no-owners
    if (!isOwner && !allowed && !chatId.endsWith("@g.us")) {
      console.log(LOG.hr())
      console.log(LOG.tag("ROUTER") + " " + LOG.bad("BLOCKED") + " " + LOG.dim("reason=allowlist(private)"))
      console.log(LOG.lineKV("senderNum", String(senderNum)))
      console.log(LOG.lineKV("senderNumDec", String(senderNumDecoded)))
      console.log(LOG.hr())
      return
    }

    if (!text) {
      console.log(LOG.hr())
      console.log(LOG.tag("ROUTER") + " " + LOG.warn("SKIP") + " " + LOG.dim("reason=no text/caption"))
      console.log(LOG.hr())
      return
    }

    if (!text.startsWith(prefix)) {
      console.log(LOG.hr())
      console.log(LOG.tag("ROUTER") + " " + LOG.warn("SKIP") + " " + LOG.dim("reason=no prefix match"))
      console.log(LOG.lineKV("expect", JSON.stringify(prefix)))
      console.log(LOG.lineKV("got", JSON.stringify(shortText(text, 40))))
      console.log(LOG.hr())
      return
    }

    // ⚠️ Estricto: NO permitimos ". comando" (solo ".comando")
    const parts = text.slice(prefix.length).trim().split(/\s+/)
    const command = (parts.shift() || "").toLowerCase()
    const args = parts

    console.log(LOG.hr())
    console.log(LOG.tag("ROUTER") + " " + LOG.ok("PARSED"))
    console.log(LOG.lineKV("command", command))
    console.log(LOG.lineKV("args", args.length ? JSON.stringify(args) : LOG.dim("(none)")))
    console.log(LOG.hr())

    const handler = COMMANDS[command]
    if (!handler) {
      console.log(LOG.tag("ROUTER") + " " + LOG.warn("NOT FOUND") + " " + LOG.dim(`cmd=${command}`))
      console.log(LOG.hr())
      return
    }

    console.log(LOG.tag("ROUTER") + " " + LOG.ok("RUN") + " " + LOG.dim(`cmd=${command}`))

    await handler(sock, msg, { args, command, isOwner, usedPrefix: prefix })

    const ms = Date.now() - t0
    console.log(LOG.tag("ROUTER") + " " + LOG.ok("DONE") + " " + LOG.dim(`cmd=${command} • ${ms}ms`))
    console.log(LOG.hr())
  } catch (e) {
    console.log(LOG.hr())
    console.error(LOG.tag("ROUTER") + " " + LOG.bad("ERROR"), e)
    console.log(LOG.hr())
  }
}