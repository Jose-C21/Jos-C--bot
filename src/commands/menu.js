// src/commands/menu.js
import moment from "moment-timezone"
import { jidToNumber, getSenderJid } from "../utils/jid.js"
import config from "../config.js"

export default async function menu(sock, msg) {
  try {
    const chatId = msg?.key?.remoteJid
    if (!chatId) return

    moment.locale("es")
    const timezone = "America/Tegucigalpa"

    // Reacción inicial
    await sock.sendMessage(chatId, { react: { text: "📜", key: msg.key } }).catch(() => {})

    // Usuario
    const senderJid = getSenderJid(msg)
    const num = jidToNumber(senderJid)
    const user = "@" + String(num || senderJid).replace(/\D/g, "")

    // Fecha y hora
    let diaSemana = moment().tz(timezone).format("dddd")
    diaSemana = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)
    const fecha = moment().tz(timezone).format("DD/MM/YYYY")
    const hora = moment().tz(timezone).format("HH:mm:ss")
    const horaNum = moment().tz(timezone).hour()

    // Saludo
    let saludo
    if (horaNum >= 5 && horaNum < 12) saludo = "🌅 𝗕𝘂𝗲𝗻𝗼𝘀 𝗱𝗶𝗮𝘀"
    else if (horaNum >= 12 && horaNum < 19) saludo = "☀️ 𝗕𝘂𝗲𝗻𝗮𝘀 𝘁𝗮𝗿𝗱𝗲𝘀"
    else saludo = "🌙 𝗕𝘂𝗲𝗻𝗮𝘀 𝗻𝗼𝗰𝗵𝗲𝘀"

    // Mensaje por día
    let msgDia = ""
    switch (diaSemana.toLowerCase()) {
      case "lunes": msgDia = "💪 ¡ᴀ ᴇᴍᴘᴇᴢᴀʀ ʟᴀ ꜱᴇᴍᴀɴᴀ ᴄᴏɴ ᴛᴏᴅᴏ!"; break
      case "martes": msgDia = "🚀 ᴍᴀʀᴛᴇꜱ ᴅᴇ ᴇɴᴇʀɢɪᴀ ᴘᴏꜱɪᴛɪᴠᴀ"; break
      case "miércoles": msgDia = "🌟 ᴍɪᴛᴀᴅ ᴅᴇ ꜱᴇᴍᴀɴᴀ, ꜱɪɢᴜᴇ ꜰᴜᴇʀᴛᴇ"; break
      case "jueves": msgDia = "🔥 ¡ᴄᴀꜱɪ ᴠɪᴇʀɴᴇꜱ, ɴᴏ ᴛᴇ ʀɪɴᴅᴀꜱ!"; break
      case "viernes": msgDia = "🎉 ᴠɪᴇʀɴᴇꜱ ᴀʟ ꜰɪɴ, ᴅɪꜱꜰʀᴜᴛᴀ ᴛᴜ ᴅɪᴀ"; break
      case "sábado": msgDia = "😎 ꜱᴀʙᴀᴅᴏ ʀᴇʟᴀx, ᴘᴇʀᴏ ᴅɪᴠᴇʀᴛɪᴅᴏ"; break
      case "domingo": msgDia = "☀️ ᴅᴏᴍɪɴɢᴏ ᴛʀᴀɴQᴜɪʟᴏ, ʀᴇᴄᴀʀɢᴀ ᴇɴᴇʀɢɪᴀꜱ"; break
      default: msgDia = ""
    }

    // Rol (Dev/Admin/Usuario)
    let rol = "👤 ᴜꜱᴜᴀʀɪᴏ"

    // Owner por config.owners / ownersLid (tu estructura)
    const isOwner =
      (config.owners || []).map(String).includes(String(num)) ||
      (config.ownersLid || []).map(String).includes(String(num))

    let isAdmin = false
    if (String(chatId).endsWith("@g.us")) {
      try {
        const md = await sock.groupMetadata(chatId)
        const p = md?.participants?.find(x => x.id === senderJid || (sock.decodeJid ? sock.decodeJid(x.id) : x.id) === senderJid)
        isAdmin = p?.admin === "admin" || p?.admin === "superadmin"
      } catch {}
    }

    if (isOwner) rol = "🧩 ᴅᴇᴠᴇʟᴏᴘᴇʀ"
    else if (isAdmin) rol = "👑 ᴀᴅᴍɪɴɪꜱᴛʀᴀᴅᴏʀ"

    // Tipo de chat
    const tipoChat = String(chatId).endsWith("@g.us") ? "👥 ɢʀᴜᴘᴏ" : "💬 ᴘʀɪᴠᴀᴅᴏ"

    // Dispositivo (heurística por id)
    let dispositivo = "Desconocido"
    try {
      const msgId = String(msg.key?.id || "").toLowerCase()
      if (msgId.startsWith("3a")) dispositivo = "🍎 ɪᴏꜱ"
      else if (msgId.startsWith("ba")) dispositivo = "💻 ᴡᴇʙ"
      else if (msgId.startsWith("e")) dispositivo = "🤖 ᴀɴᴅʀᴏɪᴅ"
      else dispositivo = "🤖 ᴀɴᴅʀᴏɪᴅ"
    } catch {
      dispositivo = "Desconocido"
    }

    const versionBot = "4.2.0"

    const captionText =
`╰•彡𝙎𝙄𝙎𝙏𝙀𝙈𝘼 𝘿𝙀 𝘽𝙊𝙏﹕𝙋𝙍𝙄𝘝𝘼𝘿𝙊彡•╯

⊱┊${saludo}, ${user} ✨
⊱┊${msgDia}

┏━༻𝗜𝗡𝗙𝗢 𝗗𝗘𝗟 𝗨𝗦𝗨𝗔𝗥𝗜𝗢༺━┓
👤 𝗨𝘀𝘂𝗮𝗿𝗶𝗼: ${user}
💬 𝗧𝗶𝗽𝗼 𝗱𝗲 𝗰𝗵𝗮𝘁: ${tipoChat}
📱 𝗗𝗶𝘀𝗽𝗼𝘀𝗶𝘁𝗶𝘃𝗼: ${dispositivo}
🏅 𝗥𝗼𝗹: ${rol}
┗━━━━━━⟡━━━━━━┛

┏━━━༻𝗜𝗡𝗙𝗢 𝗗𝗘𝗟 𝗕𝗢𝗧༺━━━┓
📅 𝗙𝗲𝗰𝗵𝗮: ${diaSemana}, ${fecha}
⏰ 𝗛𝗼𝗿𝗮: ${hora}
🛰️ 𝗩𝗲𝗿𝘀𝗶𝗼́𝗻 𝗱𝗲𝗹 𝗯𝗼𝘁: ${versionBot}
┗━━━━━━━❁━━━━━━━┛

☰┊𝗘𝘀𝘁𝗲 𝗲𝘀 𝗲𝗹 𝗺𝗲𝗻𝘂 𝗼𝗳𝗶𝗰𝗶𝗮𝗹 𝗱𝗲𝗹 𝗯𝗼𝘁 🤖

╭─ 𝗖𝗢𝗠𝗔𝗡𝗗𝗢𝗦
│ 🎧 .𝗽𝗹𝗮𝘆 - 𝗮𝘂𝗱𝗶𝗼
│ 🎥 .𝗽𝗹𝗮𝘆𝘃𝗶𝗱𝗲𝗼 — 𝘃𝗶𝗱𝗲𝗼
│ 🎵 .𝘁𝗶𝗸𝘁𝗼𝗸 — 𝗱𝗲𝘀𝗰𝗮𝗿𝗴𝗮𝗿 𝘃𝗶𝗱𝗲𝗼 𝘁𝗶𝗸𝘁𝗼𝗸
│ 📄 .𝗮𝘂𝗱𝗶𝗼𝗱𝗼𝗰 — 𝗮𝘂𝗱𝗶𝗼 𝗲𝗻 𝗱𝗼𝗰𝘂𝗺𝗲𝗻𝘁𝗼
│ 🖼️ .𝘀 — 𝗰𝗿𝗲𝗮𝗿 𝘀𝘁𝗶𝗰𝗸𝗲𝗿
│ 📝 .𝘁𝘀 — 𝘁𝗲𝘅𝘁𝗼 𝘀𝘁𝗶𝗰𝗸𝗲𝗿
│ 🧠 .𝗶𝗺𝗴 — 𝗰𝗿𝗲𝗮𝗿 𝗶𝗺𝗮𝗴𝗲𝗻 𝗜𝗔
│ 🗣️ .𝗱𝗲𝗰𝗶𝗿 — 𝗮𝘂𝗱𝗶𝗼 𝗰𝗼𝗻 𝘃𝗼𝘇 𝗱𝗲 𝗜𝗔
│ 🧾 .𝗮𝗱𝗱𝗹𝗶𝘀𝘁𝗮 — 𝗮𝗴𝗿𝗲𝗴𝗮𝗿 𝗮 𝗹𝗶𝘀𝘁𝗮
│ 🗑️ .𝗱𝗲𝗹𝗹𝗶𝘀𝘁𝗮 — 𝗯𝗼𝗿𝗿𝗮𝗿 𝗱𝗲 𝗹𝗶𝘀𝘁𝗮
│ 🧮 .𝘁𝗼𝘁𝗮𝗹𝗺𝗲𝗻𝘀𝗮𝗷𝗲𝘀 — 𝗰𝗼𝗻𝘁𝗲𝗼 𝗱𝗲 𝗺𝗲𝗻𝘀𝗮𝗷𝗲𝘀
│ 🔇 .𝗺𝘂𝘁𝗲 — 𝗺𝘂𝘁𝗲𝗮𝗿 𝘂𝘀𝘂𝗮𝗿𝗶𝗼
│ 🔊 .𝘂𝗻𝗺𝘂𝘁𝗲 — 𝗱𝗲𝘀𝗺𝘂𝘁𝗲𝗮𝗿 𝘂𝘀𝘂𝗮𝗿𝗶𝗼
│ 🥊 .𝗴𝗼𝗹𝗽𝗲𝗮𝗿 — 𝗴𝗼𝗹𝗽𝗲𝗮𝗿 𝗮 𝘂𝗻 𝘂𝘀𝘂𝗮𝗿𝗶𝗼
│ 💋 .𝗸𝗶𝘀𝘀 — 𝗱𝗮𝗿 𝗯𝗲𝘀𝗼
│ 🖼️ .𝗽𝗲𝗿𝗳𝗶𝗹 - 𝘀𝗮𝗰𝗮𝗿 𝗳𝗼𝘁𝗼 𝗱𝗲 𝗽𝗲𝗿𝗳𝗶𝗹
│ 🏷️ .𝘁𝗮𝗴 - 𝗺𝗲𝗻𝗰𝗶𝗼𝗻𝗮𝗿 𝗮 𝘁𝗼𝗱𝗼𝘀 (𝘁𝗲𝘅𝘁𝗼 𝗼 𝗿𝗲𝗲𝗻𝘃𝗶𝗮𝗿)
│ ♻️ .𝘃𝗲𝗿 - 𝗿𝗲𝗰𝘂𝗽𝗲𝗿𝗮𝗿 𝗮𝗿𝗰𝗵𝗶𝘃𝗼 𝗱𝗲 𝘂𝗻𝗮 𝘀𝗼𝗹𝗮 𝘃𝗶𝘀𝘁𝗮
│ 🛡️ .𝗮𝗻𝘁𝗶𝗹𝗶𝗻𝗸 𝗼𝗻/𝗼𝗳𝗳 — 𝗱𝗲𝘁𝗲𝗰𝘁𝗮𝗿 𝗹𝗶𝗻𝗸𝘀
│ 🧱 .𝗮𝗻𝘁𝗶𝘀 𝗼𝗻/𝗼𝗳𝗳 — 𝗮𝗻𝘁𝗶𝘀𝗽𝗮𝗺 𝗱𝗲 𝘀𝘁𝗶𝗰𝗸𝗲𝗿𝘀
│ 🚫 .𝗸𝗶𝗰𝗸/𝗯𝗮𝗻 - 𝗲𝘅𝗽𝘂𝗹𝘀𝗮𝗿 𝘂𝘀𝘂𝗮𝗿𝗶𝗼
│ 👻 .𝗳𝗮𝗻𝘁𝗮𝘀𝗺𝗮𝘀 — 𝗹𝗶𝘀𝘁𝗮 𝗱𝗲 𝗺𝗶𝗲𝗺𝗯𝗿𝗼𝘀 𝗾𝘂𝗲 𝗻𝗼 𝗵𝗮𝗻 𝗲𝘀𝗰𝗿𝗶𝘁𝗼
│ 🚫 .𝗳𝗮𝗻𝗸𝗶𝗰𝗸 — 𝗲𝘅𝗽𝘂𝗹𝘀𝗮 𝗳𝗮𝗻𝘁𝗮𝘀𝗺𝗮𝘀 𝗱𝗲𝘁𝗲𝗰𝘁𝗮𝗱𝗼𝘀
│ 👋 .𝗯𝗶𝗲𝗻𝘃𝗲𝗻𝗶𝗱𝗮 𝗼𝗻/𝗼𝗳𝗳 — 𝗱𝗮𝗿 𝗯𝗶𝗲𝗻𝘃𝗲𝗻𝗶𝗱𝗮 𝗮 𝘂𝘀𝘂𝗮𝗿𝗶𝗼
│ 🔓 .𝗼𝗽𝗲𝗻 — 𝗮𝗯𝗿𝗶𝗿 𝗴𝗿𝘂𝗽𝗼
│ 🔒 .𝗰𝗹𝗼𝘀𝗲 — 𝗰𝗲𝗿𝗿𝗮𝗿 𝗴𝗿𝘂𝗽𝗼
╰────────────

⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система
> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`

    // ✅ Enviar imagen con caption y mención
    await sock.sendMessage(
      chatId,
      {
        image: { url: "https://i.postimg.cc/nVGqZ0Fd/17C6275D-76AF-410C-86D5-0E89A361B252.png" },
        caption: captionText,
        mentions: [senderJid]
      },
      { quoted: msg }
    )

  } catch (error) {
    console.error("Error en comando menu:", error)
    const chatId = msg?.key?.remoteJid
    if (!chatId) return
    await sock.sendMessage(
      chatId,
      { text: "❌ *Ocurrió un error al mostrar el menú. Inténtalo de nuevo.*" },
      { quoted: msg }
    )
  }
}