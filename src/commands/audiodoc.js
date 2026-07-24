// src/commands/audiodoc.js
import { downloadContentFromMessage } from "baileys"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

function signature() {
  // ✅ firma nueva
  return `⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|𝘑𝘊𝘒𝘡𝘐𝘯𝘧𝘪𝘯𝘪𝘵𝘺𝘓𝘰𝘰𝘱\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦 𝑍`
}

export default async function audiodoc(sock, msg) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  try {
    // 1) Validar que haya un audio citado
    const quoted = msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const audioMsg = quoted?.audioMessage

    if (!audioMsg) {
      await sock.sendMessage(
        chatId,
        { text: "🎙️ *Responde a una nota de voz o audio para convertirlo en documento MP3.*\n\nEjemplo:\n.reply a un audio y escribe .audiodoc" },
        { quoted: msg }
      )
      return
    }

    // 2) Reacción de procesamiento
    await sock.sendMessage(chatId, { react: { text: "🛠️", key: msg.key } }).catch(() => {})

    // 3) Descargar el audio
    const stream = await downloadContentFromMessage(audioMsg, "audio")
    let buffer = Buffer.alloc(0)
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
    if (!buffer.length) throw new Error("No se pudo descargar el audio.")

    // 4) Enviar como documento
    const sentDoc = await sock.sendMessage(
      chatId,
      {
        document: buffer,
        mimetype: "audio/mpeg",
        fileName: "audio_convertido.mp3"
      },
      { quoted: msg }
    )

    // 5) Mención personalizada + firma nueva
    const senderJid = getSenderJid(msg)
    const senderTag = `@${jidToNumber(senderJid)}`

    await sock.sendMessage(
      chatId,
      {
        text: `📄 *Aquí está tu audio como documento MP3* ${senderTag}\n\n${signature()}`,
        mentions: [senderJid]
      },
      { quoted: sentDoc }
    )

    // 6) Reacción final
    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
  } catch (err) {
    console.error("❌ Error en .audiodoc:", err)
    await sock.sendMessage(
      chatId,
      { text: "❌ *Hubo un error al convertir el audio a documento.*" },
      { quoted: msg }
    )
    await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }).catch(() => {})
  }
}
