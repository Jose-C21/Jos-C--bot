// src/commands/img.js
import axios from "axios"
import FormData from "form-data"
import https from "https"

const agent = new https.Agent({ rejectUnauthorized: false })

const API_URL = "https://api.zonerai.com/zoner-ai/txt2img"
const CATBOX_URL = "https://catbox.moe/user/api.php"

// tamaños permitidos (ajusta si quieres)
const ALLOWED_SIZES = new Set(["512x512", "768x768", "1024x1024"])

async function uploadToCatbox(buffer) {
  const form = new FormData()
  form.append("reqtype", "fileupload")
  form.append("fileToUpload", buffer, {
    filename: "ai_image.jpg",
    contentType: "image/jpeg"
  })

  const res = await axios.post(CATBOX_URL, form, {
    headers: form.getHeaders(),
    httpsAgent: agent,
    timeout: 60_000
  })

  // catbox responde con texto plano (url)
  const url = String(res.data || "").trim()
  if (!url.startsWith("http")) throw new Error("Catbox no devolvió una URL válida")
  return url
}

async function generateImageBuffer({ prompt, size }) {
  const form = new FormData()
  form.append("Prompt", prompt)
  form.append("Language", "spa_Latn")
  form.append("Size", size)
  form.append("Upscale", "1")

  const res = await axios.post(API_URL, form, {
    headers: {
      ...form.getHeaders(),
      "X-Client-Platform": "web",
      Origin: "https://zonerai.com",
      Referer: "https://zonerai.com/",
      Cookie: ""
    },
    responseType: "arraybuffer",
    httpsAgent: agent,
    timeout: 120_000
  })

  return Buffer.from(res.data)
}

function parseArgs(args = []) {
  // Soporta:
  // .img prompt...
  // .img 1024x1024 prompt...
  const first = (args[0] || "").trim()
  let size = "1024x1024"
  let promptParts = args

  if (ALLOWED_SIZES.has(first)) {
    size = first
    promptParts = args.slice(1)
  }

  const prompt = promptParts.join(" ").trim()
  return { size, prompt }
}

export default async function img(sock, msg, { args = [], usedPrefix = "." }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const { size, prompt } = parseArgs(args)

  if (!prompt) {
    await sock.sendMessage(
      chatId,
      {
        text:
          `✳️ Uso:\n` +
          `*${usedPrefix}img* <prompt>\n` +
          `*${usedPrefix}img* 1024x1024 <prompt>\n\n` +
          `📐 Tamaños: 512x512 | 768x768 | 1024x1024`
      },
      { quoted: msg }
    )
    return
  }

  // Reacción de "procesando" (opcional)
  try {
    await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } })
  } catch {}

  try {
    const buffer = await generateImageBuffer({ prompt, size })
    const url = await uploadToCatbox(buffer)

    // Enviar imagen (WhatsApp puede tomar URL directa)
    await sock.sendMessage(
      chatId,
      {
        image: { url },
        caption:
          `🖼️ Imagen generada\n` +
          `• Tamaño: ${size}\n` +
          `• Prompt: ${prompt}`
      },
      { quoted: msg }
    )

    try {
      await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } })
    } catch {}
  } catch (e) {
    console.error("[img]", e)
    await sock.sendMessage(
      chatId,
      { text: `❌ Error: ${e?.message || String(e)}` },
      { quoted: msg }
    )
    try {
      await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } })
    } catch {}
  }
}