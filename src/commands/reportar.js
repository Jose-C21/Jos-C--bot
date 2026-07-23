// src/commands/reportar.js
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const SIGNATURE =
  "\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|𝘑𝘊𝘒𝘡𝘐𝘯𝘧𝘪𝘯𝘪𝘵𝘺𝘓𝘰𝘰𝘱\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦"

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
`> 📝 𝗖𝗢́𝗠𝗢 𝗥𝗘𝗣𝗢𝗥𝗧𝗔𝗥
━━━━━━━━━━━━━━━━
𝗨𝘀𝗮:
𝘙𝘦𝘴𝘱𝘰𝘯𝘥𝘦 𝘢𝘭 𝘮𝘦𝘯𝘴𝘢𝘫𝘦 𝘥𝘦 𝘭𝘢 𝘱𝘦𝘳𝘴𝘰𝘯𝘢 𝘺 𝘦𝘴𝘤𝘳𝘪𝘣𝘦:
.𝘳𝘦𝘱𝘰𝘳𝘵𝘢𝘳 <𝘮𝘰𝘵𝘪𝘷𝘰>

𝗘𝗷𝗲𝗺𝗽𝗹𝗼: .𝘳𝘦𝘱𝘰𝘳𝘵𝘢𝘳 𝘮𝘦 𝘦𝘴𝘵𝘢́ 𝘪𝘯𝘴𝘶𝘭𝘵𝘢𝘯𝘥𝘰
━━━━━━━━━━━━━━━━
ℹ️ 𝗤𝘂𝗲́ 𝗵𝗮𝗰𝗲: 𝘢𝘷𝘪𝘴𝘢 𝘢 𝘵𝘰𝘥𝘰𝘴 𝘭𝘰𝘴 𝘢𝘥𝘮𝘪𝘯𝘴, 𝘦𝘯 𝘦𝘭 𝘨𝘳𝘶𝘱𝘰 𝘺 𝘦𝘯 𝘴𝘶 𝘱𝘳𝘪𝘷𝘢𝘥𝘰, 𝘢𝘭 𝘪𝘯𝘴𝘵𝘢𝘯𝘵𝘦.

⚡ 𝗣𝗼𝗿 𝗾𝘂𝗲́ 𝘂𝘀𝗮𝗿𝗹𝗼: 𝘮𝘢́𝘴 𝘳𝘢́𝘱𝘪𝘥𝘰 𝘺 𝘴𝘦𝘨𝘶𝘳𝘰 𝘲𝘶𝘦 𝘦𝘴𝘤𝘳𝘪𝘣𝘪𝘳𝘭𝘦 𝘢 𝘤𝘢𝘥𝘢 𝘢𝘥𝘮𝘪𝘯 𝘱𝘰𝘳 𝘴𝘦𝘱𝘢𝘳𝘢𝘥𝘰, 𝘺𝘢 𝘲𝘶𝘦 𝘵𝘰𝘥𝘰𝘴 𝘴𝘦 𝘦𝘯𝘵𝘦𝘳𝘢𝘯 𝘢𝘭 𝘪𝘯𝘴𝘵𝘢𝘯𝘵𝘦 𝘺 𝘯𝘰 𝘶𝘯𝘰 𝘱𝘰𝘳 𝘶𝘯𝘰.

✅ 𝗧𝗶𝗽: 𝘴𝘦́ 𝘤𝘭𝘢𝘳𝘰 𝘤𝘰𝘯 𝘦𝘭 𝘮𝘰𝘵𝘪𝘷𝘰 𝘱𝘢𝘳𝘢 𝘲𝘶𝘦 𝘦𝘭 𝘢𝘥𝘮𝘪𝘯 𝘢𝘤𝘵𝘶́𝘦 𝘳𝘢́𝘱𝘪𝘥𝘰.
` + SIGNATURE
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
