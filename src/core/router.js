import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"
import { isAllowedPrivate } from "./middleware/allowlist.js"

import resetsession from "../commands/resetsession.js"

const COMMANDS = {
  resetsession
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

export async function routeMessage(sock, msg) {
  if (!msg?.message) return
  if (msg.key?.fromMe) return

  // ✅ Primero detectamos sender/owner
  const senderNum = jidToNumber(getSenderJid(msg))
  const isOwner = (config.owners || []).includes(senderNum)

  // ✅ filtro allowlist en privado (pero owner SIEMPRE pasa)
  if (!isOwner && !isAllowedPrivate(msg)) return

  const text = getText(msg)
  if (!text) return

  const prefix = config.prefix || "."
  if (!text.startsWith(prefix)) return

  const parts = text.slice(prefix.length).trim().split(/\s+/)
  const command = (parts.shift() || "").toLowerCase()
  const args = parts

  const handler = COMMANDS[command]
  if (!handler) return

  await handler(sock, msg, { args, command, isOwner, usedPrefix: prefix })
}