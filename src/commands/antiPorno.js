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
// UNWRAP
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
      msgObj?.viewOnceMessageV2Extension?.message
    ) {

      msgObj =
        msgObj.viewOnceMessageV2Extension.message

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

    buffer = Buffer.concat([
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
          60000
      }
    )

  return (
    response.data || {}
  )
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

    if (
      !chatId.endsWith("@g.us")
    ) {

      return false
    }

    const mUnwrapped =
      unwrapMessage(msg)

    const imageMsg =
      getImageMessage(msg)

    const stickerMsg =
      getStickerMessage(msg)

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
        "API RESULT:",
        result
      )

      safeDelete(
        imageFile
      )

      if (
        result?.nsfw === true
      ) {

        detected = true
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

      try {

        const img =
          sharp(
            webpFile,
            {
              animated: true
            }
          )

        const meta =
          await img.metadata()

        const totalFrames =
          Math.min(
            meta.pages || 1,
            12
          )

        console.log(
          "TOTAL FRAMES:",
          totalFrames
        )

        for (
          let i = 0;
          i < totalFrames;
          i++
        ) {

          const frameFile =
            path.join(
              TEMP_DIR,
              `frame-${Date.now()}-${i}.jpg`
            )

          await sharp(
            webpFile,
            {
              animated: true,
              page: i
            }
          )

            .flatten({
              background: "#ffffff"
            })

            .resize({
              width: 1400
            })

            .jpeg({
              quality: 100
            })

            .toFile(frameFile)

          const result =
            await detectFile(
              frameFile
            )

          console.log(
            "FRAME:",
            i,
            result
          )

          safeDelete(
            frameFile
          )

          // ✅ NUEVA LÓGICA
          if (
            result?.nsfw === true
          ) {

            console.log(
              "NSFW DETECTADO EN FRAME:",
              i
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
    // DELETE MSG
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

      // ✅ PROTEGER SOLO OWNERS
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
