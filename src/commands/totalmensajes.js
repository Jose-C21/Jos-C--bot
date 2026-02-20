// src/commands/totalmensajes.js
import fs from "fs"
import path from "path"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const DATA_DIR = path.join(process.cwd(), "data")

const CONTEO_PATH = path.join(DATA_DIR, "conteo.json")
const COOLDOWN_PATH = path.join(DATA_DIR, "cooldowns_totalmensajes.json")
const CONFIANZA_PATH = path.join(DATA_DIR, "confianza.json")

// ✅ cache de páginas por grupo (para exigir totalmensajes primero)
const PAGES_CACHE_PATH = path.join(DATA_DIR, "totalmensajes_pages.json")
const PAGES_CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutos

const COOLDOWN_SECONDS = 21600 // 6 horas
const PAGE_SIZE = 30
const MAX_PAGES = 10

function ensureFile(filePath, defaultJson) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(defaultJson, null, 2))
}

function readJsonSafe(filePath, fallback = {}) {
  try {
    ensureFile(filePath, fallback)
    return JSON.parse(fs.readFileSync(filePath, "utf8") || JSON.stringify(fallback))
  } catch {
    return fallback
  }
}

function writeJsonSafe(filePath, data) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

function formatoTiempo(totalSeg) {
  const h = Math.floor(totalSeg / 3600)
  const m = Math.floor((totalSeg % 3600) / 60)
  const s = Math.floor(totalSeg % 60)

  const partes = []
  if (h) partes.push(`${h} hora${h > 1 ? "s" : ""}`)
  if (m) partes.push(`${m} minuto${m > 1 ? "s" : ""}`)
  if (s || partes.length === 0) partes.push(`${s} segundo${s > 1 ? "s" : ""}`)

  if (partes.length === 1) return partes[0]
  if (partes.length === 2) return partes.join(" y ")
  return partes.slice(0, -1).join(", ") + " y " + partes.slice(-1)
}

const onlyDigits = (x) => String(x || "").replace(/\D/g, "")

// ✅ números en "negrita" sin usar *
const toBoldDigits = (x) => {
  const map = { "0":"𝟬","1":"𝟭","2":"𝟮","3":"𝟯","4":"𝟰","5":"𝟱","6":"𝟲","7":"𝟳","8":"𝟴","9":"𝟵" }
  return String(x ?? "").replace(/[0-9]/g, (d) => map[d] || d)
}

async function buildRanking(sock, chatId) {
  const conteo = readJsonSafe(CONTEO_PATH, {})
  const groupData = conteo[chatId]
  if (!groupData) return { list: [], subject: "" }

  const metadata = await sock.groupMetadata(chatId)
  const participantes = metadata.participants || []
  const subject = (metadata.subject || "este grupo").trim()

  const miembrosReales = new Set(participantes.map(p => onlyDigits(p.id)))

  const porNumero = {}
  for (const jid in groupData) {
    const numero = onlyDigits(jid)
    const mensajes = Number(groupData[jid] || 0)
    if (!numero) continue
    if (!miembrosReales.has(numero)) continue

    if (!porNumero[numero]) porNumero[numero] = { total: 0, bestJid: jid }
    porNumero[numero].total += mensajes

    const participante = participantes.find(p => onlyDigits(p.id) === numero)
    if (participante?.id) porNumero[numero].bestJid = participante.id
  }

  const list = Object.entries(porNumero)
    .map(([num, d]) => ({ num, jid: d.bestJid, total: d.total }))
    .sort((a, b) => b.total - a.total)

  return { list, subject }
}

// ✅ cache helpers
function readPagesCache() {
  return readJsonSafe(PAGES_CACHE_PATH, {})
}
function writePagesCache(db) {
  writeJsonSafe(PAGES_CACHE_PATH, db)
}
function setGroupPagesCache(chatId, totalPages) {
  const db = readPagesCache()
  db[chatId] = { totalPages, ts: Date.now() }
  writePagesCache(db)
}
function getGroupPagesCache(chatId) {
  const db = readPagesCache()
  const row = db[chatId]
  if (!row) return null
  if (!row.ts || Date.now() - row.ts > PAGES_CACHE_TTL_MS) return null
  return row
}

export async function totalmensajesPage(sock, msg, { page = 1 } = {}) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const isGroup = String(chatId).endsWith("@g.us")
  if (!isGroup) {
    await sock.sendMessage(chatId, { text: "❌ Este comando solo puede usarse en grupos." }, { quoted: msg })
    return
  }

  ensureFile(CONTEO_PATH, {})
  ensureFile(COOLDOWN_PATH, {})
  ensureFile(CONFIANZA_PATH, {
    confianza: ["50432213256", "208272208490541", "18057074359", "19580839829625"]
  })
  ensureFile(PAGES_CACHE_PATH, {})

  const wantPage = Math.max(1, Number(page) || 1)

  // ✅ si piden página > 1, exigir que primero usen .totalmensajes
  if (wantPage > 1) {
    const cache = getGroupPagesCache(chatId)
    if (!cache) {
      await sock.sendMessage(chatId, {
        text:
          "📌 Para ver listas extra, primero genera la lista principal:\n" +
          "• Usa: .totalmensajes\n\n" +
          "Luego, si hay más páginas, podrás usar:\n" +
          "• .totalmensajes2  .totalmensajes3 ..."
      }, { quoted: msg })
      return
    }

    if (wantPage > cache.totalPages) {
      await sock.sendMessage(chatId, {
        text:
          `📭 No existe la lista ${wantPage}.\n` +
          `En este grupo solo hay ${cache.totalPages} lista(s).\n\n` +
          `Usa .totalmensajes para ver la principal.`
      }, { quoted: msg })
      return
    }
  }

  // ✅ cooldown solo en página 1
  if (wantPage === 1) {
    const senderJid = getSenderJid(msg)
    const senderNum = jidToNumber(senderJid)

    const cooldownData = readJsonSafe(COOLDOWN_PATH, {})
    const confianzaData = readJsonSafe(CONFIANZA_PATH, { confianza: [] })
    const listaConfiables = confianzaData.confianza || []

    const ahora = Date.now()
    const ultimoUso = cooldownData[senderJid] || 0
    const restanteSeg = Math.ceil((ultimoUso + COOLDOWN_SECONDS * 1000 - ahora) / 1000)

    const esConfiable = listaConfiables.some(id => String(id).includes(String(senderNum)))

    if (!esConfiable && restanteSeg > 0) {
      const tiempoTexto = formatoTiempo(restanteSeg)
      await sock.sendMessage(chatId, {
        text: `⏳ @${senderNum}\nDebes esperar ${tiempoTexto} para volver a usar este comando.`,
        mentions: [senderJid]
      }, { quoted: msg })
      return
    }

    cooldownData[senderJid] = ahora
    writeJsonSafe(COOLDOWN_PATH, cooldownData)
  }

  // ✅ ranking
  let ranking
  try {
    ranking = await buildRanking(sock, chatId)
  } catch {
    ranking = { list: [], subject: "" }
  }

  const list = ranking.list || []
  const subject = ranking.subject || "este grupo"

  if (!list.length) {
    await sock.sendMessage(chatId, { text: "📭 No hay datos aún (todavía no se ha contado actividad)." }, { quoted: msg })
    return
  }

  const totalPagesReal = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const totalPages = Math.min(totalPagesReal, MAX_PAGES)

  // ✅ guardar cache SOLO cuando usan la lista principal
  if (wantPage === 1) setGroupPagesCache(chatId, totalPages)

  // ✅ clamp
  const safePage = Math.min(Math.max(1, wantPage), totalPages)

  const start = (safePage - 1) * PAGE_SIZE
  const slice = list.slice(start, start + PAGE_SIZE)

  const mentions = []
  const medals = ["🥇", "🥈", "🥉"]

  let text = ""
  text += `╭─ 𝗧𝗢𝗣 𝗔𝗖𝗧𝗜𝗩𝗢𝗦\n`
  text += `│ 🏆 Grupo: *${subject}*\n`
  text += `│ 📄 Lista: ${toBoldDigits(safePage)}/${toBoldDigits(totalPages)}\n`
  text += `│ 👥 Usuarios: ${toBoldDigits(list.length)}\n`
  text += `╰────────────\n\n`

  slice.forEach((u, i) => {
    const rank = start + i + 1
    const badge = medals[rank - 1] || `#${rank}`
    text += `${badge} @${u.num}  •  ${toBoldDigits(u.total)}\n`
    if (u.jid) mentions.push(u.jid)
  })

  // ✅ hint de páginas (solo si existe)
  const nextPage = safePage + 1
  if (nextPage <= totalPages) {
    text += `\n╭─ 𝗠𝗔́𝗦\n`
    text += `│ Usa .totalmensajes${nextPage} para ver la siguiente lista\n`
    text += `╰────────────`
  }

  await sock.sendMessage(chatId, { text: text.trim(), mentions }, { quoted: msg })
}

export default async function totalmensajes(sock, msg) {
  return totalmensajesPage(sock, msg, { page: 1 })
}