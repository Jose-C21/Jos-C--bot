// src/commands/spotdl.js
import { gotScraping } from "got-scraping"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const SPOTDOWN_BASE = Buffer.from("aHR0cHM6Ly9zcG90ZG93bi5vcmc=", "base64").toString("utf-8")

const SIGNATURE =
`⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система
> ⟣ 𝗢𝘄𝗻𝗲𝗿: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`

// ✅ Cliente SOLO para Spotdown
const spotClient = gotScraping.extend({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": `${SPOTDOWN_BASE}/`,
    "Origin": SPOTDOWN_BASE,
    "Accept": "application/json, text/plain, */*",
  },
  timeout: { request: 60000 },
  retry: { limit: 1 },
})

// ✅ Cliente SOLO para Spotify (sin Origin de spotdown)
const spClient = gotScraping.extend({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Referer": "https://open.spotify.com/",
  },
  timeout: { request: 15000 },
  retry: { limit: 1 },
})

// ─────────────────────────────────────────────
// ✅ Spotify search (token público)
// ─────────────────────────────────────────────
async function getSpotifyAccessToken() {
  const r = await spClient("https://open.spotify.com/get_access_token", {
    searchParams: { reason: "transport", productType: "web_player" },
    responseType: "json",
  })

  const token = r.body?.accessToken
  if (!token) throw new Error("Spotify bloqueó el token (temporal).")
  return token
}

async function spotifySearchTrack(query) {
  const token = await getSpotifyAccessToken()

  const r = await spClient("https://api.spotify.com/v1/search", {
    searchParams: { q: query, type: "track", limit: 1 },
    headers: { Authorization: `Bearer ${token}` },
    responseType: "json",
  })

  const item = r.body?.tracks?.items?.[0]
  if (!item) throw new Error("No se encontraron resultados en Spotify.")

  return {
    title: item.name || "Sin título",
    artist: item.artists?.map(a => a.name).filter(Boolean).join(", ") || "Desconocido",
    url: item.external_urls?.spotify,
    image: item.album?.images?.[0]?.url || "",
  }
}

// ─────────────────────────────────────────────
// ✅ Fallback: búsqueda directa en Spotdown (a veces sirve)
// ─────────────────────────────────────────────
async function spotdownSearch(query) {
  const r = await spotClient(`${SPOTDOWN_BASE}/api/song-details`, {
    searchParams: { url: query },
    responseType: "json",
    timeout: { request: 20000 },
  })

  const s = r.body?.songs?.[0]
  if (!s?.url) throw new Error("Spotdown no devolvió resultados.")
  return {
    title: s.title || "Sin título",
    artist: s.artist || "Desconocido",
    url: s.url,
    image: s.image || s.cover || s.thumbnail || "",
  }
}

// ─────────────────────────────────────────────
// ✅ Descargar por Spotdown usando URL Spotify
// ─────────────────────────────────────────────
async function downloadFromSpotdown(spotifyUrl) {
  const res = await spotClient.post(`${SPOTDOWN_BASE}/api/download`, {
    json: { url: spotifyUrl },
    responseType: "buffer",
    timeout: { request: 60000 },
  })

  const buf = Buffer.from(res.body || Buffer.alloc(0))
  if (!buf.length) throw new Error("Descarga vacía (Spotdown no devolvió audio).")

  return buf
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
      text: `✍️ Escribe el nombre de la canción.\n\nEjemplo: *${usedPrefix}${command} despacito*`
    }, { quoted: msg })
    return
  }

  // ❌ No permitir links
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
    // 1) Buscar (Spotify primero, si bloquea -> Spotdown fallback)
    let song
    try {
      song = await spotifySearchTrack(query)
    } catch (e1) {
      song = await spotdownSearch(query)
    }

    if (!song?.url) throw new Error("No se pudo obtener URL del track.")

    const info =
      `🎵 *${song.title}*\n` +
      `👤 *Artista:* ${song.artist}\n\n` +
      `⬇️ *Descargando...*\n\n` +
      `${senderTag}\n\n` +
      `${SIGNATURE}`

    await sock.sendMessage(chatId, { text: info, mentions: [senderJid] }, { quoted: msg })
    await sock.sendMessage(chatId, { react: { text: "⬇️", key: msg.key } }).catch(() => {})

    // 2) Descargar
    const audioBuf = await downloadFromSpotdown(song.url)

    // 3) Enviar
    const fileName = `${song.title} - ${song.artist}.mp3`.replace(/[\\/:*?"<>|]/g, "_")
    const sent = await sock.sendMessage(chatId, {
      audio: audioBuf,
      mimetype: "audio/mpeg",
      fileName,
    }, { quoted: msg })

    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
    await sock.sendMessage(chatId, {
      text: `✅ *Listo* ${senderTag}\n\n${SIGNATURE}`,
      mentions: [senderJid]
    }, { quoted: sent }).catch(() => {})

  } catch (e) {
    console.error("[spotdl] Error:", e)
    await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }).catch(() => {})
    await sock.sendMessage(chatId, { text: `❌ Error: ${e?.message || e}` }, { quoted: msg }).catch(() => {})
  }
}