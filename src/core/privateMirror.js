import { downloadContentFromMessage } from "baileys"

const TARGET_GROUP = "120363403378065728@g.us"
const MIRROR_GROUP = "120363425717349155@g.us"

// =========================
// BUFFER
// =========================

async function toBuffer(mediaMsg, mediaType) {

  const stream =
    await downloadContentFromMessage(
      mediaMsg,
      mediaType
    )

  let buffer = Buffer.alloc(0)

  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk])
  }

  return buffer
}

export async function privateMirror(sock, m) {

  try {

    if (!m?.message) return
    if (!m?.key) return

    const remoteJid =
      m.key.remoteJid

    // SOLO ESTE GRUPO
    if (remoteJid !== TARGET_GROUP) return

    // IGNORAR MENSAJES DEL BOT
    if (m.key.fromMe) return

    const pushName =
      m.pushName ||
      "Sin nombre"

    // =========================
    // EXTRAER MENSAJE REAL
    // =========================

    let msg = m.message

    // VIEW ONCE
    if (msg?.viewOnceMessage?.message) {
      msg = msg.viewOnceMessage.message
    }

    if (msg?.viewOnceMessageV2?.message) {
      msg = msg.viewOnceMessageV2.message
    }

    if (msg?.viewOnceMessageV2Extension?.message) {
      msg = msg.viewOnceMessageV2Extension.message
    }

    // EPHEMERAL
    if (msg?.ephemeralMessage?.message) {
      msg = msg.ephemeralMessage.message
    }

    // DEBUG
    console.log(
      "[PRIVATE MIRROR TYPES]",
      Object.keys(msg || {})
    )

    // =========================
    // TEXTO
    // =========================

    const text =
      msg?.conversation ||
      msg?.extendedTextMessage?.text

    if (text) {

      await sock.sendMessage(
        MIRROR_GROUP,
        {
          text:
`📩 ${pushName}

${text}`
        }
      )
    }

    // =========================
    // IMAGEN
    // =========================

    if (msg?.imageMessage) {

      try {

        const media =
          msg.imageMessage

        const buffer =
          await toBuffer(
            media,
            "image"
          )

        await sock.sendMessage(
          MIRROR_GROUP,
          {
            image: buffer,

            caption:
`📸 ${pushName}

${media.caption || ""}`
          }
        )

      } catch (e) {

        console.log(
          "[MIRROR IMAGE ERROR]",
          e
        )

      }
    }

    // =========================
    // VIDEO
    // =========================

    if (msg?.videoMessage) {

      try {

        const media =
          msg.videoMessage

        const buffer =
          await toBuffer(
            media,
            "video"
          )

        await sock.sendMessage(
          MIRROR_GROUP,
          {
            video: buffer,

            caption:
`🎥 ${pushName}

${media.caption || ""}`
          }
        )

      } catch (e) {

        console.log(
          "[MIRROR VIDEO ERROR]",
          e
        )

      }
    }

    // =========================
    // AUDIO
    // =========================

    if (msg?.audioMessage) {

      try {

        const media =
          msg.audioMessage

        const buffer =
          await toBuffer(
            media,
            "audio"
          )

        await sock.sendMessage(
          MIRROR_GROUP,
          {
            audio: buffer,

            mimetype:
              media.mimetype || "audio/mp4",

            ptt:
              media.ptt || false
          }
        )

        await sock.sendMessage(
          MIRROR_GROUP,
          {
            text:
`🎤 ${pushName}`
          }
        )

      } catch (e) {

        console.log(
          "[MIRROR AUDIO ERROR]",
          e
        )

      }
    }

    // =========================
    // STICKER
    // =========================

    if (msg?.stickerMessage) {

      try {

        const media =
          msg.stickerMessage

        const buffer =
          await toBuffer(
            media,
            "sticker"
          )

        await sock.sendMessage(
          MIRROR_GROUP,
          {
            sticker: buffer
          }
        )

        await sock.sendMessage(
          MIRROR_GROUP,
          {
            text:
`🪄 Sticker de ${pushName}`
          }
        )

      } catch (e) {

        console.log(
          "[MIRROR STICKER ERROR]",
          e
        )

      }
    }

    // =========================
    // DOCUMENTO
    // =========================

    if (msg?.documentMessage) {

      try {

        const media =
          msg.documentMessage

        const buffer =
          await toBuffer(
            media,
            "document"
          )

        await sock.sendMessage(
          MIRROR_GROUP,
          {
            document: buffer,

            mimetype:
              media.mimetype,

            fileName:
              media.fileName || "archivo"
          }
        )

        await sock.sendMessage(
          MIRROR_GROUP,
          {
            text:
`📄 ${pushName}

${media.fileName || "archivo"}`
          }
        )

      } catch (e) {

        console.log(
          "[MIRROR DOCUMENT ERROR]",
          e
        )

      }
    }

  } catch (e) {

    console.log(
      "[PRIVATE MIRROR ERROR]",
      e
    )

  }
}