// src/commands/textsticker.js
import fs from "fs"
import path from "path"
import crypto from "crypto"
import ffmpeg from "fluent-ffmpeg"
import webp from "node-webpmux"
import { createCanvas, registerFont } from "canvas"

// Opcional: si tienes una fuente bonita en /fonts
// registerFont(path.join(process.cwd(), "fonts", "Inter-Regular.ttf"), { family: "Inter" })

const TMP_DIR = path.join(process.cwd(), "tmp", "textsticker")

function ensureTmp() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })
}

function id() {
  return crypto.randomBytes(6).toString("hex")
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/)
  const lines = []
  let line = ""

  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width <= maxWidth) {
      line = test
    } else {
      if (line) lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  return lines
}

async function buildFrames(text) {
  ensureTmp()
  const job = id()
  const dir = path.join(TMP_DIR, job)
  fs.mkdirSync(dir, { recursive: true })

  const W = 512
  const H = 512

  const COLORS = [
    "#ff2d2d",
    "#ff9f0a",
    "#ffd60a",
    "#34c759",
    "#00c7ff",
    "#0a84ff",
    "#bf5af2",
    "#ff375f"
  ]

  const fps = 4
  const totalFrames = 16
  const fontFamily = "sans-serif"

  // ✅ márgenes reales (para que el texto quede grande)
  const PAD_X = 44
  const PAD_Y = 44
  const maxWidth = W - PAD_X * 2
  const maxHeight = H - PAD_Y * 2

  // ✅ configuración de tamaño (primero intenta grande, luego baja)
  let fontSize = 78
  const minFont = 34
  const maxLines = 5

  // función: calcular líneas y si caben
  const calcLayout = (ctx, t, size) => {
    ctx.font = `900 ${size}px ${fontFamily}`
    const lines = wrapText(ctx, t, maxWidth).slice(0, maxLines)

    const lineHeight = Math.round(size * 1.18)
    const blockHeight = lines.length * lineHeight
    const widest = Math.max(...lines.map(l => ctx.measureText(l).width), 0)

    const fits = widest <= maxWidth && blockHeight <= maxHeight
    return { lines, lineHeight, blockHeight, fits }
  }

  // ✅ elegir tamaño: intenta grande, si no cabe -> baja hasta que quepa
  const tmpCanvas = createCanvas(W, H)
  const tmpCtx = tmpCanvas.getContext("2d")
  let layout = calcLayout(tmpCtx, text, fontSize)

  while (!layout.fits && fontSize > minFont) {
    fontSize -= 2
    layout = calcLayout(tmpCtx, text, fontSize)
  }

  for (let i = 0; i < totalFrames; i++) {
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext("2d")

    // fondo blanco
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, W, H)

    const color = COLORS[i % COLORS.length]

    // aplicar fuente final
    ctx.font = `900 ${fontSize}px ${fontFamily}`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    // ✅ centro PERFECTO del bloque
    const startY = (H - layout.blockHeight) / 2 + layout.lineHeight / 2
    let y = startY

    // sombra suave
    ctx.shadowColor = "rgba(0,0,0,0.18)"
    ctx.shadowBlur = 8
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 3

    // ✅ borde + relleno (se ve más pro)
    ctx.lineWidth = Math.max(6, Math.round(fontSize * 0.12))
    ctx.strokeStyle = "rgba(0,0,0,0.20)"
    ctx.fillStyle = color

    for (const line of layout.lines) {
      ctx.strokeText(line, W / 2, y)
      ctx.fillText(line, W / 2, y)
      y += layout.lineHeight
    }

    const out = path.join(dir, `frame_${String(i).padStart(3, "0")}.png`)
    fs.writeFileSync(out, canvas.toBuffer("image/png"))
  }

  return { dir, fps, totalFrames }
}

async function framesToAnimatedWebp({ dir, fps }) {
  const outWebp = path.join(dir, "out.webp")

  // frame_%03d.png
  const input = path.join(dir, "frame_%03d.png")

  await new Promise((resolve, reject) => {
    ffmpeg(input)
      .inputFPS(fps)
      .outputOptions([
        "-vcodec", "libwebp",
        "-loop", "0",
        "-preset", "default",
        "-an",
        "-vsync", "0",
        // sticker webp: 512x512, mantener
        "-vf", "scale=512:512:flags=lanczos"
      ])
      .toFormat("webp")
      .on("end", resolve)
      .on("error", reject)
      .save(outWebp)
  })

  return outWebp
}

async function addExif(webpPath, metadata = {}) {
  const out = path.join(path.dirname(webpPath), `sticker_${id()}.webp`)

  const img = new webp.Image()
  await img.load(webpPath)

  const json = {
    "sticker-pack-id": "private-system",
    "sticker-pack-name": metadata.packname || "Stickerz",
    "sticker-pack-publisher": metadata.author || "частная система",
    "emojis": metadata.categories || [""]
  }

  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x16, 0x00, 0x00, 0x00
  ])

  const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8")
  const exif = Buffer.concat([exifAttr, jsonBuff])
  exif.writeUIntLE(jsonBuff.length, 14, 4)

  img.exif = exif
  await img.save(out)

  return out
}

function cleanup(dir) {
  try {
    const files = fs.readdirSync(dir)
    for (const f of files) {
      try { fs.unlinkSync(path.join(dir, f)) } catch {}
    }
    try { fs.rmdirSync(dir) } catch {}
  } catch {}
}

export default async function textsticker(sock, msg, { args = [], usedPrefix = "." }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const text = (args || []).join(" ").trim()
  if (!text) {
    await sock.sendMessage(chatId, {
      text: `✳️ Uso:\n*${usedPrefix}textsticker* <texto>\n\nEjemplo:\n${usedPrefix}textsticker HOLA 😎`
    }, { quoted: msg })
    return
  }

  try {
    await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } }).catch(() => {})

    const { dir, fps } = await buildFrames(text)
    const webpTmp = await framesToAnimatedWebp({ dir, fps })

    const stickerFinal = await addExif(webpTmp, {
      packname: `╰► ${msg.pushName || "Usuario"}`,
      author: `частная система - 𝐽𝑜𝑠𝑒 𝐶 ↔ 𝐾𝑎𝑡ℎ𝑦`
    })

    await sock.sendMessage(chatId, { sticker: fs.readFileSync(stickerFinal) }, { quoted: msg })
    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})

    cleanup(dir)
  } catch (e) {
    console.error("[textsticker]", e)
    await sock.sendMessage(chatId, { text: "❌ Error creando el sticker (revisa que FFmpeg esté instalado)." }, { quoted: msg })
    await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }).catch(() => {})
  }
}