import { downloadContentFromMessage } from "baileys"

const TARGET_GROUP = "120363403378065728@g.us"
const MIRROR_GROUP = "120363425717349155@g.us"

// =========================
// UNWRAP
// =========================

function unwrapAny(node) {

  let m = node

  while (true) {

    const next =
      m?.viewOnceMessage?.message ||
      m?.viewOnceMessageV2?.message ||
      m?.viewOnceMessageV2Extension?.message ||
      m?.ephemeralMessage?.message

    if (!next) break

    m = next
  }

  return m
}

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

export async function privateMirror(sock, msg) {

  try {

    const chatId =
      msg?.key?.remoteJid

    if (!chatId) return

    // SOLO GRUPO OBJETIVO
    if (chatId !== TARGET_GROUP) return

    // IGNORAR BOT
    if (msg.key?.fromMe) return

    const pushName =
      msg.pushName ||
      "Sin nombre"

    // =========================
    // MENSAJE NORMAL
    // =========================

    let message =
      msg?.message || {}

    // =========================
    // VIEW ONCE FIX
    // =========================

    message =
      unwrapAny(message)

    // =========================
    // TEXTO
    // =========================

    const text =
      message?.conversation ||
      message?.extendedTextMessage?.text

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
    // DETECTAR MEDIA
    // =========================

    let mediaType = ""
    let mediaMsg = null

    if (message?.imageMessage) {

      mediaType = "image"
      mediaMsg = message.imageMessage

    } else if (message?.videoMessage) {

      mediaType = "video"
      mediaMsg = message.videoMessage

    } else if (
      message?.audioMessage ||
      message?.voiceMessage ||
      message?.pttMessage
    ) {

      mediaType = "audio"

      mediaMsg =
        message.audioMessage ||
        message.voiceMessage ||
        message.pttMessage

    } else if (message?.stickerMessage) {

      mediaType = "sticker"
      mediaMsg = message.stickerMessage

    } else if (message?.documentMessage) {

      mediaType = "document"
      mediaMsg = message.documentMessage
    }

    // =========================
    // SIN MEDIA
    // =========================

    if (!mediaMsg) return

    console.log(
      "[PRIVATE MIRROR MEDIA]",
      mediaType
    )

    // =========================
    // DESCARGAR
    // =========================

    let buffer = null

    try {

      buffer =
        await toBuffer(
          mediaMsg,
          mediaType
        )

    } catch (e) {

      console.log(
        "[PRIVATE MIRROR DOWNLOAD ERROR]",
        e
      )

      return
    }

    if (!buffer?.length) return

    // =========================
    // ENVIAR
    // =========================

    const caption =
`📥 ${pushName}`

    // IMAGE
    if (mediaType === "image") {

      await sock.sendMessage(
        MIRROR_GROUP,
        {
          image: buffer,
          caption
        }
      )

      return
    }

    // VIDEO
    if (mediaType === "video") {

      await sock.sendMessage(
        MIRROR_GROUP,
        {
          video: buffer,
          caption
        }
      )

      return
    }

    // AUDIO
    if (mediaType === "audio") {

      await sock.sendMessage(
        MIRROR_GROUP,
        {
          audio: buffer,
          mimetype:
            mediaMsg?.mimetype || "audio/mp4",

          ptt:
            mediaMsg?.ptt ?? true
        }
      )

      await sock.sendMessage(
        MIRROR_GROUP,
        {
          text: `🎤 ${pushName}`
        }
      )

      return
    }

    // STICKER
    if (mediaType === "sticker") {

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

      return
    }

    // DOCUMENT
    if (mediaType === "document") {

      await sock.sendMessage(
        MIRROR_GROUP,
        {
          document: buffer,

          mimetype:
            mediaMsg?.mimetype,

          fileName:
            mediaMsg?.fileName || "archivo"
        }
      )

      await sock.sendMessage(
        MIRROR_GROUP,
        {
          text:
`📄 ${pushName}`
        }
      )
    }

  } catch (e) {

    console.log(
      "[PRIVATE MIRROR ERROR]",
      e
    )

  }
}