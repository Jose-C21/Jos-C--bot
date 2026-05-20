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

    if (!chatId) {
      return false
    }

    // =========================
    // SOLO GRUPOS
    // =========================

    if (
      !String(chatId)
        .endsWith("@g.us")
    ) {

      return false
    }

    // =========================
    // SOLO IMÁGENES
    // =========================

    const imageMsg =
      msg?.message?.imageMessage

    if (!imageMsg) {

      return false
    }

    console.log(
      "IMAGEN DETECTADA"
    )

    // =========================
    // DESCARGAR IMAGEN
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
    // CREAR FORM DATA
    // =========================

    const form =
      new FormData()

    form.append(
      "file",
      fs.createReadStream(filePath)
    )

    // =========================
    // ENVIAR A API
    // =========================

    const response =
      await axios.post(

        "https://confused-flashcard-nineteen.ngrok-free.dev/detect",

        form,

        {
          headers:
            form.getHeaders(),

          maxBodyLength:
            Infinity,

          timeout:
            30000
        }
      )

    // =========================
    // BORRAR TEMP
    // =========================

    if (
      fs.existsSync(filePath)
    ) {

      fs.unlinkSync(filePath)
    }

    // =========================
    // RESULTADO
    // =========================

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

        // =========================
        // GENITALES
        // =========================

        if (

          x.class.includes(
            "GENITALIA"
          ) &&

          x.score > 0.45

        ) {

          console.log(
            "GENITALES DETECTADOS"
          )

          return true
        }

        // =========================
        // PECHOS EXPUESTOS
        // =========================

        if (

          x.class.includes(
            "BREAST_EXPOSED"
          ) &&

          x.score > 0.65

        ) {

          console.log(
            "PECHOS DETECTADOS"
          )

          return true
        }

        // =========================
        // ANO
        // =========================

        if (

          x.class.includes(
            "ANUS"
          ) &&

          x.score > 0.55

        ) {

          console.log(
            "ANO DETECTADO"
          )

          return true
        }

        // =========================
        // TRASERO EXPUESTO
        // =========================

        if (

          x.class.includes(
            "BUTTOCKS_EXPOSED"
          ) &&

          x.score > 0.60

        ) {

          console.log(
            "TRASERO DETECTADO"
          )

          return true
        }

        return false
      })

    console.log(
      "NSFW DETECTADO:",
      detected
    )

    // =========================
    // SI ES NORMAL
    // =========================

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

          id:
            msg.key.id,

          participant:
            msg.key.participant
        }
      }

    ).catch(err => {

      console.log(
        "ERROR BORRANDO:",
        err
      )
    })

    // =========================
    // EXPULSAR USUARIO
    // =========================

    const participant =

      msg?.key?.participant ||
      msg?.participant

    if (participant) {

      await sock.groupParticipantsUpdate(

        chatId,
        [participant],
        "remove"

      ).catch(err => {

        console.log(
          "ERROR EXPULSANDO:",
          err
        )
      })
    }

    // =========================
    // MENSAJE
    // =========================

    await sock.sendMessage(

      chatId,

      {
        text:
`> 🚫 Usuario expulsado automáticamente por enviar contenido NSFW.`
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
