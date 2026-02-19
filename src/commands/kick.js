// src/commands/kick.js
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const SIGNATURE =
  "\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦"

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

export default async function kick(sock, msg, { args = [] } = {}) {
  try {
    const chatId = msg?.key?.remoteJid
    if (!chatId) return

    const isGroup = String(chatId).endsWith("@g.us")
    await sock.sendMessage(chatId, { react: { text: "🔴", key: msg.key } }).catch(() => {})

    if (!isGroup) {
      return await sock.sendMessage(
        chatId,
        { text: "🚫 *Este comando solo funciona en grupos.*" + SIGNATURE },
        { quoted: msg }
      )
    }

    const senderJid = getSenderJid(msg)
    const senderNum = jidToNumber(senderJid)

    let decodedJid = senderJid
    try { if (sock?.decodeJid) decodedJid = sock.decodeJid(senderJid) } catch {}
    const senderNumDecoded = jidToNumber(decodedJid)

    const isOwner = isOwnerByNumbers({ senderNum, senderNumDecoded })
    const fromMe = !!msg.key?.fromMe

    // admin?
    let metadata = await sock.groupMetadata(chatId)
    let groupAdmins = (metadata.participants || []).filter(p => p.admin)
    const isSenderAdmin = groupAdmins.some(p => p.id === senderJid || p.id === decodedJid)

    if (!isSenderAdmin && !isOwner && !fromMe) {
      return await sock.sendMessage(
        chatId,
        { text: "❌ *Solo los administradores o el owner pueden expulsar miembros del grupo.*" + SIGNATURE },
        { quoted: msg }
      )
    }

    // Obtener usuario a expulsar (mención o reply)
    const ctxInfo = msg.message?.extendedTextMessage?.contextInfo || {}
    let userToKick = null

    if (ctxInfo.mentionedJid?.length) userToKick = ctxInfo.mentionedJid[0]
    else if (ctxInfo.participant) userToKick = ctxInfo.participant

    if (!userToKick) {
      return await sock.sendMessage(
        chatId,
        { text: "📝 *Debes mencionar o responder al usuario que deseas expulsar.*" + SIGNATURE },
        { quoted: msg }
      )
    }

    // refrescar metadata justo antes de expulsar
    metadata = await sock.groupMetadata(chatId)
    groupAdmins = (metadata.participants || []).filter(p => p.admin)

    const isUserStillInGroup = (metadata.participants || []).some(p => p.id === userToKick)
    if (!isUserStillInGroup) {
      return await sock.sendMessage(
        chatId,
        {
          text: `⚠️ *El usuario @${jidToNumber(userToKick)} ya no está en el grupo.*` + SIGNATURE,
          mentions: [userToKick]
        },
        { quoted: msg }
      )
    }

    const isTargetAdmin = groupAdmins.some(p => p.id === userToKick)
    if (isTargetAdmin) {
      return await sock.sendMessage(
        chatId,
        { text: "⚠️ *No se puede expulsar a otro administrador.*" + SIGNATURE },
        { quoted: msg }
      )
    }

    const botId = sock?.user?.id
    if (botId && (userToKick === botId || userToKick === sock.decodeJid?.(botId))) {
      return await sock.sendMessage(
        chatId,
        { text: "⚠️ *No puedo expulsarme a mí mismo.*" + SIGNATURE },
        { quoted: msg }
      )
    }

    await sock.groupParticipantsUpdate(chatId, [userToKick], "remove").catch(() => {})

    await sock.sendMessage(
      chatId,
      {
        text: `🚫 *El usuario @${jidToNumber(userToKick)} ha sido expulsado del grupo.*` + SIGNATURE,
        mentions: [userToKick]
      },
      { quoted: msg }
    )

    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
  } catch (error) {
    console.error("❌ Error en comando kick:", error)
    const chatId = msg?.key?.remoteJid
    if (chatId) {
      await sock.sendMessage(
        chatId,
        { text: "❌ *Ocurrió un error al intentar expulsar al usuario.*" + SIGNATURE },
        { quoted: msg }
      ).catch(() => {})
    }
  }
}