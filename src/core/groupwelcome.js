*Core/groupwelcome.js*

// src/core/groupWelcome.js
import fs from "fs"
import path from "path"

const ACTIVOS_PATH = path.join(process.cwd(), "data", "activos.json")

function ensureActivos() {
  const dir = path.dirname(ACTIVOS_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(ACTIVOS_PATH)) {
    fs.writeFileSync(ACTIVOS_PATH, JSON.stringify({ bienvenida: {}, despedidas: {} }, null, 2))
  }
}

function readActivosSafe() {
  try {
    ensureActivos()
    const raw = fs.readFileSync(ACTIVOS_PATH, "utf8") || "{}"
    const j = JSON.parse(raw)
    if (!j.bienvenida) j.bienvenida = {}
    if (!j.despedidas) j.despedidas = {}
    return j
  } catch {
    return { bienvenida: {}, despedidas: {} }
  }
}

function signature() {
  return `⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗢𝘄𝗻𝗲𝗿: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`
}

export async function onGroupParticipantsUpdate(sock, update) {
  try {
    const { id: groupId, participants = [], action } = update || {}
    if (!groupId || !String(groupId).endsWith("@g.us")) return
    if (!participants.length) return

    const activos = readActivosSafe()
    const welcomeOn = !!activos.bienvenida?.[groupId]
    const byeOn = !!activos.despedidas?.[groupId]

    // si no hay nada activo, no hacemos nada
    if (action === "add" && !welcomeOn) return
    if (action === "remove" && !byeOn) return

    // metadata del grupo
    let groupName = "este grupo"
    let desc = ""
    try {
      const md = await sock.groupMetadata(groupId)
      groupName = (md?.subject || "este grupo").trim()
      if (action === "add") desc = md?.desc ? `\n\n${md.desc}` : ""
    } catch {}

    for (const participant of participants) {
      const mention = `@${String(participant).split("@")[0]}`

      // foto de perfil
      let profilePicUrl = "https://i.ibb.co/5x1q8H8/avatar.png"
      try {
        profilePicUrl = await sock.profilePictureUrl(participant, "image")
      } catch {
        try {
          profilePicUrl = await sock.profilePictureUrl(sock.user?.id, "image")
        } catch {}
      }

      // bienvenida
      if (action === "add" && welcomeOn) {
        const caption =
          `╭─༻❀\n` +
          `➣ *¡Bienvenido/a ${mention}!* ✨\n` +
          `╰─༻❀\n\n` +
          `⟢ 🏠 *${groupName}*${desc || ""}\n\n` +
          `🌼 Esperamos que disfrutes y compartas buena vibra 🌼\n\n` +
          `${signature()}`

        await sock.sendMessage(groupId, {
          image: { url: profilePicUrl },
          caption,
          mentions: [participant]
        }).catch(() => {})
      }

      // despedida
      if (action === "remove" && byeOn) {
        const caption =
          `👋 ${mention} ha salido de *${groupName}* 👋\n\n` +
          `${signature()}`

        await sock.sendMessage(groupId, {
          image: { url: profilePicUrl },
          caption,
          mentions: [participant]
        }).catch(() => {})
      }
    }
  } catch (e) {
    console.error("[groupWelcome]", e)
  }
}
