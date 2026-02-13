// src/commands/close.js
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

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

export default async function close(sock, msg) {
  try {
    const chatId = msg?.key?.remoteJid
    if (!chatId) return

    const isGroup = String(chatId).endsWith("@g.us")
    if (!isGroup) {
      return sock.sendMessage(chatId, { text: "❌ *Este comando solo funciona en grupos.*" }, { quoted: msg })
    }

    const senderJid = getSenderJid(msg)
    const senderNum = jidToNumber(senderJid)

    let decoded = senderJid
    try { if (sock?.decodeJid) decoded = sock.decodeJid(senderJid) } catch {}
    const senderNumDecoded = jidToNumber(decoded)

    const isOwner = isOwnerByNumbers({ senderNum, senderNumDecoded })
    const fromMe = !!msg.key?.fromMe

    // admin?
    let isAdmin = false
    try {
      const md = await sock.groupMetadata(chatId)
      const p = md.participants?.find(x => x.id === senderJid || x.id === decoded)
      isAdmin = p?.admin === "admin" || p?.admin === "superadmin"
    } catch {}

    if (!isAdmin && !isOwner && !fromMe) {
      return sock.sendMessage(
        chatId,
        { text: "*No tienes permisos para cerrar el grupo.*\n⚠️ *Solo administradores o el dueño del bot pueden usar este comando.*" },
        { quoted: msg }
      )
    }

    await sock.groupSettingUpdate(chatId, "announcement")

    return sock.sendMessage(
  chatId,
  {
    text:
      `> •	╭────────╮
> ➵ 🔒 𝙶𝚛𝚞𝚙𝚘 𝙲𝚎𝚛𝚛𝚊𝚍𝚘
> •	╰────────╯\n` +
      `❑ ꜱᴏʟᴏ ᴀᴅᴍɪɴɪꜱᴛʀᴀᴅᴏʀᴇꜱ ᴘᴜᴇᴅᴇɴ ᴇɴᴠɪᴀʀ ᴍᴇɴꜱᴀᴊᴇꜱ.`
  },
  { quoted: msg }
)
  } catch (error) {
    console.error("❌ Error en el comando close:", error)
    return sock.sendMessage(
      msg.key.remoteJid,
      { text: "❌ *Ocurrió un error al intentar cerrar el grupo.*" },
      { quoted: msg }
    )
  }
}