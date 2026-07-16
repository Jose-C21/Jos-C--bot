// src/commands/menu.js
import moment from "moment-timezone"
import path from "path"
import { jidToNumber, getSenderJid } from "../utils/jid.js"
import config from "../config.js"
import { createCanvas, loadImage } from "canvas"

const FALLBACK_AVATAR =
  "https://i.postimg.cc/VLCVJnd5/F6049B9B-B574-486D-94C7-AC17ED4438C2.png"

const TEMPLATE_PATH = path.join(process.cwd(), "assets", "menu_template.png")

function limpiarNombreParaImagen(nombre) {
  if (!nombre) return ""
  return nombre
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .trim()
}

async function generarImagenMenu({ nombre, profilePicUrl, rol, tipoChat, fecha, hora }) {
  const SIZE = 1000

  const canvas = createCanvas(SIZE, SIZE)
  const ctx = canvas.getContext("2d")

  const fondo = await loadImage(TEMPLATE_PATH)
  ctx.drawImage(fondo, 0, 0, SIZE, SIZE)

  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"

  const AVATAR_CX = SIZE / 2
  const AVATAR_CY = 335
  const AVATAR_RAD = 172

  let avatarImg
  try {
    avatarImg = await loadImage(profilePicUrl)
  } catch {
    avatarImg = await loadImage(FALLBACK_AVATAR)
  }

  ctx.save()
  ctx.beginPath()
  ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_RAD, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(
    avatarImg,
    AVATAR_CX - AVATAR_RAD,
    AVATAR_CY - AVATAR_RAD,
    AVATAR_RAD * 2,
    AVATAR_RAD * 2
  )
  ctx.restore()

  const NAME_MAX_WIDTH = 620
  let displayName = nombre || "Usuario"

  let fontSize = 52
  ctx.fillStyle = "#fff2d7"
  ctx.font = `bold ${fontSize}px Sans`

  while (ctx.measureText(displayName).width > NAME_MAX_WIDTH && fontSize > 28) {
    fontSize -= 2
    ctx.font = `bold ${fontSize}px Sans`
  }

  if (ctx.measureText(displayName).width > NAME_MAX_WIDTH) {
    while (
      ctx.measureText(displayName + "…").width > NAME_MAX_WIDTH &&
      displayName.length > 4
    ) {
      displayName = displayName.slice(0, -1)
    }
    displayName += "…"
  }

  ctx.fillText(displayName, SIZE / 2, 600)

  ctx.font = "bold 28px Sans"
  ctx.fillStyle = "#0d0d0d"
  ctx.fillText(rol, SIZE / 2, 663)

  const cols = [
    { value: tipoChat, cx: SIZE / 2 - 300 },
    { value: fecha, cx: SIZE / 2 },
    { value: hora, cx: SIZE / 2 + 300 }
  ]

  for (const col of cols) {
    ctx.font = "bold 32px Sans"
    ctx.fillStyle = "#fff2d7"
    ctx.fillText(col.value, col.cx, 825)
  }

  return canvas.toBuffer("image/png")
}

export default async function menu(sock, msg) {
  try {
    const chatId = msg?.key?.remoteJid
    if (!chatId) return

    moment.locale("es")
    const timezone = "America/Tegucigalpa"

    await sock.sendMessage(chatId, { react: { text: "📜", key: msg.key } }).catch(() => {})

    const senderJid = getSenderJid(msg)
    const num = jidToNumber(senderJid)
    const user = "@" + String(num || senderJid).replace(/\D/g, "")
    const nombreReal = (msg?.pushName || "").trim()

    let diaSemana = moment().tz(timezone).format("dddd")
    diaSemana = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)
    const fecha = moment().tz(timezone).format("DD/MM/YYYY")
    const hora = moment().tz(timezone).format("HH:mm:ss")
    const horaNum = moment().tz(timezone).hour()

    let saludo
    if (horaNum >= 5 && horaNum < 12) saludo = "🌅 𝗕𝘂𝗲𝗻𝗼𝘀 𝗱𝗶𝗮𝘀"
    else if (horaNum >= 12 && horaNum < 19) saludo = "☀️ 𝗕𝘂𝗲𝗻𝗮𝘀 𝘁𝗮𝗿𝗱𝗲𝘀"
    else saludo = "🌙 𝗕𝘂𝗲𝗻𝗮𝘀 𝗻𝗼𝗰𝗵𝗲𝘀"

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

    let rol = "👤 ᴜꜱᴜᴀʀɪᴏ"

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

    const rolImagen = isOwner ? "DEVELOPER" : isAdmin ? "ADMINISTRADOR" : "USUARIO"

    const tipoChat = String(chatId).endsWith("@g.us") ? "👥 ɢʀᴜᴘᴏ" : "💬 ᴘʀɪᴠᴀᴅᴏ"
    const tipoChatImagen = String(chatId).endsWith("@g.us") ? "Grupo" : "Privado"

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

    const versionBot = "5.0.0"

    const captionText =
`⊱┊${saludo}, ${user} ✨
⊱┊${msgDia}

「 ❑ 𝗠𝗘𝗡𝗨́ 𝗣𝗥𝗜𝗡𝗖𝗜𝗣𝗔𝗟 ❑ 」

❑ 𝗠𝘂𝗹𝘁𝗶𝗺𝗲𝗱𝗶𝗮 — 𝗣𝘂́𝗯𝗹𝗶𝗰𝗼
> ➤ .𝗽𝗹𝗮𝘆 ⇾ ᴀᴜᴅɪᴏ ᴅᴇ ʏᴏᴜᴛᴜʙᴇ
> ➤ .𝗽𝗹𝗮𝘆𝘃𝗶𝗱𝗲𝗼 ⇾ ᴠɪᴅᴇᴏ ᴅᴇ ʏᴏᴜᴛᴜʙᴇ
> ➤ .𝘁𝗶𝗸𝘁𝗼𝗸 ⇾ ᴅᴇꜱᴄᴀʀɢᴀʀ ᴠɪᴅᴇᴏ ᴛɪᴋᴛᴏᴋ
> ➤ .𝗱𝗲𝘁𝗲𝗰𝘁𝗮𝗿 ⇾ ʀᴇᴄᴏɴᴏᴄᴇ ᴄᴀɴᴄɪᴏ́ɴ
> ➤ .𝗮𝘂𝗱𝗶𝗼𝗱𝗼𝗰 ⇾ ᴀᴜᴅɪᴏ ᴇɴ ᴅᴏᴄᴜᴍᴇɴᴛᴏ

❑ 𝗦𝘁𝗶𝗰𝗸𝗲𝗿𝘀 & 𝗜𝗔 — 𝗣𝘂́𝗯𝗹𝗶𝗰𝗼
> ➤ .𝘀 ⇾ ᴄʀᴇᴀʀ ꜱᴛɪᴄᴋᴇʀ
> ➤ .𝘁𝘀 ⇾ ꜱᴛɪᴄᴋᴇʀ ᴅᴇ ᴛᴇxᴛᴏ
> ➤ .𝗶𝗺𝗴 ⇾ ᴄʀᴇᴀʀ ɪᴍᴀɢᴇɴ ɪᴀ
> ➤ .𝗱𝗲𝗰𝗶𝗿 ⇾ ᴠᴏᴢ ɪᴀ ᴇɴ ᴀᴜᴅɪᴏ

❑ 𝗚𝗿𝘂𝗽𝗼 — 𝗣𝘂́𝗯𝗹𝗶𝗰𝗼
> ➤ .𝗽𝗲𝗿𝗳𝗶𝗹 ⇾ ꜰᴏᴛᴏ ᴅᴇ ᴘᴇʀꜰɪʟ
> ➤ .𝗴𝗼𝗹𝗽𝗲𝗮𝗿 ⇾ ɢᴏʟᴘᴇᴀʀ ᴜꜱᴜᴀʀɪᴏ
> ➤ .𝗸𝗶𝘀𝘀 ⇾ ᴅᴀʀ ᴜɴ ʙᴇꜱᴏ
> ➤ .𝗿𝗲𝗽𝗼𝗿𝘁𝗮𝗿 ⇾ ᴅᴇɴᴜɴᴄɪᴀ ᴀ ᴜɴ ᴜꜱᴜᴀʀɪᴏ ʏ ɴᴏᴛɪꜰɪᴄᴀ ᴀ ᴛᴏᴅᴏꜱ ʟᴏꜱ ᴀᴅᴍɪɴꜱ ᴄᴏɴ ᴇʟ ᴍᴏᴛɪᴠᴏ ᴘᴀʀᴀ ǫᴜᴇ ᴀᴄᴛᴜ́ᴇɴ ʀᴀ́ᴘɪᴅᴏ

❑ 𝗚𝗿𝘂𝗽𝗼 — 𝗔𝗱𝗺𝗶𝗻𝘀
> ➤ .𝘁𝗮𝗴 ⇾ ᴍᴇɴᴄɪᴏɴᴀʀ ᴀ ᴛᴏᴅᴏꜱ
> ➤ .𝘃𝗲𝗿 ⇾ ʀᴇᴄᴜᴘᴇʀᴀʀ ᴠɪꜱᴛᴀ ᴜ́ɴɪᴄᴀ
> ➤ .𝗮𝗱𝗱 ⇾ ᴀɢʀᴇɢᴀʀ ᴜꜱᴜᴀʀɪᴏ
> ➤ .𝗸𝗶𝗰𝗸/.𝗯𝗮𝗻 ⇾ ᴇxᴘᴜʟꜱᴀʀ ᴜꜱᴜᴀʀɪᴏ
> ➤ .𝗺𝘂𝘁𝗲/.𝘂𝗻𝗺𝘂𝘁𝗲 ⇾ ᴍᴜᴛᴇᴀʀ ᴜꜱᴜᴀʀɪᴏ
> ➤ .𝗳𝗮𝗻𝘁𝗮𝘀𝗺𝗮𝘀 ⇾ ᴍɪᴇᴍʙʀᴏꜱ ɪɴᴀᴄᴛɪᴠᴏꜱ
> ➤ .𝗳𝗮𝗻𝗸𝗶𝗰𝗸 ⇾ ᴇxᴘᴜʟꜱᴀ ꜰᴀɴᴛᴀꜱᴍᴀꜱ
> ➤ .𝗼𝗽𝗲𝗻/.𝗰𝗹𝗼𝘀𝗲 ⇾ ᴀʙʀɪʀ/ᴄᴇʀʀᴀʀ ɢʀᴜᴘᴏ

❑ 𝗠𝗼𝗱𝗲𝗿𝗮𝗰𝗶𝗼́𝗻 (𝗼𝗻/𝗼𝗳𝗳) — 𝗔𝗱𝗺𝗶𝗻𝘀
> ➤ .𝗮𝗻𝘁𝗶𝗹𝗶𝗻𝗸 ⇾ ʙʟᴏǫᴜᴇᴀ ʟɪɴᴋꜱ
> ➤ .𝗮𝗻𝘁𝗶𝘀 ⇾ ᴀɴᴛɪꜱᴘᴀᴍ ꜱᴛɪᴄᴋᴇʀꜱ
> ➤ .𝗮𝗻𝘁𝗶𝗮𝗿𝗮𝗯𝗲 ⇾ ʙʟᴏǫᴜᴇᴀ ɴᴜ́ᴍᴇʀᴏꜱ ᴀ́ʀᴀʙᴇꜱ
> ➤ .𝗮𝗻𝘁𝗶𝗽𝗲𝗿𝘀𝗼𝗻𝗮 ⇾ ᴀʟᴇʀᴛᴀ ᴄᴀᴍʙɪᴏ ᴅᴇ ɴᴏᴍʙʀᴇ
> ➤ .𝗮𝗻𝘁𝗶𝗲𝘀𝘁𝗮𝗱𝗼 ⇾ ʙʟᴏǫᴜᴇᴀ ᴍᴇɴᴄɪᴏ́ɴ ᴅᴇ ᴇꜱᴛᴀᴅᴏꜱ
> ➤ .𝗯𝗶𝗲𝗻𝘃𝗲𝗻𝗶𝗱𝗮 ⇾ ᴍᴇɴꜱᴀᴊᴇ ᴅᴇ ʙɪᴇɴᴠᴇɴɪᴅᴀ

❑ 𝗠𝗼𝗱𝗲𝗿𝗮𝗰𝗶𝗼́𝗻 (𝗼𝗻/𝗼𝗳𝗳) — 𝗢𝘄𝗻𝗲𝗿
> ➤ .𝗮𝗻𝘁𝗶𝗽𝗼𝗿𝗻𝗼 ⇾ ʙʟᴏǫᴜᴇᴀ ᴄᴏɴᴛᴇɴɪᴅᴏ +𝟭𝟴

❑ 𝗔𝗱𝘃𝗲𝗿𝘁𝗲𝗻𝗰𝗶𝗮𝘀 — 𝗔𝗱𝗺𝗶𝗻𝘀
> ➤ .𝘄𝗮𝗿𝗻 ⇾ ᴅᴀʀ ᴀᴅᴠᴇʀᴛᴇɴᴄɪᴀ
> ➤ .𝘄𝗮𝗿𝗻𝘀 ⇾ ᴠᴇʀ ᴀᴅᴠᴇʀᴛᴇɴᴄɪᴀꜱ
> ➤ .𝘂𝗻𝘄𝗮𝗿𝗻 ⇾ ǫᴜɪᴛᴀʀ ᴀᴅᴠᴇʀᴛᴇɴᴄɪᴀ
> ➤ .𝗿𝗲𝘀𝗲𝘁𝘄𝗮𝗿𝗻𝘀 ⇾ ʙᴏʀʀᴀʀ ᴛᴏᴅᴀꜱ

❑ 𝗖𝗼𝗻𝘁𝗲𝗼 𝘆 𝗹𝗶𝘀𝘁𝗮𝘀 — 𝗣𝘂́𝗯𝗹𝗶𝗰𝗼
> ➤ .𝘁𝗼𝘁𝗮𝗹𝗺𝗲𝗻𝘀𝗮𝗷𝗲𝘀 ⇾ ᴄᴏɴᴛᴇᴏ ᴅᴇ ᴍᴇɴꜱᴀᴊᴇꜱ
> ➤ .𝗲𝘀𝘁𝗮𝗱𝗼𝗰𝗼𝗻𝘁𝗲𝗼 ⇾ ᴠᴇʀ ᴇꜱᴛᴀᴅᴏ

❑ 𝗖𝗼𝗻𝘁𝗲𝗼 𝘆 𝗹𝗶𝘀𝘁𝗮𝘀 — 𝗢𝘄𝗻𝗲𝗿
> ➤ .𝗮𝗱𝗱𝗹𝗶𝘀𝘁𝗮 ⇾ ᴀɢʀᴇɢᴀʀ ᴀ ʟɪꜱᴛᴀ
> ➤ .𝗽𝗮𝘂𝘀𝗮𝗿𝗰𝗼𝗻𝘁𝗲𝗼 ⇾ ᴘᴀᴜꜱᴀʀ ᴄᴏɴᴛᴇᴏ
> ➤ .𝗿𝗲𝗮𝗻𝘂𝗱𝗮𝗿𝗰𝗼𝗻𝘁𝗲𝗼 ⇾ ʀᴇᴀɴᴜᴅᴀʀ ᴄᴏɴᴛᴇᴏ

❑ 𝗨𝘁𝗶𝗹𝗶𝗱𝗮𝗱𝗲𝘀 — 𝗣𝘂́𝗯𝗹𝗶𝗰𝗼
> ➤ .𝗰𝗹𝗶𝗺𝗮 ⇾ ᴄʟɪᴍᴀ ᴅᴇ ᴜɴᴀ ᴄɪᴜᴅᴀᴅ
> ➤ .𝗮𝗳𝗸 ⇾ ᴍᴏᴅᴏ ᴀᴜꜱᴇɴᴛᴇ

⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система
> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`

    let profilePicUrl = FALLBACK_AVATAR
    try {
      const pic = await sock.profilePictureUrl(senderJid, "image")
      if (typeof pic === "string" && pic) profilePicUrl = pic
    } catch {}

    let imagenBuffer = null
    try {
      imagenBuffer = await generarImagenMenu({
        nombre: limpiarNombreParaImagen(nombreReal) || user,
        profilePicUrl,
        rol: rolImagen,
        tipoChat: tipoChatImagen,
        fecha,
        hora
      })
    } catch (e) {
      console.error("[menu] Error generando imagen:", e)
    }

    await sock.sendMessage(
      chatId,
      {
        image: imagenBuffer
          ? imagenBuffer
          : { url: FALLBACK_AVATAR },
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
