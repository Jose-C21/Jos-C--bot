import fs from "fs"
import path from "path"
import { createCanvas, loadImage } from "canvas"
import { isBotAuthor } from "./adminGuard.js"

const DATA_DIR = path.join(process.cwd(), "data")
const ACTIVOS_PATH = path.join(DATA_DIR, "activos.json")

// ==============================
// PLANTILLA DE BIENVENIDA (canvas)
// ==============================
const TEMPLATE_PATH = path.join(
  process.cwd(),
  "assets",
  "bienvenida_template.PNG"
)

// Coordenadas exactas de la plantilla (bienvenida_template.png, 1200x627)
const AVATAR_CX = 255
const AVATAR_CY = 309
const AVATAR_RAD = 116

const NAME_X = 431
const NAME_Y = 303 + 26 // +26 porque fillText usa la línea base, no la esquina superior
const NAME_MAX_WIDTH = 620 // ancho disponible antes de chocar con el borde de la tarjeta

async function generarImagenBienvenida(nombreUsuario, profilePicUrl) {
  const W = 1200
  const H = 627

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")

  // 1. Fondo (plantilla ya diseñada: girasoles, tarjeta, logo, textos fijos)
  const fondo = await loadImage(TEMPLATE_PATH)
  ctx.drawImage(fondo, 0, 0, W, H)

  // 2. Foto de perfil real, recortada en círculo exacto
  let avatarImg
  try {
    avatarImg = await loadImage(profilePicUrl)
  } catch {
    avatarImg = await loadImage(FALLBACK_AVATAR)
  }

  ctx.save()
  ctx.beginPath()
  ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_RAD, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(
    avatarImg,
    AVATAR_CX - AVATAR_RAD,
    AVATAR_CY - AVATAR_RAD,
    AVATAR_RAD * 2,
    AVATAR_RAD * 2
  )
  ctx.restore()

  // 3. Nombre de usuario (con autoajuste de tamaño si es muy largo)
  let fontSize = 32
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = "#fff2d7"

  let displayName = `@${nombreUsuario}`

  ctx.font = `bold ${fontSize}px Sans`
  while (ctx.measureText(displayName).width > NAME_MAX_WIDTH && fontSize > 18) {
    fontSize -= 2
    ctx.font = `bold ${fontSize}px Sans`
  }

  // si sigue sin caber, se recorta con "..."
  if (ctx.measureText(displayName).width > NAME_MAX_WIDTH) {
    while (
      ctx.measureText(displayName + "…").width > NAME_MAX_WIDTH &&
      displayName.length > 4
    ) {
      displayName = displayName.slice(0, -1)
    }
    displayName += "…"
  }

  ctx.fillText(displayName, NAME_X, NAME_Y)

  return canvas.toBuffer("image/png")
}

function ensureActivos() {
  const dir = path.dirname(ACTIVOS_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  if (!fs.existsSync(ACTIVOS_PATH)) {
    fs.writeFileSync(
      ACTIVOS_PATH,
      JSON.stringify({ bienvenida: {}, despedidas: {} }, null, 2)
    )
    return
  }

  try {
    const j = JSON.parse(fs.readFileSync(ACTIVOS_PATH, "utf8") || "{}")
    if (!j.bienvenida) j.bienvenida = {}
    if (!j.despedidas) j.despedidas = {}
    fs.writeFileSync(ACTIVOS_PATH, JSON.stringify(j, null, 2))
  } catch {
    fs.writeFileSync(
      ACTIVOS_PATH,
      JSON.stringify({ bienvenida: {}, despedidas: {} }, null, 2)
    )
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

const FALLBACK_AVATAR =
  "https://i.postimg.cc/VLCVJnd5/F6049B9B-B574-486D-94C7-AC17ED4438C2.png"

function normalizeParticipant(p) {
  if (!p) return { jid: "", phoneJid: "" }

  if (typeof p === "string") {
    return { jid: p, phoneJid: "" }
  }

  return {
    jid: String(p.id || ""),
    phoneJid: String(p.phoneNumber || ""),
  }
}

function makeMentionTag(jid, phoneJid = "") {
  const base =
    phoneJid && phoneJid.includes("@")
      ? phoneJid
      : jid

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

    console.log(
      "[groupWelcome] groupId:",
      groupId,
      "action:",
      action,
      "participants:",
      participants
    )

    console.log(
      "[groupWelcome] welcomeOn:",
      welcomeOn,
      "byeOn:",
      byeOn
    )

    let groupName = "este grupo"
    let desc = ""

    try {
      const md = await sock.groupMetadata(groupId)

      groupName = (md?.subject || "este grupo").trim()

      if (action === "add") {
        desc = md?.desc ? `\n\n${md.desc}` : ""
      }
    } catch (e) {
      console.error("[groupWelcome] groupMetadata error:", e)
    }

    /* ==============================
       PROMOTE / DEMOTE
    ============================== */

    if (action === "promote" || action === "demote") {
      const actor = update.author || ""

      // si la acción la hizo el propio bot (corrección de adminSecurityGuard),
      // no mandamos el aviso genérico para evitar avisos duplicados
      if (isBotAuthor(sock, actor)) {
        console.log("[groupWelcome] Skip promote/demote: acción interna del bot")
        return
      }

      for (const p of participants) {
        const {
          jid: participantJid,
          phoneJid
        } = normalizeParticipant(p)

        const targetJid = phoneJid || participantJid

        if (!targetJid) continue

        const targetTag = makeMentionTag(
          participantJid,
          phoneJid
        )

        const actorTag = actor
          ? `@${actor.split("@")[0]}`
          : "@Administrador"

        if (action === "promote") {
          await sock.sendMessage(groupId, {
            text:
`╭━━ 👑 ADMINISTRADOR ━━╮

• 👤 Usuario:
${targetTag}

• 🛡️ Asignado por:
${actorTag}

• 🏠 Grupo:
${groupName}

✅ Permisos de administración otorgados.

╰━━━━━━━━━━━━━━━╯`,
            mentions: [targetJid, actor].filter(Boolean),
          })

          try {
            await sock.sendMessage(targetJid, {
  text:
`╭━━━ 👑 NUEVO CARGO ━━━╮

🎉 ¡Felicidades!

Has sido nombrado administrador en:

🏠 ${groupName}

🛡️ Acción realizada por:
${actorTag}

✅ Ya cuentas con permisos de administración.

╰━━━━━━━━━━━━━━━╯`,
  mentions: [actor]
})
          } catch (e) {
            console.log(
              "[groupWelcome] Error privado promote:",
              e?.message
            )
          }

          console.log(
            "[groupWelcome] PROMOTE ->",
            targetJid
          )
        }

        if (action === "demote") {
          await sock.sendMessage(groupId, {
            text:
`╭━━ ⚠️ ADMINISTRACIÓN ━━╮

• 👤 Usuario:
${targetTag}

• 🛡️ Acción realizada por:
${actorTag}

• 🏠 Grupo:
${groupName}

ℹ️ El cargo de administrador ha sido retirado.

╰━━━━━━━━━━━━━━━╯`,
            mentions: [targetJid, actor].filter(Boolean),
          })

          try {
            await sock.sendMessage(targetJid, {
  text:
`╭━━ ⚠️ ACTUALIZACIÓN ━━╮

ℹ️ Tu cargo de administrador
ha sido retirado en:

🏠 ${groupName}

🛡️ Acción realizada por:
${actorTag}

╰━━━━━━━━━━━━━━━╯`,
  mentions: [actor]
})
            
          } catch (e) {
            console.log(
              "[groupWelcome] Error privado demote:",
              e?.message
            )
          }

          console.log(
            "[groupWelcome] DEMOTE ->",
            targetJid
          )
        }
      }

      return
    }

    /* ==============================
       BIENVENIDA / DESPEDIDA
    ============================== */

    if (action === "add" && !welcomeOn) return
    if (action === "remove" && !byeOn) return

    for (const p of participants) {
      const {
        jid: participantJid,
        phoneJid
      } = normalizeParticipant(p)

      if (!participantJid && !phoneJid) continue

      const mentionJid = phoneJid || participantJid
      const mentionTag = makeMentionTag(
        participantJid,
        phoneJid
      )

      let profilePicUrl = FALLBACK_AVATAR

      try {
        const pic1 = await sock.profilePictureUrl(
          participantJid,
          "image"
        )

        if (typeof pic1 === "string" && pic1) {
          profilePicUrl = pic1
        }
      } catch {}

      if (
        profilePicUrl === FALLBACK_AVATAR &&
        phoneJid
      ) {
        try {
          const pic2 = await sock.profilePictureUrl(
            phoneJid,
            "image"
          )

          if (typeof pic2 === "string" && pic2) {
            profilePicUrl = pic2
          }
        } catch {}
      }

      if (
        !profilePicUrl ||
        typeof profilePicUrl !== "string"
      ) {
        profilePicUrl = FALLBACK_AVATAR
      }

      if (action === "add" && welcomeOn) {
        // nombre a mostrar en la imagen: el número/tag, sin el "@"
        const nombreParaImagen = mentionTag.replace(/^@/, "")

        let imagenBuffer = null
        try {
          imagenBuffer = await generarImagenBienvenida(
            nombreParaImagen,
            profilePicUrl
          )
        } catch (e) {
          console.error("[groupWelcome] Error generando imagen de bienvenida:", e)
        }

        const caption =
          `╭─༻❀\n` +
          `➣ *¡Bienvenido/a ${mentionTag} !* ✨\n` +
          `╰─༻❀\n\n` +
          `⟢ 🏠 *${groupName}*${desc}\n\n` +
          `🌼 Esperamos que disfrutes y compartas buena vibra 🌼`

        await sock.sendMessage(groupId, {
          image: imagenBuffer
            ? imagenBuffer
            : { url: profilePicUrl },
          caption,
          mentions: [mentionJid],
        })

        console.log(
          "[groupWelcome] WELCOME SENT ->",
          mentionJid
        )
      }

      if (action === "remove" && byeOn) {
        const caption =
          `👋 ${mentionTag} ha salido de *${groupName}* 👋`

        await sock.sendMessage(groupId, {
          image: { url: profilePicUrl },
          caption,
          mentions: [mentionJid],
        })

        console.log(
          "[groupWelcome] BYE SENT ->",
          mentionJid
        )
      }
    }
  } catch (e) {
    console.error("[groupWelcome] error:", e)
  }
}
