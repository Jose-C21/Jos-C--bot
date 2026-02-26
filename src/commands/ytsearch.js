// src/commands/ytsearch.js
import yts from "yt-search"
import axios from "axios"
import fs from "fs"
import path from "path"
import { pipeline } from "stream/promises"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

// ✅ API NUEVA (Sylphy)
const SYLPHY_API = "https://sylphy.xyz/download/ytmp4"
const SYLPHY_KEY = "sylphy-MtyAgpx"
const SYLPHY_QUALITY = "360p"

// Config
const PAGE_SIZE = 7
const TTL_MS = 3 * 60 * 1000 // 3 min reales por SESIÓN
const MAX_PAGES = 10
const MAX_MB_DOC = 80

// ✅ TEMP DIR (fallback a archivo)
const TMP_DIR = path.join(process.cwd(), "data", "ytcache")
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true })

// ✅ SESIONES: 1 búsqueda = 1 sessionId (vive 3 min, aunque cambies página)
const SESSIONS = new Map()        // sessionId -> sessionData
const MSG2SESSION = new Map()     // messageId(bot) -> sessionId

const onlyDigits = (x) => String(x || "").replace(/\D/g, "")

function signature() {
  return `\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`
}

function safeFileName(name = "") {
  return String(name)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "video"
}

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

function nowSecLeft(session) {
  const left = Math.ceil((session.createdAt + TTL_MS - Date.now()) / 1000)
  return Math.max(0, left)
}

function isExpired(session) {
  return !session || session.expired || (Date.now() - session.createdAt > TTL_MS)
}

function cleanup() {
  const now = Date.now()
  for (const [sid, s] of SESSIONS.entries()) {
    if (!s?.createdAt || now - s.createdAt > TTL_MS + 30_000) {
      SESSIONS.delete(sid)
    }
  }
  for (const [mid, sid] of MSG2SESSION.entries()) {
    if (!SESSIONS.has(sid)) MSG2SESSION.delete(mid)
  }
}
setInterval(cleanup, 30_000).unref?.()

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
// ✅ Sylphy resolver
// ─────────────────────────────────────────────
async function resolveMp4Sylphy(ytUrl) {
  const apiUrl =
    `${SYLPHY_API}?url=${encodeURIComponent(ytUrl)}&q=${encodeURIComponent(SYLPHY_QUALITY)}&api_key=${encodeURIComponent(SYLPHY_KEY)}`
  const apiRes = await axios.get(apiUrl, { timeout: 60_000 })
  const ok = !!apiRes?.data?.status
  const dl_url = apiRes?.data?.result?.dl_url
  const title = apiRes?.data?.result?.title
  const quality = apiRes?.data?.result?.quality
  const author = apiRes?.data?.result?.author
  return { ok, dl_url, title, quality, author, raw: apiRes?.data }
}

async function getContentLengthBytes(url) {
  try {
    const head = await axios.head(url, {
      timeout: 20_000,
      maxRedirects: 3,
      validateStatus: () => true
    })
    const len = head?.headers?.["content-length"]
    return len ? parseInt(len, 10) : 0
  } catch {
    return 0
  }
}

async function sendWithTimeout(promise, ms, label = "send") {
  let t
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(`TIMEOUT_${label}_${ms}ms`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(t)
  }
}

// ─────────────────────────────────────────────
// ✅ NUEVO: enviar por STREAM (sin guardar en disco)
// ─────────────────────────────────────────────
async function axiosStream(url) {
  const res = await axios.get(url, {
    responseType: "stream",
    timeout: 120_000,
    maxRedirects: 5,
    validateStatus: () => true
  })
  if (res.status < 200 || res.status >= 400) {
    throw new Error(`HTTP_STREAM_${res.status}`)
  }
  return res.data // Readable stream
}

async function sendMediaStream(sock, chatId, msg, { asDoc, stream, fileName, caption, mentions }) {
  stream.on("error", () => {}) // evita crash por stream

  const payload = asDoc
    ? { document: { stream }, mimetype: "video/mp4", fileName, caption, mentions }
    : { video: { stream }, mimetype: "video/mp4", fileName, caption, mentions }

  return await sendWithTimeout(
    sock.sendMessage(chatId, payload, { quoted: msg }),
    180_000,
    asDoc ? "doc_stream" : "video_stream"
  )
}

// ─────────────────────────────────────────────
// ✅ FALLBACK: descargar a archivo temporal y borrar al final
// ─────────────────────────────────────────────
function tmpPathFor(fileName) {
  const base = safeFileName(fileName).replace(/\.mp4$/i, "")
  const stamp = Date.now() + "-" + Math.random().toString(16).slice(2)
  return path.join(TMP_DIR, `${base}-${stamp}.mp4`)
}

async function downloadToFile(url, outPath) {
  const res = await axios.get(url, { responseType: "stream", timeout: 180_000, maxRedirects: 5 })
  await pipeline(res.data, fs.createWriteStream(outPath))
  return outPath
}

async function sendFromFile(sock, chatId, msg, { asDoc, filePath, fileName, caption, mentions }) {
  const stream = fs.createReadStream(filePath)
  stream.on("error", () => {}) // evita crash

  const payload = asDoc
    ? { document: { stream }, mimetype: "video/mp4", fileName, caption, mentions }
    : { video: { stream }, mimetype: "video/mp4", fileName, caption, mentions }

  return await sendWithTimeout(
    sock.sendMessage(chatId, payload, { quoted: msg }),
    220_000,
    asDoc ? "doc_file" : "video_file"
  )
}

// ─────────────────────────────────────────────
// ✅ HOOK replies
// ─────────────────────────────────────────────
export async function ytsearchReplyHook(sock, msg) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return false
  if (!msg?.message) return false

  const text = getText(msg)
  if (!text) return false

  const quoted = getQuotedInfo(msg)
  if (!quoted?.stanzaId) return false

  const sessionId = MSG2SESSION.get(quoted.stanzaId)
  if (!sessionId) return false

  const session = SESSIONS.get(sessionId)
  if (!session || session.chatId !== chatId) return false

  // expiró
  if (isExpired(session)) {
    session.expired = true
    await sock.sendMessage(chatId, {
      text:
        `📭 Esta lista ya expiró (3 minutos).\n\n` +
        `✅ Para buscar otra vez:\n` +
        `• ${session.usedPrefix}ytsearch <texto>\n\n` +
        `Ejemplo:\n` +
        `• ${session.usedPrefix}ytsearch anuel` +
        signature()
    }, { quoted: msg }).catch(() => {})
    return true
  }

  // ✅ SOLO EL MISMO USUARIO (dueño) controla
  const replierJid = getMentionJid(sock, msg)
  const replierNum = jidToNumber(replierJid) || onlyDigits(replierJid)

  const ownerJid = session.ownerJid
  const ownerNum = session.ownerNum

  if ((ownerJid && String(replierJid) !== String(ownerJid)) && (ownerNum && String(replierNum) !== String(ownerNum))) {
    const tag = getMentionTag(sock, msg)
    await sock.sendMessage(chatId, {
      text:
        `⛔ ${tag}\n` +
        `Solo quien hizo la búsqueda puede controlar esta lista.\n\n` +
        `📌 Haz tu propia búsqueda con:\n` +
        `• ${session.usedPrefix}ytsearch <texto>`,
      mentions: [replierJid]
    }, { quoted: msg }).catch(() => {})
    return true
  }

  const t = text.trim().toLowerCase()

  // ── PAGINACIÓN
  if (t === "siguiente" || t === "next") {
    const newPage = Math.min(session.totalPages, session.page + 1)
    if (newPage === session.page) return true
    session.page = newPage

    const start = (session.page - 1) * PAGE_SIZE
    const slice = session.results.slice(start, start + PAGE_SIZE)

    const pageText = buildPageText({
      subject: session.subject,
      query: session.query,
      page: session.page,
      totalPages: session.totalPages,
      total: session.results.length,
      ownerTag: session.ownerTag,
      usedPrefix: session.usedPrefix,
      slice,
      startIndex: start,
      expiresSec: nowSecLeft(session)
    })

    const sent = await sock.sendMessage(chatId, {
      text: pageText,
      mentions: session.ownerJid ? [session.ownerJid] : []
    }, { quoted: msg }).catch(() => null)

    if (sent?.key?.id) {
      MSG2SESSION.set(sent.key.id, sessionId)
      session.lastBotMsgId = sent.key.id
    }
    return true
  }

  if (t === "anterior" || t === "prev") {
    const newPage = Math.max(1, session.page - 1)
    if (newPage === session.page) return true
    session.page = newPage

    const start = (session.page - 1) * PAGE_SIZE
    const slice = session.results.slice(start, start + PAGE_SIZE)

    const pageText = buildPageText({
      subject: session.subject,
      query: session.query,
      page: session.page,
      totalPages: session.totalPages,
      total: session.results.length,
      ownerTag: session.ownerTag,
      usedPrefix: session.usedPrefix,
      slice,
      startIndex: start,
      expiresSec: nowSecLeft(session)
    })

    const sent = await sock.sendMessage(chatId, {
      text: pageText,
      mentions: session.ownerJid ? [session.ownerJid] : []
    }, { quoted: msg }).catch(() => null)

    if (sent?.key?.id) {
      MSG2SESSION.set(sent.key.id, sessionId)
      session.lastBotMsgId = sent.key.id
    }
    return true
  }

  // ── DESCARGA N1..N7 (página actual)
  const mm = t.match(/^n\s*(\d{1,2})$/i) || t.match(/^n(\d{1,2})$/i)
  if (!mm) return false

  const n = parseInt(mm[1], 10)
  if (!n || n < 1 || n > PAGE_SIZE) {
    await sock.sendMessage(chatId, { text: `⚠️ Número inválido. Usa N1 hasta N${PAGE_SIZE}.` }, { quoted: msg }).catch(() => {})
    return true
  }

  const start = (session.page - 1) * PAGE_SIZE
  const index = start + (n - 1)
  const video = session.results[index]
  if (!video?.url) {
    await sock.sendMessage(chatId, { text: `⚠️ Ese N${n} no existe en esta página.` }, { quoted: msg }).catch(() => {})
    return true
  }

  try { await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } }).catch(() => {}) } catch {}
  console.log(`[ytsearch] download request N${n} page=${session.page} url=${video.url}`)

  try {
    const { ok, dl_url, title, quality, raw } = await resolveMp4Sylphy(video.url)
    if (!ok || !dl_url) {
      console.error("[ytsearch sylphy] bad response:", raw)
      await sock.sendMessage(chatId, { text: "❌ La API no devolvió el MP4. Intenta otro video." }, { quoted: msg }).catch(() => {})
      try { await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }).catch(() => {}) } catch {}
      return true
    }

    const finalTitle = title || video.title || "Video"
    const fileName = `${safeFileName(finalTitle)}.mp4`

    // tamaño
    const bytes = await getContentLengthBytes(dl_url)
    const mb = bytes ? (bytes / (1024 * 1024)) : 0
    const sendAsDoc = bytes ? (mb >= MAX_MB_DOC) : false

    const captionBase =
      `*${finalTitle}*\n` +
      `\n🎞️ Calidad: ${quality || SYLPHY_QUALITY}\n` +
      `👑 Solicitado por: ${session.ownerTag}`

    const captionDoc =
      captionBase +
      `\n📦 Enviado como *documento* porque pesa ~${mb.toFixed(2)}MB (límite: ${MAX_MB_DOC}MB).` +
      signature()

    // ✅ 1) STREAM (sin disco)
    try {
      const stream = await axiosStream(dl_url)
      stream.on("error", () => {}) // evita crash por error de stream

      if (sendAsDoc) {
        console.log(`[ytsearch] sending as DOCUMENT (~${mb.toFixed(2)}MB) [STREAM]`)
        await sendMediaStream(sock, chatId, msg, {
          asDoc: true,
          stream,
          fileName,
          caption: captionDoc,
          mentions: session.ownerJid ? [session.ownerJid] : []
        })
      } else {
        console.log(`[ytsearch] sending as VIDEO (~${mb ? mb.toFixed(2) : "?"}MB) [STREAM]`)
        await sendMediaStream(sock, chatId, msg, {
          asDoc: false,
          stream,
          fileName,
          caption: captionBase + signature(),
          mentions: session.ownerJid ? [session.ownerJid] : []
        })
      }

      try { await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {}) } catch {}
      console.log("[ytsearch] sent OK [STREAM]")
      return true
    } catch (eStream) {
      console.error("[ytsearch stream error]", eStream)
    }

    // ✅ 2) FALLBACK A ARCHIVO (se borra al terminar)
    let fp = null
    try {
      fp = tmpPathFor(fileName)
      console.log(`[ytsearch] fallback download -> ${fp}`)
      await downloadToFile(dl_url, fp)

      if (sendAsDoc) {
        console.log(`[ytsearch] sending as DOCUMENT (~${mb.toFixed(2)}MB) [FILE]`)
        await sendFromFile(sock, chatId, msg, {
          asDoc: true,
          filePath: fp,
          fileName,
          caption: captionDoc,
          mentions: session.ownerJid ? [session.ownerJid] : []
        })
      } else {
        console.log(`[ytsearch] sending as VIDEO [FILE]`)
        await sendFromFile(sock, chatId, msg, {
          asDoc: false,
          filePath: fp,
          fileName,
          caption: captionBase + signature(),
          mentions: session.ownerJid ? [session.ownerJid] : []
        })
      }

      try { await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {}) } catch {}
      console.log("[ytsearch] sent OK [FILE]")
      return true
    } finally {
      if (fp) {
        fs.promises.unlink(fp).catch(() => {})
      }
    }
  } catch (e) {
    console.error("[ytsearch send error]", e)
    await sock.sendMessage(chatId, {
      text:
        `❌ No se pudo enviar el video.\n` +
        `• Puede ser muy pesado para el servidor o la API.\n` +
        `• Intenta con otro resultado o baja la calidad.`,
    }, { quoted: msg }).catch(() => {})
    try { await sock.sendMessage(chatId, { react: { text: "⚠️", key: msg.key } }).catch(() => {}) } catch {}
    return true
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

  try { await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } }).catch(() => {}) } catch {}

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
      try { await sock.sendMessage(chatId, { react: { text: "❌", key: msg.key } }).catch(() => {}) } catch {}
      return
    }

    const totalPagesReal = Math.max(1, Math.ceil(vids.length / PAGE_SIZE))
    const totalPages = Math.min(totalPagesReal, MAX_PAGES)
    const page = 1

    const slice = vids.slice(0, PAGE_SIZE)

    const pageText = buildPageText({
      subject,
      query,
      page,
      totalPages,
      total: vids.length,
      ownerTag,
      usedPrefix,
      slice,
      startIndex: 0,
      expiresSec: Math.ceil(TTL_MS / 1000)
    })

    const sent = await sock.sendMessage(chatId, {
      text: pageText,
      mentions: ownerJid ? [ownerJid] : []
    }, { quoted: msg })

    const msgId = sent?.key?.id
    if (msgId) {
      const sessionId = `${msgId}:${Date.now()}`

      const session = {
        type: "ytsearch",
        sessionId,
        chatId,
        query,
        subject,
        usedPrefix,
        results: vids,
        page,
        totalPages,
        createdAt: Date.now(),
        expired: false,
        ownerJid,
        ownerNum,
        ownerTag,
        firstBotMsgId: msgId,
        lastBotMsgId: msgId
      }

      SESSIONS.set(sessionId, session)
      MSG2SESSION.set(msgId, sessionId)

      // ✅ Mensaje automático al expirar (sesión real)
      setTimeout(async () => {
        const s = SESSIONS.get(sessionId)
        if (!s || s.expired) return
        s.expired = true

        await sock.sendMessage(chatId, {
          text:
            `⌛ La lista de *ytsearch* expiró (3 minutos).\n` +
            `✅ Para buscar de nuevo:\n` +
            `• ${usedPrefix}${command} <texto>` +
            signature()
        }, { quoted: sent }).catch(() => {})

        // limpieza suave
        SESSIONS.delete(sessionId)
        for (const [mid, sid] of MSG2SESSION.entries()) {
          if (sid === sessionId) MSG2SESSION.delete(mid)
        }
      }, TTL_MS)
    }

    try { await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {}) } catch {}
  } catch (e) {
    console.error("[ytsearch]", e)
    await sock.sendMessage(chatId, { text: "❌ Error al buscar en YouTube." }, { quoted: msg })
    try { await sock.sendMessage(chatId, { react: { text: "⚠️", key: msg.key } }).catch(() => {}) } catch {}
  }
}