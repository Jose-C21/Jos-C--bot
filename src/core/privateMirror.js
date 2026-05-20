import fs from "fs"
import path from "path"

import {
  downloadMediaMessage
} from "@whiskeysockets/baileys"

const TARGET_GROUP = "1203630XXXXXXXX@g.us"
const MIRROR_GROUP = "1203630YYYYYYYY@g.us"

export async function privateMirror(sock, m, logger) {

  try {

    if (!m) return
    if (!m.message) return
    if (!m.key) return

    const remoteJid = m.key.remoteJid

    // SOLO escuchar el grupo objetivo
    if (remoteJid !== TARGET_GROUP) return

    // ignorar mensajes del propio bot
    if (m.key.fromMe) return

    const pushName =
      m.pushName ||
      "Sin nombre"

    // =========================
    // TEXTO
    // =========================

    const text =
      m.message?.conversation ||
      m.message?.extendedTextMessage?.text

    if (text) {

      await sock.sendMessage(MIRROR_GROUP, {
        text:
`📩 ${pushName}

${text}`
      })

      return
    }

    // =========================
    // IMAGENES
    // =========================

    if (m.message?.imageMessage) {

      const buffer = await downloadMediaMessage(
        m,
        "buffer",
        {},
        {
          logger,
          reuploadRequest: sock.updateMediaMessage
        }
      )

      const caption =
        m.message.imageMessage.caption || ""

      await sock.sendMessage(MIRROR_GROUP, {
        image: buffer,
        caption:
`📸 ${pushName}

${caption}`
      })

      return
    }

    // =========================
    // VIDEOS
    // =========================

    if (m.message?.videoMessage) {

      const buffer = await downloadMediaMessage(
        m,
        "buffer",
        {},
        {
          logger,
          reuploadRequest: sock.updateMediaMessage
        }
      )

      const caption =
        m.message.videoMessage.caption || ""

      await sock.sendMessage(MIRROR_GROUP, {
        video: buffer,
        caption:
`🎥 ${pushName}

${caption}`
      })

      return
    }

    // =========================
    // AUDIOS
    // =========================

    if (m.message?.audioMessage) {

      const buffer = await downloadMediaMessage(
        m,
        "buffer",
        {},
        {
          logger,
          reuploadRequest: sock.updateMediaMessage
        }
      )

      await sock.sendMessage(MIRROR_GROUP, {
        audio: buffer,
        mimetype: "audio/mp4",
        ptt: true
      })

      await sock.sendMessage(MIRROR_GROUP, {
        text: `🎤 ${pushName}`
      })

      return
    }

    // =========================
    // STICKERS
    // =========================

    if (m.message?.stickerMessage) {

      const buffer = await downloadMediaMessage(
        m,
        "buffer",
        {},
        {
          logger,
          reuploadRequest: sock.updateMediaMessage
        }
      )

      await sock.sendMessage(MIRROR_GROUP, {
        sticker: buffer
      })

      await sock.sendMessage(MIRROR_GROUP, {
        text: `🪄 Sticker de ${pushName}`
      })

      return
    }

    // =========================
    // DOCUMENTOS
    // =========================

    if (m.message?.documentMessage) {

      const buffer = await downloadMediaMessage(
        m,
        "buffer",
        {},
        {
          logger,
          reuploadRequest: sock.updateMediaMessage
        }
      )

      const fileName =
        m.message.documentMessage.fileName ||
        "archivo"

      await sock.sendMessage(MIRROR_GROUP, {
        document: buffer,
        fileName,
        mimetype:
          m.message.documentMessage.mimetype
      })

      await sock.sendMessage(MIRROR_GROUP, {
        text:
`📄 ${pushName}

${fileName}`
      })

      return
    }

  } catch (e) {

    console.log(
      "[PRIVATE MIRROR ERROR]",
      e
    )

  }
}