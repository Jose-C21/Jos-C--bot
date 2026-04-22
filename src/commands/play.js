import fs from "fs"
import path from "path"
import yts from "yt-search"
import axios from "axios"
import { createCanvas, loadImage } from "canvas"
import config from "../config.js"

const SKY_APIKEY = "sk_2fea7c1a-0c7d-429c-bbb7-7a3b936ef4f4"
const SKY_API = "https://api-sky.ultraplus.click/youtube/resolve"

const SYLPHY_APIKEY = "sylphy-MtyAgpx"
const SYLPHY_API = "https://sylphyy.xyz/download/v2/ytmp3"

const THUMB_URL = "https://i.postimg.cc/zvGnpW8F/7-C5-CF8-AB-92-E7-45-F5-89-D5-97291-B10761-D.png"

/* ========================= */
/* 🎧 GENERADOR DE IMAGEN */
/* ========================= */
async function generarCard({ title, artist, duration, thumbnail }) {
  const canvas = createCanvas(1024, 1024)
  const ctx = canvas.getContext("2d")

  // fondo base (TU PNG)
  const bg = await loadImage("./assets/player.png")
  ctx.drawImage(bg, 0, 0, 1024, 1024)

  // portada
  const portada = await loadImage(thumbnail)
  ctx.drawImage(portada, 140, 520, 220, 220)

  // ARTISTA
  ctx.fillStyle = "#ffffff"
  ctx.font = "bold 38px Sans"
  ctx.fillText(artist.slice(0, 25), 400, 580)

  // TITULO
  ctx.fillStyle = "#ff2e2e"
  ctx.font = "bold 42px Sans"
  ctx.fillText(title.slice(0, 28), 400, 640)

  // TIEMPO
  ctx.fillStyle = "#aaa"
  ctx.font = "26px Sans"
  ctx.fillText("0:00", 400, 720)
  ctx.fillText(duration, 820, 720)

  return canvas.toBuffer("image/png")
}

/* ========================= */

function trad(en = "") {
  const map = {
    "years ago": "años", "year ago": "año",
    "months ago": "meses", "month ago": "mes",
    "weeks ago": "semanas", "week ago": "semana",
    "days ago": "días", "day ago": "día",
    "hours ago": "horas", "hour ago": "hora",
    "minutes ago": "minutos", "minute ago": "minuto",
    "seconds ago": "segundos", "second ago": "segundo"
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
  const ab = await r.arrayBuffer()
  return Buffer.from(ab)
}

function signature() {
  return `⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система
> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`
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

    /* BUSCAR */
    const res = await yts(text)
    if (!res?.videos?.length) throw "Sin resultados"

    const video = res.videos[0]

    const title = video.title
    const ytUrl = video.url
    const timestamp = video.timestamp
    const views = video.views || 0
    const subido = trad(video.uploadedAt || video.ago || "")
    const allArtists = video.author?.name || "Artista desconocido"

    const clean = safeFileName(title)
    const filePath = path.join(cacheDir, `${clean}.mp3`)

    const finalCaption =
      `🔘 ᴛɪᴛᴜʟᴏ: ${title}\n\n` +
      `🔘 ᴀʀᴛɪꜱᴛᴀ: ${allArtists}\n\n` +
      `🔘 ᴅᴜʀᴀᴄɪᴏɴ: ${timestamp}\n\n` +
      `👁 ${Number(views).toLocaleString()} • 📅 ${subido}\n\n` +
      signature()

    const thumb2 = await fetchBuffer(THUMB_URL)
    const jidUsuario = msg?.key?.participant || msg?.participant || msg?.key?.remoteJid

    /* 🎧 IMAGEN DINÁMICA */
    const bufferImg = await generarCard({
      title,
      artist: allArtists,
      duration: timestamp,
      thumbnail: video.image || video.thumbnail
    })

    await sock.sendMessage(chatId, {
      image: bufferImg,
      caption: finalCaption
    }, { quoted: msg })

    /* CACHE */
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

      await sock.sendMessage(chatId, { react: { text: "⚡", key: msg.key } })
      return
    }

    let audioUrl = null

    /* SYLPHY */
    try {
      const sylphy = await axios.get(
        `${SYLPHY_API}?url=${encodeURIComponent(ytUrl)}&api_key=${SYLPHY_APIKEY}`,
        { headers: { Accept: "application/json" }, timeout: 30000 }
      )

      if (sylphy.data?.status && sylphy.data?.result?.dl_url) {
        audioUrl = sylphy.data.result.dl_url
      }
    } catch { }

    /* FALLBACK SKY */
    if (!audioUrl) {
      const sky = await axios.post(
        SKY_API,
        { url: ytUrl, type: "audio", format: "mp3" },
        {
          headers: {
            "Content-Type": "application/json",
            apikey: SKY_APIKEY
          }
        }
      )

      const result = sky.data?.result || sky.data?.data
      audioUrl = result?.media?.dl_download || result?.media?.direct

      if (audioUrl?.startsWith("/")) {
        audioUrl = "https://api-sky.ultraplus.click" + audioUrl
      }
    }

    if (!audioUrl) throw "No se pudo obtener audio"

    /* DESCARGAR */
    const bin = await axios.get(audioUrl, {
      responseType: "arraybuffer",
      timeout: 60000
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

    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } })

  } catch (e) {

    console.error("❌ ERROR PLAY:", e)

    await sock.sendMessage(chatId, {
      text: `❌ *Error:* ${e}`
    }, { quoted: msg })

    await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } })
  }
}
