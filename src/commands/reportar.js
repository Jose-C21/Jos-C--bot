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
        {
          text:
`📝 𝗗𝗲𝗯𝗲𝘀 𝗿𝗲𝘀𝗽𝗼𝗻𝗱𝗲𝗿 𝗮𝗹 𝗺𝗲𝗻𝘀𝗮𝗷𝗲 𝗱𝗲 𝗹𝗮 𝗽𝗲𝗿𝘀𝗼𝗻𝗮 𝗾𝘂𝗲 𝗾𝘂𝗶𝗲𝗿𝗲𝘀 𝗿𝗲𝗽𝗼𝗿𝘁𝗮𝗿.

ℹ️ ¿𝗣𝗮𝗿𝗮 𝗾𝘂𝗲́ 𝘀𝗶𝗿𝘃𝗲?
𝗘𝘀𝘁𝗲 𝗰𝗼𝗺𝗮𝗻𝗱𝗼 𝘁𝗲 𝗽𝗲𝗿𝗺𝗶𝘁𝗲 𝗮𝘃𝗶𝘀𝗮𝗿𝗹𝗲 𝗮 𝗹𝗼𝘀 𝗮𝗱𝗺𝗶𝗻𝗶𝘀𝘁𝗿𝗮𝗱𝗼𝗿𝗲𝘀 𝗱𝗲𝗹 𝗴𝗿𝘂𝗽𝗼 𝘀𝗼𝗯𝗿𝗲 𝘂𝗻 𝗰𝗼𝗺𝗽𝗼𝗿𝘁𝗮𝗺𝗶𝗲𝗻𝘁𝗼 𝗶𝗻𝗱𝗲𝗯𝗶𝗱𝗼 (𝘀𝗽𝗮𝗺, 𝗮𝗰𝗼𝘀𝗼, 𝗳𝗮𝗹𝘁𝗮𝘀 𝗱𝗲 𝗿𝗲𝘀𝗽𝗲𝘁𝗼, 𝗲𝘁𝗰). 𝗘𝗹 𝗮𝘃𝗶𝘀𝗼 𝗹𝗹𝗲𝗴𝗮 𝗮𝗹 𝗴𝗿𝘂𝗽𝗼 𝘆 𝗱𝗶𝗿𝗲𝗰𝘁𝗼 𝗮𝗹 𝗽𝗿𝗶𝘃𝗮𝗱𝗼 𝗱𝗲 𝗰𝗮𝗱𝗮 𝗮𝗱𝗺𝗶𝗻.

📌 𝗖𝗼́𝗺𝗼 𝘂𝘀𝗮𝗿𝗹𝗼:
𝗥𝗲𝘀𝗽𝗼𝗻𝗱𝗲 𝗮𝗹 𝗺𝗲𝗻𝘀𝗮𝗷𝗲 𝗱𝗲 𝗲𝘀𝗮 𝗽𝗲𝗿𝘀𝗼𝗻𝗮 𝗰𝗼𝗻:
.𝗿𝗲𝗽𝗼𝗿𝘁𝗮𝗿 <𝗺𝗼𝘁𝗶𝘃𝗼>

⚡ 𝗨𝘀𝗮𝗿 𝗲𝘀𝘁𝗲 𝗰𝗼𝗺𝗮𝗻𝗱𝗼 𝗲𝘀 𝗺𝗮́𝘀 𝗿𝗮́𝗽𝗶𝗱𝗼 𝘆 𝘀𝗲𝗴𝘂𝗿𝗼 𝗾𝘂𝗲 𝗲𝘀𝗰𝗿𝗶𝗯𝗶𝗿𝗹𝗲 𝗮 𝘂𝗻 𝗮𝗱𝗺𝗶𝗻 𝘂𝗻𝗼 𝗽𝗼𝗿 𝘂𝗻𝗼: 𝘁𝗼𝗱𝗼𝘀 𝘀𝗲 𝗲𝗻𝘁𝗲𝗿𝗮𝗻 𝗮𝗹 𝗶𝗻𝘀𝘁𝗮𝗻𝘁𝗲 𝘆 𝗽𝘂𝗲𝗱𝗲𝗻 𝘀𝗼𝗹𝘂𝗰𝗶𝗼𝗻𝗮𝗿𝗹𝗼 𝗺𝗮́𝘀 𝗿𝗮́𝗽𝗶𝗱𝗼.

✅ 𝗦𝗲́ 𝗰𝗹𝗮𝗿𝗼 𝗰𝗼𝗻 𝗲𝗹 𝗺𝗼𝘁𝗶𝘃𝗼, 𝗲𝗻𝘁𝗿𝗲 𝗺𝗮́𝘀 𝗽𝗿𝗲𝗰𝗶𝘀𝗼 𝗹𝗼 𝗲𝘀𝗰𝗿𝗶𝗯𝗮𝘀, 𝗺𝗮́𝘀 𝗿𝗮́𝗽𝗶𝗱𝗼 𝗲𝗹 𝗮𝗱𝗺𝗶𝗻 𝗲𝗻𝘁𝗶𝗲𝗻𝗱𝗲 𝗾𝘂𝗲́ 𝗽𝗮𝘀𝗼́ 𝘆 𝗽𝘂𝗲𝗱𝗲 𝗮𝗰𝘁𝘂𝗮𝗿.

𝗘𝗷𝗲𝗺𝗽𝗹𝗼: .𝗿𝗲𝗽𝗼𝗿𝘁𝗮𝗿 𝗺𝗲 𝗲𝘀𝘁𝗮́ 𝗶𝗻𝘀𝘂𝗹𝘁𝗮𝗻𝗱𝗼` + SIGNATURE
        },
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
🔎 𝗥𝗲𝘃𝗶𝘀𝗮𝗹𝗼 𝗰𝘂𝗮𝗻𝗱𝗼 𝗽𝘂𝗲𝗱𝗮𝘀.` + SIGNATURE,
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
