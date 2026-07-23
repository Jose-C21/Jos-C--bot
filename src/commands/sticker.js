import fs from "fs"
import config from "../config.js"
import { jidToNumber } from "../utils/jid.js"
import { downloadContentFromMessage } from "baileys"
import { writeExifImg, writeExifVid } from "../utils/sticker-exif.js"

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
    `⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|𝘑𝘊𝘒𝘡𝘐𝘯𝘧𝘪𝘯𝘪𝘵𝘺𝘓𝘰𝘰𝘱\n` +
    `> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`
  )
}

export default async function sticker(sock, msg, { usedPrefix = "." }) {
  try {
    const chatId = msg?.key?.remoteJid
    if (!chatId) return

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

    const node = mediaType === "image" ? quoted.imageMessage : quoted.videoMessage
    const stream = await downloadContentFromMessage(node, mediaType)
    const buffer = await streamToBuffer(stream)

    if (!buffer || buffer.length === 0) throw new Error("No se pudo descargar el archivo")

    const metadata = {
      packname: `⟢ ${senderName} `,
      author: `𝘑𝘊𝘒𝘡𝘐𝘯𝘧𝘪𝘯𝘪𝘵𝘺𝘓𝘰𝘰𝘱 - 「 𝐽𝑜𝑠𝑒 𝐶 | 𝐾𝑎𝑡ℎ𝑦 」`
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
