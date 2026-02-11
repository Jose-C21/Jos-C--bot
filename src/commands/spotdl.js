// src/commands/spotdl.js
import { gotScraping } from "got-scraping"

const BASE = Buffer.from("aHR0cHM6Ly9zcG90ZG93bi5vcmc=", "base64").toString("utf-8")

const client = gotScraping.extend({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Referer: `${BASE}/`,
    Origin: BASE,
    Accept: "application/json, text/plain, */*",
  },
})

const SIGNATURE =
  "⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗢𝘄𝗻𝗲𝗿: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦"

function cleanName(s = "") {
  return String(s)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
}

async function searchSong(query) {
  // ESTA API espera "url", pero acepta texto de búsqueda también (como lo usabas)
  const res = await client(`${BASE}/api/song-details`, {
    searchParams: { url: query },
    responseType: "json",
    timeout: { request: 15000 },
  })

  const data = res.body
  if (!data?.songs?.length) throw new Error("No se encontraron resultados")
  return data.songs[0]
}

async function downloadSong(spotifyUrl) {
  const res = await client.post(`${BASE}/api/download`, {
    json: { url: spotifyUrl },
    responseType: "buffer",
    timeout: { request: 60000 },
  })

  if (!res.body?.length) throw new Error("Descarga vacía")

  let filename = "song.mp3"
  const disp = res.headers["content-disposition"]
  if (disp) {
    const match = String(disp).match(/filename[^;=\n]*=\s*["']?([^"';\n]+)/i)
    if (match?.[1]) filename = match[1].replace(/[^a-zA-Z0-9 .\-_]/g, "").trim()
  }

  return { buffer: Buffer.from(res.body), filename }
}

export default async function spotdl(sock, msg, { args = [], usedPrefix = ".", command = "spotdl" } = {}) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const query = (args.join(" ") || "").trim()

  // ❌ SOLO BÚSQUEDA (no links)
  if (!query) {
    await sock.sendMessage(
      chatId,
      { text: `✍️ Escribe el nombre de la canción.\n\nEjemplo:\n${usedPrefix}${command} Despacito\n\n${SIGNATURE}` },
      { quoted: msg }
    )
    return
  }

  if (/https?:\/\/|spotify\.com/i.test(query)) {
    await sock.sendMessage(
      chatId,
      { text: `🚫 Solo se permite *búsqueda por nombre*, no links.\n\nEjemplo:\n${usedPrefix}${command} Blinding Lights\n\n${SIGNATURE}` },
      { quoted: msg }
    )
    return
  }

  // Reacción (si tu WA la soporta)
  await sock.sendMessage(chatId, { react: { text: "🔎", key: msg.key } }).catch(() => {})

  try {
    const song = await searchSong(query)
    const spotifyUrl = song?.url

    if (!spotifyUrl) throw new Error("No se obtuvo URL de descarga")

    const title = song.title || "Sin título"
    const artist = song.artist || "Desconocido"

    const info = [
      `🎵 *${title}*`,
      `👤 *Artista:* ${artist}`,
      song.duration ? `⏱ *Duración:* ${song.duration}` : "",
      song.album ? `💿 *Álbum:* ${song.album}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    await sock.sendMessage(
      chatId,
      { text: `${info}\n\n⬇️ *Descargando...*\n\n${SIGNATURE}` },
      { quoted: msg }
    )

    await sock.sendMessage(chatId, { react: { text: "⬇️", key: msg.key } }).catch(() => {})

    const { buffer } = await downloadSong(spotifyUrl)

    const contextInfo = {}
    const thumbUrl = song.image || song.cover || song.thumbnail
    if (thumbUrl) {
      contextInfo.externalAdReply = {
        title,
        body: artist,
        thumbnailUrl: thumbUrl,
        sourceUrl: spotifyUrl,
        mediaType: 1,
        renderLargerThumbnail: true,
      }
    }

    const fileName = cleanName(`${title} - ${artist}.mp3`) || "song.mp3"

    await sock.sendMessage(
      chatId,
      {
        audio: buffer,
        mimetype: "audio/mpeg",
        fileName,
        ...(Object.keys(contextInfo).length ? { contextInfo } : {}),
      },
      { quoted: msg }
    )

    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
  } catch (e) {
    console.error("[spotdl]", e)
    await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }).catch(() => {})
    await sock.sendMessage(
      chatId,
      { text: `❌ Error: ${e?.message || e}\n\n${SIGNATURE}` },
      { quoted: msg }
    )
  }
}