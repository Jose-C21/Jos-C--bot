// src/commands/ytsearch.js
import yts from "yt-search"
import axios from "axios"
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

// ✅ API NUEVA (Sylphy)
const SYLPHY_API = "https://sylphy.xyz/download/ytmp4"
const SYLPHY_KEY = "sylphy-MtyAgpx"
const SYLPHY_QUALITY = "720p"

// configuración
const PAGE_SIZE = 7
const CACHE_TTL_MS = 3 * 60 * 1000 // 3 min
const MAX_PAGES = 10
const MAX_MB_DOC = 80

// cache en memoria (por id del mensaje del bot)
const CACHE = new Map()

const onlyDigits = (x) => String(x || "").replace(/\D/g, "")

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

function setCache(messageId, data) {
  CACHE.set(messageId, data)
}

function getCache(messageId) {
  const row = CACHE.get(messageId)
  if (!row) return null
  if (!row?.ts || Date.now() - row.ts > CACHE_TTL_MS) {
    CACHE.delete(messageId)
    return null
  }
  return row
}

function cleanupCache() {
  const now = Date.now()
  for (const [k, v] of CACHE.entries()) {
    if (!v?.ts || now - v.ts > CACHE_TTL_MS) CACHE.delete(k)
  }
}
setInterval(cleanupCache, 30_000).unref?.()

// ─────────────────────────────────────────────
// ✅ quoted helpers (para detectar replies)
// ─────────────────────────────────────────────
function unwrapMessage(msg) {
  let m = msg?.message || {}
  while (true) {
    if (m?.ephemeralMessage?.message) { m = m.ephemeralMessage.message; continue }
    if (m?.viewOnceMessageV2?.message) { m = m.viewOnceMessageV2.message; continue }
    if (m?.viewOnceMessageV2Extension?.message) { m = m.viewOnceMessageV2Extension.message; continue }
    break
  }
  return m
}

function getQuotedInfo(msg) {
  const m = unwrapMessage(msg)
  const ctx =
    m?.extendedTextMessage?.contextInfo ||
    m?.imageMessage?.contextInfo ||
    m?.videoMessage?.contextInfo ||
    m?.documentMessage?.contextInfo ||
    null

  if (!ctx) return null
  const stanzaId = ctx.stanzaId || ctx?.quotedMessage?.stanzaId
  const participant = ctx.participant
  return { stanzaId, participant }
}

function getText(msg) {
  const m = unwrapMessage(msg)
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    ""
  ).trim()
}

function getMentionJid(sock, msg) {
  const raw = getSenderJid(msg)
  let decoded = raw
  try { if (sock?.decodeJid) decoded = sock.decodeJid(raw) } catch {}
  return decoded || raw
}

function getMentionTag(sock, msg) {
  const jid = getMentionJid(sock, msg)
  const num = jidToNumber(jid) || onlyDigits(jid)
  return `@${num || "usuario"}`
}

function getExpireLeftSec(row) {
  const left = Math.ceil((row.ts + CACHE_TTL_MS - Date.now()) / 1000)
  return Math.max(0, left)
}

// ─────────────────────────────────────────────
// ✅ render página (MISMO DISEÑO QUE TE GUSTA)
// ─────────────────────────────────────────────
function buildPageText({ subject, query, page, totalPages, total, ownerTag, usedPrefix, slice, startIndex, expiresSec }) {
  const head =
`╭─ 𝗬𝗢𝗨𝗧𝗨𝗕𝗘 𝗦𝗘𝗔𝗥𝗖𝗛
│ 🔎 Búsqueda: ${query}
│ 📌 Grupo: ${subject}
│ 📄 Página: ${page}/${totalPages}   •   🎞️ Resultados: ${total}
│ 👑 Control: ${ownerTag}
│ ⏳ Expira en: ${expiresSec}s
╰────────────`

  let body = ""
  slice.forEach((v, i) => {
    const n = i + 1
    const idx = startIndex + i + 1
    body +=
`╭─ N${n}  •  #${idx}
│ 🎬 ${v.title}
│ 👤 ${v.author?.name || "N/A"}  •  ⏱️ ${v.timestamp || "N/A"}
│ 👁️ ${String(v.views || 0).toLocaleString("en-US")}  •  🕒 ${v.ago || "N/A"}
╰─ ${v.url}

`
  })

  const help =
`╭─ 𝗖𝗢𝗠𝗢 𝗨𝗦𝗔𝗥
│ ✅ Descargar: responde a ESTE mensaje con: N1 / N2 / N3...
│ ▶️ Siguiente página: responde con: siguiente
│ ◀️ Página anterior: responde con: anterior
│ 🧩 Nueva búsqueda: ${usedPrefix}ytsearch <texto>
╰────────────${signature()}`

  return `${head}\n\n${body.trim()}\n\n${help}`.trim()
}

// ─────────────────────────────────────────────
// ✅ resolver mp4 por API Sylphy
// ─────────────────────────────────────────────
async function resolveMp4Sylphy(ytUrl) {
  const apiUrl =
    `${SYLPHY_API}?url=${encodeURIComponent(ytUrl)}&q=${encodeURIComponent(SYLPHY_QUALITY)}&api_key=${encodeURIComponent(SYLPHY_KEY)}`

  const apiRes = await axios.get(apiUrl, { timeout: 60_000 })
  const ok = !!apiRes?.data?.status
  const dl_url = apiRes?.data?.result?.dl_url
  const title = apiRes?.data?.result?.title
  const quality = apiRes?.data?.result?.quality
  return { ok, dl_url, title, quality, raw: apiRes?.data }
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

// ─────────────────────────────────────────────
// ✅ HOOK: manejar replies (siguiente/anterior/Nx)
// ─────────────────────────────────────────────
export async function ytsearchReplyHook(sock, msg) {
  try {
    const chatId = msg?.key?.remoteJid
    if (!chatId) return false
    if (!msg?.message) return false

    const text = getText(msg)
    if (!text) return false

    // debe ser reply a un mensaje del bot
    const quoted = getQuotedInfo(msg)
    if (!quoted?.stanzaId) return false

    // ⚠️ si ya no existe cache, es porque expiró
    const cachedRow = CACHE.get(quoted.stanzaId)
    if (cachedRow && cachedRow.type === "ytsearch") {
      const still = getCache(quoted.stanzaId)
      if (!still) {
        const prefix = cachedRow.usedPrefix || "."
        await sock.sendMessage(chatId, {
          text:
            `📭 Esta lista ya expiró (3 minutos).\n\n` +
            `✅ Para buscar otra vez:\n` +
            `• ${prefix}ytsearch <texto>\n\n` +
            `Ejemplo:\n` +
            `• ${prefix}ytsearch anuel` +
            signature()
        }, { quoted: msg }).catch(() => {})
        return true
      }
    }

    const cache = getCache(quoted.stanzaId)
    if (!cache || cache.type !== "ytsearch") return false
    if (cache.chatId !== chatId) return false

    // ✅ SOLO EL DUEÑO CONTROLA (comparar por jid y por número)
    const replierJid = getMentionJid(sock, msg)
    const replierNum = jidToNumber(replierJid) || onlyDigits(replierJid)

    const ownerJid = cache.ownerJid
    const ownerNum = cache.ownerNum

    if ((ownerJid && String(replierJid) !== String(ownerJid)) && (ownerNum && String(replierNum) !== String(ownerNum))) {
      const tag = getMentionTag(sock, msg)
      await sock.sendMessage(chatId, {
        text:
          `⛔ ${tag}\n` +
          `Solo quien hizo la búsqueda puede controlar esta lista.\n\n` +
          `📌 Haz tu propia búsqueda con:\n` +
          `• ${cache.usedPrefix || "."}ytsearch <texto>`,
        mentions: [replierJid]
      }, { quoted: msg }).catch(() => {})
      return true
    }

    const t = text.trim().toLowerCase()

    // ── PAGINACIÓN
    if (t === "siguiente" || t === "next") {
      const newPage = Math.min(cache.totalPages, cache.page + 1)
      if (newPage === cache.page) return true

      cache.page = newPage
      cache.ts = Date.now()

      const start = (cache.page - 1) * PAGE_SIZE
      const slice = cache.results.slice(start, start + PAGE_SIZE)

      const expiresSec = getExpireLeftSec(cache)

      const pageText = buildPageText({
        subject: cache.subject,
        query: cache.query,
        page: cache.page,
        totalPages: cache.totalPages,
        total: cache.results.length,
        ownerTag: cache.ownerTag,
        usedPrefix: cache.usedPrefix || ".",
        slice,
        startIndex: start,
        expiresSec
      })

      const sent = await sock.sendMessage(chatId, {
        text: pageText,
        mentions: cache.ownerJid ? [cache.ownerJid] : []
      }, { quoted: msg }).catch(() => null)

      // ✅ nueva página = nuevo control (nuevo id en cache)
      if (sent?.key?.id) {
        setCache(sent.key.id, { ...cache, ts: Date.now() })
      }
      return true
    }

    if (t === "anterior" || t === "prev") {
      const newPage = Math.max(1, cache.page - 1)
      if (newPage === cache.page) return true

      cache.page = newPage
      cache.ts = Date.now()

      const start = (cache.page - 1) * PAGE_SIZE
      const slice = cache.results.slice(start, start + PAGE_SIZE)

      const expiresSec = getExpireLeftSec(cache)

      const pageText = buildPageText({
        subject: cache.subject,
        query: cache.query,
        page: cache.page,
        totalPages: cache.totalPages,
        total: cache.results.length,
        ownerTag: cache.ownerTag,
        usedPrefix: cache.usedPrefix || ".",
        slice,
        startIndex: start,
        expiresSec
      })

      const sent = await sock.sendMessage(chatId, {
        text: pageText,
        mentions: cache.ownerJid ? [cache.ownerJid] : []
      }, { quoted: msg }).catch(() => null)

      if (sent?.key?.id) {
        setCache(sent.key.id, { ...cache, ts: Date.now() })
      }
      return true
    }

    // ── DESCARGA: N1..N7 (de la página actual)
    const m = t.match(/^n\s*(\d{1,2})$/i) || t.match(/^n(\d{1,2})$/i)
    if (!m) return false

    const n = parseInt(m[1], 10)
    if (!n || n < 1 || n > PAGE_SIZE) {
      await sock.sendMessage(chatId, { text: `⚠️ Número inválido. Usa N1 hasta N${PAGE_SIZE}.` }, { quoted: msg }).catch(() => {})
      return true
    }

    const start = (cache.page - 1) * PAGE_SIZE
    const index = start + (n - 1)
    const video = cache.results[index]
    if (!video?.url) {
      await sock.sendMessage(chatId, { text: `⚠️ Ese N${n} no existe en esta página.` }, { quoted: msg }).catch(() => {})
      return true
    }

    // reacción “cargando”
    try { await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } }) } catch {}

    try {
      const { ok, dl_url, title, quality, raw } = await resolveMp4Sylphy(video.url)
      if (!ok || !dl_url) {
        console.error("[ytsearch sylphy]", raw)
        await sock.sendMessage(chatId, { text: "❌ La API no devolvió el MP4. Intenta otro video." }, { quoted: msg }).catch(() => {})
        try { await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }) } catch {}
        return true
      }

      const finalTitle = title || video.title || "Video"
      const ownerTag = cache.ownerTag
      const ownerJid = cache.ownerJid
      const fileName = `${safeFileName(finalTitle)}.mp4`

      // medir tamaño (si no se puede, queda 0 y se manda normal)
      const bytes = await getContentLengthBytes(dl_url)
      const mb = bytes ? (bytes / (1024 * 1024)) : 0
      const sendAsDoc = bytes ? (mb >= MAX_MB_DOC) : false

      if (sendAsDoc) {
        await sock.sendMessage(chatId, {
          document: { url: dl_url },
          mimetype: "video/mp4",
          fileName,
          caption:
            `*${finalTitle}*\n` +
            `\n📦 Enviado como *documento* porque pesa ~${mb.toFixed(2)}MB (límite: ${MAX_MB_DOC}MB).\n` +
            `🎞️ Calidad: ${quality || SYLPHY_QUALITY}\n` +
            `👑 Solicitado por: ${ownerTag}` +
            signature(),
          mentions: ownerJid ? [ownerJid] : []
        }, { quoted: msg }).catch(() => {})
      } else {
        // ✅ envío normal por URL (más estable que buffer)
        await sock.sendMessage(chatId, {
          video: { url: dl_url },
          mimetype: "video/mp4",
          fileName,
          caption:
            `*${finalTitle}*\n` +
            `\n🎞️ Calidad: ${quality || SYLPHY_QUALITY}\n` +
            `👑 Solicitado por: ${ownerTag}` +
            signature(),
          mentions: ownerJid ? [ownerJid] : []
        }, { quoted: msg }).catch(() => {})
      }

      try { await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }) } catch {}
      return true
    } catch (e) {
      console.error("[ytsearch download]", e)
      await sock.sendMessage(chatId, { text: "❌ Error al descargar el video." }, { quoted: msg }).catch(() => {})
      try { await sock.sendMessage(chatId, { react: { text: "⚠️", key: msg.key } }) } catch {}
      return true
    }
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────
// ✅ COMANDO: ytsearch
// ─────────────────────────────────────────────
export default async function ytsearch(sock, msg, { args = [], usedPrefix = ".", command = "ytsearch" } = {}) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const isGroup = String(chatId).endsWith("@g.us")
  const query = (args || []).join(" ").trim()

  if (!query) {
    await sock.sendMessage(chatId, {
      text:
        `📌 Uso:\n` +
        `• ${usedPrefix}${command} anuel\n\n` +
        `📍 Luego responde al mensaje del bot con:\n` +
        `• N1 (descargar)\n` +
        `• siguiente / anterior (páginas)` +
        signature()
    }, { quoted: msg })
    return
  }

  try { await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } }) } catch {}

  let subject = "Chat"
  if (isGroup) {
    try {
      const md = await sock.groupMetadata(chatId)
      subject = (md?.subject || "Grupo").trim()
    } catch {}
  }

  const ownerJid = getMentionJid(sock, msg)
  const ownerNum = jidToNumber(ownerJid) || onlyDigits(ownerJid)
  const ownerTag = getMentionTag(sock, msg)

  try {
    const results = await yts(query)
    const vids = (results?.videos || []).slice(0, PAGE_SIZE * MAX_PAGES)

    if (!vids.length) {
      await sock.sendMessage(chatId, { text: "❌ No encontré resultados en YouTube." }, { quoted: msg })
      try { await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }) } catch {}
      return
    }

    const totalPagesReal = Math.max(1, Math.ceil(vids.length / PAGE_SIZE))
    const totalPages = Math.min(totalPagesReal, MAX_PAGES)
    const page = 1

    const start = 0
    const slice = vids.slice(start, start + PAGE_SIZE)
    const expiresSec = Math.max(1, Math.ceil(CACHE_TTL_MS / 1000))

    const pageText = buildPageText({
      subject,
      query,
      page,
      totalPages,
      total: vids.length,
      ownerTag,
      usedPrefix,
      slice,
      startIndex: start,
      expiresSec
    })

    const sent = await sock.sendMessage(chatId, {
      text: pageText,
      mentions: ownerJid ? [ownerJid] : []
    }, { quoted: msg })

    const msgId = sent?.key?.id
    if (msgId) {
      setCache(msgId, {
        type: "ytsearch",
        chatId,
        query,
        subject,
        usedPrefix,
        results: vids,
        page,
        totalPages,
        ts: Date.now(),
        ownerJid,
        ownerNum,
        ownerTag
      })

      // ✅ aviso automático al expirar (3 min)
      setTimeout(async () => {
        const row = CACHE.get(msgId)
        if (!row) return
        if (!row?.ts || Date.now() - row.ts > CACHE_TTL_MS) {
          await sock.sendMessage(chatId, {
            text:
              `⌛ La lista de *ytsearch* expiró (3 minutos).\n` +
              `✅ Para buscar de nuevo:\n` +
              `• ${usedPrefix}${command} <texto>` +
              signature()
          }, { quoted: sent }).catch(() => {})
          CACHE.delete(msgId)
        }
      }, CACHE_TTL_MS + 8000)
    }

    try { await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }) } catch {}
  } catch (e) {
    console.error("[ytsearch]", e)
    await sock.sendMessage(chatId, { text: "❌ Error al buscar en YouTube." }, { quoted: msg })
    try { await sock.sendMessage(chatId, { react: { text: "⚠️", key: msg.key } }) } catch {}
  }
}