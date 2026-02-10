// src/core/groupWelcome.js
import fs from "fs"
import path from "path"

// ✅ MISMA RUTA QUE EL COMANDO
const DATA_DIR = path.join(process.cwd(), "data")
const ACTIVOS_PATH = path.join(DATA_DIR, "activos.json")

function ensureActivos() {
  const dir = path.dirname(ACTIVOS_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  if (!fs.existsSync(ACTIVOS_PATH)) {
    fs.writeFileSync(ACTIVOS_PATH, JSON.stringify({ bienvenida: {}, despedidas: {} }, null, 2))
    return
  }

  try {
    const j = JSON.parse(fs.readFileSync(ACTIVOS_PATH, "utf8") || "{}")
    if (!j.bienvenida) j.bienvenida = {}
    if (!j.despedidas) j.despedidas = {}
    fs.writeFileSync(ACTIVOS_PATH, JSON.stringify(j, null, 2))
  } catch {
    fs.writeFileSync(ACTIVOS_PATH, JSON.stringify({ bienvenida: {}, despedidas: {} }, null, 2))
  }
}

function readActivosSafe() {
  try {
    ensureActivos()
    return JSON.parse(fs.readFileSync(ACTIVOS_PATH, "utf8") || "{}")
  } catch {
    return { bienvenida: {}, despedidas: {} }
  }
}

// ✅ URL fallback si no hay foto
const FALLBACK_AVATAR = "https://i.ibb.co/5x1q8H8/avatar.png"

// ✅ Normalizar participant (string o object)
function normalizeParticipant(p) {
  if (!p) return { jid: "", phoneJid: "" }

  // si ya viene como string
  if (typeof p === "string") {
    return { jid: p, phoneJid: "" }
  }

  // si viene como objeto (como en tu log)
  const jid = String(p.id || "")
  const phoneJid = String(p.phoneNumber || "")
  return { jid, phoneJid }
}

// ✅ sacar @tag bonito para caption
function makeMentionTag(jid, phoneJid = "") {
  // si es lid, mejor usar phoneNumber para mostrar el número real
  const base = (phoneJid && phoneJid.includes("@")) ? phoneJid : jid
  return `@${String(base).split("@")[0]}`
}

export async function onGroupParticipantsUpdate(sock, update) {
  try {
    console.log("[groupWelcome] UPDATE RAW:", JSON.stringify(update))

    const { id: groupId, participants = [], action } = update || {}
    if (!groupId || !String(groupId).endsWith("@g.us")) return
    if (!participants.length) return

    const activos = readActivosSafe()
    const welcomeOn = !!activos?.bienvenida?.[groupId]
    const byeOn = !!activos?.despedidas?.[groupId]

    console.log("[groupWelcome] groupId:", groupId, "action:", action, "participants:", participants)
    console.log("[groupWelcome] welcomeOn:", welcomeOn, "byeOn:", byeOn)
    console.log("[groupWelcome] activosPath:", ACTIVOS_PATH)

    if (action === "add" && !welcomeOn) return
    if (action === "remove" && !byeOn) return

    // metadata del grupo
    let groupName = "este grupo"
    let desc = ""
    try {
      const md = await sock.groupMetadata(groupId)
      groupName = (md?.subject || "este grupo").trim()
      if (action === "add") desc = md?.desc ? `\n\n${md.desc}` : ""
    } catch (e) {
      console.error("[groupWelcome] groupMetadata error:", e)
    }

    for (const p of participants) {
      const { jid: participantJid, phoneJid } = normalizeParticipant(p)
      if (!participantJid && !phoneJid) continue

      // ✅ para mencionar SIEMPRE manda jid válido (preferimos phoneNumber si existe)
      const mentionJid = phoneJid || participantJid
      const mentionTag = makeMentionTag(participantJid, phoneJid)

      // foto perfil (primero intenta jid lid, luego phoneNumber, luego fallback)
      let profilePicUrl = FALLBACK_AVATAR
      try {
        const pic1 = await sock.profilePictureUrl(participantJid, "image")
        if (typeof pic1 === "string" && pic1) profilePicUrl = pic1
      } catch {}

      if (profilePicUrl === FALLBACK_AVATAR && phoneJid) {
        try {
          const pic2 = await sock.profilePictureUrl(phoneJid, "image")
          if (typeof pic2 === "string" && pic2) profilePicUrl = pic2
        } catch {}
      }

      if (!profilePicUrl || typeof profilePicUrl !== "string") profilePicUrl = FALLBACK_AVATAR

      // ✅ Bienvenida
      if (action === "add" && welcomeOn) {
        const caption =
          `╭─༻❀\n` +
          `➣ *¡Bienvenido/a ${mentionTag}!* ✨\n` +
          `╰─༻❀\n\n` +
          `⟢ 🏠 *${groupName}*${desc || ""}\n\n` +
          `🌼 Esperamos que disfrutes y compartas buena vibra 🌼`

        await sock.sendMessage(groupId, {
          image: { url: profilePicUrl },
          caption,
          mentions: [mentionJid],
        })

        console.log("[groupWelcome] WELCOME SENT ->", mentionJid)
      }

      // ✅ Despedida
      if (action === "remove" && byeOn) {
        const caption = `👋 ${mentionTag} ha salido de *${groupName}* 👋`

        await sock.sendMessage(groupId, {
          image: { url: profilePicUrl },
          caption,
          mentions: [mentionJid],
        })

        console.log("[groupWelcome] BYE SENT ->", mentionJid)
      }
    }
  } catch (e) {
    console.error("[groupWelcome] error:", e)
  }
}