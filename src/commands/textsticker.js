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

  // Colores que “parpadean”
  const COLORS = [
    "#ff2d2d", // rojo
    "#ff9f0a", // naranja
    "#ffd60a", // amarillo
    "#34c759", // verde
    "#00c7ff", // cyan
    "#0a84ff", // azul
    "#bf5af2", // morado
    "#ff375f"  // rosa
  ]

  // Duración: 4s aprox (16 frames a 4 fps)
  const fps = 4
  const totalFrames = 16

  // Fuente (si no registras, usa sans-serif)
  const fontFamily = "sans-serif"

  for (let i = 0; i < totalFrames; i++) {
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext("2d")

    // Fondo blanco
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, W, H)

    // Texto centrado con sombra suave
    const color = COLORS[i % COLORS.length]

    let fontSize = 64
    ctx.font = `bold ${fontSize}px ${fontFamily}`

    // Ajustar tamaño si el texto es largo
    const maxWidth = 460
    while (ctx.measureText(text).width > maxWidth && fontSize > 30) {
      fontSize -= 2
      ctx.font = `bold ${fontSize}px ${fontFamily}`
    }

    const lines = wrapText(ctx, text, maxWidth)

    const lineHeight = Math.floor(fontSize * 1.15)
    const blockHeight = lines.length * lineHeight
    let y = Math.floor((H - blockHeight) / 2) + lineHeight - 10

    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    // Sombra
    ctx.shadowColor = "rgba(0,0,0,0.20)"
    ctx.shadowBlur = 8
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 3

    // Texto
    ctx.fillStyle = color
    for (const line of lines) {
      ctx.fillText(line, W / 2, y)
      y += lineHeight
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
      author: `частная система - 𝔍𝔬𝔰𝔢 ℭ`
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