// src/commands/menu.js
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

// ✅ Detectar país por prefijo (orden importa: más largo primero)
function detectCountry(num = "") {
  const n = String(num).replace(/\D/g, "")
  if (!n) return { cc: "?", country: "Desconocido" }

  const map = [
    ["504", "Honduras 🇭🇳"],
    ["503", "El Salvador 🇸🇻"],
    ["502", "Guatemala 🇬🇹"],
    ["505", "Nicaragua 🇳🇮"],
    ["506", "Costa Rica 🇨🇷"],
    ["507", "Panamá 🇵🇦"],
    ["52", "México 🇲🇽"],
    ["57", "Colombia 🇨🇴"],
    ["58", "Venezuela 🇻🇪"],
    ["51", "Perú 🇵🇪"],
    ["54", "Argentina 🇦🇷"],
    ["56", "Chile 🇨🇱"],
    ["1", "USA/Canadá 🇺🇸🇨🇦"],
    ["34", "España 🇪🇸"]
  ]

  for (const [cc, country] of map) {
    if (n.startsWith(cc)) return { cc, country }
  }

  return { cc: n.slice(0, 3), country: "Desconocido" }
}

// ✅ Fecha/hora en TZ sin dependencias
function getNowTZ(timeZone = "America/Tegucigalpa") {
  const now = new Date()

  const parts = new Intl.DateTimeFormat("es-ES", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(now)

  const get = (t) => parts.find((p) => p.type === t)?.value || ""
  let weekday = get("weekday")
  if (weekday) weekday = weekday.charAt(0).toUpperCase() + weekday.slice(1)

  const day = get("day")
  const month = get("month")
  const year = get("year")
  const hour = get("hour")
  const minute = get("minute")
  const second = get("second")

  return {
    weekday,
    fecha: `${day}/${month}/${year}`,
    hora: `${hour}:${minute}:${second}`,
    hourNum: Number(hour || 0)
  }
}

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

// ✅ Detectar dispositivo (tu lógica)
function detectDevice(msgId = "") {
  const lowerId = String(msgId || "").toLowerCase()
  if (lowerId.startsWith("3a")) return "🍎 ɪᴏꜱ"
  if (lowerId.startsWith("ba")) return "💻 ᴡᴇʙ"
  if (lowerId.startsWith("e")) return "🤖 ᴀɴᴅʀᴏɪᴅ"
  return "🤖 ᴀɴᴅʀᴏɪᴅ"
}

export default async function menu(sock, msg, { usedPrefix = ".", command = "menu" } = {}) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  try {
    // Reacción inicial
    await sock.sendMessage(chatId, { react: { text: "📜", key: msg.key } }).catch(() => {})

    // ✅ Sender (soporta decodeJid por @lid)
    const senderJid = getSenderJid(msg)
    let decoded = senderJid
    try { if (sock?.decodeJid) decoded = sock.decodeJid(senderJid) } catch {}

    const senderNum = jidToNumber(senderJid)
    const senderNumDecoded = jidToNumber(decoded)
    const finalNum = senderNumDecoded || senderNum || ""

    // ✅ este es el JID que se menciona (aunque sea @lid)
    const mentionJid = decoded || senderJid
    const userTag = finalNum ? `@${finalNum}` : "@usuario"

    // ✅ Hora/fecha
    const tz = "America/Tegucigalpa"
    const { weekday, fecha, hora, hourNum } = getNowTZ(tz)

    // ✅ Saludo
    let saludo = "🌙 𝗕𝘂𝗲𝗻𝗮𝘀 𝗻𝗼𝗰𝗵𝗲𝘀"
    if (hourNum >= 5 && hourNum < 12) saludo = "🌅 𝗕𝘂𝗲𝗻𝗼𝘀 𝗱𝗶𝗮𝘀"
    else if (hourNum >= 12 && hourNum < 19) saludo = "☀️ 𝗕𝘂𝗲𝗻𝗮𝘀 𝘁𝗮𝗿𝗱𝗲𝘀"

    // ✅ Mensaje por día
    const d = String(weekday || "").toLowerCase()
    let msgDia = ""
    if (d.includes("lunes")) msgDia = "💪 ¡ᴀ ᴇᴍᴘᴇᴢᴀʀ ʟᴀ ꜱᴇᴍᴀɴᴀ ᴄᴏɴ ᴛᴏᴅᴏ!"
    else if (d.includes("martes")) msgDia = "🚀 ᴍᴀʀᴛᴇꜱ ᴅᴇ ᴇɴᴇʀɢɪᴀ ᴘᴏꜱɪᴛɪᴠᴀ"
    else if (d.includes("miércoles") || d.includes("miercoles")) msgDia = "🌟 ᴍɪᴛᴀᴅ ᴅᴇ ꜱᴇᴍᴀɴᴀ, ꜱɪɢᴜᴇ ꜰᴜᴇʀᴛᴇ"
    else if (d.includes("jueves")) msgDia = "🔥 ¡ᴄᴀꜱɪ ᴠɪᴇʀɴᴇꜱ, ɴᴏ ᴛᴇ ʀɪɴᴅᴀꜱ!"
    else if (d.includes("viernes")) msgDia = "🎉 ᴠɪᴇʀɴᴇꜱ ᴀʟ ꜰɪɴ, ᴅɪꜱꜰʀᴜᴛᴀ ᴛᴜ ᴅɪᴀ"
    else if (d.includes("sábado") || d.includes("sabado")) msgDia = "😎 ꜱᴀʙᴀᴅᴏ ʀᴇʟᴀx, ᴘᴇʀᴏ ᴅɪᴠᴇʀᴛɪᴅᴏ"
    else if (d.includes("domingo")) msgDia = "☀️ ᴅᴏᴍɪɴɢᴏ ᴛʀᴀɴQᴜɪʟᴏ, ʀᴇᴄᴀʀɢᴀ ᴇɴᴇʀɢɪᴀꜱ"

    // ✅ Rol + admin
    const isOwner = isOwnerByNumbers({ senderNum, senderNumDecoded })
    let isAdmin = false

    if (String(chatId).endsWith("@g.us")) {
      try {
        const md = await sock.groupMetadata(chatId)
        const p = md.participants?.find((x) => x.id === senderJid || x.id === decoded)
        isAdmin = p?.admin === "admin" || p?.admin === "superadmin"
      } catch {}
    }

    let rol = "👤 ᴜꜱᴜᴀʀɪᴏ"
    if (isOwner) rol = "🧩 ᴅᴇᴠᴇʟᴏᴘᴇʀ"
    else if (isAdmin) rol = "👑 ᴀᴅᴍɪɴɪꜱᴛʀᴀᴅᴏʀ"

    // ✅ tipo chat + dispositivo
    const tipoChat = String(chatId).endsWith("@g.us") ? "👥 ɢʀᴜᴘᴏ" : "💬 ᴘʀɪᴠᴀᴅ𝘰"
    const dispositivo = detectDevice(msg?.key?.id)

    // ✅ país por código
    const { cc, country } = detectCountry(finalNum)

    // ✅ versión bot (pon la tuya)
    const versionBot = "4.2.0"

    // ✅ TU CAPTION (con país)
    const captionText =
`╰•彡𝙎𝙄𝙎𝙏𝙀𝙈𝘼 𝘿𝙀 𝘽𝙊𝙏﹕𝙋𝙍𝙄𝘝𝘼𝘿𝙊彡•╯

⊱┊${saludo}, ${userTag} ✨
⊱┊${msgDia}

┏━༻𝗜𝗡𝗙𝗢 𝗗𝗘𝗟 𝗨𝗦𝗨𝗔𝗥𝗜𝗢༺━┓
👤 𝗨𝘀𝘂𝗮𝗿𝗶𝗼: ${userTag}
🌍 𝗣𝗮𝗶𝘀: ${country}
📞 𝗖𝗼𝗱𝗶𝗴𝗼: +${cc}
💬 𝗧𝗶𝗽𝗼 𝗱𝗲 𝗰𝗵𝗮𝘁: ${tipoChat}
📱 𝗗𝗶𝘀𝗽𝗼𝘀𝗶𝘁𝗶𝘃𝗼: ${dispositivo}
🏅 𝗥𝗼𝗹: ${rol}
┗━━━━━━⟡━━━━━━┛

┏━━━༻𝗜𝗡𝗙𝗢 𝗗𝗘𝗟 𝗕𝗢𝗧༺━━━┓
📅 𝗙𝗲𝗰𝗵𝗮: ${weekday}, ${fecha}
⏰ 𝗛𝗼𝗿𝗮: ${hora}
🛰️ 𝗩𝗲𝗿𝘀𝗶𝗼́𝗻 𝗱𝗲𝗹 𝗯𝗼𝘁: ${versionBot}
┗━━━━━━━❁━━━━━━━┛

☰┊𝗘𝘀𝘁𝗲 𝗲𝘀 𝗲𝗹 𝗺𝗲𝗻𝘂 𝗼𝗳𝗶𝗰𝗶𝗮𝗹 𝗱𝗲𝗹 𝗯𝗼𝘁 🤖

╭─✦ 𝗖𝗢𝗠𝗔𝗡𝗗𝗢𝗦 ✦─╮
• ${usedPrefix}menu
• ${usedPrefix}play <texto>
• ${usedPrefix}playvideo <texto>
• ${usedPrefix}sticker
• ${usedPrefix}img <texto>
• ${usedPrefix}antilink on/off
• ${usedPrefix}antis on/off
• ${usedPrefix}bienvenida on/off
╰──────────────╯`

    // ✅ Enviar imagen con caption y mención (POSTIMG)
    await sock.sendMessage(
      chatId,
      {
        image: { url: "https://i.postimg.cc/90j2Nghj/D93798D6-9DCC-4CC6-919A-8211A8434705.png" },
        caption: captionText,
        mentions: finalNum ? [mentionJid] : []
      },
      { quoted: msg }
    ).catch(() => {})

    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})

  } catch (error) {
    console.error("Error en comando menu:", error)
    await sock.sendMessage(
      chatId,
      { text: "❌ *Ocurrió un error al mostrar el menú. Inténtalo de nuevo.*" },
      { quoted: msg }
    ).catch(() => {})
  }
}