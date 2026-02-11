// src/commands/spotdl.js
import { gotScraping } from "got-scraping"
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const BASE = Buffer.from("aHR0cHM6Ly9zcG90ZG93bi5vcmc=", "base64").toString("utf-8")

const SIGNATURE =
`⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система
> ⟣ 𝗢𝘄𝗻𝗲𝗿: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`

const client = gotScraping.extend({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": `${BASE}/`,
    "Origin": BASE,
    "Accept": "application/json, text/plain, */*",
  },
  timeout: { request: 60000 },
  retry: { limit: 1 },
})

// ─────────────────────────────────────────────
// ✅ Spotify search (sin API key) — token público
// ─────────────────────────────────────────────
async function getSpotifyAccessToken() {
  const r = await client("https://open.spotify.com/get_access_token", {
    searchParams: { reason: "transport", productType: "web_player" },
    responseType: "json",
    timeout: { request: 15000 },
  })

  const token = r.body?.accessToken
  if (!token) throw new Error("No se pudo obtener token de Spotify (bloqueo temporal o rate limit).")
  return token
}

async function spotifySearchTrack(query) {
  const token = await getSpotifyAccessToken()

  const r = await client("https://api.spotify.com/v1/search", {
    searchParams: {
      q: query,
      type: "track",
      limit: 1,
    },
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    responseType: "json",
    timeout: { request: 15000 },
  })

  const item = r.body?.tracks?.items?.[0]
  if (!item) throw new Error("No se encontraron resultados en Spotify.")

  const title = item.name || "Sin título"
  const artist = item.artists?.map(a => a.name).filter(Boolean).join(", ") || "Desconocido"
  const url = item.external_urls?.spotify
  const image =
    item.album?.images?.[0]?.url ||
    item.album?.images?.[1]?.url ||
    item.album?.images?.[2]?.url ||
    ""

  if (!url) throw new Error("No se pudo obtener URL del track.")
  return { title, artist, url, image }
}

// ─────────────────────────────────────────────
// ✅ Descarga por Spotdown (requiere URL track)
// ─────────────────────────────────────────────
async function downloadFromSpotdown(spotifyUrl) {
  // IMPORTANTE: aquí NO usamos streams raros, pedimos buffer directo
  const res = await client.post(`${BASE}/api/download`, {
    json: { url: spotifyUrl },
    responseType: "buffer",
    timeout: { request: 60000 },
  })

  const buf = Buffer.from(res.body || Buffer.alloc(0))
  if (!buf.length) throw new Error("Descarga vacía (Spotdown no devolvió audio).")

  let filename = "song.mp3"
  const disp = res.headers?.["content-disposition"]
  if (disp) {
    const match = String(disp).match(/filename[^;=\n]*=\s*["']?([^"';\n]+)/i)
    if (match?.[1]) filename = match[1]
  }
  filename = filename.replace(/[^a-zA-Z0-9 .\-_]/g, "").trim() || "song.mp3"

  return { buffer: buf, filename }
}

// ─────────────────────────────────────────────
// ✅ Command
// ─────────────────────────────────────────────
export default async function spotdl(sock, msg, { args = [], usedPrefix = ".", command = "spotdl" }) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const query = (args.join(" ") || "").trim()
  if (!query) {
    await sock.sendMessage(chatId, {
      text:
        `✍️ Escribe el nombre de la canción.\n\n` +
        `Ejemplo: *${usedPrefix}${command} despacito*`
    }, { quoted: msg })
    return
  }

  // ❌ NO permitir links
  if (/https?:\/\/|spotify\.com/i.test(query)) {
    await sock.sendMessage(chatId, {
      text: "🚫 *No se permiten links.*\nSolo escribe el nombre de la canción."
    }, { quoted: msg })
    return
  }

  const senderJid = getSenderJid(msg)
  const senderTag = `@${jidToNumber(senderJid)}`

  await sock.sendMessage(chatId, { react: { text: "🔎", key: msg.key } }).catch(() => {})

  try {
    // 1) buscar en Spotify
    const song = await spotifySearchTrack(query)

    const info =
      `🎵 *${song.title}*\n` +
      `👤 *Artista:* ${song.artist}\n\n` +
      `⬇️ *Descargando...*\n\n` +
      `${senderTag}\n\n` +
      `${SIGNATURE}`

    const infoMsg = await sock.sendMessage(chatId, {
      text: info,
      mentions: [senderJid],
    }, { quoted: msg })

    await sock.sendMessage(chatId, { react: { text: "⬇️", key: msg.key } }).catch(() => {})

    // 2) descargar por Spotdown con url del track
    const { buffer, filename } = await downloadFromSpotdown(song.url)

    // 3) enviar audio
    const fileNameClean =
      `${song.title} - ${song.artist}.mp3`.replace(/[\\/:*?"<>|]/g, "_")

    const sent = await sock.sendMessage(chatId, {
      audio: buffer,
      mimetype: "audio/mpeg",
      fileName: fileNameClean || filename || "song.mp3",
    }, { quoted: infoMsg || msg })

    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})

    // mensaje final opcional
    await sock.sendMessage(chatId, {
      text: `✅ *Listo* ${senderTag}\n\n${SIGNATURE}`,
      mentions: [senderJid]
    }, { quoted: sent }).catch(() => {})

  } catch (e) {
    console.error("[spotdl] Error:", e)
    await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }).catch(() => {})
    await sock.sendMessage(chatId, {
      text: `❌ Error: ${e?.message || e}`
    }, { quoted: msg }).catch(() => {})
  }
}