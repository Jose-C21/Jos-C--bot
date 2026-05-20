import { downloadContentFromMessage } from "baileys"

const TARGET_GROUP = "120363403378065728@g.us"
const MIRROR_GROUP = "120363425717349155@g.us"

// =========================
// UNWRAP RECURSIVO REAL
// =========================

function unwrap(msg) {

  if (!msg) return msg

  if (msg?.ephemeralMessage?.message) {
    return unwrap(msg.ephemeralMessage.message)
  }

  if (msg?.viewOnceMessage?.message) {
    return unwrap(msg.viewOnceMessage.message)
  }

  if (msg?.viewOnceMessageV2?.message) {
    return unwrap(msg.viewOnceMessageV2.message)
  }

  if (msg?.viewOnceMessageV2Extension?.message) {
    return unwrap(msg.viewOnceMessageV2Extension.message)
  }

  return msg
}

// =========================
// BUFFER
// =========================

async function toBuffer(media, type) {

  const stream =
    await downloadContentFromMessage(
      media,
      type
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

    // IGNORAR BOT
    if (m.key.fromMe) return

    const pushName =
      m.pushName ||
      "Sin nombre"

    // =========================
    // UNWRAP REAL
    // =========================

    const msg =
      unwrap(m.message)

    console.log(
      "[PRIVATE MIRROR FINAL TYPES]",
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
    }

    // =========================
    // VIDEO
    // =========================

    if (msg?.videoMessage) {

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
    }

    // =========================
    // AUDIO
    // =========================

    if (msg?.audioMessage) {

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
    }

    // =========================
    // STICKER
    // =========================

    if (msg?.stickerMessage) {

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
    }

    // =========================
    // DOCUMENTO
    // =========================

    if (msg?.documentMessage) {

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
    }

  } catch (e) {

    console.log(
      "[PRIVATE MIRROR ERROR]",
      e
    )

  }
}