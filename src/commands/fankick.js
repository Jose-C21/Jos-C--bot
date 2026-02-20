// src/commands/fankick.js
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const CACHE_TTL_MS = 10 * 60 * 1000 // debe coincidir con fantasma.js

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

const digits = (x) => String(x || "").replace(/\D/g, "")

function cacheGet(chatId) {
  global.fantasmaPages = global.fantasmaPages || {}
  const c = global.fantasmaPages[chatId]
  if (!c) return null
  if (Date.now() - c.t > CACHE_TTL_MS) {
    delete global.fantasmaPages[chatId]
    return null
  }
  return c
}

async function checkPerms(sock, msg, chatId) {
  const senderJid = getSenderJid(msg)
  const senderNum = jidToNumber(senderJid)

  let decoded = senderJid
  try { if (sock?.decodeJid) decoded = sock.decodeJid(senderJid) } catch {}
  const senderNumDecoded = jidToNumber(decoded)

  const fromMe = !!msg.key?.fromMe
  const isOwner = isOwnerByNumbers({ senderNum, senderNumDecoded })

  let isAdmin = false
  let md = null
  try {
    md = await sock.groupMetadata(chatId)
    const p = md.participants?.find(x => x.id === senderJid || x.id === decoded)
    isAdmin = p?.admin === "admin" || p?.admin === "superadmin"
  } catch {}

  return { ok: (isAdmin || isOwner || fromMe), md }
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms))

export default async function fankick(sock, msg) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  if (!String(chatId).endsWith("@g.us")) {
    await sock.sendMessage(chatId, { text: "❌ Este comando solo puede usarse en grupos." }, { quoted: msg })
    return
  }

  const { ok, md } = await checkPerms(sock, msg, chatId)
  if (!ok) {
    await sock.sendMessage(chatId, { text: "🚫 Solo administradores, owner o el bot pueden usar este comando." }, { quoted: msg })
    return
  }

  const cache = cacheGet(chatId)
  if (!cache?.allMentions?.length) {
    await sock.sendMessage(chatId, {
      text:
        "⚠️ No hay lista guardada.\n" +
        "Primero usa: *.fantasma*"
    }, { quoted: msg })
    return
  }

  // refrescar metadata para admins actuales
  let metadata = md
  try { metadata = await sock.groupMetadata(chatId) } catch {}

  const admins = new Set(
    (metadata?.participants || [])
      .filter(p => p.admin === "admin" || p.admin === "superadmin")
      .map(p => digits(p.id))
  )

  const botDigits = digits(sock?.user?.id)

  const targets = cache.allMentions.filter(jid => {
    const d = digits(jid)
    if (!d) return false
    if (admins.has(d)) return false
    if (botDigits && d === botDigits) return false
    return true
  })

  if (!targets.length) {
    await sock.sendMessage(chatId, {
      text: "✅ No hay fantasmas eliminables (los detectados eran admins o no se puede expulsar)."
    }, { quoted: msg })
    return
  }

  await sock.sendMessage(chatId, {
    text:
      "╭─ 𝗙𝗔𝗡𝗞𝗜𝗖𝗞 ⚠️\n" +
      `│ Voy a eliminar: *${targets.length}* fantasmas\n` +
      "│ (solo NO-admins)\n" +
      "╰────────────"
  }, { quoted: msg })

  let removed = 0
  let failed = 0

  for (const jid of targets) {
    try {
      await sock.groupParticipantsUpdate(chatId, [jid], "remove")
      removed++
      await sleep(1200)
    } catch {
      failed++
      await sleep(800)
    }
  }

  await sock.sendMessage(chatId, {
    text:
      "╭─ 𝗥𝗘𝗦𝗨𝗟𝗧𝗔𝗗𝗢 ✅\n" +
      `│ Eliminados: *${removed}*\n` +
      `│ Fallaron: *${failed}*\n` +
      "╰────────────"
  }, { quoted: msg })

  // limpiar cache del grupo
  if (global.fantasmaPages?.[chatId]) delete global.fantasmaPages[chatId]
}