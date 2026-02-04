import fs from "fs"
import path from "path"
import yts from "yt-search"
import axios from "axios"

const APIKEY = "sk_2fea7c1a-0c7d-429c-bbb7-7a3b936ef4f4"
const API_RESOLVE = "https://api-sky.ultraplus.click/youtube/resolve"

const CARD_IMAGE_URL = "https://i.postimg.cc/hPYd8Jzz/9AA94CD7-458A-4B9D-B8D2-50EFB0A6E7A5.png"
const THUMB_URL = "https://i.postimg.cc/zvGnpW8F/7-C5-CF8-AB-92-E7-45-F5-89-D5-97291-B10761-D.png"

// ✅ API VIDEO (tu bot viejo)
const VIDEO_RESOLVE = "https://gawrgura-api.onrender.com/download/ytdl?url="

// ✅ 20 minutos
const VIDEO_TTL_MS = 20 * 60 * 1000

// Memoria temporal por mensaje (para saber qué video/audio corresponde al botón)
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
  // cuando se toca botón, WhatsApp manda respuesta con contextInfo del mensaje original (la tarjeta)
  const m = msg?.message || {}
  const ctx =
    m.buttonsResponseMessage?.contextInfo ||
    m.listResponseMessage?.contextInfo ||
    m.interactiveResponseMessage?.contextInfo

  // stanzaId suele ser el id del mensaje citado (la tarjeta)
  return ctx?.stanzaId || null
}

async function prefetchVideoToCache({ ytUrl, title, cacheDir, keyId }) {
  // Guardamos estado para poder esperar si el usuario toca antes de terminar
  const clean = safeFileName(title)
  const videoPath = path.join(cacheDir, `${clean}.mp4`)

  const state = global.__PLAY_STATE.get(keyId)
  if (!state) return

  // si ya existe, igual ponemos timer para autodelete
  if (fs.existsSync(videoPath)) {
    state.videoPath = videoPath
    // auto-delete en 20 min
    state.videoTimer = setTimeout(() => {
      try { if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath) } catch {}
      global.__PLAY_STATE.delete(keyId)
    }, VIDEO_TTL_MS)
    return
  }

  // Promesa de descarga (para si el usuario toca mientras baja)
  state.videoPromise = (async () => {
    const apiUrl = VIDEO_RESOLVE + encodeURIComponent(ytUrl)
    const res = await axios.get(apiUrl, { timeout: 60_000 })

    const videoUrl = res?.data?.result?.mp4
    if (!videoUrl) throw new Error("No se pudo obtener el mp4 (api video).")

    const bin = await axios.get(videoUrl, { responseType: "arraybuffer", timeout: 120_000 })
    fs.writeFileSync(videoPath, Buffer.from(bin.data))

    state.videoPath = videoPath

    // auto-delete en 20 min
    state.videoTimer = setTimeout(() => {
      try { if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath) } catch {}
      global.__PLAY_STATE.delete(keyId)
    }, VIDEO_TTL_MS)

    return videoPath
  })().catch(err => {
    state.videoError = String(err?.message || err)
    return null
  })

  return state.videoPromise
}

async function handlePlayButton(sock, msg, { buttonId, usedPrefix }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const keyId = getQuotedKeyIdFromButton(msg)
  if (!keyId) {
    await sock.sendMessage(chatId, { text: `⚠️ Botón inválido. Usa ${usedPrefix}play otra vez.` }, { quoted: msg })
    return
  }

  const st = global.__PLAY_STATE.get(keyId)
  if (!st) {
    await sock.sendMessage(chatId, { text: `⚠️ Esta selección expiró. Usa ${usedPrefix}play otra vez.` }, { quoted: msg })
    return
  }

  const jidUsuario = msg?.key?.participant || msg?.participant || msg?.key?.remoteJid
  const userNum = (jidUsuario || "").split("@")[0]

  if (buttonId === "play:audio") {
    // ✅ AUDIO: si existe en caché -> envía, si no -> baja y guarda (tu lógica)
    if (fs.existsSync(st.audioPath)) {
      await sock.sendMessage(chatId, {
        audio: fs.readFileSync(st.audioPath),
        mimetype: "audio/mpeg",
        contextInfo: { mentionedJid: jidUsuario ? [jidUsuario] : [] }
      }, { quoted: msg })
      try { await sock.sendMessage(chatId, { react: { text: "⚡", key: msg.key } }) } catch {}
      return
    }

    // si no existe (por si algo falló antes)
    await sock.sendMessage(chatId, { text: "⚠️ El audio no está en caché. Usa .play otra vez." }, { quoted: msg })
    return
  }

  // ✅ VIDEO: enviar 1 vez y borrar
  try { await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } }) } catch {}

  // si estaba descargándose, esperamos
  if (!st.videoPath && st.videoPromise) {
    await st.videoPromise
  }

  // error de precache
  if (st.videoError) {
    await sock.sendMessage(chatId, { text: `❌ No pude preparar el video: ${st.videoError}` }, { quoted: msg })
    try { await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }) } catch {}
    return
  }

  if (!st.videoPath || !fs.existsSync(st.videoPath)) {
    await sock.sendMessage(chatId, { text: "⚠️ El video no está listo o expiró. Usa .play otra vez." }, { quoted: msg })
    return
  }

  // enviar video
  await sock.sendMessage(chatId, {
    video: fs.readFileSync(st.videoPath),
    mimetype: "video/mp4",
    fileName: `${safeFileName(st.title)}.mp4`,
    caption: `*${st.title}*\n\n⊱┊ @${userNum} 𝗔𝗾𝘂𝗶 𝗲𝘀𝘁𝗮́ 𝘁𝘂 𝘃𝗶𝗱𝗲𝗼.\n\n${signature()}`,
    mentions: jidUsuario ? [jidUsuario] : []
  }, { quoted: msg })

  // ✅ borrar video después de enviar (one-time)
  try { if (fs.existsSync(st.videoPath)) fs.unlinkSync(st.videoPath) } catch {}

  // limpiar timer y estado
  try { if (st.videoTimer) clearTimeout(st.videoTimer) } catch {}
  global.__PLAY_STATE.delete(keyId)

  try { await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }) } catch {}
}

export default async function play(sock, msg, { args = [], usedPrefix = ".", buttonId = null }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  // ✅ Si viene de botón, lo manejamos aquí
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
    // 🔍 Buscar
    const res = await yts(text)
    if (!res?.videos?.length) throw "Sin resultados."
    const video = res.videos[0]

    const title = video.title
    const ytUrl = video.url
    const timestamp = video.timestamp
    const views = video.views || 0
    const subido = trad(video.uploadedAt || video.ago || "")
    const allArtists = video.author?.name || "Artista desconocido"

    // rutas caché
    const clean = safeFileName(title)
    const audioPath = path.join(cacheDir, `${clean}.mp3`)
    const videoPath = path.join(cacheDir, `${clean}.mp4`) // temporal, se borra

    const finalCaption =
      `🔘 *Título:* ${title}\n` +
      `🔘 *Artista:* ${allArtists}\n` +
      `🔘 *Duración:* ${timestamp}\n` +
      `🔘 *Vistas:* ${Number(views).toLocaleString()}\n` +
      `🔘 *Subido:* ${subido}\n\n` +
      `*Please Wait*\n\n` +
      signature()

    // miniatura (fkontak)
    const thumb2 = await fetchBuffer(THUMB_URL)

    // mention jid
    const jidUsuario = msg?.key?.participant || msg?.participant || msg?.key?.remoteJid

    // ✅ botones
    const buttons = [
      { buttonId: "play:audio", buttonText: { displayText: "Audio" }, type: 1 },
      { buttonId: "play:video", buttonText: { displayText: "Video" }, type: 1 }
    ]

    // enviar tarjeta con botones
    const sent = await sock.sendMessage(chatId, {
      image: { url: CARD_IMAGE_URL },
      caption: finalCaption,
      buttons,
      headerType: 4
    }, { quoted: msg })

    const keyId = sent?.key?.id
    if (keyId) {
      // guardamos estado para botones
      global.__PLAY_STATE.set(keyId, {
        title,
        ytUrl,
        audioPath,
        videoPath,
        thumb2
      })

      // ✅ precache VIDEO (20 min)
      // Nota: video es temporal. Se borra al enviar o por TTL.
      prefetchVideoToCache({ ytUrl, title, cacheDir, keyId }).catch(() => {})
    }

    // ✅ AUDIO: si existe manda al instante y ya (como antes)
    if (fs.existsSync(audioPath)) {
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
        audio: fs.readFileSync(audioPath),
        mimetype: "audio/mpeg",
        contextInfo: { mentionedJid: jidUsuario ? [jidUsuario] : [] }
      }, { quoted: fkontakAudio })

      try { await sock.sendMessage(chatId, { react: { text: "⚡", key: msg.key } }) } catch {}
      return
    }

    // 🌐 bajar audio y guardar (persistente)
    const apiRes = await axios.post(
      API_RESOLVE,
      { url: ytUrl, type: "audio", format: "mp3" },
      { headers: { "Content-Type": "application/json", apikey: APIKEY } }
    )

    const result = apiRes.data?.result || apiRes.data?.data
    let audioUrl = result?.media?.dl_download || result?.media?.direct
    if (!audioUrl) throw "No se pudo obtener el audio."

    if (audioUrl.startsWith("/")) audioUrl = "https://api-sky.ultraplus.click" + audioUrl

    const bin = await axios.get(audioUrl, {
      responseType: "arraybuffer",
      headers: { apikey: APIKEY }
    })

    fs.writeFileSync(audioPath, Buffer.from(bin.data))

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
      audio: fs.readFileSync(audioPath),
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
