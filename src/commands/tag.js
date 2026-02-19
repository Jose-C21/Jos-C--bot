// src/commands/tag.js
import { downloadContentFromMessage } from "baileys"
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

export default async function tag(sock, msg, { args = [] }) {
  try {
    const chatId = msg?.key?.remoteJid
    if (!chatId) return

    const isGroup = String(chatId).endsWith("@g.us")
    if (!isGroup) {
      await sock.sendMessage(chatId, { text: "⚠️ Este comando solo se puede usar en grupos." }, { quoted: msg })
      return
    }

    const senderJid = getSenderJid(msg)
    let decoded = senderJid
    try { if (sock?.decodeJid) decoded = sock.decodeJid(senderJid) } catch {}

    // ✅ admin o bot (fromMe) pueden usarlo
    const fromMe = !!msg.key?.fromMe

    let isAdmin = false
    let metadata
    try {
      metadata = await sock.groupMetadata(chatId)
      const senderId = decoded || senderJid
      const p = metadata.participants?.find(x => x.id === senderId || x.id === senderJid)
      isAdmin = p?.admin === "admin" || p?.admin === "superadmin"
    } catch {}

    if (!isAdmin && !fromMe) {
      await sock.sendMessage(chatId, { text: "❌ Solo los administradores del grupo o el bot pueden usar este comando." }, { quoted: msg })
      return
    }

    metadata = metadata || (await sock.groupMetadata(chatId))
    const allMentions = (metadata.participants || []).map(p => p.id)

    const ctx = msg?.message?.extendedTextMessage?.contextInfo || {}
    const quoted = ctx?.quotedMessage || null

    // Unwrap (ephemeral/viewOnce) dentro del QUOTED
    const unwrap = (m) => {
      let node = m || {}
      while (
        node?.ephemeralMessage?.message ||
        node?.viewOnceMessageV2?.message ||
        node?.viewOnceMessageV2Extension?.message ||
        node?.viewOnceMessage?.message
      ) {
        node =
          node.ephemeralMessage?.message ||
          node.viewOnceMessageV2?.message ||
          node.viewOnceMessageV2Extension?.message ||
          node.viewOnceMessage?.message ||
          node
      }
      return node
    }

    let payload = null

    if (quoted) {
      const inner = unwrap(quoted)

      if (inner?.conversation) {
        payload = { text: inner.conversation }
      } else if (inner?.extendedTextMessage?.text) {
        payload = { text: inner.extendedTextMessage.text }
      } else if (inner?.imageMessage) {
        const stream = await downloadContentFromMessage(inner.imageMessage, "image")
        let buffer = Buffer.alloc(0)
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
        payload = {
          image: buffer,
          mimetype: inner.imageMessage.mimetype || "image/jpeg",
          caption: inner.imageMessage.caption || ""
        }
      } else if (inner?.videoMessage) {
        const stream = await downloadContentFromMessage(inner.videoMessage, "video")
        let buffer = Buffer.alloc(0)
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
        payload = {
          video: buffer,
          mimetype: inner.videoMessage.mimetype || "video/mp4",
          caption: inner.videoMessage.caption || ""
        }
      } else if (inner?.audioMessage) {
        const stream = await downloadContentFromMessage(inner.audioMessage, "audio")
        let buffer = Buffer.alloc(0)
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
        payload = {
          audio: buffer,
          mimetype: inner.audioMessage.mimetype || "audio/mpeg",
          ptt: inner.audioMessage.ptt ?? false
        }
      } else if (inner?.stickerMessage) {
        const stream = await downloadContentFromMessage(inner.stickerMessage, "sticker")
        let buffer = Buffer.alloc(0)
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
        payload = { sticker: buffer }
      } else if (inner?.documentMessage) {
        const stream = await downloadContentFromMessage(inner.documentMessage, "document")
        let buffer = Buffer.alloc(0)
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
        payload = {
          document: buffer,
          mimetype: inner.documentMessage.mimetype || "application/octet-stream",
          fileName: inner.documentMessage.fileName || "archivo",
          caption: inner.documentMessage.caption || ""
        }
      }
    }

    // ✅ si no hay quoted, usar texto args
    if (!payload) {
      const txt = (args || []).join(" ").trim()
      if (txt) payload = { text: txt }
    }

    if (!payload) {
      await sock.sendMessage(chatId, { text: "⚠️ Debes responder a un mensaje o escribir un texto para reenviar." }, { quoted: msg })
      return
    }

    await sock.sendMessage(chatId, { ...payload, mentions: allMentions }, { quoted: msg })
  } catch (error) {
    console.error("❌ Error en el comando tag:", error)
    await sock.sendMessage(msg.key.remoteJid, { text: "❌ Ocurrió un error al ejecutar el comando tag." }, { quoted: msg })
  }
}