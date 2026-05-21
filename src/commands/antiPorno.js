import fs from "fs"
import path from "path"

import axios from "axios"
import FormData from "form-data"
import sharp from "sharp"

import ffmpeg from "fluent-ffmpeg"

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
// UNWRAP MENSAJES
// =========================

function unwrapMessage(m) {

  let msgObj =
    m?.message || {}

  while (true) {

    if (
      msgObj?.ephemeralMessage?.message
    ) {

      msgObj =
        msgObj.ephemeralMessage.message

      continue
    }

    if (
      msgObj?.viewOnceMessageV2?.message
    ) {

      msgObj =
        msgObj.viewOnceMessageV2.message

      continue
    }

    if (
      msgObj?.viewOnceMessage?.message
    ) {

      msgObj =
        msgObj.viewOnceMessage.message

      continue
    }

    break
  }

  return msgObj
}

// =========================
// OBTENER STICKER
// =========================

function getStickerMessage(
  msg
) {

  const m =
    msg?.message || {}

  return (

    m?.stickerMessage ||

    m?.ephemeralMessage
      ?.message
      ?.stickerMessage ||

    m?.viewOnceMessageV2
      ?.message
      ?.stickerMessage ||

    m?.viewOnceMessage
      ?.message
      ?.stickerMessage ||

    m?.extendedTextMessage
      ?.contextInfo
      ?.quotedMessage
      ?.stickerMessage ||

    null
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
// NSFW CHECK
// =========================

function isNSFW(result = []) {

  return result.some(x => {

    if (
      x.class.includes(
        "GENITALIA"
      ) &&
      x.score > 0.45
    ) {

      return true
    }

    if (
      x.class.includes(
        "BREAST_EXPOSED"
      ) &&
      x.score > 0.65
    ) {

      return true
    }

    if (
      x.class.includes(
        "ANUS"
      ) &&
      x.score > 0.55
    ) {

      return true
    }

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
// API DETECT
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
// EXTRAER FRAMES
// =========================

async function extractFrames(
  inputFile,
  outputDir
) {

  return new Promise((
    resolve,
    reject
  ) => {

    if (
      !fs.existsSync(outputDir)
    ) {

      fs.mkdirSync(
        outputDir,
        { recursive: true }
      )
    }

    ffmpeg(inputFile)

      .outputOptions([
        "-vf fps=5"
      ])

      .output(
        path.join(
          outputDir,
          "frame-%03d.jpg"
        )
      )

      .on("end", () => {

        resolve(true)
      })

      .on("error", err => {

        reject(err)
      })

      .run()
  })
}

// =========================
// CLEAN FILE
// =========================

function safeDelete(
  file
) {

  try {

    if (
      fs.existsSync(file)
    ) {

      fs.unlinkSync(file)
    }

  } catch {}
}

// =========================
// CLEAN DIR
// =========================

function safeDeleteDir(
  dir
) {

  try {

    if (
      fs.existsSync(dir)
    ) {

      fs.rmSync(
        dir,
        {
          recursive: true,
          force: true
        }
      )
    }

  } catch {}
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

    // =========================
    // SOLO GRUPOS
    // =========================

    if (
      !chatId.endsWith("@g.us")
    ) {

      return false
    }

    // =========================
    // UNWRAP
    // =========================

    const mUnwrapped =
      unwrapMessage(msg)

    // =========================
    // MEDIA
    // =========================

    const imageMsg =
      mUnwrapped?.imageMessage

    const stickerMsg =
      getStickerMessage(msg)

    console.log(
      "UNWRAPPED KEYS:",
      Object.keys(
        mUnwrapped || {}
      )
    )

    console.log(
      "IMAGE FOUND:",
      !!imageMsg
    )

    console.log(
      "STICKER FOUND:",
      !!stickerMsg
    )

    // =========================
    // VALIDAR
    // =========================

    if (
      !imageMsg &&
      !stickerMsg
    ) {

      return false
    }

    console.log(
      "MEDIA DETECTADA"
    )

    let mediaBuffer

    // =========================
    // IMAGEN
    // =========================

    if (imageMsg) {

      console.log(
        "IMAGEN DETECTADA"
      )

      const imageFile =
        path.join(
          TEMP_DIR,
          `${Date.now()}.jpg`
        )

      mediaBuffer =
        await toBuffer(
          imageMsg,
          "image"
        )

      fs.writeFileSync(
        imageFile,
        mediaBuffer
      )

      const result =
        await detectFile(
          imageFile
        )

      console.log(
        "NSFW RESULT:",
        result
      )

      safeDelete(
        imageFile
      )

      const detected =
        isNSFW(result)

      if (!detected) {

        console.log(
          "IMAGEN NORMAL"
        )

        return false
      }
    }

    // =========================
    // STICKER
    // =========================

    if (stickerMsg) {

      console.log(
        "STICKER DETECTADO"
      )

      console.log(
        "ANIMATED:",
        stickerMsg?.isAnimated
      )

      mediaBuffer =
        await toBuffer(
          stickerMsg,
          "sticker"
        )

      const webpFile =
        path.join(
          TEMP_DIR,
          `${Date.now()}.webp`
        )

      fs.writeFileSync(
        webpFile,
        mediaBuffer
      )

      let detected =
        false

      // =========================
      // STICKER NORMAL
      // =========================

      if (
        !stickerMsg?.isAnimated
      ) {

        console.log(
          "STICKER NORMAL"
        )

        const jpgFile =
          path.join(
            TEMP_DIR,
            `${Date.now()}.jpg`
          )

        await sharp(webpFile)

          .jpeg()

          .toFile(jpgFile)

        const result =
          await detectFile(
            jpgFile
          )

        console.log(
          "SHARP RESULT:",
          result
        )

        safeDelete(
          jpgFile
        )

        if (
          isNSFW(result)
        ) {

          detected = true
        }
      }

      // =========================
      // STICKER ANIMADO
      // =========================

      else {

        console.log(
          "STICKER ANIMADO"
        )

        const framesDir =
          path.join(
            TEMP_DIR,
            `frames-${Date.now()}`
          )

        await extractFrames(
          webpFile,
          framesDir
        )

        const files =
          fs.readdirSync(
            framesDir
          )

        console.log(
          "FRAMES:",
          files.length
        )

        const selected =
          files.slice(0, 6)

        for (
          const frame of selected
        ) {

          const framePath =
            path.join(
              framesDir,
              frame
            )

          console.log(
            "ANALIZANDO:",
            frame
          )

          const result =
            await detectFile(
              framePath
            )

          console.log(
            "FRAME RESULT:",
            result
          )

          if (
            isNSFW(result)
          ) {

            console.log(
              "NSFW EN FRAME"
            )

            detected = true
            break
          }
        }

        safeDeleteDir(
          framesDir
        )
      }

      // =========================
      // LIMPIAR
      // =========================

      safeDelete(
        webpFile
      )

      // =========================
      // NO NSFW
      // =========================

      if (!detected) {

        console.log(
          "STICKER NORMAL"
        )

        return false
      }
    }

    console.log(
      "NSFW DETECTADO"
    )

    // =========================
    // BORRAR
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