import fs from "fs"
import path from "path"
import crypto from "crypto"
import axios from "axios"
import FormData from "form-data"
import { downloadContentFromMessage } from "baileys"

export default async function tourl(sock, msg) {
  try {
    const chatId = msg.key.remoteJid

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
          "💬 Responde a una imagen, video, audio o documento.\n\nEjemplo:\n.tourl"
      }, { quoted: msg })
      return
    }

    // 📥 Descargar archivo
    const stream = await downloadContentFromMessage(
      quoted[type],
      type.replace("Message", "")
    )

    let buffer = Buffer.from([])
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk])
    }

    // 📁 Guardar temporal
    const tempPath = path.join(process.cwd(), `temp_${Date.now()}`)
    await fs.promises.writeFile(tempPath, buffer)

    const sizeBytes = fs.statSync(tempPath).size

    const formatBytes = (bytes) => {
      if (bytes === 0) return "0 B"
      const sizes = ["B", "KB", "MB", "GB"]
      const i = Math.floor(Math.log(bytes) / Math.log(1024))
      return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i]
    }

    const humanSize = formatBytes(sizeBytes)

    if (sizeBytes > 1024 * 1024 * 1024) {
      await sock.sendMessage(chatId, {
        text: "⚠️ El archivo supera 1GB."
      }, { quoted: msg })

      await fs.promises.unlink(tempPath)
      return
    }

    // ⏳ Mensaje progreso
    const status = await sock.sendMessage(chatId, {
      text: "⏳ Subiendo..."
    }, { quoted: msg })

    // 📤 Subir a Catbox
    const bufferData = await fs.promises.readFile(tempPath)

    const form = new FormData()
    form.append("reqtype", "fileupload")
    form.append("fileToUpload", bufferData, {
      filename: crypto.randomBytes(5).toString("hex") + ".bin",
      contentType: "application/octet-stream"
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

    // ✅ Resultado
    const txt =
`☑️ Subida completada

❍ Enlace: ${link}
❍ Tamaño: ${humanSize}
❍ Expiración: Permanente`

    await sock.sendMessage(chatId, {
      edit: status.key,
      text: txt
    })

  } catch (error) {
    console.error("❌ tourl error:", error)

    await sock.sendMessage(msg.key.remoteJid, {
      text: "❌ Error al subir archivo."
    }, { quoted: msg })
  }
}
