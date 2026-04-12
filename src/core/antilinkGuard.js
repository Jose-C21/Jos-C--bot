// src/core/antilinkGuard.js
import fs from "fs"
import path from "path"
import axios from "axios"
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const DATA_DIR = path.join(process.cwd(), "data")
const ACTIVOS_PATH = path.join(DATA_DIR, "activos.json")

function ensureActivosAntilink() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

  if (!fs.existsSync(ACTIVOS_PATH)) {
    fs.writeFileSync(ACTIVOS_PATH, JSON.stringify({ antilink: {} }, null, 2))
    return
  }

  try {
    const j = JSON.parse(fs.readFileSync(ACTIVOS_PATH, "utf8") || "{}")
    if (!j.antilink) j.antilink = {}
    fs.writeFileSync(ACTIVOS_PATH, JSON.stringify(j, null, 2))
  } catch {
    fs.writeFileSync(ACTIVOS_PATH, JSON.stringify({ antilink: {} }, null, 2))
  }
}

function readActivosSafe() {
  try {
    ensureActivosAntilink()
    return JSON.parse(fs.readFileSync(ACTIVOS_PATH, "utf8") || "{}")
  } catch {
    return { antilink: {} }
  }
}

function isOwnerByNumbers({ senderNum, senderNumDecoded }) {
  const owners = (config.owners || []).map(String)
  const ownersLid = (config.ownersLid || []).map(String)
  return (
    owners.includes(String(senderNum)) ||
    owners.includes(String(senderNumDecoded)) ||
    ownersLid.includes(String(senderNum)) ||
    ownersLid.includes(String(senderNumDecoded))
  )
}

// extra por si baileys manda objetos raros
function normalizeParticipant(p) {
  if (!p) return { jid: "", phoneJid: "" }
  if (typeof p === "string") return { jid: p, phoneJid: "" }
  return { jid: String(p.id || ""), phoneJid: String(p.phoneNumber || "") }
}

function extractText(msg) {
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

function getQuotedTextAndAuthor(msg) {
  const ctx = msg?.message?.extendedTextMessage?.contextInfo
  const quoted = ctx?.quotedMessage
  const author = ctx?.participant
  if (!quoted) return { text: "", authorJid: "" }

  const text =
    quoted?.conversation ||
    quoted?.extendedTextMessage?.text ||
    quoted?.imageMessage?.caption ||
    quoted?.videoMessage?.caption ||
    quoted?.documentMessage?.caption ||
    ""

  return { text: String(text || "").trim(), authorJid: String(author || "") }
}

// detectar links
const ANY_LINK_RE =
  /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/gi

// limpiar ?parametros
function cleanLink(link) {
  return link.split("?")[0]
}

// TikTok
const linkTikTokVideo = /tiktok\.com\/\@[^\/]+\/video\/\d+/i
const linkTikTokAcortado = /(vm|vt)\.tiktok\.com\/[^\s]+/i

// Facebook
const linkFacebookVideo = /facebook\.com\/.+\/videos\/\d+/i
const linkFacebookWatch = /facebook\.com\/watch\/\?v=\d+/i
const linkFacebookReel = /facebook\.com\/reel\/\d+/i
const linkFacebookShareVideo = /facebook\.com\/share\/v\//i
const linkFacebookShareReel = /facebook\.com\/share\/r\//i
const linkFbShort = /fb\.watch\/[^\s]+/i

// Instagram FIX
const linkInstagramReel = /instagram\.com\/reels?\/[A-Za-z0-9_-]+/i

async function headResolve(url) {
  try {
    const res = await axios.head(url, { maxRedirects: 5, validateStatus: null })
    return res?.request?.res?.responseUrl || ""
  } catch {
    return ""
  }
}

async function esVideoTikTok(link) {
  const redir = await headResolve(link)
  return linkTikTokVideo.test(redir)
}

async function esVideoFacebook(link) {
  const redir = await headResolve(link)
  return (
    linkFacebookVideo.test(redir) ||
    linkFacebookWatch.test(redir) ||
    linkFacebookReel.test(redir)
  )
}

function isAllowedLinkDirect(link) {
  if (linkTikTokVideo.test(link)) return true
  if (linkInstagramReel.test(link)) return true
  return false
}

function isCommandAllowed(name) {
  return ["tiktok", "facebook", "instagram"].includes(String(name || "").toLowerCase())
}

// globals
global.avisados = global.avisados || new Set()
global.mensajesConLink = global.mensajesConLink || {}

export async function antiLinkGuard(sock, msg) {
  const chatId = msg?.key?.remoteJid || ""
  const isGroup = String(chatId).endsWith("@g.us")
  if (!isGroup) return false

  const activos = readActivosSafe()
  if (!activos?.antilink?.[chatId]) return false

  const prefix = config.prefix || "."
  const fromMe = !!msg?.key?.fromMe

  const senderJid = getSenderJid(msg)
  const senderNum = jidToNumber(senderJid)

  let decodedJid = senderJid
  try { if (sock?.decodeJid) decodedJid = sock.decodeJid(senderJid) } catch {}
  const senderNumDecoded = jidToNumber(decodedJid)

  const isOwner = isOwnerByNumbers({ senderNum, senderNumDecoded })

  const messageText = extractText(msg)
  const { text: quotedText, authorJid: quotedAuthor } = getQuotedTextAndAuthor(msg)

  let textoAnalizado = quotedText || messageText
  let autorAnalizado = quotedAuthor || senderJid

  const links = (textoAnalizado.match(ANY_LINK_RE) || [])
    .map(s => cleanLink(String(s).trim()))
    .filter(Boolean)

  if (!links.length) return false

  // guardar historial
  global.mensajesConLink[chatId] = global.mensajesConLink[chatId] || []
  global.mensajesConLink[chatId].push(msg)
  if (global.mensajesConLink[chatId].length > 150) global.mensajesConLink[chatId].shift()

  // comando permitido
  const esComando = messageText.startsWith(prefix)
  const nombreComando = esComando
    ? messageText.slice(prefix.length).trim().split(/\s+/)[0]?.toLowerCase()
    : ""

  let esComandoPermitido = esComando && isCommandAllowed(nombreComando)

  if (esComandoPermitido) {
    const linkCmd = cleanLink(messageText.split(/\s+/)[1] || "")

    if (nombreComando === "instagram") {
      esComandoPermitido = linkInstagramReel.test(linkCmd)
    }
  }

  if (esComandoPermitido) return false

  // validar links
  let todoValido = true

  for (let link of links) {
    if (isAllowedLinkDirect(link)) continue

    if (linkTikTokAcortado.test(link)) {
      const ok = await esVideoTikTok(link)
      if (!ok) { todoValido = false; break }
      continue
    }

    if (linkFbShort.test(link)) {
      const ok = await esVideoFacebook(link)
      if (!ok) { todoValido = false; break }
      continue
    }

    todoValido = false
    break
  }

  if (todoValido) return false

  // bypass
  let canBypass = fromMe || isOwner
  let autorEsAdmin = false

  try {
    const meta = await sock.groupMetadata(chatId)
    const limpiar = j => String(j || "").replace(/\D/g, "")

    const adminNums = new Set(
      (meta.participants || [])
        .filter(p => p.admin)
        .map(p => limpiar(p.id))
    )

    if (adminNums.has(limpiar(senderJid))) canBypass = true
    if (adminNums.has(limpiar(autorAnalizado))) autorEsAdmin = true
  } catch {}

  if (autorEsAdmin) return false
  if (canBypass) return false

  const idUsuario = autorAnalizado

  // 1 expulsar
  await sock.groupParticipantsUpdate(chatId, [idUsuario], "remove").catch(() => {})

  // 2 borrar msg
  await sock.sendMessage(chatId, { delete: msg.key }).catch(() => {})

  // borrar historial
  try {
    const limpiar = j => String(j || "").replace(/\D/g, "")
    const list = global.mensajesConLink[chatId] || []
    for (const m of list) {
      const who = m?.key?.participant || m?.key?.remoteJid
      if (limpiar(who) === limpiar(idUsuario)) {
        await sock.sendMessage(chatId, { delete: m.key }).catch(() => {})
      }
    }
  } catch {}

  // 3 aviso
  if (!global.avisados.has(idUsuario)) {
    global.avisados.add(idUsuario)
    const tag = `@${jidToNumber(idUsuario)}`

    await sock.sendMessage(chatId, {
      text:
`╭━━〔🔗𝗔𝗡𝗧𝗜𝗟𝗜𝗡𝗞〕━━╮
┃ 👤 Usuario:
┃    ${tag}
┃
┃ ⚖️ Acción:
┃    Expulsado
┃
┃ 📛 Motivo:
┃    Enlace no permitido
╰━━━━━━━━━━━━━╯`,
      mentions: [idUsuario]
    }).catch(() => {})

    setTimeout(() => global.avisados.delete(idUsuario), 180000)
  }

  return true
}