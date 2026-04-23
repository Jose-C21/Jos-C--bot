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
/* 🔥 UTILIDADES */
/* ========================= */

function formatearTiempo(segundos) {
  if (!segundos || isNaN(segundos)) return "0:00"
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

function dividirTexto(ctx, text, maxWidth) {
  let words = (text || "").split(" ")
  let lines = []
  let line = ""

  for (let word of words) {
    let test = line + word + " "
    if (ctx.measureText(test).width > maxWidth) {
      lines.push(line.trim())
      line = word + " "
    } else {
      line = test
    }
  }

  lines.push(line.trim())
  return lines.slice(0, 2)
}


/* ========================= */
/* 🎧 GENERADOR FINAL PRO */
/* ========================= */

async function generarCard({ title, artist, duration, thumbnail }) {
  const canvas = createCanvas(1024, 1024)
  const ctx = canvas.getContext("2d")

  const bg = await loadImage(path.join(process.cwd(), "assets", "player3.png"))
  ctx.drawImage(bg, 0, 0, 1024, 1024)

  let portada
  try {
    portada = await loadImage(thumbnail)
  } catch {
    portada = await loadImage(THUMB_URL)
  }

  /* ========================= */
  /* 🎯 PORTADA AJUSTADA PERFECTA */
  /* ========================= */

  const size = 200

  // 🔥 POSICIÓN REAL (ajustada al diseño)
  const x = 412
  const y = 425

  const imgRatio = portada.width / portada.height

  let drawWidth = size
  let drawHeight = size
  let offsetX = 0
  let offsetY = 0

  if (imgRatio > 1) {
    drawWidth = size * imgRatio
    offsetX = -(drawWidth - size) / 2
  } else {
    drawHeight = size / imgRatio
    offsetY = -(drawHeight - size) / 2
  }

  // 🔥 AJUSTE FINO FINAL (CLAVE)
  offsetY += 28

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, size, size, 25)
  ctx.clip()

  ctx.drawImage(
    portada,
    x + offsetX,
    y + offsetY,
    drawWidth,
    drawHeight
  )

  ctx.restore()


  /* ========================= */
  /* 🎯 TEXTO CENTRADO */
  /* ========================= */

  ctx.textAlign = "center"

  // ARTISTA
  ctx.fillStyle = "#ffffff"
  ctx.font = "bold 28px Sans"
  ctx.fillText(artist, 512, 670)

  // TITULO
  ctx.fillStyle = "#ff2e2e"
  ctx.font = "bold 26px Sans"

  const lines = dividirTexto(ctx, title, 700)
  ctx.fillText(lines[0] || "", 512, 710)
  if (lines[1]) ctx.fillText(lines[1], 512, 745)


  /* ========================= */
  /* 🎯 TIEMPO (POSICIÓN EXACTA) */
  /* ========================= */

  ctx.fillStyle = "#b3b3b3"
  ctx.font = "24px Sans"

  ctx.textAlign = "left"
  ctx.fillText("0:00", 140, 820)

  ctx.textAlign = "right"
  ctx.fillText(duration, 880, 820)


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
  return Buffer.from(await r.arrayBuffer())
}

function signature() {
  return `⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система
> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`
}


/* ========================= */
/* 🚀 PLAY */
/* ========================= */

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

    const res = await yts(text)
    if (!res?.videos?.length) throw "Sin resultados"

    const video = res.videos[0]

    const title = video.title
    const ytUrl = video.url

    const duration = video.seconds
      ? formatearTiempo(video.seconds)
      : video.timestamp

    const views = video.views || 0
    const subido = trad(video.uploadedAt || video.ago || "")
    const allArtists = video.author?.name || "Artista desconocido"

    const clean = safeFileName(title)
    const filePath = path.join(cacheDir, `${clean}.mp3`)

    const finalCaption =
      `🔘 TITULO: ${title}\n\n` +
      `🔘 ARTISTA: ${allArtists}\n\n` +
      `🔘 DURACION: ${duration}\n\n` +
      `👁 ${Number(views).toLocaleString()} • 📅 ${subido}\n\n` +
      signature()

    const thumb2 = await fetchBuffer(THUMB_URL)
    const jidUsuario = msg?.key?.participant || msg?.participant || msg?.key?.remoteJid

    const bufferImg = await generarCard({
      title,
      artist: allArtists,
      duration,
      thumbnail: video.image || video.thumbnail
    })

    await sock.sendMessage(chatId, {
      image: bufferImg,
      caption: finalCaption
    }, { quoted: msg })


    if (fs.existsSync(filePath)) {

      await sock.sendMessage(chatId, {
        audio: fs.readFileSync(filePath),
        mimetype: "audio/mpeg"
      }, { quoted: msg })

      await sock.sendMessage(chatId, { react: { text: "⚡", key: msg.key } })
      return
    }

    let audioUrl = null

    try {
      const sylphy = await axios.get(
        `${SYLPHY_API}?url=${encodeURIComponent(ytUrl)}&api_key=${SYLPHY_APIKEY}`
      )

      if (sylphy.data?.status && sylphy.data?.result?.dl_url) {
        audioUrl = sylphy.data.result.dl_url
      }
    } catch {}

    if (!audioUrl) {
      const sky = await axios.post(
        SKY_API,
        { url: ytUrl, type: "audio", format: "mp3" },
        { headers: { apikey: SKY_APIKEY } }
      )

      const result = sky.data?.result || sky.data?.data
      audioUrl = result?.media?.dl_download || result?.media?.direct
    }

    if (!audioUrl) throw "No se pudo obtener audio"

    const bin = await axios.get(audioUrl, { responseType: "arraybuffer" })

    fs.writeFileSync(filePath, Buffer.from(bin.data))

    await sock.sendMessage(chatId, {
      audio: fs.readFileSync(filePath),
      mimetype: "audio/mpeg"
    }, { quoted: msg })

    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } })

  } catch (e) {

    console.error("❌ ERROR PLAY:", e)

    await sock.sendMessage(chatId, {
      text: `❌ Error: ${e}`
    }, { quoted: msg })

    await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } })
  }
}
