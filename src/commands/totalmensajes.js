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

// números estilo bold
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
  await sock.sendMessage(chatId,{text:"⚙️ Comando en mantenimiento."},{quoted:msg})
}

// ✅ COMANDO PRINCIPAL BLOQUEADO
export default async function totalmensajes(sock, msg) {

const chatId = msg?.key?.remoteJid
if (!chatId) return

await sock.sendMessage(chatId,{
text:
`╭─ ⚙️ 𝗦𝗜𝗦𝗧𝗘𝗠𝗔
│
│ 🚧 𝗖𝗢𝗠𝗔𝗡𝗗𝗢 𝗘𝗡 𝗠𝗔𝗡𝗧𝗘𝗡𝗜𝗠𝗜𝗘𝗡𝗧𝗢
│
│ La función *totalmensajes*
│ se encuentra temporalmente
│ en mantenimiento.
│
│ ⏳ Vuelve a intentarlo más tarde.
╰────────────`
},{quoted:msg})

}