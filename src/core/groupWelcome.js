import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const ACTIVOS_PATH = path.join(DATA_DIR, "activos.json")

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
`👑 *NUEVO ADMINISTRADOR*

${targetTag} ahora es administrador del grupo.

🛡️ Ascendido por:
${actorTag}`,
            mentions: [targetJid, actor].filter(Boolean),
          })

          try {
            await sock.sendMessage(targetJid, {
  text:
`🎉 ¡Felicidades!

Has sido nombrado administrador en:

🏠 ${groupName}

👤 Administrador que realizó la acción:
${actorTag}

Ahora cuentas con permisos de administración.`
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
`⚠️ *CAMBIO DE ADMINISTRACIÓN*

${targetTag} ya no es administrador del grupo.

🛡️ Acción realizada por:
${actorTag}`,
            mentions: [targetJid, actor].filter(Boolean),
          })

          try {
            await sock.sendMessage(targetJid, {
  text:
`ℹ️ Aviso

Tu cargo de administrador fue retirado en:

🏠 ${groupName}

👤 Administrador que realizó la acción:
${actorTag}`
})
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
        const caption =
          `╭─༻❀\n` +
          `➣ *¡Bienvenido/a ${mentionTag} !* ✨\n` +
          `╰─༻❀\n\n` +
          `⟢ 🏠 *${groupName}*${desc}\n\n` +
          `🌼 Esperamos que disfrutes y compartas buena vibra 🌼`

        await sock.sendMessage(groupId, {
          image: { url: profilePicUrl },
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