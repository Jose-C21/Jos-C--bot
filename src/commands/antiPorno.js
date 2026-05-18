import fs from "fs"
import path from "path"
import { exec } from "child_process"
import { downloadContentFromMessage } from "baileys"

// =========================
// CARPETAS AUTOMÁTICAS
// =========================

const TEMP_DIR =
  path.join(process.cwd(), "temp")

const NSFW_DIR =
  path.join(process.cwd(), "nsfw")

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true })
}

if (!fs.existsSync(NSFW_DIR)) {
  fs.mkdirSync(NSFW_DIR, { recursive: true })
}

// =========================
// CREAR detector.py SOLO
// =========================

const detectorPath =
  path.join(NSFW_DIR, "detector.py")

const detectorCode = `
from nudenet import NudeDetector
import sys
import json

detector = NudeDetector()

result = detector.detect(sys.argv[1])

print(json.dumps(result))
`

if (!fs.existsSync(detectorPath)) {

  fs.writeFileSync(
    detectorPath,
    detectorCode
  )
}

// =========================
// INSTALAR NUDENET SOLO
// =========================

const installedFlag =
  path.join(NSFW_DIR, ".installed")

if (!fs.existsSync(installedFlag)) {

  exec(
    "pip install nudenet",

    (err, stdout, stderr) => {

      console.log(stdout)

      if (err) {
        console.log(stderr)
        return
      }

      fs.writeFileSync(installedFlag, "ok")
    }
  )
}

// =========================
// DESCARGAR BUFFER
// =========================

async function toBuffer(mediaMsg, mediaType) {

  const stream =
    await downloadContentFromMessage(
      mediaMsg,
      mediaType
    )

  let buffer = Buffer.alloc(0)

  for await (const chunk of stream) {

    buffer = Buffer.concat([
      buffer,
      chunk
    ])
  }

  return buffer
}

// =========================
// COMANDO PRINCIPAL
// =========================

export default async function antiPorno(sock, msg) {

  try {

    const chatId =
      msg?.key?.remoteJid

    if (!chatId) return

    // SOLO grupos

    if (!chatId.endsWith("@g.us")) {
      return
    }

    // SOLO imágenes

    const imageMsg =
      msg?.message?.imageMessage

    if (!imageMsg) return

    // =========================
    // DESCARGAR IMAGEN
    // =========================

    const mediaBuffer =
      await toBuffer(
        imageMsg,
        "image"
      )

    if (!mediaBuffer?.length) {
      return
    }

    // =========================
    // GUARDAR TEMPORAL
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

    // =========================
    // EJECUTAR NUDENET
    // =========================

    exec(

      `python3 "${detectorPath}" "${filePath}"`,

      async (err, stdout, stderr) => {

        try {

          // LIMPIAR SIEMPRE

          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
          }

          if (err) {
            console.log(stderr)
            return
          }

          let result = []

          try {

            result =
              JSON.parse(stdout)

          } catch {

            return
          }

          console.log(
            "NSFW RESULT:",
            result
          )

          // =========================
          // CLASES PROHIBIDAS
          // =========================

          const forbidden = [

            "EXPOSED_GENITALIA_F",
            "EXPOSED_GENITALIA_M",
            "EXPOSED_BREAST_F"

          ]

          const detected =
            result.some(

              x =>

                forbidden.includes(
                  x.class
                ) &&

                x.score > 0.70
            )

          if (!detected) return

          // =========================
          // BORRAR MENSAJE
          // =========================

          await sock.sendMessage(
            chatId,
            {
              delete: msg.key
            }
          ).catch(() => {})

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

        } catch (e) {

          console.log(
            "ERROR NSFW:",
            e
          )
        }
      }
    )

  } catch (e) {

    console.log(
      "ERROR ANTIPORNO:",
      e
    )
  }
}