// src/commands/mute.js
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

export default async function mute(sock, msg, { isOwner }) {
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

  // target
  const targetJid = getTargetFromMessage(msg)
  if (!targetJid) {
    await sock.sendMessage(chatId, { text: "⚠️ Responde al mensaje o menciona al usuario que quieres mutear." }, { quoted: msg })
    return
  }

  // normalizamos target -> número limpio (sirve lid y normal)
  let decodedTarget = targetJid
  try { if (sock?.decodeJid) decodedTarget = sock.decodeJid(targetJid) } catch {}
  const targetNum = jidToNumber(decodedTarget) || jidToNumber(targetJid)

  // ✅ PROTECCIÓN: no mutear owners (nadie)
  if (isOwnerNumber(targetNum)) {
    await sock.sendMessage(chatId, { text: "⛔ No puedes mutear a un *owner*." }, { quoted: msg })
    return
  }

  // metadata para admin checks
  const md = await sock.groupMetadata(chatId)
  const parts = md?.participants || []

  // ✅ sender admin check robusto (por número)
  const senderP = parts.find(p => {
    const n = jidToNumber(p.id)
    return n && n === String(senderNum)
  })
  const senderIsAdmin = senderP?.admin === "admin" || senderP?.admin === "superadmin"

  // Si no es owner, debe ser admin para usar mute
  if (!isOwner && !senderIsAdmin) {
    await sock.sendMessage(chatId, { text: "❌ Solo *admins* o *owner* pueden usar este comando." }, { quoted: msg })
    return
  }

  // ✅ target admin check robusto (por número)
  const targetP = parts.find(p => {
    const n = jidToNumber(p.id)
    return n && n === String(targetNum)
  })
  const targetIsAdmin = targetP?.admin === "admin" || targetP?.admin === "superadmin"

  // ✅ Admin NO puede mutear admins
  if (targetIsAdmin && !isOwner) {
    await sock.sendMessage(chatId, { text: "⛔ No puedes mutear a otro *admin*." }, { quoted: msg })
    return
  }

  // ✅ Owner SI puede mutear admins y usuarios normales

  const db = readDB()
  if (!db[chatId]) db[chatId] = []

  const keyNum = String(targetNum)

  if (!db[chatId].includes(keyNum)) {
    db[chatId].push(keyNum)
    writeDB(db)

    // mentions: preferimos el jid decodificado si existe
    const mentionJid = decodedTarget || targetJid

    await sock.sendMessage(chatId, {
      text: `> 🔇 Usuario @${keyNum} ha sido *muteado*.`,
      mentions: [mentionJid]
    }, { quoted: msg })
  } else {
    await sock.sendMessage(chatId, { text: "⚠️ Este usuario ya está muteado." }, { quoted: msg })
  }
}