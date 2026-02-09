// src/commands/decir.js
import axios from "axios"
import fs from "fs"
import path from "path"
import { execSync } from "child_process"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

function signature() {
  return `⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗢𝘄𝗻𝗲𝗿: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`
}

// saca texto de quoted (si responden un mensaje)
function getQuotedText(msg) {
  const q = msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage
  if (!q) return ""
  return (
    q?.conversation ||
    q?.extendedTextMessage?.text ||
    q?.imageMessage?.caption ||
    q?.videoMessage?.caption ||
    q?.documentMessage?.caption ||
    q?.message?.conversation ||
    ""
  )
}

// limpia links, menciones, emojis/símbolos raros
function cleanText(t = "") {
  return String(t || "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/@(\d{5,16})/g, "")
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}\n]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
}

// Gradio SSE: espera hasta process_completed y devuelve url
async function qwenTTS(text, voice = "Sunny") {
  const session_hash = Math.random().toString(36).slice(2)

  await axios.post(
    "https://qwen-qwen-tts-demo.hf.space/gradio_api/queue/join",
    {
      data: [text, voice],
      event_data: null,
      fn_index: 2,
      trigger_id: 13,
      session_hash
    },
    { timeout: 40_000 }
  )

  // poll simple
  const pollUrl = `https://qwen-qwen-tts-demo.hf.space/gradio_api/queue/data?session_hash=${session_hash}`
  const started = Date.now()
  const TIMEOUT_MS = 90_000

  while (Date.now() - started < TIMEOUT_MS) {
    const { data } = await axios.get(pollUrl, { timeout: 40_000 })
    const chunks = String(data || "").split("\n\n")

    for (const chunk of chunks) {
      if (!chunk.startsWith("data:")) continue
      const payload = chunk.slice(5).trim()
      if (!payload) continue

      let j
      try { j = JSON.parse(payload) } catch { continue }

      if (j?.msg === "process_completed") {
        const url = j?.output?.data?.[0]?.url
        if (url) return url
      }
    }

    // espera un poco y vuelve a consultar
    await new Promise(r => setTimeout(r, 1200))
  }

  throw new Error("No se pudo generar el audio (timeout / servidor ocupado).")
}

export default async function decir(sock, msg, { args = [], usedPrefix = "." }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const senderJid = getSenderJid(msg)
  const senderTag = `@${jidToNumber(senderJid)}`

  // texto escrito o texto citado
  let texto = String(args.join(" ") || "").trim()
  if (!texto) texto = getQuotedText(msg)

  texto = cleanText(texto)

  if (!texto) {
    await sock.sendMessage(chatId, {
      text: `✍️ Escribe o responde un texto para convertirlo en voz.\n\nEjemplo: *${usedPrefix}decir* Hola, ¿cómo estás?`
    }, { quoted: msg })
    return
  }

  await sock.sendMessage(chatId, { react: { text: "🎙️", key: msg.key } }).catch(() => {})

  // ✅ Carpeta tmp (persistente)
  const TMP_DIR = path.join(process.cwd(), "tmp", "decir")
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })

  const base = Date.now()
  const wavPath = path.join(TMP_DIR, `tts_${base}.wav`)
  const opusPath = path.join(TMP_DIR, `tts_${base}.opus`)

  try {
    const voice = "Sunny"

    // 1) generar url
    const audioUrl = await qwenTTS(texto, voice)

    // 2) bajar wav
    const res = await axios.get(audioUrl, { responseType: "arraybuffer", timeout: 60_000 })
    fs.writeFileSync(wavPath, Buffer.from(res.data))

    // 3) convertir a opus (compatible Android/iPhone en WhatsApp)
    //    -ar 48000 + -ac 1 + bitrate razonable
    execSync(
      `ffmpeg -y -i "${wavPath}" -vn -ac 1 -ar 48000 -c:a libopus -b:a 96k "${opusPath}"`,
      { stdio: "ignore" }
    )

    // 4) enviar audio (ptt true = nota de voz)
    const sentAudio = await sock.sendMessage(chatId, {
      audio: fs.readFileSync(opusPath),
      mimetype: "audio/ogg; codecs=opus",
      ptt: false
    }, { quoted: msg })

    // 5) mensaje final
    await sock.sendMessage(chatId, {
      text: `*Aquí tienes tu audio con voz de IA* 🗣️ ${senderTag}\n\n${signature()}`,
      mentions: senderJid ? [senderJid] : []
    }, { quoted: sentAudio })

    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
  } catch (e) {
    console.error("[decir]", e)
    await sock.sendMessage(chatId, {
      text: `❌ Error al generar el audio: ${e?.message || e}`
    }, { quoted: msg }).catch(() => {})
    await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }).catch(() => {})
  } finally {
    // cleanup
    try { if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath) } catch {}
    try { if (fs.existsSync(opusPath)) fs.unlinkSync(opusPath) } catch {}
  }
}
