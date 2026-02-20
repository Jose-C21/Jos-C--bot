// src/commands/fantasma.js
import fs from "fs"
import path from "path"
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const DATA_DIR = path.join(process.cwd(), "data")
const CONTEO_PATH = path.join(DATA_DIR, "conteo.json")

const PAGE_SIZE = 30
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 min
const MAX_PAGES = 10 // .fantasma2 ... .fantasma10

function ensureConteoDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(CONTEO_PATH)) fs.writeFileSync(CONTEO_PATH, "{}")
}

function readConteoSafe() {
  try {
    ensureConteoDB()
    return JSON.parse(fs.readFileSync(CONTEO_PATH, "utf8") || "{}")
  } catch {
    return {}
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

const digits = (x) => String(x || "").replace(/\D/g, "")

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function cacheSet(chatId, pages, allMentions, totalMembers) {
  global.fantasmaPages = global.fantasmaPages || {}
  global.fantasmaPages[chatId] = {
    t: Date.now(),
    pages,
    allMentions,
    totalMembers
  }
}

function cacheGet(chatId) {
  global.fantasmaPages = global.fantasmaPages || {}
  const c = global.fantasmaPages[chatId]
  if (!c) return null
  if (Date.now() - c.t > CACHE_TTL_MS) {
    delete global.fantasmaPages[chatId]
    return null
  }
  return c
}

async function checkPerms(sock, msg, chatId) {
  const senderJid = getSenderJid(msg)
  const senderNum = jidToNumber(senderJid)

  let decoded = senderJid
  try { if (sock?.decodeJid) decoded = sock.decodeJid(senderJid) } catch {}
  const senderNumDecoded = jidToNumber(decoded)

  const fromMe = !!msg.key?.fromMe
  const isOwner = isOwnerByNumbers({ senderNum, senderNumDecoded })

  let isAdmin = false
  let md = null
  try {
    md = await sock.groupMetadata(chatId)
    const p = md.participants?.find(x => x.id === senderJid || x.id === decoded)
    isAdmin = p?.admin === "admin" || p?.admin === "superadmin"
  } catch {}

  return { ok: (isAdmin || isOwner || fromMe), md }
}

async function computeGhosts(sock, chatId, md) {
  const conteoData = readConteoSafe()
  const groupConteo = conteoData?.[chatId] || {}

  const participants = md?.participants || []
  const botJid = sock?.user?.id
  const botDigits = digits(botJid)

  // fantasmas = no admin, no bot, y sin registro en conteo
  const ghosts = participants.filter(p => {
    const id = p?.id
    if (!id) return false
    if (p.admin === "admin" || p.admin === "superadmin") return false
    if (botDigits && digits(id) === botDigits) return false
    return !groupConteo[id]
  })

  const allMentions = ghosts.map(x => x.id)
  const pages = chunk(allMentions, PAGE_SIZE)
  return { pages, allMentions, totalMembers: participants.length }
}

function buildPageText({ pageIndex, totalPages, totalMembers, totalGhosts, pageMentions }) {
  let list = ""
  for (const jid of pageMentions) {
    list += `│ • @${String(jid).split("@")[0]}\n`
  }

  // ✅ tip SIEMPRE (en todas las listas)
  const tips =
    "├────────────\n" +
    "│ 🧹 Para expulsarlos:\n" +
    "│ ✅ Usa: *.fankick*\n"

  // ✅ si hay más páginas, sugerir el siguiente comando
  let footer = ""
  if (totalPages > 1) {
    const next = pageIndex + 2
    if (next <= totalPages) {
      footer +=
        "├────────────\n" +
        "│ 📄 Hay más fantasmas.\n" +
        `│ 👉 Usa *.fantasma${next}* para ver la lista ${next}.\n`
      if (totalPages > 2) {
        footer += `│ (Disponible hasta *.fantasma${totalPages}*)\n`
      }
    }
  }

  return (
    "╭─ 𝗙𝗔𝗡𝗧𝗔𝗦𝗠𝗔𝗦 👻\n" +
    `│ Lista: *${pageIndex + 1}/${totalPages}*\n` +
    `│ Detectados: *${totalGhosts}* / ${totalMembers}\n` +
    "├────────────\n" +
    list +
    tips +
    footer +
    "╰────────────"
  )
}

// ─────────────────────────────────────────────
// ✅ .fantasma (Lista 1)
// ─────────────────────────────────────────────
export default async function fantasma(sock, msg) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  if (!String(chatId).endsWith("@g.us")) {
    await sock.sendMessage(chatId, { text: "❌ Este comando solo puede usarse en grupos." }, { quoted: msg })
    return
  }

  const { ok, md } = await checkPerms(sock, msg, chatId)
  if (!ok) {
    await sock.sendMessage(chatId, { text: "🚫 Solo administradores, owner o el bot pueden usar este comando." }, { quoted: msg })
    return
  }

  const { pages, allMentions, totalMembers } = await computeGhosts(sock, chatId, md)

  if (!allMentions.length) {
    await sock.sendMessage(chatId, {
      text:
        "╭─ 𝗙𝗔𝗡𝗧𝗔𝗦𝗠𝗔𝗦 👻\n" +
        "│ ✅ No hay fantasmas.\n" +
        "│ Todos han enviado mensajes.\n" +
        "╰────────────"
    }, { quoted: msg })
    return
  }

  cacheSet(chatId, pages, allMentions, totalMembers)

  const pageIndex = 0
  const totalPages = pages.length
  const pageMentions = pages[pageIndex]

  const texto = buildPageText({
    pageIndex,
    totalPages,
    totalMembers,
    totalGhosts: allMentions.length,
    pageMentions
  })

  await sock.sendMessage(chatId, { text: texto, mentions: pageMentions }, { quoted: msg })
}

// ─────────────────────────────────────────────
// ✅ .fantasma2 .. .fantasma10
// ─────────────────────────────────────────────
export async function fantasmaPage(sock, msg, { page = 2 } = {}) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  if (!String(chatId).endsWith("@g.us")) {
    await sock.sendMessage(chatId, { text: "❌ Este comando solo puede usarse en grupos." }, { quoted: msg })
    return
  }

  const { ok } = await checkPerms(sock, msg, chatId)
  if (!ok) {
    await sock.sendMessage(chatId, { text: "🚫 Solo administradores, owner o el bot pueden usar este comando." }, { quoted: msg })
    return
  }

  const c = cacheGet(chatId)
  if (!c) {
    await sock.sendMessage(chatId, {
      text: "⚠️ Primero usa *.fantasma* para generar la lista."
    }, { quoted: msg })
    return
  }

  const pages = c.pages || []
  const totalPages = pages.length
  const wantIndex = Math.max(1, Number(page) || 2) - 1

  if (!totalPages) {
    await sock.sendMessage(chatId, { text: "✅ No hay fantasmas guardados." }, { quoted: msg })
    return
  }

  if (wantIndex < 0 || wantIndex >= totalPages) {
    await sock.sendMessage(chatId, {
      text:
        `⚠️ Esa lista no existe.\n` +
        `Disponibles: *1* a *${Math.min(totalPages, MAX_PAGES)}*` +
        (totalPages > MAX_PAGES ? ` (hay ${totalPages} en total)` : "")
    }, { quoted: msg })
    return
  }

  const pageMentions = pages[wantIndex]
  const texto = buildPageText({
    pageIndex: wantIndex,
    totalPages,
    totalMembers: c.totalMembers || 0,
    totalGhosts: (c.allMentions || []).length,
    pageMentions
  })

  await sock.sendMessage(chatId, { text: texto, mentions: pageMentions }, { quoted: msg })
}