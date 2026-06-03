import fs from "fs"
import path from "path"
import ffmpeg from "fluent-ffmpeg"
import { downloadContentFromMessage } from "baileys"

function getQuotedMessage(msg) {
  return msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage || null
}

async function streamToBuffer(stream) {
  let buffer = Buffer.alloc(0)
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk])
  }
  return buffer
}

export default async function stickertovideo(sock, msg) {
  try {
    const chatId = msg.key.remoteJid
    const quoted = getQuotedMessage(msg)

    if (!quoted?.stickerMessage) {
      return await sock.sendMessage(chatId, {
        text: "⚠️ Responde a un sticker animado con *.mp4*"
      }, { quoted: msg })
    }

    await sock.sendMessage(chatId, {
      react: { text: "🎬", key: msg.key }
    })

    const stream = await downloadContentFromMessage(
      quoted.stickerMessage,
      "sticker"
    )

    const buffer = await streamToBuffer(stream)

    const tempId = Date.now()

    const webpPath = path.join(process.cwd(), `sticker_${tempId}.webp`)
    const mp4Path = path.join(process.cwd(), `video_${tempId}.mp4`)

    fs.writeFileSync(webpPath, buffer)

    await new Promise((resolve, reject) => {
      ffmpeg(webpPath)
        .outputOptions([
          "-movflags faststart",
          "-pix_fmt yuv420p"
        ])
        .save(mp4Path)
        .on("end", resolve)
        .on("error", reject)
    })

    await sock.sendMessage(chatId, {
      video: fs.readFileSync(mp4Path),
      gifPlayback: true,
      mimetype: "video/mp4"
    }, { quoted: msg })

    try { fs.unlinkSync(webpPath) } catch {}
    try { fs.unlinkSync(mp4Path) } catch {}

    await sock.sendMessage(chatId, {
      react: { text: "✅", key: msg.key }
    })

  } catch (e) {
    console.error("stickertovideo:", e)

    await sock.sendMessage(msg.key.remoteJid, {
      text: "❌ Error al convertir el sticker."
    }, { quoted: msg })
  }
}
