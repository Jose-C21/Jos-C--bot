// src/commands/ver.js
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"
import { downloadContentFromMessage } from "baileys"

// 🧠 Limpia cualquier jid (lid o número real) a solo dígitos
const limpiarId = (jid) => String(jid || "").replace(/\D/g, "")

// 🔓 Unwrap: viewOnce / ephemeral
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

// ⬇️ Descargar buffer desde baileys
async function toBuffer(mediaMsg, mediaType) {
  const stream = await downloadContentFromMessage(mediaMsg, mediaType)
  let buffer = Buffer.alloc(0)
  for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
  return buffer
}

export default async function ver(sock, msg, { args = [], command = "" }) {
  try {
    const chatId = msg?.key?.remoteJid
    if (!chatId) return

    // ❌ solo grupos
    if (!String(chatId).endsWith("@g.us")) {
      await sock.sendMessage(chatId, { text: "⛔ Este comando solo funciona en grupos." }, { quoted: msg })
      return
    }

    // ✅ sender real (LID o normal)
    const senderJid = getSenderJid(msg)
    let decoded = senderJid
    try { if (sock?.decodeJid) decoded = sock.decodeJid(senderJid) } catch {}

    const senderClean = limpiarId(decoded || senderJid)

    // 🛡️ verificar admin del grupo (comparando por dígitos)
    let isAdmin = false
    try {
      const md = await sock.groupMetadata(chatId)
      const p = md.participants?.find((x) => limpiarId(x.id) === senderClean)
      isAdmin = p?.admin === "admin" || p?.admin === "superadmin"
    } catch {}

    if (!isAdmin) {
      await sock.sendMessage(chatId, { text: "⛔ Solo administradores pueden usar este comando." }, { quoted: msg })
      return
    }

    // 🔐 restricción extra SOLO para este grupo
    const GRUPO_RESTRINGIDO = "120363402012008160@g.us"
    if (chatId === GRUPO_RESTRINGIDO) {
      const ADMINS_CONFIANZA = [
        // números reales
        "50432213256",
        "18057074359",
        // LID limpios
        "19580839829625",
        "208272208490541",
      ]

      if (!ADMINS_CONFIANZA.includes(senderClean)) {
        await sock.sendMessage(
          chatId,
          { text: "⛔ En este grupo solo administradores autorizados pueden usar este comando." },
          { quoted: msg }
        )
        return
      }
    }

    // ================== LÓGICA VER ==================

    // ✅ quoted message (lo que respondes)
    const ctx = msg?.message?.extendedTextMessage?.contextInfo
    const quotedMessage = ctx?.quotedMessage
    if (!quotedMessage) {
      await sock.sendMessage(
        chatId,
        { text: "❌ *Error:* Debes responder a una imagen, video o nota de voz para reenviarla." },
        { quoted: msg }
      )
      return
    }

    const inner = unwrapAny(quotedMessage)

    let mediaType = ""
    let mediaMsg = null

    if (inner?.imageMessage) {
      mediaType = "image"
      mediaMsg = inner.imageMessage
    } else if (inner?.videoMessage) {
      mediaType = "video"
      mediaMsg = inner.videoMessage
    } else if (inner?.audioMessage || inner?.voiceMessage || inner?.pttMessage) {
      mediaType = "audio"
      mediaMsg = inner.audioMessage || inner.voiceMessage || inner.pttMessage
    } else {
      await sock.sendMessage(
        chatId,
        { text: "❌ *Error:* El mensaje citado no contiene un archivo compatible." },
        { quoted: msg }
      )
      return
    }

    // ⏳ reacción
    await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } }).catch(() => {})

    // ⬇️ descargar
    let mediaBuffer = null
    try {
      mediaBuffer = await toBuffer(mediaMsg, mediaType)
    } catch {
      mediaBuffer = null
    }

    if (!mediaBuffer?.length) {
      await sock.sendMessage(chatId, { text: "❌ *Error:* No se pudo descargar el archivo." }, { quoted: msg })
      return
    }

    const credit =
`⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|𝘑𝘊𝘒𝘡𝘐𝘯𝘧𝘪𝘯𝘪𝘵𝘺𝘓𝘰𝘰𝘱
> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`

    const opts = { mimetype: mediaMsg?.mimetype }

    if (mediaType === "image") {
      opts.image = mediaBuffer
      opts.caption = credit
    } else if (mediaType === "video") {
      opts.video = mediaBuffer
      opts.caption = credit
    } else {
      opts.audio = mediaBuffer
      // ✅ respeta si era ptt o no
      opts.ptt = mediaMsg?.ptt ?? true
      // ✅ duración si existe
      if (mediaMsg?.seconds) opts.seconds = mediaMsg.seconds
    }

    await sock.sendMessage(chatId, opts, { quoted: msg }).catch(() => {})

    // en audio mandar credit aparte (como tu lógica)
    if (mediaType === "audio") {
      await sock.sendMessage(chatId, { text: credit }, { quoted: msg }).catch(() => {})
    }

    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
  } catch (error) {
    console.error("❌ Error en comando ver:", error)
    await sock.sendMessage(
      msg?.key?.remoteJid,
      { text: "❌ *Error:* Hubo un problema al procesar el archivo." },
      { quoted: msg }
    ).catch(() => {})
  }
}