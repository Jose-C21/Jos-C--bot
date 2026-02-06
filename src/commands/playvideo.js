// src/commands/playvideo.js
import yts from "yt-search"
import axios from "axios"

const VIDEO_API = "https://gawrgura-api.onrender.com/download/ytdl?url="

function safeFileName(name = "") {
  return String(name)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "video"
}

function signature() {
  return `\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗢𝘄𝗻𝗲𝗿: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`
}

export default async function playvideo(sock, msg, { args = [], usedPrefix = "." }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const query = (args || []).join(" ").trim()
  if (!query) {
    await sock.sendMessage(chatId, {
      text: `💡 Ejemplo de uso:\n\n${usedPrefix}playvideo anuel mercedes tintia${signature()}`
    }, { quoted: msg })
    return
  }

  // user para mention (grupo o privado)
  const jidUsuario = msg?.key?.participant || msg?.participant || chatId
  const userNum = String(jidUsuario).split("@")[0]

  // reacción cargando
  try { await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } }) } catch {}

  try {
    const resYt = await yts(query)
    const video = resYt?.videos?.[0]
    if (!video?.url) {
      await sock.sendMessage(chatId, { text: "❌ No se encontraron resultados." }, { quoted: msg })
      try { await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }) } catch {}
      return
    }

    const ytUrl = video.url

    // Resolver mp4 con tu API vieja
    const apiUrl = VIDEO_API + encodeURIComponent(ytUrl)
    const apiRes = await axios.get(apiUrl, { timeout: 60_000 })

    const videoUrl = apiRes?.data?.result?.mp4
    const title = apiRes?.data?.result?.title || video.title || "Video"

    if (!videoUrl) {
      await sock.sendMessage(chatId, { text: "❌ No se pudo obtener el video." }, { quoted: msg })
      try { await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }) } catch {}
      return
    }

    // Descargar buffer
    const dl = await axios.get(videoUrl, { responseType: "arraybuffer", timeout: 120_000 })
    const videoBuffer = Buffer.from(dl.data)

    // Enviar video
    await sock.sendMessage(chatId, {
      video: videoBuffer,
      mimetype: "video/mp4",
      fileName: `${safeFileName(title)}.mp4`,
      caption: `*${title}*\n\n⊱┊ @${userNum} 𝗔𝗾𝘂𝗶 𝗲𝘀𝘁𝗮́ 𝘁𝘂 𝘃𝗶𝗱𝗲𝗼.${signature()}`,
      mentions: jidUsuario ? [jidUsuario] : []
    }, { quoted: msg })

    try { await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }) } catch {}
  } catch (e) {
    console.error("[playvideo]", e)
    await sock.sendMessage(chatId, { text: "❌ Ocurrió un error al procesar la solicitud." }, { quoted: msg })
    try { await sock.sendMessage(chatId, { react: { text: "⚠️", key: msg.key } }) } catch {}
  }
}