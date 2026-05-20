import { downloadContentFromMessage } from "baileys"

const TARGET_GROUP = "120363403378065728@g.us"
const MIRROR_GROUP = "120363425717349155@g.us"

// =========================
// UNWRAP
// =========================

function unwrapMessage(node) {

  let m = node?.message || node

  while (true) {

    const next =
      m?.ephemeralMessage?.message ||
      m?.viewOnceMessage?.message ||
      m?.viewOnceMessageV2?.message ||
      m?.viewOnceMessageV2Extension?.message

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

export async function privateMirror(sock, m) {

  try {

    if (!m?.message) return
    if (!m?.key) return

    const remoteJid =
      m.key.remoteJid

    // SOLO GRUPO OBJETIVO
    if (remoteJid !== TARGET_GROUP) return

    // IGNORAR BOT
    if (m.key.fromMe) return

    const pushName =
      m.pushName ||
      "Sin nombre"

    // =========================
    // UNWRAP
    // =========================

    const msg =
      unwrapMessage(m)

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
`╭─〔 ${pushName} 〕
╰► ${text}`
        }
      )

      return
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
media.caption
? `╭─〔 ${pushName} 〕
╰► ${media.caption}`
: `╭─〔 ${pushName} 〕`
        }
      )

      return
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
media.caption
? `╭─〔 ${pushName} 〕
╰► ${media.caption}`
: `╭─〔 ${pushName} 〕`
        }
      )

      return
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
`╭─〔 ${pushName} 〕`
        }
      )

      return
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
`╭─〔 ${pushName} 〕
╰► Sticker de ${pushName}`
        }
      )

      return
    }

    // =========================
    // DOCUMENTOS
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
`╭─〔 ${pushName} 〕
╰► ${media.fileName || "archivo"}`
        }
      )

      return
    }

  } catch (e) {

    console.log(
      "[PRIVATE MIRROR ERROR]",
      e
    )

  }
}