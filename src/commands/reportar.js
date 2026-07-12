// src/commands/reportar.js
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const SIGNATURE =
  "\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦"

const COOLDOWN_MS = 5 * 60 * 1000 // 5 minutos

global.reportesCooldown = global.reportesCooldown || new Map()

function formatRestante(ms) {
  const totalSeg = Math.ceil(ms / 1000)
  const min = Math.floor(totalSeg / 60)
  const seg = totalSeg % 60

  if (min <= 0) return `${seg}s`
  if (seg === 0) return `${min}m`
  return `${min}m ${seg}s`
}

export default async function reportar(sock, msg, { args = [] } = {}) {
  try {
    const chatId = msg?.key?.remoteJid
    if (!chatId) return

    const isGroup = String(chatId).endsWith("@g.us")
    if (!isGroup) {
      return await sock.sendMessage(
        chatId,
        { text: "🚫 *Este comando solo funciona en grupos.*" + SIGNATURE },
        { quoted: msg }
      )
    }

    const senderJid = getSenderJid(msg)
    const motivo = args.join(" ").trim()

    const ctxInfo = msg.message?.extendedTextMessage?.contextInfo || {}
    const reportedJid = ctxInfo.participant || null

    if (!reportedJid) {
      return await sock.sendMessage(
        chatId,
        { text: "📝 *Debes responder al mensaje de la persona que quieres reportar.*" + SIGNATURE },
        { quoted: msg }
      )
    }

    if (!motivo) {
      return await sock.sendMessage(
        chatId,
        { text: "📝 *Escribe el motivo. Ej: .reportar spam*" + SIGNATURE },
        { quoted: msg }
      )
    }

    const cooldownKey = `${chatId}:${jidToNumber(senderJid)}:${jidToNumber(reportedJid)}`
    const expiresAt = global.reportesCooldown.get(cooldownKey)

    if (expiresAt && Date.now() < expiresAt) {
      const restante = formatRestante(expiresAt - Date.now())

      return await sock.sendMessage(
        chatId,
        {
          text: `⏳ *Ya reportaste a @${jidToNumber(reportedJid)}. Espera ${restante} antes de volver a reportarlo.*` + SIGNATURE,
          mentions: [reportedJid]
        },
        { quoted: msg }
      )
    }

    const metadata = await sock.groupMetadata(chatId)
    const groupName = (metadata?.subject || "este grupo").trim()
    const admins = (metadata.participants || []).filter(p => p.admin)

    if (!admins.length) {
      return await sock.sendMessage(
        chatId,
        { text: "⚠️ *No encontré administradores en este grupo.*" + SIGNATURE },
        { quoted: msg }
      )
    }

    global.reportesCooldown.set(cooldownKey, Date.now() + COOLDOWN_MS)

    const adminTags = admins.map(p => `@${jidToNumber(p.id)}`).join(" ")
    const reporterTag = `@${jidToNumber(senderJid)}`
    const reportedTag = `@${jidToNumber(reportedJid)}`
    const mentionsGroup = Array.from(new Set([senderJid, reportedJid, ...admins.map(p => p.id)]))

    await sock.sendMessage(
      chatId,
      {
        text:
`> 🚨 𝗥𝗘𝗣𝗢𝗥𝗧𝗘 𝗥𝗘𝗖𝗜𝗕𝗜𝗗𝗢 🚨
━━━━━━━━━━━━━━━━
👤 𝗥𝗲𝗽𝗼𝗿𝘁𝗮𝗱𝗼 𝗽𝗼𝗿 ⇾ ${reporterTag}
🎯 𝗨𝘀𝘂𝗮𝗿𝗶𝗼 𝗿𝗲𝗽𝗼𝗿𝘁𝗮𝗱𝗼 ⇾ ${reportedTag}
📄 𝗠𝗼𝘁𝗶𝘃𝗼 ⇾ ${motivo}
━━━━━━━━━━━━━━━━
📨 𝗔𝗱𝗺𝗶𝗻𝘀 𝗻𝗼𝘁𝗶𝗳𝗶𝗰𝗮𝗱𝗼𝘀 𝗲𝗻 𝗽𝗿𝗶𝘃𝗮𝗱𝗼 ⇾ ${adminTags}` + SIGNATURE,
        mentions: mentionsGroup
      },
      { quoted: msg }
    )

    for (const admin of admins) {
      try {
        await sock.sendMessage(admin.id, {
          text:
`> 🚨 𝗡𝗨𝗘𝗩𝗢 𝗥𝗘𝗣𝗢𝗥𝗧𝗘 🚨
━━━━━━━━━━━━━━━━
🏠 𝗚𝗿𝘂𝗽𝗼 ⇾ ${groupName}
👤 𝗥𝗲𝗽𝗼𝗿𝘁𝗮𝗱𝗼 𝗽𝗼𝗿 ⇾ ${reporterTag}
🎯 𝗨𝘀𝘂𝗮𝗿𝗶𝗼 𝗿𝗲𝗽𝗼𝗿𝘁𝗮𝗱𝗼 ⇾ ${reportedTag}
📄 𝗠𝗼𝘁𝗶𝘃𝗼 ⇾ ${motivo}
━━━━━━━━━━━━━━━━
🔎 𝗥𝗲𝘃𝗶𝘀𝗮𝗹𝗼 𝗰𝘂𝗮𝗻𝗱𝗼 𝗽𝘂𝗲𝗱𝗮𝘀` + SIGNATURE,
          mentions: [senderJid, reportedJid]
        })
      } catch (e) {
        console.log("[reportar] Error privado a admin:", admin.id, e?.message)
      }
    }

    await sock.sendMessage(chatId, { react: { text: "🚨", key: msg.key } }).catch(() => {})
  } catch (e) {
    console.error("[reportar] error:", e)
    const chatId = msg?.key?.remoteJid
    if (chatId) {
      await sock.sendMessage(
        chatId,
        { text: "❌ *Ocurrió un error al enviar el reporte.*" + SIGNATURE },
        { quoted: msg }
      ).catch(() => {})
    }
  }
}
