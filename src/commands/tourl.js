import fs from "fs"
import crypto from "crypto"
import axios from "axios"
import FormData from "form-data"
import fileType from "file-type"
import { downloadContentFromMessage } from "baileys"

export default async function tourl(sock, msg) {
  try {
    const chatId = msg.key.remoteJid

    // reacción
    await sock.sendMessage(chatId, {
      react: { text: "☁️", key: msg.key }
    })

    const quoted =
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
      msg.message

    const type = Object.keys(quoted || {})[0]

    if (!type || !/image|video|audio|sticker|document/i.test(type)) {
      await sock.sendMessage(chatId, {
        text:
`💬 *Responde a una imagen, video, audio o documento para subirlo a Catbox.*

Ejemplo:
.tourl`
      }, { quoted: msg })
      return
    }

    // descargar
    const stream = await downloadContentFromMessage(
      quoted[type],
      type.split("M")[0]
    )

    let buffer = Buffer.from([])
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk])
    }

    // guardar temporal
    const tempPath = `./temp_${Date.now()}`
    await fs.promises.writeFile(tempPath, buffer)

    // tamaño
    const sizeBytes = fs.statSync(tempPath).size

    const formatBytes = (bytes) => {
      if (bytes === 0) return "0 B"
      const sizes = ["B", "KB", "MB", "GB"]
      const i = Math.floor(Math.log(bytes) / Math.log(1024))
      return `${(bytes / 1024 ** i).toFixed(2)} ${sizes[i]}`
    }

    const humanSize = formatBytes(sizeBytes)

    if (sizeBytes > 1024 * 1024 * 1024) {
      await sock.sendMessage(chatId, {
        text: "⚠️ *El archivo supera 1GB.*"
      }, { quoted: msg })

      await fs.promises.unlink(tempPath)
      return
    }

    // progreso fake
    const estados = [
      "⏳ Subiendo a Catbox...",
      "▰▱▱▱▱▱▱▱ 10%",
      "▰▰▱▱▱▱▱▱ 25%",
      "▰▰▰▰▱▱▱▱ 50%",
      "▰▰▰▰▰▰▱▱ 75%",
      "✅ Casi listo..."
    ]

    const status = await sock.sendMessage(chatId, {
      text: estados[0]
    }, { quoted: msg })

    for (let i = 1; i < estados.length; i++) {
      await new Promise(r => setTimeout(r, 700))
      await sock.sendMessage(chatId, {
        edit: status.key,
        text: estados[i]
      })
    }

    // subir
    const bufferData = await fs.promises.readFile(tempPath)

    const fileInfo = await fileType.fromBuffer(bufferData)
    const ext = fileInfo?.ext || "bin"
    const mime = fileInfo?.mime || "application/octet-stream"

    const random = crypto.randomBytes(5).toString("hex")

    const form = new FormData()
    form.append("reqtype", "fileupload")
    form.append("fileToUpload", bufferData, {
      filename: `${random}.${ext}`,
      contentType: mime
    })

    const res = await axios.post(
      "https://catbox.moe/user/api.php",
      form,
      {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    )

    const link = res.data

    await fs.promises.unlink(tempPath)

    // mensaje final
    const text =
`*☑️ Subida completada ☑️*

*乂 CATBOX UPLOAD 乂*

❍ Enlace: ${link}
❍ Tamaño: ${humanSize}
❍ Expiración: Permanente

> ⊱┊*Jose Bot*`

    await sock.sendMessage(chatId, {
      edit: status.key,
      text: text.trim()
    })

  } catch (err) {
    console.error("[tourl]", err)

    await sock.sendMessage(msg.key.remoteJid, {
      text:
`❌ *Error al subir el archivo.*

Intenta nuevamente.`
    }, { quoted: msg })
  }
}
