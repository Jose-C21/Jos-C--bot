// src/commands/unmute.js
import fs from "fs"
import path from "path"
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const MUTE_PATH = path.join(process.cwd(), "data", "mute.json")

function ensureDB() {
  const dir = path.dirname(MUTE_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(MUTE_PATH)) fs.writeFileSync(MUTE_PATH, "{}")
}

function readDB() {
  try {
    ensureDB()
    return JSON.parse(fs.readFileSync(MUTE_PATH, "utf8") || "{}")
  } catch {
    return {}
  }
}

function writeDB(db) {
  ensureDB()
  fs.writeFileSync(MUTE_PATH, JSON.stringify(db, null, 2))
}

function isOwnerNumber(num) {
  const owners = (config.owners || []).map(String)
  const ownersLid = (config.ownersLid || []).map(String)
  const s = String(num)
  return owners.includes(s) || ownersLid.includes(s)
}

function getTargetFromMessage(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo
  let targetJid = ctx?.participant
  if (!targetJid && ctx?.mentionedJid?.length) targetJid = ctx.mentionedJid[0]
  return targetJid || null
}

export default async function unmute(sock, msg, { isOwner }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const isGroup = String(chatId).endsWith("@g.us")
  if (!isGroup) {
    await sock.sendMessage(chatId, { text: "❌ Este comando solo puede usarse en grupos." }, { quoted: msg })
    return
  }

  // sender
  const senderJidRaw = getSenderJid(msg)
  let senderJid = senderJidRaw
  try { if (sock?.decodeJid) senderJid = sock.decodeJid(senderJidRaw) } catch {}
  const senderNum = jidToNumber(senderJid) || jidToNumber(senderJidRaw)

  const targetJid = getTargetFromMessage(msg)
  if (!targetJid) {
    await sock.sendMessage(chatId, { text: "⚠️ Responde al mensaje o menciona al usuario que quieres desmutear." }, { quoted: msg })
    return
  }

  // target
  let decodedTarget = targetJid
  try { if (sock?.decodeJid) decodedTarget = sock.decodeJid(targetJid) } catch {}
  const targetNum = jidToNumber(decodedTarget) || jidToNumber(targetJid)
  const keyNum = String(targetNum)

  // metadata para admin checks
  const md = await sock.groupMetadata(chatId)
  const parts = md?.participants || []

  // ✅ sender admin check robusto (por número)
  const senderP = parts.find(p => String(jidToNumber(p.id)) === String(senderNum))
  const senderIsAdmin = senderP?.admin === "admin" || senderP?.admin === "superadmin"

  // Si no es owner, debe ser admin
  if (!isOwner && !senderIsAdmin) {
    await sock.sendMessage(chatId, { text: "❌ Solo *admins* o *owner* pueden usar este comando." }, { quoted: msg })
    return
  }

  // ✅ target admin check robusto (por número)
  const targetP = parts.find(p => String(jidToNumber(p.id)) === String(targetNum))
  const targetIsAdmin = targetP?.admin === "admin" || targetP?.admin === "superadmin"

  // ✅ Admin NO puede desmutear admins
  if (targetIsAdmin && !isOwner) {
    await sock.sendMessage(chatId, { text: "⛔ No puedes desmutear a otro *admin*." }, { quoted: msg })
    return
  }

  // ✅ owners: nadie debería mutearlos, pero si por error quedaron en JSON:
  // solo owner puede limpiar
  if (isOwnerNumber(targetNum) && !isOwner) {
    await sock.sendMessage(chatId, { text: "⛔ No puedes desmutear a un *owner*." }, { quoted: msg })
    return
  }

  const db = readDB()
  const list = db[chatId] || []

  const idx = list.indexOf(keyNum)
  if (idx === -1) {
    await sock.sendMessage(chatId, { text: "⚠️ Este usuario no está muteado." }, { quoted: msg })
    return
  }

  list.splice(idx, 1)

  if (list.length === 0) delete db[chatId]
  else db[chatId] = list

  writeDB(db)

  const mentionJid = decodedTarget || targetJid

  await sock.sendMessage(chatId, {
    text: `> 🔊 Usuario @${keyNum} ha sido *desmuteado*.`,
    mentions: [mentionJid]
  }, { quoted: msg })
}
