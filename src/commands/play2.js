import fs from "fs"
import path from "path"
import yts from "yt-search"
import axios from "axios"
import { createCanvas, loadImage } from "canvas"

const LOL_API = "https://api.lolhuman.xyz/api/ytaudio"
const LOL_APIKEY = "0f1858daee91a3f548edc9cf"

const THUMB_URL = "https://i.postimg.cc/zvGnpW8F/7-C5-CF8-AB-92-E7-45-F5-89-D5-97291-B10761-D.png"
const MAX_SEG = 1800

const formatearTiempo = s => { if (!s || isNaN(s)) return "0:00"; return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` }

function dividirTexto(ctx, text, maxWidth) {
  let lines = [], line = ""
  for (let w of (text || "").split(" ")) {
    let t = line + w + " "
    if (ctx.measureText(t).width > maxWidth) { lines.push(line.trim()); line = w + " " } else line = t
  }
  lines.push(line.trim())
  return lines.slice(0, 2)
}

async function generarCard({ title, artist, duration, thumbnail }) {
  const canvas = createCanvas(1024, 1024), ctx = canvas.getContext("2d")
  ctx.drawImage(await loadImage(path.join(process.cwd(), "assets", "player5.png")), 0, 0, 1024, 1024)
  let portada
  try { portada = await loadImage(thumbnail) } catch { portada = await loadImage(THUMB_URL) }
  const size = 200, x = 412, y = 425, r = portada.width / portada.height
  let dw = size, dh = size, ox = 0, oy = 0
  if (r > 1) { dw = size * r; ox = -(dw - size) / 2 } else { dh = size / r; oy = -(dh - size) / 2 }
  oy += 28
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, size, size, 25); ctx.clip()
  ctx.drawImage(portada, x + ox, y + oy, dw, dh); ctx.restore()
  ctx.textAlign = "center"; ctx.fillStyle = "#ffffff"; ctx.font = "bold 28px Sans"; ctx.fillText(artist, 512, 670)
  ctx.fillStyle = "#ff2e2e"; ctx.font = "bold 26px Sans"
  const lines = dividirTexto(ctx, title, 700)
  ctx.fillText(lines[0] || "", 512, 710)
  if (lines[1]) ctx.fillText(lines[1], 512, 745)
  ctx.fillStyle = "#b3b3b3"; ctx.font = "24px Sans"
  ctx.textAlign = "left"; ctx.fillText("0:00", 140, 820)
  ctx.textAlign = "right"; ctx.fillText(duration, 880, 820)
  return canvas.toBuffer("image/png")
}

function trad(en = "") {
  const raw = String(en || "").replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").replace(/\s+/g, " ").trim()
  if (!raw) return "fecha desconocida"
  const s = raw.toLowerCase(), es = s.match(/hace .+$/)
  if (es) return es[0]
  if (/^(just now|now)$/.test(s)) return "hace un momento"
  const m = s.match(/(\d+)\s*(years?|yrs?|y|months?|mos?|weeks?|wks?|w|days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\s*ago/)
  if (!m) return raw
  const n = +m[1], k = m[2].slice(0, 2) === "mo" ? "mo" : m[2][0]
  const u = { y: ["año", "años"], mo: ["mes", "meses"], w: ["semana", "semanas"], d: ["día", "días"], h: ["hora", "horas"], m: ["minuto", "minutos"], s: ["segundo", "segundos"] }[k]
  return `hace ${n} ${n === 1 ? u[0] : u[1]}`
}

const safeFileName = (name = "") => name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 50) || "audio"

const signature = () => `⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|𝘑𝘊𝘒𝘡𝘐𝘯𝘧𝘪𝘯𝘪𝘵𝘺𝘓𝘰𝘰𝘱
> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦 𝑍`

/* LOLHUMAN: única API de este comando */
async function lolAudio(ytUrl) {
  try {
    const { data } = await axios.get(LOL_API, {
      params: { apikey: LOL_APIKEY, url: ytUrl },
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 60000
    })
    if (data?.status !== 200) throw new Error(data?.message || "respuesta inválida")
    const r = data?.result || {}
    const link = r.link?.link || (typeof r.link === "string" && r.link) || r.download_url || r.url || r.audio?.link || r.audio?.url
    if (!link) throw new Error("sin link de descarga")
    const dl = await axios.get(link, {
      responseType: "arraybuffer",
      timeout: 90000,
      maxRedirects: 5,
      headers: { "User-Agent": "Mozilla/5.0" }
    })
    const buf = Buffer.from(dl.data)
    return buf.length > 10000 ? buf : null
  } catch (err) {
    console.error("❌ ERROR LOLHUMAN:", err?.response?.status || "", err?.response?.data?.message || err.message)
    return null
  }
}

export default async function play2(sock, msg, { args, usedPrefix = "." }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return
  const text = (args || []).join(" ").trim()

  const cacheDir = path.join(process.cwd(), "cache", "play2")
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })

  if (!text) {
    await sock.sendMessage(chatId, { text: `✳️ Uso:\n*${usedPrefix}play2* <título o artista>\n\n${signature()}` }, { quoted: msg })
    return
  }

  try {
    await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } })

    const res = await yts(text)
    if (!res?.videos?.length) throw "Sin resultados"
    const video = res.videos[0]
    if (video.seconds > MAX_SEG) throw "El video es muy largo (máx. 30 min)"

    const title = video.title
    const ytUrl = video.url
    const duration = video.seconds ? formatearTiempo(video.seconds) : video.timestamp
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

    const bufferImg = await generarCard({ title, artist: allArtists, duration, thumbnail: video.image || video.thumbnail })
    await sock.sendMessage(chatId, { image: bufferImg, caption: finalCaption }, { quoted: msg })

    if (fs.existsSync(filePath)) {
      await sock.sendMessage(chatId, { audio: fs.readFileSync(filePath), mimetype: "audio/mpeg", ptt: false }, { quoted: msg })
      await sock.sendMessage(chatId, { react: { text: "⚡", key: msg.key } })
      return
    }

    const audioBuf = await lolAudio(ytUrl)
    if (!audioBuf) throw "No se pudo obtener audio"

    fs.writeFileSync(filePath, audioBuf)
    await sock.sendMessage(chatId, { audio: audioBuf, mimetype: "audio/mpeg", ptt: false }, { quoted: msg })
    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } })
  } catch (e) {
    console.error("❌ ERROR PLAY2:", e)
    await sock.sendMessage(chatId, { text: `❌ Error: ${e}` }, { quoted: msg })
    await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } })
  }
}
