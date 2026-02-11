import fs from "fs"
import path from "path"
import yts from "yt-search"
import axios from "axios"
import config from "../config.js"

const APIKEY = "sk_2fea7c1a-0c7d-429c-bbb7-7a3b936ef4f4"
const API_RESOLVE = "https://api-sky.ultraplus.click/youtube/resolve"

// miniaturas (las mismas que usabas)
const CARD_IMAGE_URL = "https://i.postimg.cc/zf9B9n1H/27327237-4E86-4321-AD03-EB5B71422C26.png"
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

async function fetchBuffer(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`fetch failed ${r.status}`)
  const ab = await r.arrayBuffer()
  return Buffer.from(ab)
}

// firma nueva
function signature() {
  return `⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗢𝘄𝗻𝗲𝗿: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`
}

export default async function play(sock, msg, { args, usedPrefix = "." }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const text = (args || []).join(" ").trim()

  // === Carpeta de caché ===
  const cacheDir = path.join(process.cwd(), "cache", "play")
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })

  if (!text) {
    await sock.sendMessage(chatId, {
      text: `✳️ Uso:\n*${usedPrefix}play* <título o artista>\n\n${signature()}`
    }, { quoted: msg })
    return
  }

  // reacción cargando
  try {
    await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } })
  } catch {}

  try {
    // 🔍 Buscar en YouTube
    const res = await yts(text)
    if (!res?.videos?.length) throw "Sin resultados."
    const video = res.videos[0]

    const title = video.title
    const ytUrl = video.url
    const timestamp = video.timestamp
    const views = video.views || 0
    const subido = trad(video.uploadedAt || video.ago || "")
    const allArtists = video.author?.name || "Artista desconocido"

    // 🧼 Nombre limpio + ruta
    const clean = safeFileName(title)
    const filePath = path.join(cacheDir, `${clean}.mp3`)

    // 📝 Caption (firma nueva)
    const finalCaption =
      `🔘 *Título:* ${title}\n` +
      `🔘 *Artista:* ${allArtists}\n` +
      `🔘 *Duración:* ${timestamp}\n` +
      `🔘 *Vistas:* ${Number(views).toLocaleString()}\n` +
      `🔘 *Subido:* ${subido}\n\n` +
      signature()

    // 🖼️ Miniatura (para fkontak)
    const thumb2 = await fetchBuffer(THUMB_URL)

    // jid usuario para mention (como en tu código viejo)
    const jidUsuario = msg?.key?.participant || msg?.participant || msg?.key?.remoteJid

    // 🧾 Tarjeta visual
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
            name: title,
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

    // 🌐 API UltraPlus Sky
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

    // 🔧 Normalizar ruta relativa
    if (audioUrl.startsWith("/")) {
      audioUrl = "https://api-sky.ultraplus.click" + audioUrl
    }

    // ⬇️ Descargar audio (con apikey)
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
          name: title,
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