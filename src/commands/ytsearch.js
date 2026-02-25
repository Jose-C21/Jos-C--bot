// src/commands/ytsearch.js
import yts from "yt-search"
import axios from "axios"
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

// ─────────────────────────────────────────────
// ✅ CONFIG
// ─────────────────────────────────────────────
const PAGE_SIZE = 7
const CACHE_TIME_MS = 3 * 60 * 1000 // 3 min
const MAX_FILE_SIZE_MB = 80

// ✅ API NUEVA (Sylphy)
const SYLPHY_API = "https://sylphy.xyz/download/ytmp4"
const SYLPHY_KEY = "sylphy-MtyAgpx" // ← tu api_key
const SYLPHY_QUALITY = "720p"       // ← puedes cambiar: 360p/480p/720p/1080p (si la API lo soporta)

// cache en memoria
const ytCache = new Map()

// ─────────────────────────────────────────────
// ✅ HELPERS
// ─────────────────────────────────────────────
function safeFileName(name = "") {
  return String(name)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "video"
}

function signature() {
  return `\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗢𝘄𝗻𝗲𝗿: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`
}

const normalizeDigits = (x) => String(x || "").replace(/\D/g, "")

function getText(msg) {
  const m = msg?.message || {}
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    ""
  ).trim()
}

function getQuotedMsgId(msg) {
  const m = msg?.message || {}
  const q =
    m.extendedTextMessage?.contextInfo?.quotedMessage ||
    m.imageMessage?.contextInfo?.quotedMessage ||
    m.videoMessage?.contextInfo?.quotedMessage ||
    m.documentMessage?.contextInfo?.quotedMessage ||
    null

  const stanzaId =
    m.extendedTextMessage?.contextInfo?.stanzaId ||
    m.imageMessage?.contextInfo?.stanzaId ||
    m.videoMessage?.contextInfo?.stanzaId ||
    m.documentMessage?.contextInfo?.stanzaId ||
    null

  return q && stanzaId ? stanzaId : null
}

function getQuotedFromMe(msg) {
  const m = msg?.message || {}
  const ctx =
    m.extendedTextMessage?.contextInfo ||
    m.imageMessage?.contextInfo ||
    m.videoMessage?.contextInfo ||
    m.documentMessage?.contextInfo ||
    null
  return !!ctx?.participant && !!ctx?.quotedMessage && !!ctx?.stanzaId
}

function formatAgo(v) {
  return v?.ago || "N/A"
}

function formatViews(v) {
  const n = Number(v?.views || 0)
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K"
  return String(n)
}

function msToSec(ms) {
  return Math.max(0, Math.floor(ms / 1000))
}

async function getContentLengthBytes(url) {
  try {
    const head = await axios.head(url, { timeout: 20_000 })
    const len = head?.headers?.["content-length"]
    return len ? parseInt(len, 10) : 0
  } catch {
    return 0
  }
}

async function resolveMp4ViaSylphy(ytUrl) {
  const api = `${SYLPHY_API}?url=${encodeURIComponent(ytUrl)}&q=${encodeURIComponent(SYLPHY_QUALITY)}&api_key=${encodeURIComponent(SYLPHY_KEY)}`
  try {
    const r = await axios.get(api, { timeout: 60_000 })
    const data = r?.data
    const ok = !!data?.status
    const dl = data?.result?.dl_url
    const title = data?.result?.title
    return { ok, dl, title, raw: data }
  } catch (e) {
    return { ok: false, dl: null, title: null, raw: { error: e?.message } }
  }
}

// ✅ mention “real” (jid) para que salga @xxxx
function buildMention(sock, msg) {
  const raw = getSenderJid(msg)
  let decoded = raw
  try { if (sock?.decodeJid) decoded = sock.decodeJid(raw) } catch {}
  const jid = decoded || raw
  const num = jidToNumber(jid) || normalizeDigits(jid)
  return { jid, tag: `@${num}` }
}

// ─────────────────────────────────────────────
// ✅ RENDER PÁGINA
// ─────────────────────────────────────────────
function renderPage({ query, page, totalPages, results, ownerTag, expiresInSec }) {
  const start = (page - 1) * PAGE_SIZE
  const slice = results.slice(start, start + PAGE_SIZE)

  let t = ""
  t += `╭─ 𝗬𝗢𝗨𝗧𝗨𝗕𝗘 𝗦𝗘𝗔𝗥𝗖𝗛\n`
  t += `│ 🔎 Búsqueda: ${query}\n`
  t += `│ 📄 Página: ${page}/${totalPages}\n`
  t += `│ 🎞️ Resultados: ${results.length}\n`
  t += `╰────────────\n\n`

  slice.forEach((v, i) => {
    const n = start + i + 1
    t += `🎬 N${n} • ${v.title}\n`
    t += `   ├ Canal: ${v.author?.name || "N/A"}\n`
    t += `   ├ Duración: ${v.timestamp || "N/A"}\n`
    t += `   ├ Vistas: ${formatViews(v)}\n`
    t += `   └ Publicado: ${formatAgo(v)}\n\n`
  })

  t += `╭─ 𝗖𝗢𝗠𝗢 𝗨𝗦𝗔𝗥\n`
  t += `│ ✅ Descargar: responde a ESTE mensaje con:\n`
  t += `│    • N1  (o N2, N3...)\n`
  t += `│ ✅ Páginas:\n`
  t += `│    • siguiente  (pasa a la próxima)\n`
  t += `│    • anterior   (regresa a la anterior)\n`
  t += `│ ⚠️ Solo puede responder quien hizo la búsqueda: ${ownerTag}\n`
  t += `╰────────────\n`
  t += `⏳ Expira en: ${expiresInSec}s${signature()}`

  return t.trim()
}

// ─────────────────────────────────────────────
// ✅ COMANDO PRINCIPAL: .ytsearch
// ─────────────────────────────────────────────
export default async function ytsearch(sock, msg, { args = [], usedPrefix = ".", command = "ytsearch" } = {}) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const query = (args || []).join(" ").trim()
  if (!query) {
    await sock.sendMessage(chatId, {
      text:
        `💡 Ejemplo:\n` +
        `${usedPrefix}${command} maluma borro cassette\n` +
        `${signature()}`
    }, { quoted: msg })
    return
  }

  const { jid: ownerJid, tag: ownerTag } = buildMention(sock, msg)

  try { await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } }).catch(() => {}) } catch {}

  let results
  try {
    const r = await yts(query)
    results = (r?.videos || []).slice(0, 30) // máximo 30 para paginar hasta 5 páginas con PAGE_SIZE=7
  } catch (e) {
    console.error("[ytsearch yts]", e)
    await sock.sendMessage(chatId, { text: "❌ Error buscando en YouTube." }, { quoted: msg })
    try { await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }).catch(() => {}) } catch {}
    return
  }

  if (!results.length) {
    await sock.sendMessage(chatId, { text: "📭 No se encontraron resultados." }, { quoted: msg })
    try { await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }).catch(() => {}) } catch {}
    return
  }

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const expiresAt = Date.now() + CACHE_TIME_MS
  const text = renderPage({
    query,
    page: 1,
    totalPages,
    results,
    ownerTag,
    expiresInSec: msToSec(expiresAt - Date.now())
  })

  const sent = await sock.sendMessage(chatId, { text }, { quoted: msg })
  const messageId = sent?.key?.id
  if (!messageId) return

  // cache
  ytCache.set(messageId, {
    chatId,
    ownerJid,
    ownerTag,
    query,
    results,
    page: 1,
    totalPages,
    expiresAt,
    expired: false,
    timeoutWarned: false
  })

  // auto-expirar (mensaje + limpiar)
  setTimeout(async () => {
    const row = ytCache.get(messageId)
    if (!row) return
    if (row.expired) return

    row.expired = true
    ytCache.set(messageId, row)

    // mensaje automático de expiración
    await sock.sendMessage(chatId, {
      text:
        `⌛ Esta búsqueda expiró (3 minutos).\n` +
        `📌 Usa ${usedPrefix}${command} <texto> para buscar de nuevo.${signature()}`
    }, { quoted: sent }).catch(() => {})

    setTimeout(() => ytCache.delete(messageId), 15_000)
  }, CACHE_TIME_MS)

  try { await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {}) } catch {}
}

// ─────────────────────────────────────────────
// ✅ “BEFORE” (router): responde al bot con N1/N2, siguiente/anterior
// IMPORTANTE: tu router NO tiene sistema handler.before,
// así que esto se maneja con una función exportada que el router debe llamar.
// ─────────────────────────────────────────────
export async function ytsearchReplyHook(sock, msg) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return false

  // Solo texto
  const text = getText(msg)
  if (!text) return false

  // Debe ser respuesta a un mensaje del bot
  const quotedId = getQuotedMsgId(msg)
  if (!quotedId) return false

  const cache = ytCache.get(quotedId)
  if (!cache) return false

  // Debe ser en el mismo chat
  if (cache.chatId !== chatId) return false

  // Expirado
  if (cache.expired || Date.now() > cache.expiresAt) {
    cache.expired = true
    ytCache.set(quotedId, cache)
    await sock.sendMessage(chatId, { text: `⌛ Esta búsqueda ya expiró. Usa .ytsearch para buscar de nuevo.${signature()}` }, { quoted: msg }).catch(() => {})
    return true
  }

  // Solo el dueño de la búsqueda puede controlar
  const sender = getSenderJid(msg)
  let senderDecoded = sender
  try { if (sock?.decodeJid) senderDecoded = sock.decodeJid(sender) } catch {}
  const senderFinal = senderDecoded || sender

  if (String(senderFinal) !== String(cache.ownerJid)) {
    await sock.sendMessage(chatId, {
      text: `⛔ Solo puede usar esta búsqueda: ${cache.ownerTag}\n📌 Haz tu propia búsqueda con .ytsearch`,
      mentions: [cache.ownerJid]
    }, { quoted: msg }).catch(() => {})
    return true
  }

  const lower = text.trim().toLowerCase()

  // ─────────────────────────
  // ✅ PAGINACIÓN (siguiente/anterior)
  // ─────────────────────────
  if (lower === "siguiente" || lower === "next") {
    const newPage = Math.min(cache.totalPages, cache.page + 1)
    cache.page = newPage
    ytCache.set(quotedId, cache)

    const pageText = renderPage({
      query: cache.query,
      page: cache.page,
      totalPages: cache.totalPages,
      results: cache.results,
      ownerTag: cache.ownerTag,
      expiresInSec: msToSec(cache.expiresAt - Date.now())
    })

    await sock.sendMessage(chatId, { text: pageText }, { quoted: msg }).catch(() => {})
    return true
  }

  if (lower === "anterior" || lower === "prev") {
    const newPage = Math.max(1, cache.page - 1)
    cache.page = newPage
    ytCache.set(quotedId, cache)

    const pageText = renderPage({
      query: cache.query,
      page: cache.page,
      totalPages: cache.totalPages,
      results: cache.results,
      ownerTag: cache.ownerTag,
      expiresInSec: msToSec(cache.expiresAt - Date.now())
    })

    await sock.sendMessage(chatId, { text: pageText }, { quoted: msg }).catch(() => {})
    return true
  }

  // ─────────────────────────
  // ✅ DESCARGA (N1, N2, ...)
  // ─────────────────────────
  const mNum = text.trim().match(/^n(\d{1,2})$/i)
  if (!mNum) return false

  const index = parseInt(mNum[1], 10) - 1
  if (Number.isNaN(index) || index < 0 || index >= cache.results.length) {
    await sock.sendMessage(chatId, {
      text: `⚠️ Número inválido. Usa N1 hasta N${cache.results.length}.`
    }, { quoted: msg }).catch(() => {})
    return true
  }

  const v = cache.results[index]
  if (!v?.url) {
    await sock.sendMessage(chatId, { text: "❌ No se pudo leer el video seleccionado." }, { quoted: msg }).catch(() => {})
    return true
  }

  try { await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } }).catch(() => {}) } catch {}

  // Resolver MP4
  const { ok, dl, title, raw } = await resolveMp4ViaSylphy(v.url)
  if (!ok || !dl) {
    console.error("[ytsearch sylphy fail]", raw)
    await sock.sendMessage(chatId, { text: "❌ La API no devolvió el enlace MP4. Intenta otro video." }, { quoted: msg }).catch(() => {})
    try { await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }).catch(() => {}) } catch {}
    return true
  }

  const finalTitle = title || v.title || "Video"
  const fileName = `${safeFileName(finalTitle)}.mp4`

  // medir tamaño
  const bytes = await getContentLengthBytes(dl)
  const mb = bytes ? (bytes / (1024 * 1024)) : 0
  const sendAsDoc = bytes ? (mb >= MAX_FILE_SIZE_MB) : false

  if (sendAsDoc) {
    // ✅ Documento (sin buffer)
    await sock.sendMessage(chatId, {
      document: { url: dl },
      mimetype: "video/mp4",
      fileName,
      caption:
        `*${finalTitle}*\n` +
        `\n📦 Enviado como *documento* porque pesa ~${mb.toFixed(2)}MB (límite: ${MAX_FILE_SIZE_MB}MB).\n` +
        `👤 Solicitado por: ${cache.ownerTag}` +
        signature(),
      mentions: [cache.ownerJid]
    }, { quoted: msg }).catch(() => {})
  } else {
    // ✅ Video normal (buffer)
    const dlRes = await axios.get(dl, { responseType: "arraybuffer", timeout: 120_000 })
    const buf = Buffer.from(dlRes.data)

    await sock.sendMessage(chatId, {
      video: buf,
      mimetype: "video/mp4",
      fileName,
      caption:
        `*${finalTitle}*\n` +
        `\n👤 Solicitado por: ${cache.ownerTag}` +
        signature(),
      mentions: [cache.ownerJid]
    }, { quoted: msg }).catch(() => {})
  }

  try { await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {}) } catch {}
  return true
}