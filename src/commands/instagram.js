// src/commands/instagram.js
import axios from "axios"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const IG_ENDPOINT = "https://instagram-tiktok-youtube-downloader.p.rapidapi.com/fetch"
const RAPID_KEY = process.env.RAPIDAPI_KEY || "8b004a7ff9msh658214a8fb106f2p1213c3jsn5047c465b710"
const IG_HEADERS = {
  "x-rapidapi-host": "instagram-tiktok-youtube-downloader.p.rapidapi.com",
  "x-rapidapi-key": RAPID_KEY
}

function signature() {
  return `\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|𝘑𝘊𝘒𝘡𝘐𝘯𝘧𝘪𝘯𝘪𝘵𝘺𝘓𝘰𝘰𝘱\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦 𝑍`
}

function isInstagramUrl(u = "") {
  u = String(u || "").trim()
  return /(instagram\.com|instagr\.am)\/.+/i.test(u)
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function tipoLabel(tipo = "") {
  const t = String(tipo || "").toLowerCase()
  if (t === "video") return "🎬 Video / Reel"
  if (t === "image" || t === "imagen" || t === "photo") return "📸 Foto"
  if (t === "story" || t === "historia") return "📱 Historia"
  return "📦 Multimedia"
}

export default async function instagram(sock, msg, { args = [], usedPrefix = "." }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const senderJid = getSenderJid(msg)
  const senderTag = `@${jidToNumber(senderJid)}`
  const url = String(args?.[0] || "").trim()

  if (!url || !isInstagramUrl(url)) {
    await sock.sendMessage(
      chatId,
      {
        text:
`> ⟢ ɪɴꜱᴛᴀɢʀᴀᴍ ᴅᴇꜱᴄᴀʀɢᴀꜱ ⟣
┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
🔗 𝗨𝘀𝗼: ${usedPrefix}instagram <enlace>

📸 Reels, videos y fotos.

💬 𝗘𝗷𝗲𝗺𝗽𝗹𝗼:
${usedPrefix}instagram https://www.instagram.com/reel/DbEgsesBDhP/${signature()}`
      },
      { quoted: msg }
    )
    return
  }

  try {
    await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } }).catch(() => {})

    const steps = [
      "⏳ Conectando con Instagram..",
      "⏳ Conectando con Instagram...",
      "▰▱▱▱▱▱▱▱ 10%",
      "▰▰▰▱▱▱▱▱ 35%",
      "▰▰▰▰▰▱▱▱ 60%",
      "▰▰▰▰▰▰▰▱ 85%",
      "✅ Casi listo..."
    ]

    let progreso = await sock.sendMessage(chatId, { text: steps[0] }, { quoted: msg })
    for (let i = 1; i < steps.length; i++) {
      await delay(700)
      await sock.sendMessage(chatId, { edit: progreso.key, text: steps[i] }).catch(() => {})
    }

    const { data: r } = await axios.get(IG_ENDPOINT, {
      params: { url },
      headers: IG_HEADERS,
      timeout: 60_000
    })

    // Adapta la respuesta de RapidAPI al formato que usa el resto del comando
    const toItem = it => ({ tipo: /video/i.test(String(it?.type || it?.media_type || "")) ? "video" : "image", url: it?.download_url || it?.url })
    const media = r?.type === "album" && Array.isArray(r?.items)
      ? r.items.map(toItem).filter(m => m.url)
      : r?.download_url ? [toItem(r)] : []
    const data = { status: r?.ok === true, media, tipo: r?.type }

    if (!data?.status || !Array.isArray(data?.media) || data.media.length === 0) {
      throw new Error("La API no devolvió contenido descargable")
    }

    const autorUser = data?.autor?.username ? `@${data.autor.username}` : "Desconocido"
    const total = data.media.length

    await sock.sendMessage(chatId, { edit: progreso.key, text: "📤 Enviando contenido..." }).catch(() => {})

    for (let i = 0; i < total; i++) {
      const item = data.media[i]
      const esUltimo = i === total - 1
      const tipo = String(item?.tipo || "").toLowerCase()

      const captionFinal = esUltimo
  ? `> ⟢ ɪɴꜱᴛᴀɢʀᴀᴍ ᴅᴇꜱᴄᴀʀɢᴀᴅᴏ ⟣
┄┄┄┄┄┄┄┄┄┄┄┄┄
╭ ${tipo === "video" ? "🎬" : "📸"} 𝗧𝗶𝗽𝗼
╰▸ ${tipoLabel(data?.tipo)}

╭ 👥 𝗔𝘂𝘁𝗼𝗿
╰▸ ${autorUser}

╭ 👤 𝗦𝗼𝗹𝗶𝗰𝗶𝘁𝗮𝗱𝗼 𝗽𝗼𝗿
╰▸ ${senderTag}
┄┄┄┄┄┄┄┄┄┄┄┄┄
> ✅ ꜱɪɴ ᴍᴀʀᴄᴀ ᴅᴇ ᴀɢᴜᴀ · ᴄᴀʟɪᴅᴀᴅ ᴏʀɪɢɪɴᴀʟ${signature()}`
  : undefined


      if (tipo === "video") {
        await sock.sendMessage(chatId, {
          video: { url: item.url },
          caption: captionFinal,
          mentions: !esUltimo ? undefined : (senderJid ? [senderJid] : [])
        }, { quoted: msg })
      } else {
        await sock.sendMessage(chatId, {
          image: { url: item.url },
          caption: captionFinal,
          mentions: !esUltimo ? undefined : (senderJid ? [senderJid] : [])
        }, { quoted: msg })
      }

      if (!esUltimo) await delay(500)
    }

    await sock.sendMessage(chatId, { edit: progreso.key, text: "✅ Contenido enviado con éxito" }).catch(() => {})
    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
  } catch (err) {
    console.error("[instagram] Error:", err?.response?.data || err)
    await sock.sendMessage(chatId, {
      text: "❌ No se pudo descargar el contenido. Verifica que el enlace sea público y válido."
    }, { quoted: msg }).catch(() => {})
    await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }).catch(() => {})
  }
}
