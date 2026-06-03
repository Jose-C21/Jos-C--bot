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
      return await sock.sendMessage(
        chatId,
        {
          text: "⚠️ Responde a un sticker animado con *.mp4*"
        },
        { quoted: msg }
      )
    }

    await sock.sendMessage(chatId, {
      react: {
        text: "🎬",
        key: msg.key
      }
    })

    console.log("\n========== STICKER INFO ==========")
    console.log(
      JSON.stringify(
        quoted.stickerMessage,
        null,
        2
      )
    )

    const stream =
      await downloadContentFromMessage(
        quoted.stickerMessage,
        "sticker"
      )

    const buffer =
      await streamToBuffer(stream)

    console.log(
      "[MP4] BUFFER SIZE:",
      buffer.length
    )

    console.log(
      "[MP4] HEADER:",
      buffer.slice(0, 20)
    )

    if (!buffer || buffer.length < 1000) {
      throw new Error(
        `Buffer inválido (${buffer.length} bytes)`
      )
    }

    const tempId = Date.now()

    const webpPath = path.join(
      process.cwd(),
      `sticker_${tempId}.webp`
    )

    const mp4Path = path.join(
      process.cwd(),
      `video_${tempId}.mp4`
    )

    fs.writeFileSync(
      webpPath,
      buffer
    )

    console.log(
      "[MP4] WEBP SAVED:",
      webpPath
    )

    await new Promise(
      (resolve, reject) => {

        ffmpeg()
          .input(webpPath)
          .inputFormat("webp")
          .outputOptions([
            "-vf",
            "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "faststart"
          ])
          .save(mp4Path)
          .on("start", cmd => {
            console.log(
              "[FFMPEG CMD]",
              cmd
            )
          })
          .on("end", () => {
            console.log(
              "[FFMPEG] CONVERSION OK"
            )
            resolve()
          })
          .on("error", err => {
            console.log(
              "[FFMPEG ERROR]",
              err
            )
            reject(err)
          })
      }
    )

    const videoBuffer =
      fs.readFileSync(mp4Path)

    console.log(
      "[MP4] VIDEO SIZE:",
      videoBuffer.length
    )

    await sock.sendMessage(
      chatId,
      {
        video: videoBuffer,
        mimetype: "video/mp4",
        gifPlayback: true
      },
      { quoted: msg }
    )

    try {
      fs.unlinkSync(webpPath)
    } catch {}

    try {
      fs.unlinkSync(mp4Path)
    } catch {}

    await sock.sendMessage(chatId, {
      react: {
        text: "✅",
        key: msg.key
      }
    })

  } catch (e) {

    console.error(
      "\n[STICKER TO VIDEO ERROR]\n",
      e
    )

    await sock.sendMessage(
      msg.key.remoteJid,
      {
        text:
          "❌ Error al convertir el sticker.\n\nRevisa la consola para más detalles."
      },
      { quoted: msg }
    )
  }
}