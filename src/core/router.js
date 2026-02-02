import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"
import { isAllowedPrivate } from "./middleware/allowlist.js"
import sticker from "../commands/sticker.js"
import play from "../commands/play.js"

import resetsession from "../commands/resetsession.js"

const COMMANDS = {
  resetsession,
  s: sticker,        // si ya lo tienes
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

  // acepta si coincide en cualquiera
  return (
    owners.includes(String(senderNum)) ||
    owners.includes(String(senderNumDecoded)) ||
    ownersLid.includes(String(senderNum)) ||
    ownersLid.includes(String(senderNumDecoded))
  )
}

export async function routeMessage(sock, msg) {
  try {
    if (!msg?.message) return
    if (msg.key?.fromMe) return

    const chatId = msg?.key?.remoteJid || "unknown"

    const rawSenderJid = getSenderJid(msg)
    const senderNum = jidToNumber(rawSenderJid)

    // intentamos decodificar (si sirve)
    let decodedJid = rawSenderJid
    try {
      if (sock?.decodeJid) decodedJid = sock.decodeJid(rawSenderJid)
    } catch {}
    const senderNumDecoded = jidToNumber(decodedJid)

    const isOwner = isOwnerByNumbers({ senderNum, senderNumDecoded })

    const text = getText(msg)

    console.log("[ROUTER] msg:", {
      chatId,
      rawSenderJid,
      decodedJid,
      senderNum,
      senderNumDecoded,
      isOwner,
      prefix: config.prefix,
      text: text?.slice(0, 80)
    })

    // ✅ privado: allowlist SOLO para no-owners
    const allowed = isAllowedPrivate(msg)
    if (!isOwner && !allowed) {
      console.log("[ROUTER] blocked by allowlist (private).", { senderNum, senderNumDecoded })
      return
    }

    if (!text) {
      console.log("[ROUTER] no text/caption")
      return
    }

    const prefix = config.prefix || "."
    if (!text.startsWith(prefix)) {
      console.log("[ROUTER] no prefix match", { prefix, text: text.slice(0, 30) })
      return
    }

    // ⚠️ Estricto: NO permitimos ". comando" (solo ".comando")
    const parts = text.slice(prefix.length).trim().split(/\s+/)
    const command = (parts.shift() || "").toLowerCase()
    const args = parts

    console.log("[ROUTER] parsed:", { command, args })

    const handler = COMMANDS[command]
    if (!handler) {
      console.log("[ROUTER] command not found:", command)
      return
    }

    console.log("[ROUTER] running handler:", command)
    await handler(sock, msg, { args, command, isOwner, usedPrefix: prefix })
    console.log("[ROUTER] handler done:", command)
  } catch (e) {
    console.error("[ROUTER] error:", e)
  }
}