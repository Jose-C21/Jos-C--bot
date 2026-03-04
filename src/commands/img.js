// src/commands/img.js
import axios from "axios"
import FormData from "form-data"
import https from "https"

const agent = new https.Agent({ rejectUnauthorized: false })

const API_URL = "https://api.zonerai.com/zoner-ai/txt2img"
const ALLOWED_SIZES = new Set(["512x512", "768x768", "1024x1024"])

// 🛑 Imagen de censura
const CENSOR_IMAGE = "https://i.postimg.cc/k56Ln5X5/IMG-1812.jpg"

// 🔎 Palabras NSFW
const NSFW_WORDS = [
  "desnuda","desnudo","semidesnudo","semidesnudos","semi desnudos","semi desnudo","nude","naked",
  "bikini","lingerie","panty","panties",
  "underwear","boxer","boxers",
  "bra","bralette","tanga","thong",
  "sexy","sensual","erotic","erotico",
  "nsfw","onlyfans",
  "topless","sin ropa","pito","pene","nalga","nalgas",
  "pechos","breasts","boobs",
  "culo","ass","butt",
  "lenceria","lingerie"
]

// 🔍 detector
function isNSFW(prompt = "") {
  const text = prompt.toLowerCase()
  return NSFW_WORDS.some(w => text.includes(w))
}

function parseArgs(args = []) {
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
    timeout: 120000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity
  })

  return Buffer.from(res.data)
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

  // 🚫 Detectar contenido NSFW
  if (isNSFW(prompt)) {
    await sock.sendMessage(
      chatId,
      {
        image: { url: CENSOR_IMAGE },
        caption: "🚫 Contenido censurado"
      },
      { quoted: msg }
    )
    return
  }

  try {
    await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } })
  } catch {}

  try {
    const buffer = await generateImageBuffer({ prompt, size })

    await sock.sendMessage(
      chatId,
      {
        image: buffer,
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