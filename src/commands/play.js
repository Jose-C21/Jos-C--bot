// src/commands/play.js
import fs from "fs"
import path from "path"
import yts from "yt-search"
import axios from "axios"
import { generateWAMessageFromContent, proto } from "baileys"

const APIKEY = "sk_2fea7c1a-0c7d-429c-bbb7-7a3b936ef4f4"
const API_RESOLVE = "https://api-sky.ultraplus.click/youtube/resolve"

const CARD_IMAGE_URL = "https://i.postimg.cc/hPYd8Jzz/9AA94CD7-458A-4B9D-B8D2-50EFB0A6E7A5.png"
const THUMB_URL = "https://i.postimg.cc/zvGnpW8F/7-C5-CF8-AB-92-E7-45-F5-89-D5-97291-B10761-D.png"

// ✅ API VIDEO (tu bot viejo)
const VIDEO_RESOLVE = "https://gawrgura-api.onrender.com/download/ytdl?url="

// ✅ 20 minutos
const VIDEO_TTL_MS = 20 * 60 * 1000

// Memoria temporal por mensaje
global.__PLAY_STATE = global.__PLAY_STATE || new Map()

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
  const out = Object.entries(map).reduce((t, [e, es]) => t.replace(new RegExp(`\\b${e}\\b`, "g"), es), en || "")
  return ("hace " + out).trim()
}

function safeFileName(name = "") {
  return name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 60) || "media"
}

async function fetchBuffer(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`fetch failed ${r.status}`)
  const ab = await r.arrayBuffer()
  return Buffer.from(ab)
}

function signature() {
  return `⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗢𝘄𝗻𝗲𝗿: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`
}

function getQuotedKeyIdFromButton(msg) {
  const m = msg?.message || {}
  const ctx =
    m.buttonsResponseMessage?.contextInfo ||
    m.listResponseMessage?.contextInfo ||
    m.interactiveResponseMessage?.contextInfo
  return ctx?.stanzaId || null
}

// ✅ Enviar menú con botones compatibles iPhone/Android (nativeFlow quick_reply)
async function sendPlayInteractive(sock, chatId, quoted, { caption, imageUrl, token }) {
  const waMsg = generateWAMessageFromContent(
    chatId,
    {
      viewOnceMessage: {
        message: {
          interactiveMessage: proto.Message.InteractiveMessage.create({
            header: proto.Message.InteractiveMessage.Header.create({
              hasMediaAttachment: true,
              imageMessage: proto.Message.ImageMessage.create({ url: imageUrl })
            }),
            body: proto.Message.InteractiveMessage.Body.create({ text: caption }),
            footer: proto.Message.InteractiveMessage.Footer.create({ text: "Selecciona:" }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
              buttons: [
                {
                  name: "quick_reply",
                  buttonParamsJson: JSON.stringify({
                    display_text: "Audio",
                    id: `play:audio:${token}`
                  })
                },
                {
                  name: "quick_reply",
                  buttonParamsJson: JSON.stringify({
                    display_text: "Video",
                    id: `play:video:${token}`
                  })
                }
              ]
            })
          })
        }
      }
    },
    { quoted }
  )

  await sock.relayMessage(chatId, waMsg.message, { messageId: waMsg.key.id })
  return waMsg // 👈 aquí está el id del mensaje enviado
}

async function prefetchVideoToCache({ ytUrl, title, cacheDir, token }) {
  const clean = safeFileName(title)
  const videoPath = path.join(cacheDir, `${clean}.mp4`)

  const state = global.__PLAY_STATE.get(token)
  if (!state) return

  // si ya existe, solo set timer
  if (fs.existsSync(videoPath)) {
    state.videoPath = videoPath
    state.videoTimer = setTimeout(() => {
      try { if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath) } catch {}
      global.__PLAY_STATE.delete(token)
    }, VIDEO_TTL_MS)
    return
  }

  // descarga async
  state.videoPromise = (async () => {
    const apiUrl = VIDEO_RESOLVE + encodeURIComponent(ytUrl)
    const res = await axios.get(apiUrl, { timeout: 60_000 })

    const videoUrl = res?.data?.result?.mp4
    if (!videoUrl) throw new Error("No se pudo obtener el mp4 (api video).")

    const bin = await axios.get(videoUrl, { responseType: "arraybuffer", timeout: 180_000 })
    fs.writeFileSync(videoPath, Buffer.from(bin.data))

    state.videoPath = videoPath

    state.videoTimer = setTimeout(() => {
      try { if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath) } catch {}
      global.__PLAY_STATE.delete(token)
    }, VIDEO_TTL_MS)

    return videoPath
  })().catch(err => {
    state.videoError = String(err?.message || err)
    return null
  })

  return state.videoPromise
}

async function downloadAudioToCache({ ytUrl, audioPath }) {
  // 🌐 API UltraPlus Sky
  const apiRes = await axios.post(
    API_RESOLVE,
    { url: ytUrl, type: "audio", format: "mp3" },
    { headers: { "Content-Type": "application/json", apikey: APIKEY } }
  )

  const result = apiRes.data?.result || apiRes.data?.data
  let audioUrl = result?.media?.dl_download || result?.media?.direct
  if (!audioUrl) throw new Error("No se pudo obtener el audio.")

  if (audioUrl.startsWith("/")) audioUrl = "https://api-sky.ultraplus.click" + audioUrl

  const bin = await axios.get(audioUrl, {
    responseType: "arraybuffer",
    headers: { apikey: APIKEY },
    timeout: 180_000
  })

  fs.writeFileSync(audioPath, Buffer.from(bin.data))
  return audioPath
}

async function handlePlayButton(sock, msg, { buttonId, usedPrefix }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  // token viene en el id: play:audio:xxxx
  const parts = String(buttonId).split(":")
  const tokenFromId = parts.length >= 3 ? parts.slice(2).join(":") : null

  // fallback (por si algún cliente no manda id completo)
  const tokenFromQuote = getQuotedKeyIdFromButton(msg)

  const token = tokenFromId || tokenFromQuote
  if (!token) {
    await sock.sendMessage(chatId, { text: `⚠️ Botón inválido. Usa ${usedPrefix}play otra vez.` }, { quoted: msg })
    return
  }

  const st = global.__PLAY_STATE.get(token)
  if (!st) {
    await sock.sendMessage(chatId, { text: `⚠️ Esta selección expiró. Usa ${usedPrefix}play otra vez.` }, { quoted: msg })
    return
  }

  const jidUsuario = msg?.key?.participant || msg?.participant || msg?.key?.remoteJid
  const userNum = (jidUsuario || "").split("@")[0]

  // ✅ AUDIO
  if (String(buttonId).startsWith("play:audio")) {
    try { await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } }) } catch {}

    try {
      if (!fs.existsSync(st.audioPath)) {
        await downloadAudioToCache({ ytUrl: st.ytUrl, audioPath: st.audioPath })
      }

      const fkontakAudio = {
        key: {
          participants: "0@s.whatsapp.net",
          remoteJid: "0@s.whatsapp.net",
          fromMe: false,
          id: "PlayAudio"
        },
        message: {
          locationMessage: {
            name: st.title,
            jpegThumbnail: st.thumb2,
            description: "🎵 Audio"
          }
        },
        participant: "0@s.whatsapp.net"
      }

      await sock.sendMessage(chatId, {
        audio: fs.readFileSync(st.audioPath),
        mimetype: "audio/mpeg",
        contextInfo: { mentionedJid: jidUsuario ? [jidUsuario] : [] }
      }, { quoted: fkontakAudio })

      try { await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }) } catch {}
    } catch (e) {
      await sock.sendMessage(chatId, { text: `❌ Error audio: ${e?.message || e}` }, { quoted: msg })
      try { await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }) } catch {}
    }
    return
  }

  // ✅ VIDEO (one-time + borra)
  if (String(buttonId).startsWith("play:video")) {
    try { await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } }) } catch {}

    // si estaba descargándose
    if (!st.videoPath && st.videoPromise) {
      await st.videoPromise
    }

    if (st.videoError) {
      await sock.sendMessage(chatId, { text: `❌ No pude preparar el video: ${st.videoError}` }, { quoted: msg })
      try { await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }) } catch {}
      return
    }

    if (!st.videoPath || !fs.existsSync(st.videoPath)) {
      await sock.sendMessage(chatId, { text: `⚠️ El video no está listo o expiró. Usa ${usedPrefix}play otra vez.` }, { quoted: msg })
      return
    }

    await sock.sendMessage(chatId, {
      video: fs.readFileSync(st.videoPath),
      mimetype: "video/mp4",
      fileName: `${safeFileName(st.title)}.mp4`,
      caption: `*${st.title}*\n\n⊱┊ @${userNum} 𝗔𝗾𝘂𝗶 𝗲𝘀𝘁𝗮́ 𝘁𝘂 𝘃𝗶𝗱𝗲𝗼.\n\n${signature()}`,
      mentions: jidUsuario ? [jidUsuario] : []
    }, { quoted: msg })

    // ✅ borrar video después de enviar
    try { if (fs.existsSync(st.videoPath)) fs.unlinkSync(st.videoPath) } catch {}
    try { if (st.videoTimer) clearTimeout(st.videoTimer) } catch {}
    global.__PLAY_STATE.delete(token)

    try { await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }) } catch {}
    return
  }
}

export default async function play(sock, msg, { args = [], usedPrefix = ".", buttonId = null }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  // ✅ Si viene de botón
  if (buttonId) {
    await handlePlayButton(sock, msg, { buttonId, usedPrefix })
    return
  }

  const text = (args || []).join(" ").trim()

  const cacheDir = path.join(process.cwd(), "cache", "play")
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })

  if (!text) {
    await sock.sendMessage(chatId, {
      text: `✳️ Uso:\n*${usedPrefix}play* <título o artista>\n\n${signature()}`
    }, { quoted: msg })
    return
  }

  try { await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } }) } catch {}

  try {
    const res = await yts(text)
    if (!res?.videos?.length) throw new Error("Sin resultados.")
    const video = res.videos[0]

    const title = video.title
    const ytUrl = video.url
    const timestamp = video.timestamp
    const views = video.views || 0
    const subido = trad(video.uploadedAt || video.ago || "")
    const allArtists = video.author?.name || "Artista desconocido"

    const clean = safeFileName(title)
    const audioPath = path.join(cacheDir, `${clean}.mp3`)
    const videoPath = path.join(cacheDir, `${clean}.mp4`) // temporal

    const finalCaption =
      `🔘 *Título:* ${title}\n` +
      `🔘 *Artista:* ${allArtists}\n` +
      `🔘 *Duración:* ${timestamp}\n` +
      `🔘 *Vistas:* ${Number(views).toLocaleString()}\n` +
      `🔘 *Subido:* ${subido}\n\n` +
      `*Please Wait*\n\n` +
      signature()

    const thumb2 = await fetchBuffer(THUMB_URL)

    // ✅ enviamos menú (NO enviamos audio aquí)
    const token = `${Date.now()}_${Math.random().toString(16).slice(2)}`
    const sent = await sendPlayInteractive(sock, chatId, msg, {
      caption: finalCaption,
      imageUrl: CARD_IMAGE_URL,
      token
    })

    // guardamos estado
    global.__PLAY_STATE.set(token, {
      title,
      ytUrl,
      audioPath,
      videoPath,
      thumb2,
      videoPathReady: null,
      videoPromise: null,
      videoTimer: null,
      videoError: null
    })

    // ✅ precache VIDEO en background (20 min)
    // (no bloquea, no traba)
    setTimeout(() => {
      prefetchVideoToCache({ ytUrl, title, cacheDir, token }).catch(() => {})
    }, 50)

    try { await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }) } catch {}
  } catch (e) {
    console.error("[play]", e)
    await sock.sendMessage(chatId, { text: `❌ *Error:* ${e?.message || e}` }, { quoted: msg })
    try { await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }) } catch {}
  }
}