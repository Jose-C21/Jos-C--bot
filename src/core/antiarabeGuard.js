// src/core/antiarabeGuard.js
import fs from "fs"
import path from "path"
import config from "../config.js"
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

export async function antiarabeGuard(sock, update) {
  try {
    const activos = readActivosSafe()
    const groupId = update?.id
    if (!groupId) return false

    const isOn = !!activos?.antiarabe?.[groupId]
    if (!isOn) return false

    if (update?.action !== "add") return false
    const parts = update?.participants || []
    if (!parts.length) return false

    // ✅ prefijos prohibidos (igual a tu lista)
    const disallowedPrefixes = [
      "20","63","212","213","216","218","222","249","252","253","962","963","964","965","966",
      "967","968","970","971","973","974","211","220","223","224","225","226","227","228",
      "229","230","231","232","233","234","235","236","237","238","239","240","241","242",
      "243","244","245","246","247","248","250","251","254","255","256","257","258","260",
      "261","262","263","264","265","266","267","268","55","297","7","86","81","82","91",
      "90","62","66","44","297","972","269","57"
    ]

    // metadata (para bypass admins)
    let md = null
    try {
      md = await sock.groupMetadata(groupId)
    } catch {}

    let expelledSomeone = false

    for (const participantJid of parts) {
      const num = jidToNumber(participantJid) // sirve para lid y s.whatsapp
      const isDisallowed = disallowedPrefixes.some(prefix => String(num).startsWith(prefix))
      if (!isDisallowed) continue

      // bypass: admin
      let bypass = false
      try {
        const p = md?.participants?.find(x => x.id === participantJid)
        if (p?.admin === "admin" || p?.admin === "superadmin") bypass = true
      } catch {}

      // bypass: owner (por números)
      const senderNum = num
      const senderNumDecoded = num
      if (isOwnerByNumbers({ senderNum, senderNumDecoded })) bypass = true

      if (bypass) continue

      // ✅ aviso y expulsión
      await sock.sendMessage(groupId, {
        text: `> ⚠️ @${num} ᴛɪᴇɴᴇ ᴜɴ ɴᴜᴍᴇʀᴏ ᴘʀᴏʜɪʙɪᴅᴏ ʏ ꜱᴇʀᴀ ᴇxᴘᴜʟꜱᴀᴅᴏ.`,
        mentions: [participantJid]
      }).catch(() => {})

      await sock.groupParticipantsUpdate(groupId, [participantJid], "remove").catch(() => {})

      expelledSomeone = true
    }

    // ✅ OPCIÓN A: si expulsó a alguien, NO bienvenida
    return expelledSomeone
  } catch (e) {
    console.error("[antiarabeGuard] error:", e)
    return false
  }
}