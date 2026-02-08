// src/commands/tiktok.js
import axios from "axios"
import { load as loadHtml } from "cheerio"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"

function signature() {
  return `⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗢𝘄𝗻𝗲𝗿: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`
}

function isTikTokUrl(u = "") {
  u = String(u || "").trim()
  return /tiktok\.com/i.test(u)
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function resolveViaTikWM(url) {
  const res = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
    headers: { "User-Agent": UA },
    timeout: 30_000
  })
  const videoUrl = res?.data?.data?.play
  if (!videoUrl) throw new Error("TikWM no devolvió un enlace válido")
  return videoUrl
}

async function resolveViaSnapTik(url) {
  const homeRes = await axios.get("https://snaptik.app/en2", {
    headers: { "User-Agent": UA },
    timeout: 30_000
  })

  const tokenMatch = String(homeRes.data || "").match(/name="token"\s+value="([^"]+)"/)
  if (!tokenMatch) throw new Error("No se pudo extraer token")

  const token = tokenMatch[1]
  const form = new URLSearchParams()
  form.append("url", url)
  form.append("token", token)
  form.append("lang", "en2")

  const submit = await axios.post("https://snaptik.app/abc2.php", form, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
      "Origin": "https://snaptik.app",
      "Referer": "https://snaptik.app/en2"
    },
    timeout: 40_000
  })

  const html = String(submit.data || "")
  const $ = loadHtml(html)

  const videoUrl =
    $("a.button.download-file").attr("href") ||
    $("a.download-file").attr("href") ||
    $("a.btn-download").attr("href") ||
    (html.match(/https:\/\/[^"']+\.mp4[^"']*/i) || [])[0]

  if (!videoUrl) throw new Error("SnapTik tampoco devolvió enlace válido")
  return videoUrl
}

export default async function tiktok(sock, msg, { args = [], usedPrefix = "." }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const senderJid = getSenderJid(msg)
  const senderTag = `@${jidToNumber(senderJid)}`
  const url = String(args?.[0] || "").trim()

  if (!url || !isTikTokUrl(url)) {
    await sock.sendMessage(chatId, { text: "🔗 Envíame un enlace válido de TikTok." }, { quoted: msg })
    return
  }

  try {
    await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } }).catch(() => {})

    // Mensaje de progreso (edit)
    const steps = [
      "⏳ Descargando video tiktok...",
      "▰▱▱▱▱▱▱▱ 10%",
      "▰▰▱▱▱▱▱▱ 25%",
      "▰▰▰▰▱▱▱▱ 50%",
      "▰▰▰▰▰▰▱▱ 75%",
      "▰▰▰▰▰▰▰▱ 85%",
      "✅ Casi listo..."
    ]

    let progreso = await sock.sendMessage(chatId, { text: steps[0] }, { quoted: msg })

    for (let i = 1; i < steps.length; i++) {
      await delay(800)
      await sock.sendMessage(chatId, { edit: progreso.key, text: steps[i] }).catch(() => {})
    }

    // Resolver URL (TikWM -> SnapTik)
    let videoUrl = null
    try {
      videoUrl = await resolveViaTikWM(url)
    } catch (e1) {
      console.warn("[tiktok] TikWM falló, intentando SnapTik...", e1?.message || e1)
      videoUrl = await resolveViaSnapTik(url)
    }

    // Animación envío
    const envioAnim = ["📤 Enviando video..", "📤 Enviando video....", "📤 Enviando video......."]
    for (const paso of envioAnim) {
      await delay(700)
      await sock.sendMessage(chatId, { edit: progreso.key, text: paso }).catch(() => {})
    }

    await sock.sendMessage(chatId, {
      video: { url: videoUrl },
      caption:
        `📥 *Aquí esta tu video descargado con éxito, sin marca de agua.*\n\n` +
        `${senderTag}\n\n` +
        signature(),
      mentions: senderJid ? [senderJid] : []
    }, { quoted: msg })

    await sock.sendMessage(chatId, { edit: progreso.key, text: "✅ Video enviado con éxito" }).catch(() => {})
    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
  } catch (err) {
    console.error("[tiktok] Error:", err)
    await sock.sendMessage(chatId, {
      text: "❌ No se pudo descargar el video. Puede que el enlace sea privado o haya un error temporal."
    }, { quoted: msg }).catch(() => {})
    await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }).catch(() => {})
  }
}