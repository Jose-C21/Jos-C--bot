// src/core/antiarabeGuard.js
import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const ACTIVOS_PATH = path.join(DATA_DIR, "activos.json")

function readActivosSafe() {
  try {
    const j = JSON.parse(fs.readFileSync(ACTIVOS_PATH, "utf8") || "{}")
    if (!j.antiarabe) j.antiarabe = {}
    return j
  } catch {
    return { antiarabe: {} }
  }
}

const disallowedPrefixes = [
  "20","63","212","213","216","218","222","249","252","253","962","963","964","965","966",
  "967","968","970","971","973","974","211","220","223","224","225","226","227","228",
  "229","230","231","232","233","234","235","236","237","238","239","240","241","242",
  "243","244","245","246","247","248","250","251","254","255","256","257","258","260",
  "261","262","263","264","265","266","267","268","55","297","7","86","81","82","91",
  "90","62","66","44","297","972","269","57"
]

const clean = (jid) => String(jid || "").replace(/\D/g, "")

// ✅ para update.participants puede venir ["xxx@lid"] o [{id, phoneNumber}]
function getPhoneAndJid(p) {
  if (!p) return { jid: "", phone: "" }

  // objeto { id, phoneNumber }
  if (typeof p === "object") {
    const jid = p.id || ""
    const phone = clean(p.phoneNumber || jid)
    return { jid, phone }
  }

  // string "xxxx@s.whatsapp.net" o "xxxx@lid"
  const jid = String(p)
  return { jid, phone: clean(jid) }
}

export async function antiarabeGuard(sock, update, { isOwnerByNumbers } = {}) {
  try {
    const activos = readActivosSafe()
    const groupId = update?.id
    if (!groupId) return false
    if (!activos?.antiarabe?.[groupId]) return false
    if (update?.action !== "add") return false

    let md = null
    try { md = await sock.groupMetadata(groupId) } catch {}

    const owners = typeof isOwnerByNumbers === "function"
      ? isOwnerByNumbers
      : (() => false)

    for (const p of (update.participants || [])) {
      const { jid, phone } = getPhoneAndJid(p)
      if (!jid || !phone) continue

      const isDisallowed = disallowedPrefixes.some(prefix => phone.startsWith(prefix))
      if (!isDisallowed) continue

      // bypass si es admin (en metadata) o es owner
      let bypass = false
      try {
        const target = md?.participants?.find(x => x.id === jid)
        if (target?.admin === "admin" || target?.admin === "superadmin") bypass = true
      } catch {}

      // owner por números (si lo pasas desde baileys.js)
      // intentamos con phone como senderNum
      try {
        if (owners({ senderNum: phone, senderNumDecoded: phone })) bypass = true
      } catch {}

      if (bypass) continue

      // aviso -> remove
      await sock.sendMessage(groupId, {
        text: `⚠️ @${phone} tiene un número prohibido y será expulsado.`,
        mentions: [jid]
      }).catch(() => {})

      await sock.groupParticipantsUpdate(groupId, [jid], "remove").catch(() => {})
    }

    return false
  } catch (e) {
    console.error("[antiarabeGuard] error:", e)
    return false
  }
}