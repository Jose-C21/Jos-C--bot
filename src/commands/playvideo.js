// src/commands/playvideo.js
import yts from "yt-search"
import axios from "axios"

// ✅ NUEVA API (RapidAPI - YouTube Mp4 Downloader)
const MP4_API = "https://youtube-mp4-downloader.p.rapidapi.com/mp4"
const RAPID_KEY = process.env.RAPIDAPI_KEY || "8b004a7ff9msh658214a8fb106f2p1213c3jsn5047c465b710"
const MP4_HEADERS = {
  "x-rapidapi-host": "youtube-mp4-downloader.p.rapidapi.com",
  "x-rapidapi-key": RAPID_KEY
}

function safeFileName(name = "") {
  return String(name)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "video"
}

function signature() {
  return `\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|𝘑𝘊𝘒𝘡𝘐𝘯𝘧𝘪𝘯𝘪𝘵𝘺𝘓𝘰𝘰𝘱\n> ⟣ 𝗢𝘄𝗻𝗲𝗿: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦 𝑍`
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

  const jidUsuario = msg?.key?.participant || msg?.participant || chatId
  const userNum = String(jidUsuario).split("@")[0]

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

    // ✅ Resolver mp4 con RapidAPI
    const apiRes = await axios.get(MP4_API, {
      params: { url: ytUrl },
      headers: MP4_HEADERS,
      timeout: 60_000
    })

    const data = apiRes?.data
    const videoUrl = data?.download
    const title = data?.title || video.title || "Video"

    if (!videoUrl) {
      await sock.sendMessage(chatId, { text: "❌ No se pudo obtener el video." }, { quoted: msg })
      try { await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }) } catch {}
      return
    }

    // Descargar buffer
    const dl = await axios.get(videoUrl, { responseType: "arraybuffer", timeout: 180_000 })
    const videoBuffer = Buffer.from(dl.data)
    console.log(`[playvideo] ${(videoBuffer.length / 1048576).toFixed(1)} MB`)

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
    console.error("[playvideo]", e?.response?.data || e)
    await sock.sendMessage(chatId, { text: "❌ Ocurrió un error al procesar la solicitud." }, { quoted: msg })
    try { await sock.sendMessage(chatId, { react: { text: "⚠️", key: msg.key } }) } catch {}
  }
}
