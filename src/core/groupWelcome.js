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

  // si existe pero está mal, lo arreglamos
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

export async function onGroupParticipantsUpdate(sock, update) {
  try {
    const { id: groupId, participants = [], action } = update || {}
    if (!groupId || !String(groupId).endsWith("@g.us")) return
    if (!participants.length) return

    const activos = readActivosSafe()

    // Solo responder si está activado
    const welcomeOn = !!activos?.bienvenida?.[groupId]
    const byeOn = !!activos?.despedidas?.[groupId]

    if (action === "add" && !welcomeOn) return
    if (action === "remove" && !byeOn) return

    // metadata del grupo
    let groupName = "este grupo"
    let desc = ""
    try {
      const md = await sock.groupMetadata(groupId)
      groupName = (md?.subject || "este grupo").trim()
      if (action === "add") {
        desc = md?.desc ? `\n\n${md.desc}` : ""
      }
    } catch {}

    for (const participant of participants) {
      const mention = `@${String(participant).split("@")[0]}`

      // foto perfil
      let profilePicUrl = FALLBACK_AVATAR
      try {
        profilePicUrl = await sock.profilePictureUrl(participant, "image")
      } catch {
        try {
          profilePicUrl = await sock.profilePictureUrl(sock.user.id, "image")
        } catch {
          profilePicUrl = FALLBACK_AVATAR
        }
      }

      // ✅ Bienvenida
      if (action === "add" && welcomeOn) {
        const caption =
          `╭─༻❀\n` +
          `➣ *¡Bienvenido/a ${mention}!* ✨\n` +
          `╰─༻❀\n\n` +
          `⟢ 🏠 *${groupName}*${desc || ""}\n\n` +
          `🌼 Esperamos que disfrutes y compartas buena vibra 🌼`

        await sock.sendMessage(groupId, {
          image: { url: profilePicUrl },
          caption,
          mentions: [participant],
        }).catch(() => {})
      }

      // ✅ Despedida
      if (action === "remove" && byeOn) {
        const caption = `👋 ${mention} ha salido de *${groupName}* 👋`
        await sock.sendMessage(groupId, {
          image: { url: profilePicUrl },
          caption,
          mentions: [participant],
        }).catch(() => {})
      }
    }
  } catch (e) {
    console.error("[groupWelcome] error:", e)
  }
}