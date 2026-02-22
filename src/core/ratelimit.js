// src/core/ratelimit.js
import fs from "fs"
import path from "path"
import { jidToNumber } from "../utils/jid.js"

const DATA_DIR = path.join(process.cwd(), "data")
const RL_PATH = path.join(DATA_DIR, "ratelimits.json")

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

function readJsonSafe(filePath, fallback) {
  try {
    ensureDir()
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2))
      return fallback
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8") || JSON.stringify(fallback))
  } catch {
    return fallback
  }
}

function writeJsonSafe(filePath, data) {
  try {
    ensureDir()
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  } catch {}
}

// ✅ helpers
const onlyDigits = (x) => String(x || "").replace(/\D/g, "")

function getSenderRawJid(msg) {
  return (
    msg?.key?.participant ||
    msg?.participant ||
    msg?.key?.remoteJid ||
    ""
  )
}

// ✅ key por usuario: lid + decoded + número (para que siempre sea el mismo usuario)
export function buildUserRateKey(sock, msg) {
  const raw = getSenderRawJid(msg)

  let decoded = raw
  try { if (sock?.decodeJid) decoded = sock.decodeJid(raw) } catch {}

  const n1 = onlyDigits(jidToNumber(raw))
  const n2 = onlyDigits(jidToNumber(decoded))

  // si por alguna razón no hay número, usa el jid como fallback
  const base = n2 || n1 || String(decoded || raw)
  return `u:${base}`
}

// ✅ JID para mencionar (preferimos decoded si existe)
export function buildUserMentionJid(sock, msg) {
  const raw = getSenderRawJid(msg)

  let decoded = raw
  try { if (sock?.decodeJid) decoded = sock.decodeJid(raw) } catch {}

  return decoded || raw
}

export function buildUserMentionTag(sock, msg) {
  const jid = buildUserMentionJid(sock, msg)
  const num = onlyDigits(jidToNumber(jid))
  return num ? `@${num}` : "@usuario"
}

// ✅ límites por comando
// play: 1 vez / 20s
// sticker: 2 veces / 20s
function getRule(command = "") {
  const c = String(command || "").toLowerCase()

  if (c === "play") return { limit: 1, windowSec: 20 }
  if (c === "sticker" || c === "s") return { limit: 2, windowSec: 20 }

  return null // sin ratelimit para otros comandos
}

// ✅ GC: limpiar entradas viejas para que el JSON no crezca infinito
function gc(db, now) {
  const MAX_AGE_MS = 60 * 60 * 1000 // 1h
  for (const k of Object.keys(db)) {
    const row = db[k]
    if (!row || !row.lastTs) { delete db[k]; continue }
    if (now - row.lastTs > MAX_AGE_MS) delete db[k]
  }
}

// ✅ check principal (persistente en data/ratelimits.json)
export function checkRateLimit(sock, msg, { command, isOwner } = {}) {
  // owners bypass
  if (isOwner) return { blocked: false, waitSec: 0 }

  const rule = getRule(command)
  if (!rule) return { blocked: false, waitSec: 0 }

  const now = Date.now()
  const db = readJsonSafe(RL_PATH, {})

  // limpiar viejo
  gc(db, now)

  const userKey = buildUserRateKey(sock, msg)
  const cmdKey = `c:${String(command).toLowerCase()}`
  const key = `${cmdKey}:${userKey}`

  const row = db[key] || { ts: [], lastTs: 0 }
  const windowMs = rule.windowSec * 1000

  // quedarnos solo con timestamps dentro de ventana
  const ts = (row.ts || []).filter(t => now - t < windowMs)

  if (ts.length >= rule.limit) {
    const oldest = ts[0]
    const waitMs = windowMs - (now - oldest)
    const waitSec = Math.max(1, Math.ceil(waitMs / 1000))

    // actualizar lastTs para GC
    db[key] = { ts, lastTs: now }
    writeJsonSafe(RL_PATH, db)

    return { blocked: true, waitSec }
  }

  // registrar uso
  ts.push(now)
  db[key] = { ts, lastTs: now }
  writeJsonSafe(RL_PATH, db)

  return { blocked: false, waitSec: 0 }
}