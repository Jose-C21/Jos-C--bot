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

// =========================
// ACTIVOS
// =========================

const DATA_DIR =
  path.join(
    process.cwd(),
    "data"
  )

const ACTIVOS_PATH =
  path.join(
    DATA_DIR,
    "activos.json"
  )

function readActivosSafe() {

  try {

    if (!fs.existsSync(DATA_DIR)) {

      fs.mkdirSync(
        DATA_DIR,
        {
          recursive: true
        }
      )
    }

    if (!fs.existsSync(ACTIVOS_PATH)) {

      fs.writeFileSync(

        ACTIVOS_PATH,

        JSON.stringify({

          antiporno: {}

        }, null, 2)

      )
    }

    const j =
      JSON.parse(

        fs.readFileSync(
          ACTIVOS_PATH,
          "utf8"
        ) || "{}"

      )

    if (!j.antiporno) {

      j.antiporno = {}
    }

    return j

  } catch {

    return {

      antiporno: {}

    }
  }
}

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
// REVIEW OWNER
// =========================

const REVIEW_OWNER =
  "111651969888394@lid"

const REVIEW_TAG =
  `@${jidToNumber(REVIEW_OWNER)}`

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
// UNWRAP MESSAGE
// =========================

function unwrapMessage(msg) {

  let m =
    msg?.message || {}

  while (true) {

    if (
      m?.ephemeralMessage?.message
    ) {

      m =
        m.ephemeralMessage.message

      continue
    }

    if (
      m?.viewOnceMessage?.message
    ) {

      m =
        m.viewOnceMessage.message

      continue
    }

    if (
      m?.viewOnceMessageV2?.message
    ) {

      m =
        m.viewOnceMessageV2.message

      continue
    }

    if (
      m?.viewOnceMessageV2Extension?.message
    ) {

      m =
        m.viewOnceMessageV2Extension.message

      continue
    }

    break
  }

  return m
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

    const fromMe =
      !!msg?.key?.fromMe

    if (fromMe) {
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
    // ACTIVADO SOLO EN
    // GRUPOS ESPECÍFICOS
    // =========================

    const activos =
      readActivosSafe()

    const antipornoActivo =

      activos?.antiporno?.[chatId] === true

    if (!antipornoActivo) {

      return false
    }

    // =========================
    // UNWRAP
    // =========================

    const cleanMsg =
      unwrapMessage(msg)

    // =========================
    // FALLBACKS
    // =========================

    const imageMsg =

      cleanMsg?.imageMessage ||

      msg?.message?.imageMessage ||

      null

    const stickerMsg =

      cleanMsg?.stickerMessage ||

      msg?.message?.stickerMessage ||

      null

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

    let imageBuffer =
      null

    let detectedType =
      "Desconocido"

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

        imageBuffer =
          mediaBuffer

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

        const openScore =
          Number(
            result?.open_nsfw_score || 0
          )

        const nudenet =
          Array.isArray(result?.nudenet)
            ? result.nudenet
            : []

        const hasMaleGenitalia =
          nudenet.some(x => {

            const cls =
              String(
                x?.class || ""
              ).toUpperCase()

            const score =
              Number(
                x?.score || 0
              )

            return (
              cls ===
                "MALE_GENITALIA_EXPOSED"
              &&
              score >= 0.45
            )
          })

        const hasFemaleGenitalia =
          nudenet.some(x => {

            const cls =
              String(
                x?.class || ""
              ).toUpperCase()

            const score =
              Number(
                x?.score || 0
              )

            return (
              cls ===
                "FEMALE_GENITALIA_EXPOSED"
              &&
              score >= 0.45
            )
          })

        const hasBreastExposed =
          nudenet.some(x => {

            const cls =
              String(
                x?.class || ""
              ).toUpperCase()

            const score =
              Number(
                x?.score || 0
              )

            return (
              cls ===
                "FEMALE_BREAST_EXPOSED"
              &&
              score >= 0.70
            )
          })

        if (

          hasMaleGenitalia ||

          hasFemaleGenitalia ||

          hasBreastExposed ||

          (
            result?.nsfw === true &&
            openScore >= 0.98
          )

        ) {

          console.log(
            "NSFW IMAGE"
          )

          detected = true
          detectedType = "Imagen"

        } else {

          console.log(
            "IMAGEN NORMAL"
          )
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

      imageBuffer =
        mediaBuffer

      const webpFile =
        path.join(
          TEMP_DIR,
          `${Date.now()}.webp`
        )

      fs.writeFileSync(
        webpFile,
        mediaBuffer
      )

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

        let uniqueFrames = []

        if (pages <= 3) {

          uniqueFrames =
            [0]

        } else {

          uniqueFrames =
            [...new Set([

              0,

              Math.floor(
                pages * 0.25
              ),

              Math.floor(
                pages * 0.50
              ),

              Math.floor(
                pages * 0.75
              ),

              pages - 1

            ])]
        }

        console.log(
          "FRAMES IMPORTANTES:",
          uniqueFrames
        )

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

              .toFile(
                frameFile
              )

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

          const openScore =
            Number(
              result?.open_nsfw_score || 0
            )

          const nudenet =
            result?.nudenet || []

          console.log(
            "FRAME SCORE:",
            openScore
          )

          const hasStrongGenitalia =
            nudenet.some(x => {

              const cls =
                String(
                  x?.class || ""
                ).toUpperCase()

              const score =
                Number(
                  x?.score || 0
                )

              return (

                (
                  cls.includes(
                    "GENITALIA_EXPOSED"
                  ) ||

                  cls.includes(
                    "MALE_GENITALIA_EXPOSED"
                  ) ||

                  cls.includes(
                    "FEMALE_GENITALIA_EXPOSED"
                  ) ||

                  cls.includes(
                    "ANUS_EXPOSED"
                  )
                )

                &&

                score >= 0.45
              )
            })

          const hasBreast =
            nudenet.some(x => {

              const cls =
                String(
                  x?.class || ""
                ).toUpperCase()

              const score =
                Number(
                  x?.score || 0
                )

              return (

                cls.includes(
                  "BREAST_EXPOSED"
                )

                &&

                score >= 0.80
              )
            })

          const hasButtocks =
            nudenet.some(x => {

              const cls =
                String(
                  x?.class || ""
                ).toUpperCase()

              const score =
                Number(
                  x?.score || 0
                )

              return (

                cls.includes(
                  "BUTTOCKS_EXPOSED"
                )

                &&

                score >= 0.55
              )
            })

          const isLastFrame =

            realFrame ===
            pages - 1

          const lastFramePorn =

            isLastFrame &&

            result?.nsfw === true &&

            openScore >= 0.80

          if (

            hasStrongGenitalia ||

            (
              openScore >= 0.985
            ) ||

            (
              openScore >= 0.90 &&
              result?.nsfw === true
            ) ||

            (
              hasBreast &&
              openScore >= 0.55
            ) ||

            (
              hasButtocks &&
              openScore >= 0.88
            ) ||

            (
              lastFramePorn &&

              (

                hasButtocks ||

                hasBreast ||

                hasStrongGenitalia ||

                openScore >= 0.92

              )
            )

          ) {

            console.log(
              "NSFW DETECTADO EN FRAME:",
              realFrame
            )

            detected = true
            detectedType = "Sticker"
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

    if (!detected) {

      console.log(
        "MEDIA LIMPIA"
      )

      return false
    }

    console.log(
      "NSFW DETECTADO"
    )

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

    const participant =

      msg?.key?.participant ||
      msg?.participant

    let participantNum =
      "Desconocido"

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

      participantNum =
        jidToNumber(decoded) ||
        jidToNumber(participant)

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
// MENTION REAL
// =========================

const decodedParticipant =
  participant && sock?.decodeJid
    ? sock.decodeJid(participant)
    : participant

const mentionJid =
  decodedParticipant || participant

const mentionNumber =
  jidToNumber(mentionJid || "")

const userTag =
  mentionNumber
    ? `@${mentionNumber}`
    : "Usuario"
    
    // =========================
// EVIDENCIA PRIVADA
// =========================

try {

  if (
    imageBuffer
  ) {

    const groupMetadata =
      await sock.groupMetadata(
        chatId
      ).catch(() => null)

    const groupName =
      groupMetadata?.subject ||
      "Grupo desconocido"

    

    // =========================
// CAPTION
// =========================

const caption =
`🚫 ANTI-PORNO

👤 Usuario:
${userTag}

🏷️ Grupo:
${groupName}

📂 Tipo:
${detectedType}

⚠️ Detectado como NSFW para revisión de falsos positivos.`

// =========================
// IMAGEN
// =========================

if (
  detectedType === "Imagen"
) {

  // TEXTO ARRIBA

  await sock.sendMessage(

    REVIEW_OWNER,

    {
      text:
        caption,

      mentions: [

        ...(mentionJid
          ? [mentionJid]
          : []),

        REVIEW_OWNER
      ]
    }

  ).catch(() => {})

  // IMAGEN ABAJO

  await sock.sendMessage(

    REVIEW_OWNER,

    {
      image:
        imageBuffer
    }

  ).catch(() => {})
}

// =========================
// STICKER
// =========================

if (
  detectedType === "Sticker"
) {

  // TEXTO ARRIBA

  await sock.sendMessage(

    REVIEW_OWNER,

    {
      text:
        caption,

      mentions: [

        ...(mentionJid
          ? [mentionJid]
          : []),

        REVIEW_OWNER
      ]
    }

  ).catch(() => {})

  // STICKER ABAJO

  await sock.sendMessage(

    REVIEW_OWNER,

    {
      sticker:
        imageBuffer
    }

  ).catch(() => {})

}

// ← cierra if (imageBuffer)
}

// ← cierra try
catch (e) {

  console.log(
    "ERROR REVIEW:",
    e
  )
}

await sock.sendMessage(

      chatId,

      {
        text:
`╭━🚫 𝗔𝗡𝗧𝗜-𝗣𝗢𝗥𝗡𝗢
┃ 👤 𝗨𝘀𝘂𝗮𝗿𝗶𝗼:
┃    ${userTag}
┃
┃ 🔞 𝗠𝗼𝘁𝗶𝘃𝗼:
┃    Contenido NSFW detectado
┃
┃ 🛡️ 𝗔𝗰𝗰𝗶𝗼́𝗻:
┃    Expulsión automática
┃
┃ 📩 𝗘𝘃𝗶𝗱𝗲𝗻𝗰𝗶𝗮:
┃    Enviada al privado
┃    de ${REVIEW_TAG}
┃    para revisión de
┃    falsos positivos
╰━━━━━━━━━━━━

⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система
> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`,

        mentions: [

  ...(mentionJid
    ? [mentionJid]
    : []),

  REVIEW_OWNER

]
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