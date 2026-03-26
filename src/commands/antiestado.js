// src/commands/antiestado.js

let enabled = false

export default async function antiestado(sock, msg, { args = [] }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const body =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    ""

  // 🔘 COMANDO ON/OFF
  if (body.startsWith(".antiestado")) {
    const option = args?.[0]

    if (option === "on") {
      enabled = true
      return sock.sendMessage(chatId, {
        text: "✅ Anti-estado activado."
      }, { quoted: msg })
    }

    if (option === "off") {
      enabled = false
      return sock.sendMessage(chatId, {
        text: "❌ Anti-estado desactivado."
      }, { quoted: msg })
    }

    return sock.sendMessage(chatId, {
      text: "Usa:\n.antiestado on\n.antiestado off"
    }, { quoted: msg })
  }

  if (!enabled) return

  const m = msg.message || {}

  const isStatus =
    m?.extendedTextMessage?.contextInfo?.quotedMessage?.groupStatusMentionMessage ||
    m?.groupStatusMentionMessage

  if (!isStatus) return

  const sender =
    msg.key.participant ||
    m?.extendedTextMessage?.contextInfo?.participant ||
    msg.key.remoteJid

  const tag = `@${sender.split("@")[0]}`

  // 🗑️ BORRAR MENSAJE
  try {
    await sock.sendMessage(chatId, {
      delete: {
        remoteJid: chatId,
        fromMe: false,
        id: msg.key.id,
        participant: msg.key.participant || sender
      }
    })
  } catch (e) {
    console.log("❌ Error borrando estado:", e)
  }

  // ⚠️ AVISO
  await sock.sendMessage(chatId, {
    text: `> ╰❒ ${tag}, ɴᴏ ꜱᴇ ᴘᴇʀᴍɪᴛᴇɴ ᴍᴇɴᴄɪᴏɴᴇꜱ ᴅᴇ ᴇꜱᴛᴀᴅᴏꜱ ᴇɴ ᴇꜱᴛᴇ ɢʀᴜᴘᴏ.`,
    mentions: [sender]
  })
}