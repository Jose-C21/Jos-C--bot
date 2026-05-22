import fs from "fs"
import path from "path"

import axios from "axios"
import FormData from "form-data"
import sharp from "sharp"

import {
  downloadContentFromMessage
} from "baileys"

import config from "../config.js"
import { jidToNumber } from "../utils/jid.js"

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
    {
      recursive: true
    }
  )
}

// =========================
// LIMITS
// =========================

const MAX_STICKER_SIZE =
  15 * 1024 * 1024

// =========================
// OWNER CHECK
// =========================

function isOwnerNumber(num) {

  const owners =
    (config.owners || [])
      .map(String)

  const ownersLid =
    (config.ownersLid || [])
      .map(String)

  const s =
    String(num)

  return (
    owners.includes(s) ||
    ownersLid.includes(s)
  )
}

// =========================
// GET STICKER
// =========================

function getStickerMessage(msg) {

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

    m?.viewOnceMessageV2Extension
      ?.message
      ?.stickerMessage ||

    m?.viewOnceMessage
      ?.message
      ?.stickerMessage ||

    null
  )
}

// =========================
// GET IMAGE
// =========================

function getImageMessage(msg) {

  const m =
    msg?.message || {}

  return (

    m?.imageMessage ||

    m?.ephemeralMessage
      ?.message
      ?.imageMessage ||

    m?.viewOnceMessageV2
      ?.message
      ?.imageMessage ||

    m?.viewOnceMessageV2Extension
      ?.message
      ?.imageMessage ||

    m?.viewOnceMessage
      ?.message
      ?.imageMessage ||

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

    buffer =
      Buffer.concat([
        buffer,
        chunk
      ])
  }

  return buffer
}

// =========================
// API DETECT
// =========================

async function detectFile(filePath) {

  try {

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
            15000
        }
      )

    if (
      typeof response.data !== "object"
    ) {

      return {
        nsfw: false,
        nudenet: [],
        open_nsfw_score: 0
      }
    }

    return response.data

  } catch (e) {

    console.log(
      "ERROR API:",
      e?.message || e
    )

    return {
      nsfw: false,
      nudenet: [],
      open_nsfw_score: 0
    }
  }
}

// =========================
// DELETE
// =========================

function safeDelete(file) {

  try {

    if (
      fs.existsSync(file)
    ) {

      fs.unlinkSync(file)
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

    const imageMsg =
      getImageMessage(msg)

    const stickerMsg =
      getStickerMessage(msg)

    console.log(
      "[MEDIA CHECK]",
      {
        hasSticker:
          !!stickerMsg,

        hasImage:
          !!imageMsg
      }
    )

    if (
      !imageMsg &&
      !stickerMsg
    ) {

      return false
    }

    let detected =
      false

    // =========================
    // IMAGE
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

      try {

        const mediaBuffer =
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
          "IMAGE RESULT:",
          result
        )

        if (
          result?.nsfw === true
        ) {

          console.log(
            "NSFW IMAGE"
          )

          detected = true
        }

      } catch (e) {

        console.log(
          "ERROR IMAGE:",
          e
        )

      } finally {

        safeDelete(
          imageFile
        )
      }
    }

    // =========================
    // STICKER
    // =========================

    if (
      stickerMsg &&
      !detected
    ) {

      console.log(
        "STICKER DETECTADO"
      )

      console.log(
        "ANIMATED:",
        stickerMsg?.isAnimated
      )

      const mediaBuffer =
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

      // =========================
      // SIZE CHECK
      // =========================

      const stats =
        fs.statSync(
          webpFile
        )

      if (
        stats.size >
        MAX_STICKER_SIZE
      ) {

        console.log(
          "STICKER MUY PESADO"
        )

        safeDelete(
          webpFile
        )

        return false
      }

      try {

        const meta =
          await sharp(
            webpFile,
            {
              animated: true,
              limitInputPixels: false
            }
          ).metadata()

        const pages =
          meta.pages || 1

        console.log(
          "TOTAL FRAMES:",
          pages
        )

        // =========================
        // FRAMES IMPORTANTES
        // =========================

        const uniqueFrames = [
          0,
          Math.floor(pages / 2),
          pages - 1
        ]

        console.log(
          "FRAMES IMPORTANTES:",
          uniqueFrames
        )

        // =========================
        // ANALIZAR FRAMES
        // =========================

        for (
          const realFrame of uniqueFrames
        ) {

          const frameFile =
            path.join(
              TEMP_DIR,
              `frame-${Date.now()}-${realFrame}.jpg`
            )

          try {

            await sharp(
              webpFile,
              {
                animated: true,
                page: realFrame,
                limitInputPixels: false,
                sequentialRead: true
              }
            )

              .resize({
                width: 448,
                height: 448,
                fit: "inside",
                withoutEnlargement: true
              })

              .jpeg({
                quality: 82
              })

              .toFile(frameFile)

          } catch (e) {

            console.log(
              "ERROR FRAME:",
              e
            )

            continue
          }

          let result = null

          try {

            result =
              await detectFile(
                frameFile
              )

          } catch (e) {

            console.log(
              "ERROR API FRAME:",
              e
            )

            safeDelete(
              frameFile
            )

            continue
          }

          console.log(
            `FRAME ${realFrame}:`,
            result
          )

          safeDelete(
            frameFile
          )

          if (
            result?.nsfw === true
          ) {

            console.log(
              "NSFW DETECTADO EN FRAME:",
              realFrame
            )

            detected = true
            break
          }
        }

      } catch (e) {

        console.log(
          "ERROR STICKER:",
          e
        )
      }

      safeDelete(
        webpFile
      )
    }

    // =========================
    // CLEAN
    // =========================

    if (!detected) {

      console.log(
        "MEDIA LIMPIA"
      )

      return false
    }

    console.log(
      "NSFW DETECTADO"
    )

    // =========================
    // DELETE MESSAGE
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
    // REMOVE USER
    // =========================

    const participant =

      msg?.key?.participant ||
      msg?.participant

    if (participant) {

      let decoded =
        participant

      try {

        if (sock?.decodeJid) {

          decoded =
            sock.decodeJid(
              participant
            )
        }

      } catch {}

      const participantNum =
        jidToNumber(decoded) ||
        jidToNumber(participant)

      // =========================
      // OWNER PROTECTION
      // =========================

      if (
        isOwnerNumber(
          participantNum
        )
      ) {

        console.log(
          "OWNER DETECTADO - NO ELIMINADO"
        )

      } else {

        await sock.groupParticipantsUpdate(

          chatId,
          [participant],
          "remove"

        ).catch(() => {})

        console.log(
          "USUARIO ELIMINADO"
        )
      }
    }

    // =========================
    // ALERT
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