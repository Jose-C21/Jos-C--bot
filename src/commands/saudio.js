import fs from "fs"
import path from "path"
import { spawn } from "child_process"
import { randomBytes } from "crypto"
import webp from "node-webpmux"
import {
  proto,
  prepareWAMessageMedia,
  generateMessageIDV2,
  downloadContentFromMessage
} from "baileys"
import { buildUserMentionJid, buildUserMentionTag } from "../core/ratelimit.js"

const MAX_AUDIO_SEG = 16
const MAX_VIDEO_SEG = 16
const MAX_VIDEO_TOLERANCE = 0.9 // acepta hasta 16.9 s en videos de ~16 s
const GUARDA_MS = 2 * 60 * 1000
const MAX_BYTES = 25 * 1024 * 1024
const MAX_STICKER_BYTES = 950 * 1000
const PTT = false

const TMP_DIR = path.join(process.cwd(), "tmp", "saudio")
try { fs.mkdirSync(TMP_DIR, { recursive: true }) } catch {}

const guardados = new Map()

const MAX_STICKERS = 3
const BLOQUEO_MS = 3 * 60 * 60 * 1000
const LIMITE_PATH = path.join(process.cwd(), "data", "limite_saudio.json")

function guardarLimites(db) {
  try {
    fs.mkdirSync(path.dirname(LIMITE_PATH), { recursive: true })
    fs.writeFileSync(LIMITE_PATH, JSON.stringify(db))
  } catch {}
}

function leerLimites() {
  let db = {}
  try { db = JSON.parse(fs.readFileSync(LIMITE_PATH, "utf8") || "{}") } catch {}
  const ahora = Date.now()
  let cambio = false
  for (const k of Object.keys(db)) {
    const e = db[k]
    if (!e || typeof e !== "object" || (e.hasta && e.hasta <= ahora)) { delete db[k]; cambio = true }
  }
  if (cambio) guardarLimites(db)
  return db
}

function sumarSticker(clave) {
  const db = leerLimites()
  const e = db[clave] || { n: 0, hasta: 0 }
  e.n += 1
  if (e.n >= MAX_STICKERS) {
    e.hasta = Date.now() + BLOQUEO_MS
    const t = setTimeout(leerLimites, BLOQUEO_MS + 1000)
    t.unref?.()
  }
  db[clave] = e
  guardarLimites(db)
  return e
}

const AVISO = (sock, msg, p, c, seg) =>
  `🚫 ${buildUserMentionTag(sock, msg)}\n\n` +
  `-┊ *ʟɪᴍɪᴛᴇ ᴀʟᴄᴀɴᴢᴀᴅᴏ:* ʜɪᴄɪꜱᴛᴇ ${MAX_STICKERS} ꜱᴛɪᴄᴋᴇʀꜱ ᴄᴏɴ ꜱᴏɴɪᴅᴏ\n` +
  `-┊ ᴘᴀʀᴀ ᴇᴠɪᴛᴀʀ ꜱᴘᴀᴍ ʏ ǫᴜᴇ ᴄᴏɴᴠᴇʀꜱᴇɴ ᴍᴀꜱ, ɴᴏ ᴇꜱᴛᴀʀ ꜱᴏʟᴏ ʜᴀᴄɪᴇɴᴅᴏ ꜱᴛɪᴄᴋᴇʀꜱ 💬\n` +
  `-┊ ᴘᴏᴅʀᴀꜱ ᴠᴏʟᴠᴇʀ ᴀ ᴜꜱᴀʀ *${p}${c}* ᴇɴ *${tiempoLargo(seg)}*\n\n` +
  signature()

function tiempoLargo(seg) {
  const min = Math.max(1, Math.ceil(seg / 60))
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h} ʜ ${m} ᴍɪɴ` : `${m} ᴍɪɴ`
}

const tmp = (ext) => path.join(TMP_DIR, `sa-${randomBytes(6).toString("hex")}.${ext}`)

function signature() {
  return `⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|𝘑𝘊𝘒𝘡𝘐𝘯𝘧𝘪𝘯𝘪𝘵𝘺𝘓𝘰𝘰𝘱\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦 𝑍`
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] })
    let err = ""
    p.stderr.on("data", d => (err += d))
    p.on("error", reject)
    p.on("close", code =>
      code === 0
        ? resolve()
        : reject(new Error(err.split("\n").filter(Boolean).slice(-2).join(" ") || `${cmd} salió con código ${code}`))
    )
  })
}

async function conTemporal(buf, ext, fn) {
  const f = tmp(ext)
  fs.writeFileSync(f, buf)
  try { return await fn(f) } finally { try { fs.unlinkSync(f) } catch {} }
}

function info(buf, ext) {
  return conTemporal(buf, ext, (f) => new Promise((resolve) => {
    const p = spawn("ffmpeg", ["-hide_banner", "-i", f], { stdio: ["ignore", "ignore", "pipe"] })
    let err = ""
    p.stderr.on("data", d => (err += d))
    p.on("error", () => resolve({ dur: 0, tieneAudio: false }))
    p.on("close", () => {
      const m = err.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
      const dur = m ? (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : 0
      resolve({ dur, tieneAudio: /Stream #[^\n]*Audio:/.test(err) })
    })
  }))
}

function detalleAudio(buf, ext, etiqueta) {
  return conTemporal(buf, ext, (f) => new Promise((resolve) => {
    const p = spawn("ffmpeg", ["-hide_banner", "-i", f], { stdio: ["ignore", "ignore", "pipe"] })
    let err = ""
    p.stderr.on("data", d => (err += d))
    p.on("error", () => resolve())
    p.on("close", () => {
      const d = err.match(/Duration:\s*([\d:.]+).*?bitrate:\s*([^\n]+)/)
      const a = err.match(/Stream #[^\n]*Audio:[^\n]+/)
      console.log(`[saudio][audio ${etiqueta}] ${(buf.length / 1024).toFixed(1)} KB | cabecera ${buf.slice(0, 4).toString("latin1")} | dur ${d?.[1] || "?"} | bitrate ${(d?.[2] || "?").trim()} | ${a ? a[0].replace(/^Stream #\S+\s*/, "") : "SIN AUDIO"}`)
      resolve()
    })
  }))
}

function aNotaDeVoz(buf, ext) {
  return conTemporal(buf, ext, async (entrada) => {
    const salida = tmp("ogg")
    try {
      await run("ffmpeg", ["-y", "-v", "error", "-i", entrada, "-t", String(MAX_AUDIO_SEG), "-vn",
        "-ac", "1", "-ar", "48000", "-c:a", "libopus", "-b:a", "48k",
        "-vbr", "on", "-compression_level", "10", "-frame_duration", "20", "-avoid_negative_ts", "make_zero",
        "-f", "ogg", salida])
      return fs.readFileSync(salida)
    } finally { try { fs.unlinkSync(salida) } catch {} }
  })
}

function buildExif(metadata = {}) {
  const json = {
    "sticker-pack-id": "https://github.com/DikaArdnt/Hisoka-Morou",
    "sticker-pack-name": metadata.packname || "",
    "sticker-pack-publisher": metadata.author || "",
    "emojis": metadata.categories ? metadata.categories : [""]
  }
  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x16, 0x00, 0x00, 0x00
  ])
  const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8")
  const exif = Buffer.concat([exifAttr, jsonBuff])
  exif.writeUIntLE(jsonBuff.length, 14, 4)
  return exif
}

async function ponerExif(buf, metadata) {
  const fin = tmp("webp")
  const fout = tmp("webp")
  try {
    fs.writeFileSync(fin, buf)
    const img = new webp.Image()
    await img.load(fin)
    img.exif = buildExif(metadata)
    await img.save(fout)
    return fs.readFileSync(fout)
  } catch (e) {
    console.error("[saudio] no se pudo poner el exif:", e?.message || e)
    return buf
  } finally {
    try { fs.unlinkSync(fin) } catch {}
    try { fs.unlinkSync(fout) } catch {}
  }
}

const PASOS = [{ fps: 15, q: 50 }, { fps: 12, q: 40 }, { fps: 10, q: 30 }, { fps: 8, q: 20 }]

async function aWebp(media, ext, seg, p) {
  const salida = tmp("webp")
  try {
    await conTemporal(media, ext, (f) => run("ffmpeg", ["-y", "-v", "error", "-i", f, "-t", String(seg), "-an",
      "-vf", `fps=${p.fps},scale=512:512:force_original_aspect_ratio=increase,crop=512:512`,
      "-loop", "0", "-c:v", "libwebp", "-q:v", String(p.q), "-compression_level", "6", "-preset", "default", salida]))
    return fs.readFileSync(salida)
  } finally { try { fs.unlinkSync(salida) } catch {} }
}

async function crearSticker(media, ext, seg) {
  const limite = MAX_STICKER_BYTES - 2000
  const deseado = Math.min(seg, MAX_AUDIO_SEG)
  const prueba = Math.min(seg, 6)
  let elegido = null

  for (const p of PASOS) {
    const b = await aWebp(media, ext, prueba, p)
    const caben = Math.floor(limite / (b.length / prueba))
    console.log(`[saudio] prueba ${prueba}s ${p.fps}fps q${p.q}: ${(b.length / 1024).toFixed(0)} KB -> caben ~${caben}s`)
    elegido = { p, caben }
    if (caben >= deseado) break
  }

  let dur = Math.max(2, Math.min(seg, elegido.caben))
  for (let i = 0; i < 4; i++) {
    const b = await aWebp(media, ext, dur, elegido.p)
    console.log(`[saudio] sticker ${dur}s (audio ${seg}s) | ${elegido.p.fps}fps q${elegido.p.q} | ${(b.length / 1024).toFixed(0)} KB`)
    if (b.length <= limite) return b
    dur = Math.max(2, Math.floor(dur * 0.9 * limite / b.length))
  }
  throw new Error("No pude reducir el sticker a menos de 1 MB. Usa un video más corto.")
}

const extDe = (mime = "") => {
  if (mime.includes("webp")) return "webp"
  if (mime.includes("png")) return "png"
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg"
  if (mime.includes("gif")) return "gif"
  if (mime.includes("mp4") || mime.startsWith("video/")) return "mp4"
  if (mime.includes("ogg") || mime.includes("opus")) return "ogg"
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3"
  if (mime.includes("m4a") || mime.includes("aac") || mime.includes("mp4a")) return "m4a"
  if (mime.startsWith("audio/")) return "ogg"
  return "bin"
}

function getCtx(msg) {
  const m = msg?.message || {}
  return (
    m.extendedTextMessage?.contextInfo ||
    m.imageMessage?.contextInfo ||
    m.videoMessage?.contextInfo ||
    m.audioMessage?.contextInfo ||
    null
  )
}

function pickTarget(msg) {
  const ctx = getCtx(msg)
  const src = ctx?.quotedMessage || msg?.message || {}
  const respondio = !!ctx?.stanzaId
  if (src.audioMessage) return { tipo: "audio", node: src.audioMessage, respondio }
  if (src.videoMessage) return { tipo: "video", node: src.videoMessage, respondio }
  if (src.imageMessage) return { tipo: "image", node: src.imageMessage, respondio }
  if (src.stickerMessage) return { tipo: "sticker", node: src.stickerMessage, respondio }
  return { tipo: null, node: null, respondio }
}

async function descargar(node, tipo) {
  const stream = await downloadContentFromMessage(node, tipo)
  const chunks = []
  for await (const c of stream) chunks.push(c)
  return Buffer.concat(chunks)
}

const AYUDA = (p, c) =>
`-┊ *Sticker con sonido* 🔊

Convierte un video en un sticker que suena al tocarlo.

*Con un video que ya tiene sonido:*
- Respóndele con *${p}${c}*
- O envíalo con *${p}${c}* en el pie de foto

*Con una imagen, sticker o video sin sonido:*
1️⃣ Responde a un audio o nota de voz con *${p}${c}* (se guarda 2 minutos)
2️⃣ Después responde a la imagen, sticker o video con *${p}${c}*

⏱ Duración máxima: ${MAX_AUDIO_SEG} segundos

${signature()}`

const varint = (n) => {
  const o = []
  while (n > 127) { o.push((n & 127) | 128); n = Math.floor(n / 128) }
  o.push(n)
  return Buffer.from(o)
}
const campoBytes = (numero, datos) =>
  Buffer.concat([varint(numero * 8 + 2), varint(datos.length), Buffer.from(datos)])

function armarAudioSticker(stickerBytes, audioBytes) {
  const stickerConSonido = Buffer.concat([Buffer.from(stickerBytes), campoBytes(26, audioBytes)])
  const mensajeInterno = campoBytes(26, stickerConSonido)
  return campoBytes(1, mensajeInterno)
}

function parchearEncode() {
  if (proto.Message.__audioStickerParche) return
  const original = proto.Message.encode
  proto.Message.encode = function (mensaje, escritor) {
    const w = original.call(this, mensaje, escritor)
    const crudo = mensaje && mensaje.__audioStickerCrudo
    if (crudo) w.uint32(134 * 8 + 2).bytes(crudo)
    return w
  }
  proto.Message.__audioStickerParche = true
}

async function enviarNativo(sock, chatId, stickerBuf, oggBuf, segundos) {
  parchearEncode()

  const subida = { upload: sock.waUploadToServer }
  const st = await prepareWAMessageMedia({ sticker: stickerBuf }, subida)
  const au = await prepareWAMessageMedia(
    { audio: oggBuf, mimetype: "audio/ogg; codecs=opus", ptt: PTT, seconds: segundos },
    subida
  )
  const stickerMsg = st?.stickerMessage
  const audioMsg = au?.audioMessage
  if (!stickerMsg || !audioMsg) throw new Error("No se pudo subir el sticker o el audio.")

  console.log("[saudio][audioMsg subido]", { mimetype: audioMsg.mimetype, seconds: audioMsg.seconds, ptt: audioMsg.ptt, fileLength: String(audioMsg.fileLength), waveform: !!audioMsg.waveform, mediaKey: !!audioMsg.mediaKey, directPath: !!audioMsg.directPath })
  console.log("[saudio][stickerMsg subido]", { mimetype: stickerMsg.mimetype, isAnimated: stickerMsg.isAnimated, fileLength: String(stickerMsg.fileLength), width: stickerMsg.width, height: stickerMsg.height })
  audioMsg.mimetype = "audio/ogg; codecs=opus"
  audioMsg.seconds = segundos
  audioMsg.ptt = PTT

  const crudo = armarAudioSticker(
    proto.Message.StickerMessage.encode(stickerMsg).finish(),
    proto.Message.AudioMessage.encode(audioMsg).finish()
  )

  const mensaje = proto.Message.create({})
  Object.defineProperty(mensaje, "__audioStickerCrudo", { value: crudo, enumerable: false })
  await sock.relayMessage(chatId, mensaje, { messageId: generateMessageIDV2(sock.user?.id) })
}

async function enviarSeparado(sock, chatId, msg, stickerBuf, oggBuf) {
  const enviado = await sock.sendMessage(chatId, { sticker: stickerBuf }, { quoted: msg })
  await sock.sendMessage(
    chatId,
    { audio: oggBuf, mimetype: "audio/ogg; codecs=opus", ptt: true },
    { quoted: enviado || msg }
  )
}

async function reaccion(sock, msg, emoji) {
  try { await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }) } catch {}
}

export default async function saudio(sock, msg, { command = "saudio", usedPrefix = ".", senderNum, isOwner } = {}) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const modoAlterno = /^(saudio2|saudiob)$/i.test(command)
  const responder = (text) => sock.sendMessage(chatId, { text }, { quoted: msg })

  const { tipo, node, respondio } = pickTarget(msg)

  if (!tipo) {
    if (respondio) {
      return responder(
        `*⚠️ No pude leer el mensaje al que respondiste.*\n> Puede que haya sido eliminado, que sea muy antiguo o que el bot no lo recibió. Reenvía el video o imagen y respóndele a ese mensaje nuevo con *${usedPrefix}${command}*.`
      )
    }
    return responder(AYUDA(usedPrefix, command))
  }

  const clave = String(senderNum || msg?.key?.participant || chatId)
  for (const [k, v] of guardados) if (Date.now() - v.t > GUARDA_MS) guardados.delete(k)

  const mime = node?.mimetype || ""

  try {
    if (tipo === "audio") {
      await reaccion(sock, msg, "⏳")
      const buf = await descargar(node, "audio")
      if (!buf?.length) throw new Error("No pude descargar el audio.")
      if (buf.length > MAX_BYTES) throw new Error("El audio es demasiado pesado.")
      await detalleAudio(buf, extDe(mime), `GUARDADO original (mime ${mime})`)
      const ogg = await aNotaDeVoz(buf, extDe(mime))
      await detalleAudio(ogg, "ogg", "GUARDADO convertido")
      guardados.set(clave, { buf: ogg, t: Date.now() })
      await reaccion(sock, msg, "✅")
      return responder(
        `*✅ Audio guardado* (recortado a ${MAX_AUDIO_SEG} s máx.).\n> Ahora responde a la imagen, video o sticker con *${usedPrefix}${command}*. Vence en 2 minutos.`
      )
    }

    const ahora = Date.now()

    const lim = leerLimites()[clave]
    if (!isOwner && lim && lim.n >= MAX_STICKERS && lim.hasta > ahora) {
      await reaccion(sock, msg, "🚫")
      return sock.sendMessage(chatId, {
        text: AVISO(sock, msg, usedPrefix, command, Math.ceil((lim.hasta - ahora) / 1000)),
        mentions: [buildUserMentionJid(sock, msg)]
      }, { quoted: msg })
    }

    await reaccion(sock, msg, "⏳")
    const media = await descargar(node, tipo)
    if (!media?.length) throw new Error("No pude descargar el archivo.")
    if (media.length > MAX_BYTES) throw new Error("El archivo es demasiado pesado.")

    const ext = extDe(mime)
    const esVideo = tipo === "video"
    let audio = null

    if (esVideo) {
      const inf = await info(media, ext)
      const limiteReal = MAX_VIDEO_SEG + MAX_VIDEO_TOLERANCE
      console.log(`[saudio] video original ${inf.dur.toFixed(1)}s (límite ${limiteReal.toFixed(1)}s) | audio: ${inf.tieneAudio ? "si" : "no"}`)
      if (inf.dur > limiteReal) {
        throw new Error(`El video dura ${inf.dur.toFixed(1)} s. Usa uno de ${MAX_VIDEO_SEG} s o menos.`)
      }
      if (inf.tieneAudio) {
        await detalleAudio(media, ext, `VIDEO original (mime ${mime})`)
        audio = await aNotaDeVoz(media, ext)
        await detalleAudio(audio, "ogg", "VIDEO convertido")
      }
    }

    if (!audio) {
      const g = guardados.get(clave)
      if (g && Date.now() - g.t <= GUARDA_MS) audio = g.buf
    }
    if (!audio) {
      await reaccion(sock, msg, "❌")
      return responder(
        `*⚠️ No tengo ningún audio para ese sticker.*\n> Esto no tiene sonido. Primero responde a un audio con *${usedPrefix}${command}* y luego repite este paso.`
      )
    }

    const dur = (await info(audio, "ogg").catch(() => ({ dur: 0 }))).dur
    const segundos = Math.max(1, Math.min(MAX_AUDIO_SEG, Math.round(dur) || 1))

    let stk
    if (tipo === "sticker") {
      stk = media
      if (stk.length > MAX_STICKER_BYTES) {
        throw new Error("El sticker pesa más de 1 MB y WhatsApp no lo acepta con sonido.")
      }
    } else {
      const senderName = msg?.pushName || "Usuario Desconocido"
      const base = await crearSticker(media, ext, segundos)
      stk = await ponerExif(base, {
        packname: `⟢ ${senderName} `,
        author: `𝘑𝘊𝘒𝘡𝘐𝘯𝘧𝘪𝘯𝘪𝘵𝘺𝘓𝘰𝘰𝘱 - 「 𝐽𝑜𝑠𝑒 𝐶 | 𝐾𝑎𝑡ℎ𝑦 𝑍 」`
      })
    }

    console.log(`[saudio] audio ${dur.toFixed(1)}s (usado ${segundos}s) | sticker final ${(stk.length / 1024).toFixed(0)} KB | modo ${modoAlterno ? "alterno" : "nativo"}`)

    if (modoAlterno) {
      await enviarSeparado(sock, chatId, msg, stk, audio)
    } else {
      try {
        await enviarNativo(sock, chatId, stk, audio, segundos)
        console.log("[saudio] enviado nativo OK")
      } catch (e) {
        console.error("[saudio] el envío nativo falló, uso el modo alterno:", e)
        await enviarSeparado(sock, chatId, msg, stk, audio)
      }
    }

    guardados.delete(clave)

    if (!isOwner) sumarSticker(clave)

    await reaccion(sock, msg, "✅")
  } catch (e) {
    console.error("[saudio]", e)
    await reaccion(sock, msg, "❌")
    await responder(`*❌ No pude hacerlo.*\n> ${e?.message || "Error desconocido"}`)
  }
}