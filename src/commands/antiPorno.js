import fs from "fs"
import path from "path"

import axios from "axios"
import FormData from "form-data"

import {
  downloadContentFromMessage
} from "baileys"

console.log("ANTI PORNO CARGADO")

// =========================
// CARPETA TEMP
// =========================

const TEMP_DIR =
  path.join(
    process.cwd(),
    "temp"
  )

if (!fs.existsSync(TEMP_DIR)) {

  fs.mkdirSync(
    TEMP_DIR,
    { recursive: true }
  )
}

// =========================
// DESCARGAR BUFFER
// =========================

async function toBuffer(
  mediaMsg,
  mediaType
) {

  const stream =
    await downloadContentFromMessage(
      mediaMsg,
      mediaType
    )

  let buffer =
    Buffer.alloc(0)

  for await (
    const chunk of stream
  ) {

    buffer = Buffer.concat([
      buffer,
      chunk
    ])
  }

  return buffer
}

// =========================
// DETECTOR PRINCIPAL
// =========================

export default async function antiPorno(
  sock,
  msg
) {

  try {

    const chatId =
      msg?.key?.remoteJid

    if (!chatId) return false

    // SOLO GRUPOS

    if (
      !String(chatId)
        .endsWith("@g.us")
    ) {
      return false
    }

    // SOLO IMÁGENES

    const imageMsg =
      msg?.message?.imageMessage

    if (!imageMsg) {
      return false
    }

    console.log(
      "IMAGEN DETECTADA"
    )

    // =========================
    // DESCARGAR
    // =========================

    const mediaBuffer =
      await toBuffer(
        imageMsg,
        "image"
      )

    if (!mediaBuffer?.length) {

      console.log(
        "NO SE PUDO DESCARGAR"
      )

      return false
    }

    // =========================
    // GUARDAR TEMP
    // =========================

    const filePath =
      path.join(
        TEMP_DIR,
        `${Date.now()}.jpg`
      )

    fs.writeFileSync(
      filePath,
      mediaBuffer
    )

    console.log(
      "IMAGEN GUARDADA:",
      filePath
    )

    // =========================
    // ENVIAR A API
    // =========================

    const form =
      new FormData()

    form.append(
      "file",
      fs.createReadStream(filePath)
    )

    const response =
      await axios.post(

        "http://127.0.0.1:5000/detect",

        form,

        {
          headers:
            form.getHeaders()
        }
      )

    // =========================
    // LIMPIAR
    // =========================

    if (
      fs.existsSync(filePath)
    ) {

      fs.unlinkSync(filePath)
    }

    const result =
      response.data?.result || []

    console.log(
      "NSFW RESULT:",
      result
    )

    // =========================
    // DETECCIÓN
    // =========================

    const detected =
      result.some(x => {

        // GENITALES

        if (

          x.class.includes(
            "GENITALIA"
          ) &&

          x.score > 0.45

        ) {

          return true
        }

        // PECHOS

        if (

          x.class.includes(
            "BREAST"
          ) &&

          x.score > 0.65

        ) {

          return true
        }

        // ANO / TRASERO

        if (

          x.class.includes("ANUS") ||

          x.class.includes(
            "BUTTOCKS"
          )

        ) {

          if (x.score > 0.55) {
            return true
          }
        }

        return false
      })

    console.log(
      "NSFW DETECTADO:",
      detected
    )

    if (!detected) {

      console.log(
        "IMAGEN NORMAL"
      )

      return false
    }

    // =========================
    // BORRAR MENSAJE
    // =========================

    await sock.sendMessage(

      chatId,

      {
        delete: {
          remoteJid:
            chatId,

          fromMe: false,

          id: msg.key.id,

          participant:
            msg.key.participant
        }
      }

    ).catch(() => {})

    // =========================
    // EXPULSAR
    // =========================

    const participant =

      msg?.key?.participant ||
      msg?.participant

    if (participant) {

      await sock.groupParticipantsUpdate(

        chatId,
        [participant],
        "remove"

      ).catch(() => {})
    }

    // =========================
    // AVISO
    // =========================

    await sock.sendMessage(

      chatId,

      {
        text:
`🚫 Usuario expulsado automáticamente por enviar contenido NSFW.`
      }

    ).catch(() => {})

    return true

  } catch (e) {

    console.log(
      "ERROR ANTIPORNO:",
      e
    )

    return false
  }
}
