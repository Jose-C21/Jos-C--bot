import fs from "fs"
import config from "../config.js"
import { jidToNumber } from "../utils/jid.js"
import { downloadContentFromMessage } from "baileys"
import { writeExifImg, writeExifVid } from "../utils/sticker-exif.js"

const GRUPO_RESTRINGIDO = "120363402012008160@g.us"

const ADMINS_CONFIANZA_LID = [
  ...(config.ownersLid || []),  // aquí está tu lid ya agregado
  "19580839829625"
]

async function streamToBuffer(stream) {
  let buffer = Buffer.alloc(0)
  for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
  return buffer
}

function getQuotedMessage(msg) {
  return msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage || null
}

function buildUsage(prefix = ".") {
  return (
    `-┊ *Uso correcto del comando:*\n` +
    `Responde a una imagen/video con "${prefix}s" para convertirlo en sticker\n\n` +
    `ᴇᴊᴇᴍᴘʟᴏ: ʀᴇꜱᴘᴏɴᴅᴇ ᴀ ᴜɴᴀ ꜰᴏᴛᴏ ᴄᴏɴ ${prefix}s\n\n` +
    `⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n` +
    `> ⟣ 𝗢𝘄𝗻𝗲𝗿: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`
  )
}

export default async function sticker(sock, msg, { usedPrefix = "." }) {
  try {
    const chatId = msg?.key?.remoteJid
    if (!chatId) return

    const senderJid = msg?.key?.participant || msg?.participant || msg?.key?.remoteJid
    const senderClean = jidToNumber(senderJid)

    // 🔒 Grupo restringido: solo admins + autorizados
    if (chatId === GRUPO_RESTRINGIDO) {
      const metadata = await sock.groupMetadata(chatId)
      const participante = metadata.participants.find(
        (p) => jidToNumber(p.id) === senderClean
      )

      const isAdmin =
        participante?.admin === "admin" || participante?.admin === "superadmin"

      if (!isAdmin) {
        await sock.sendMessage(chatId, {
          text: "⛔ Solo administradores pueden usar este comando en este grupo."
        }, { quoted: msg })
        return
      }

      if (!ADMINS_CONFIANZA_LID.includes(String(senderClean))) {
        await sock.sendMessage(chatId, {
          text: "⛔ En este grupo solo administradores autorizados pueden usar este comando."
        }, { quoted: msg })
        return
      }
    }

    // ✅ quoted
    const quoted = getQuotedMessage(msg)
    if (!quoted) {
      await sock.sendMessage(chatId, { text: buildUsage(usedPrefix) }, { quoted: msg })
      return
    }

    const mediaType = quoted.imageMessage
      ? "image"
      : quoted.videoMessage
      ? "video"
      : null

    if (!mediaType) {
      await sock.sendMessage(chatId, {
        text: "⚠️ *Solo puedes convertir imágenes o videos en stickers.*"
      }, { quoted: msg })
      return
    }

    // reacción creando
    try { await sock.sendMessage(chatId, { react: { text: "🛠️", key: msg.key } }) } catch {}

    const senderName = msg?.pushName || "Usuario Desconocido"

    const now = new Date()
    const dd = String(now.getDate()).padStart(2, "0")
    const mm = String(now.getMonth() + 1).padStart(2, "0")
    const yyyy = now.getFullYear()
    const hh = String(now.getHours()).padStart(2, "0")
    const min = String(now.getMinutes()).padStart(2, "0")

    const fechaCreacion = `📅 Fecha de Creación de Stickerz: ${dd}/${mm}/${yyyy} 🕒 ${hh}:${min}`

    const node = mediaType === "image" ? quoted.imageMessage : quoted.videoMessage
    const stream = await downloadContentFromMessage(node, mediaType)
    const buffer = await streamToBuffer(stream)

    if (!buffer || buffer.length === 0) throw new Error("No se pudo descargar el archivo")

    const metadata = {
      packname: `╰► ${senderName} `,
      author: `частная sistema - 𝔍𝔬𝔰𝔢 ℭ\n${fechaCreacion}`
    }

    const stickerPath =
      mediaType === "image"
        ? await writeExifImg(buffer, metadata)
        : await writeExifVid(buffer, metadata)

    await sock.sendMessage(chatId, { sticker: { url: stickerPath } }, { quoted: msg })

    // limpiar archivo exif generado
    try { fs.unlinkSync(stickerPath) } catch {}

    // reacción final
    try { await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }) } catch {}
  } catch (error) {
    console.error("❌ Error en el comando .s:", error)
    const chatId = msg?.key?.remoteJid
    if (chatId) {
      try {
        await sock.sendMessage(chatId, {
          text: "❌ *Hubo un error al procesar el sticker. Inténtalo de nuevo.*"
        }, { quoted: msg })
      } catch {}
    }
  }
}