import fs from "fs"
import path from "path"

import {
  exec,
  execSync
} from "child_process"

import {
  downloadContentFromMessage
} from "baileys"

console.log("ANTI PORNO CARGADO")

// =========================
// VERIFICAR PYTHON
// =========================

try {

  console.log(
    execSync("python3 --version").toString()
  )

} catch (e) {

  console.log("PYTHON NO INSTALADO")

}

// =========================
// CARPETAS
// =========================

const TEMP_DIR =
  path.join(
    process.cwd(),
    "temp"
  )

const NSFW_DIR =
  path.join(
    process.cwd(),
    "nsfw"
  )

if (!fs.existsSync(TEMP_DIR)) {

  fs.mkdirSync(
    TEMP_DIR,
    { recursive: true }
  )
}

if (!fs.existsSync(NSFW_DIR)) {

  fs.mkdirSync(
    NSFW_DIR,
    { recursive: true }
  )
}

// =========================
// CREAR detector.py
// =========================

const detectorPath =
  path.join(
    NSFW_DIR,
    "detector.py"
  )

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
// INSTALAR NUDENET
// =========================

const installedFlag =
  path.join(
    NSFW_DIR,
    ".installed"
  )

if (!fs.existsSync(installedFlag)) {

  console.log(
    "INSTALANDO NUDENET..."
  )

  exec(

    "pip3 install nudenet",

    (err, stdout, stderr) => {

      console.log(stdout)

      if (err) {

        console.log(
          "ERROR INSTALANDO:"
        )

        console.log(stderr)

        return
      }

      fs.writeFileSync(
        installedFlag,
        "ok"
      )

      console.log(
        "NUDENET INSTALADO"
      )
    }
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
    // EJECUTAR PYTHON
    // =========================

    exec(

      `python3 "${detectorPath}" "${filePath}"`,

      async (
        err,
        stdout,
        stderr
      ) => {

        try {

          // LIMPIAR ARCHIVO

          if (
            fs.existsSync(filePath)
          ) {

            fs.unlinkSync(filePath)
          }

          // ERROR PYTHON

          if (err) {

            console.log(
              "ERROR PYTHON:"
            )

            console.log(stderr)

            return
          }

          let result = []

          try {

            result =
              JSON.parse(stdout)

          } catch {

            console.log(
              "JSON INVALIDO"
            )

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

          console.log(
            "NSFW DETECTADO:",
            detected
          )

          if (!detected) {
            return
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

        } catch (e) {

          console.log(
            "ERROR NSFW:",
            e
          )
        }
      }
    )

    return false

  } catch (e) {

    console.log(
      "ERROR ANTIPORNO:",
      e
    )

    return false
  }
}