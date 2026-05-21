import fs from "fs"
import path from "path"

import axios from "axios"
import FormData from "form-data"
import sharp from "sharp"

import {
  downloadContentFromMessage
} from "baileys"

console.log("ANTI PORNO CARGADO")

// =========================
// TEMP
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
// BUFFER
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
// ANALIZAR RESULTADO
// =========================

function isNSFW(result = []) {

  return result.some(x => {

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
        "BREAST_EXPOSED"
      ) &&

      x.score > 0.65

    ) {

      return true
    }

    // ANO

    if (

      x.class.includes(
        "ANUS"
      ) &&

      x.score > 0.55

    ) {

      return true
    }

    // TRASERO

    if (

      x.class.includes(
        "BUTTOCKS_EXPOSED"
      ) &&

      x.score > 0.60

    ) {

      return true
    }

    return false
  })
}

// =========================
// API NSFW
// =========================

async function detectFile(
  filePath
) {

  const form =
    new FormData()

  form.append(
    "file",
    fs.createReadStream(filePath)
  )

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

  return (
    response.data?.result || []
  )
}

// =========================
// MAIN
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

    // SOLO GRUPOS

    if (
      !chatId.endsWith("@g.us")
    ) {

      return false
    }

    // =========================
    // DETECTAR TIPO
    // =========================

    const imageMsg =
      msg?.message?.imageMessage

    const stickerMsg =
      msg?.message?.stickerMessage

    if (
      !imageMsg &&
      !stickerMsg
    ) {

      return false
    }

    console.log(
      "MEDIA DETECTADA"
    )

    // =========================
    // DESCARGAR
    // =========================

    let mediaBuffer
    let tempInput
    let finalImage

    // =========================
    // IMAGEN
    // =========================

    if (imageMsg) {

      mediaBuffer =
        await toBuffer(
          imageMsg,
          "image"
        )

      finalImage =
        path.join(
          TEMP_DIR,
          `${Date.now()}.jpg`
        )

      fs.writeFileSync(
        finalImage,
        mediaBuffer
      )
    }

    // =========================
    // STICKER
    // =========================

    if (stickerMsg) {

      mediaBuffer =
        await toBuffer(
          stickerMsg,
          "sticker"
        )

      tempInput =
        path.join(
          TEMP_DIR,
          `${Date.now()}.webp`
        )

      finalImage =
        path.join(
          TEMP_DIR,
          `${Date.now()}.jpg`
        )

      fs.writeFileSync(
        tempInput,
        mediaBuffer
      )

      // WEBP -> JPG

      await sharp(tempInput)

        .jpeg()

        .toFile(finalImage)

      // BORRAR WEBP

      if (
        fs.existsSync(tempInput)
      ) {

        fs.unlinkSync(
          tempInput
        )
      }
    }

    // =========================
    // ANALIZAR
    // =========================

    const result =
      await detectFile(
        finalImage
      )

    console.log(
      "NSFW RESULT:",
      result
    )

    // =========================
    // LIMPIAR
    // =========================

    if (
      fs.existsSync(finalImage)
    ) {

      fs.unlinkSync(
        finalImage
      )
    }

    // =========================
    // DETECTAR
    // =========================

    const detected =
      isNSFW(result)

    console.log(
      "NSFW:",
      detected
    )

    if (!detected) {

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
`> 🚫 Usuario expulsado automáticamente por enviar contenido NSFW.`
      }

    ).catch(() => {})

    return true

  } catch (e) {

    console.log(
      "ERROR NSFW:",
      e
    )

    return false
  }
}