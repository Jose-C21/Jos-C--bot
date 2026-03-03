import fs from "fs"
import path from "path"
import yts from "yt-search"
import axios from "axios"
import config from "../config.js"

const APIKEY = "sk_2fea7c1a-0c7d-429c-bbb7-7a3b936ef4f4"
const API_RESOLVE = "https://api-sky.ultraplus.click/youtube/resolve"

const CARD_IMAGE_URL = "https://i.postimg.cc/TwGh4vDP/IMG-1651.png"
const THUMB_URL = "https://i.postimg.cc/zvGnpW8F/7-C5-CF8-AB-92-E7-45-F5-89-D5-97291-B10761-D.png"

function trad(en = "") {
  const map = {
    "years ago": "años",
    "year ago": "año",
    "months ago": "meses",
    "month ago": "mes",
    "weeks ago": "semanas",
    "week ago": "semana",
    "days ago": "días",
    "day ago": "día",
    "hours ago": "horas",
    "hour ago": "hora",
    "minutes ago": "minutos",
    "minute ago": "minuto",
    "seconds ago": "segundos",
    "second ago": "segundo"
  }

  const out = Object.entries(map).reduce((t, [e, es]) => {
    return t.replace(new RegExp(`\\b${e}\\b`, "g"), es)
  }, en || "")

  return ("hace " + out).trim()
}

function safeFileName(name = "") {
  return name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 50) || "audio"
}

// 🔥 Limitar texto para que no rompa el cuadro
function limitText(text = "", max = 38) {
  if (text.length <= max) return text
  return text.slice(0, max - 3) + "..."
}

async function fetchBuffer(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`fetch failed ${r.status}`)
  const ab = await r.arrayBuffer()
  return Buffer.from(ab)
}

function signature() {
  return `⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`
}

export default async function play(sock, msg, { args, usedPrefix = "." }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const text = (args || []).join(" ").trim()

  const cacheDir = path.join(process.cwd(), "cache", "play")
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })

  if (!text) {
    await sock.sendMessage(chatId, {
      text: `✳️ Uso:\n*${usedPrefix}play* <título o artista>\n\n${signature()}`
    }, { quoted: msg })
    return
  }

  try {
    await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } })
  } catch {}

  try {
    const res = await yts(text)
    if (!res?.videos?.length) throw "Sin resultados."
    const video = res.videos[0]

    const title = limitText(video.title)
    const ytUrl = video.url
    const timestamp = video.timestamp
    const views = video.views || 0
    const subido = trad(video.uploadedAt || video.ago || "")
    const allArtists = limitText(video.author?.name || "Artista desconocido")

    const clean = safeFileName(video.title)
    const filePath = path.join(cacheDir, `${clean}.mp3`)

    // 🔥 DISEÑO PROFESIONAL
    const finalCaption =
      `╭──────〔 🎶 𝐏𝐋𝐀𝐘 𝐌𝐎𝐃𝐔𝐋𝐄 〕──────╮\n` +
      `│\n` +
      `│  🎧  Título: ${title}\n` +
      `│  👤  Artista: ${allArtists}\n` +
      `│\n` +
      `│  ─────────────────────────────\n` +
      `│  ▰▰▰▰▰▰▱▱▱▱  ⏱ ${timestamp}\n` +
      `│\n` +
      `│  👁 ${Number(views).toLocaleString()}\n` +
      `│  📅 ${subido}\n` +
      `│\n` +
      `╰────────────────────────────────╯\n` +
      signature()

    const thumb2 = await fetchBuffer(THUMB_URL)

    const jidUsuario =
      msg?.key?.participant ||
      msg?.participant ||
      msg?.key?.remoteJid

    await sock.sendMessage(chatId, {
      image: { url: CARD_IMAGE_URL },
      caption: finalCaption
    }, { quoted: msg })

    // ⚡ CACHÉ
    if (fs.existsSync(filePath)) {
      const fkontakAudio = {
        key: {
          participants: "0@s.whatsapp.net",
          remoteJid: "0@s.whatsapp.net",
          fromMe: false,
          id: "PlayCache"
        },
        message: {
          locationMessage: {
            name: video.title,
            jpegThumbnail: thumb2,
            description: "🎵 Archivo desde caché"
          }
        },
        participant: "0@s.whatsapp.net"
      }

      await sock.sendMessage(chatId, {
        audio: fs.readFileSync(filePath),
        mimetype: "audio/mpeg",
        contextInfo: { mentionedJid: jidUsuario ? [jidUsuario] : [] }
      }, { quoted: fkontakAudio })

      try { await sock.sendMessage(chatId, { react: { text: "⚡", key: msg.key } }) } catch {}
      return
    }

    const apiRes = await axios.post(
      API_RESOLVE,
      { url: ytUrl, type: "audio", format: "mp3" },
      {
        headers: {
          "Content-Type": "application/json",
          apikey: APIKEY
        }
      }
    )

    const result = apiRes.data?.result || apiRes.data?.data
    let audioUrl = result?.media?.dl_download || result?.media?.direct
    if (!audioUrl) throw "No se pudo obtener el audio."

    if (audioUrl.startsWith("/")) {
      audioUrl = "https://api-sky.ultraplus.click" + audioUrl
    }

    const bin = await axios.get(audioUrl, {
      responseType: "arraybuffer",
      headers: { apikey: APIKEY }
    })

    fs.writeFileSync(filePath, Buffer.from(bin.data))

    const fkontakAudio = {
      key: {
        participants: "0@s.whatsapp.net",
        remoteJid: "0@s.whatsapp.net",
        fromMe: false,
        id: "PlayNuevo"
      },
      message: {
        locationMessage: {
          name: video.title,
          jpegThumbnail: thumb2,
          description: "⚡ Descargado y guardado en caché"
        }
      },
      participant: "0@s.whatsapp.net"
    }

    await sock.sendMessage(chatId, {
      audio: fs.readFileSync(filePath),
      mimetype: "audio/mpeg",
      contextInfo: { mentionedJid: jidUsuario ? [jidUsuario] : [] }
    }, { quoted: fkontakAudio })

    try { await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }) } catch {}
  } catch (e) {
    console.error("[play]", e)
    await sock.sendMessage(chatId, { text: `❌ *Error:* ${e}` }, { quoted: msg })
    try { await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }) } catch {}
  }
}