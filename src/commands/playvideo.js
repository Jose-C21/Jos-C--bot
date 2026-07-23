// src/commands/playvideo.js
import yts from "yt-search"
import axios from "axios"

// ✅ NUEVA API (Sylphy)
const SYLPHY_BASE = "https://sylphy.xyz/download/ytmp4"
const SYLPHY_API_KEY = "sylphy-MtyAgpx" // ← tu api_key
const SYLPHY_QUALITY = "720p" // puedes cambiar: 360p, 480p, 720p, etc

function safeFileName(name = "") {
  return String(name)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "video"
}

function signature() {
  return `\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|𝘑𝘊𝘒𝘡𝘐𝘯𝘧𝘪𝘯𝘪𝘵𝘺𝘓𝘰𝘰𝘱\n> ⟣ 𝗢𝘄𝗻𝗲𝗿: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`
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

    // ✅ Resolver mp4 con Sylphy
    const apiRes = await axios.get(SYLPHY_BASE, {
      params: {
        url: ytUrl,
        q: SYLPHY_QUALITY,
        api_key: SYLPHY_API_KEY
      },
      timeout: 60_000
    })

    const data = apiRes?.data
    const videoUrl = data?.result?.dl_url
    const title = data?.result?.title || video.title || "Video"

    if (!videoUrl) {
      await sock.sendMessage(chatId, { text: "❌ No se pudo obtener el video." }, { quoted: msg })
      try { await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }) } catch {}
      return
    }

    // Descargar buffer
    const dl = await axios.get(videoUrl, { responseType: "arraybuffer", timeout: 180_000 })
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
    console.error("[playvideo]", e?.response?.data || e)
    await sock.sendMessage(chatId, { text: "❌ Ocurrió un error al procesar la solicitud." }, { quoted: msg })
    try { await sock.sendMessage(chatId, { react: { text: "⚠️", key: msg.key } }) } catch {}
  }
}