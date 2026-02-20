// src/core/antiarabeGuard.js
import fs from "fs"
import path from "path"
import { jidToNumber } from "../utils/jid.js"

const DATA_DIR = path.join(process.cwd(), "data")
const ACTIVOS_PATH = path.join(DATA_DIR, "activos.json")

function ensureActivos() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(ACTIVOS_PATH)) {
    fs.writeFileSync(
      ACTIVOS_PATH,
      JSON.stringify({ bienvenida: {}, despedidas: {}, antilink: {}, antis: {}, antiarabe: {} }, null, 2)
    )
    return
  }
  try {
    const j = JSON.parse(fs.readFileSync(ACTIVOS_PATH, "utf8") || "{}")
    if (!j.bienvenida) j.bienvenida = {}
    if (!j.despedidas) j.despedidas = {}
    if (!j.antilink) j.antilink = {}
    if (!j.antis) j.antis = {}
    if (!j.antiarabe) j.antiarabe = {}
    fs.writeFileSync(ACTIVOS_PATH, JSON.stringify(j, null, 2))
  } catch {
    fs.writeFileSync(
      ACTIVOS_PATH,
      JSON.stringify({ bienvenida: {}, despedidas: {}, antilink: {}, antis: {}, antiarabe: {} }, null, 2)
    )
  }
}

function readActivosSafe() {
  try {
    ensureActivos()
    return JSON.parse(fs.readFileSync(ACTIVOS_PATH, "utf8") || "{}")
  } catch {
    return { bienvenida: {}, despedidas: {}, antilink: {}, antis: {}, antiarabe: {} }
  }
}

const normDigits = (x) => String(x || "").replace(/\D/g, "")

// ✅ saca el mejor JID para detectar número (phone real si viene)
function pickDetectJid(p) {
  if (!p) return ""
  if (typeof p === "string") return p
  return p.phoneNumber || p.id || ""
}

// ✅ saca el mejor JID para expulsar (id lid si viene)
function pickKickJid(p) {
  if (!p) return ""
  if (typeof p === "string") return p
  return p.id || p.phoneNumber || ""
}

export async function antiarabeGuard(sock, update, { isOwnerByNumbers } = {}) {
  try {
    const activos = readActivosSafe()
    const groupId = update?.id
    if (!groupId) return false

    const isOn = !!activos?.antiarabe?.[groupId]
    if (!isOn) return false

    if (update?.action !== "add") return false

    const parts = update?.participants || []
    if (!parts.length) return false

    // ✅ prefijos prohibidos (incluye 57)
    const disallowedPrefixes = [
      "20","63","212","213","216","218","222","249","252","253","962","963","964","965","966",
      "967","968","970","971","973","974","211","220","223","224","225","226","227","228",
      "229","230","231","232","233","234","235","236","237","238","239","240","241","242",
      "243","244","245","246","247","248","250","251","254","255","256","257","258","260",
      "261","262","263","264","265","266","267","268","55","297","7","86","81","82","91",
      "90","62","66","44","297","972","269"
    ]

    let md = null
    try { md = await sock.groupMetadata(groupId) } catch {}

    let expelledSomeone = false

    for (const p of parts) {
      const detectJid = pickDetectJid(p)
      const kickJid = pickKickJid(p)

      if (!detectJid || !kickJid) continue

      // ✅ número desde el jid (sirve lid/s.whatsapp)
      const num = jidToNumber(detectJid)
      const isDisallowed = disallowedPrefixes.some(prefix => String(num).startsWith(prefix))
      if (!isDisallowed) continue

      // ✅ bypass admin: comparar por dígitos (lid vs s.whatsapp)
      let bypass = false
      try {
        const target = normDigits(kickJid) || normDigits(detectJid)
        const found = md?.participants?.find(x => normDigits(x.id) === target)
        if (found?.admin === "admin" || found?.admin === "superadmin") bypass = true
      } catch {}

      // ✅ bypass owner (si helper viene desde baileys.js)
      if (!bypass && typeof isOwnerByNumbers === "function") {
        if (isOwnerByNumbers({ senderNum: num, senderNumDecoded: num })) bypass = true
      }

      if (bypass) continue

      // ✅ ARREGLO: que el aviso muestre la mención (@) del usuario, no el "num" detectado
      // - Si viene phoneNumber (s.whatsapp.net) usamos eso para que el @ salga con número real
      // - Si no, usamos kickJid / detectJid como fallback
      const mentionBase =
        (typeof p === "object" && p?.phoneNumber) ? p.phoneNumber : (kickJid || detectJid)

      const mentionNum = jidToNumber(mentionBase) || jidToNumber(kickJid) || jidToNumber(detectJid) || num

      // ✅ aviso (menciona al user real)
      await sock.sendMessage(groupId, {
        text: `> ⚠️ @${mentionNum} ᴛɪᴇɴᴇ ᴜɴ ɴᴜ́ᴍᴇʀᴏ ᴘʀᴏʜɪʙɪᴅᴏ ʏ ꜱᴇʀᴀ́ ᴇxᴘᴜʟꜱᴀᴅᴏ.`,
        mentions: [kickJid]
      }).catch(() => {})

      // ✅ expulsión (usar LID si está)
      await sock.groupParticipantsUpdate(groupId, [kickJid], "remove").catch(() => {})

      expelledSomeone = true
    }

    // ✅ si expulsó a alguien => el caller debe NO dar bienvenida
    return expelledSomeone
  } catch (e) {
    console.error("[antiarabeGuard] error:", e)
    return false
  }
}