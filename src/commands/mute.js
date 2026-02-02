import fs from "fs"
import path from "path"
import config from "../config.js"
import { jidToNumber } from "../utils/jid.js"

const MUTE_PATH = path.join(process.cwd(), "data", "mute.json")

function readMuteDB() {
  try {
    if (!fs.existsSync(MUTE_PATH)) return {}
    return JSON.parse(fs.readFileSync(MUTE_PATH, "utf8") || "{}")
  } catch {
    return {}
  }
}

function writeMuteDB(db) {
  fs.mkdirSync(path.dirname(MUTE_PATH), { recursive: true })
  fs.writeFileSync(MUTE_PATH, JSON.stringify(db, null, 2))
}

function getTargetJid(msg) {
  const ctx = msg?.message?.extendedTextMessage?.contextInfo
  let target = ctx?.participant

  if (!target && Array.isArray(ctx?.mentionedJid) && ctx.mentionedJid.length) {
    target = ctx.mentionedJid[0]
  }
  return target || null
}

function isOwnerNumber(numStr = "") {
  const owners = (config.owners || []).map(String)
  const ownersLid = (config.ownersLid || []).map(String)
  return owners.includes(String(numStr)) || ownersLid.includes(String(numStr))
}

export default async function mute(sock, msg, { isOwner }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const isGroup = String(chatId).endsWith("@g.us")
  if (!isGroup) {
    await sock.sendMessage(chatId, { text: "❌ Este comando solo puede usarse en grupos." }, { quoted: msg })
    return
  }

  const senderJid = msg.key.participant || msg.key.remoteJid
  const senderNum = jidToNumber(senderJid)

  // admins del grupo
  const metadata = await sock.groupMetadata(chatId)
  const p = metadata.participants?.find(x => (x.id === senderJid))
  const isAdmin = p?.admin === "admin" || p?.admin === "superadmin"

  // “bots permitidos” (opcional)
  const botNum = jidToNumber(sock.user?.id || "")
  const allowedBots = (config.allowedBots || []).map(String)
  const isBotAllowed = allowedBots.includes(String(senderNum)) || allowedBots.includes(String(botNum))

  if (!isOwner && !isAdmin && !isBotAllowed) {
    await sock.sendMessage(chatId, { text: "❌ Solo *admins* o *owners* pueden usar este comando." }, { quoted: msg })
    return
  }

  const targetJid = getTargetJid(msg)
  if (!targetJid) {
    await sock.sendMessage(chatId, { text: "⚠️ Responde a un mensaje o menciona al usuario que quieres mutear." }, { quoted: msg })
    return
  }

  const targetNum = jidToNumber(targetJid)
  const targetIsOwner = isOwnerNumber(targetNum)

  if (targetIsOwner) {
    await sock.sendMessage(chatId, { text: "❌ No puedes mutear al *dueño del bot*." }, { quoted: msg })
    return
  }

  const tp = metadata.participants?.find(x => x.id === targetJid)
  const targetIsAdmin = tp?.admin === "admin" || tp?.admin === "superadmin"

  if (targetIsAdmin && !isOwner && !isBotAllowed) {
    await sock.sendMessage(chatId, { text: "❌ No puedes mutear a otro *admin*." }, { quoted: msg })
    return
  }

  const db = readMuteDB()
  if (!db[chatId]) db[chatId] = []

  // guardamos por NÚMERO (más estable: real/lid da igual)
  if (!db[chatId].includes(String(targetNum))) {
    db[chatId].push(String(targetNum))
    writeMuteDB(db)

    await sock.sendMessage(chatId, {
      text: `> 🔇 Usuario @${String(targetNum)} ha sido *muteado*.`,
      mentions: [targetJid]
    }, { quoted: msg })
  } else {
    await sock.sendMessage(chatId, {
      text: "⚠️ Este usuario ya está muteado.",
      mentions: [targetJid]
    }, { quoted: msg })
  }
}