// src/commands/add.js
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"
import { proto, generateWAMessageFromContent } from "baileys"

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

const onlyDigits = (x) => String(x || "").replace(/\D/g, "")
const cleanNumberInput = (txt = "") => onlyDigits(txt)

// ✅ JID para mostrar/mention (usa el número)
const mentionTag = (num) => `@${onlyDigits(num)}`

// ✅ BOT admin detect: por dígitos (sirve para lid / :device / s.whatsapp)
function botIsAdminInGroup(sock, md) {
  try {
    const parts = md?.participants || []
    if (!parts.length) return false

    const raw = sock?.user?.id || ""
    let decoded = raw
    try { if (sock?.decodeJid) decoded = sock.decodeJid(raw) } catch {}

    const botNum1 = onlyDigits(raw)
    const botNum2 = onlyDigits(decoded)
    const botNum = botNum2 || botNum1
    if (!botNum) return false

    const found = parts.find((p) => onlyDigits(p.id) === botNum)
    const a = found?.admin
    return a === "admin" || a === "superadmin"
  } catch {
    return false
  }
}

// ✅ Invitación con botón (Baileys 7 rc.9)
async function sendInviteWithButtons(sock, targetJid, groupName, link, reasonText = "") {
  const caption =
    `👋 Hola!\n` +
    `Te invitaron al grupo:\n` +
    `• ${groupName}\n\n` +
    (reasonText ? `${reasonText}\n\n` : "") +
    `Pulsa el botón para unirte:`

  try {
    const msg = generateWAMessageFromContent(
      targetJid,
      {
        viewOnceMessage: {
          message: {
            interactiveMessage: proto.Message.InteractiveMessage.fromObject({
              body: proto.Message.InteractiveMessage.Body.fromObject({ text: caption }),
              footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: "Invitación" }),
              nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                buttons: [
                  {
                    name: "cta_url",
                    buttonParamsJson: JSON.stringify({
                      display_text: "Unirme al grupo",
                      url: link
                    })
                  }
                ]
              })
            })
          }
        }
      },
      {}
    )

    await sock.relayMessage(targetJid, msg.message, { messageId: msg.key.id })
    return true
  } catch (e) {
    // fallback link plano
    await sock.sendMessage(targetJid, { text: `${caption}\n\n${link}` }).catch(() => {})
    return false
  }
}

export default async function add(
  sock,
  msg,
  { args, usedPrefix = ".", command = "add", isOwner: isOwnerFromRouter } = {}
) {
  try {
    const chatId = msg?.key?.remoteJid
    if (!chatId) return

    const isGroup = String(chatId).endsWith("@g.us")
    if (!isGroup) {
      return sock.sendMessage(chatId, { text: "❌ Este comando solo funciona en grupos." }, { quoted: msg })
    }

    // reacción
    await sock.sendMessage(chatId, { react: { text: "⏰", key: msg.key } }).catch(() => {})

    // sender
    const senderJid = getSenderJid(msg)
    const senderNum = jidToNumber(senderJid)

    let decoded = senderJid
    try { if (sock?.decodeJid) decoded = sock.decodeJid(senderJid) } catch {}
    const senderNumDecoded = jidToNumber(decoded)

    const fromMe = !!msg.key?.fromMe
    const isOwner = !!isOwnerFromRouter || isOwnerByNumbers({ senderNum, senderNumDecoded })

    // número objetivo
    const text = (args || []).join(" ").trim()
    if (!text) {
      return sock.sendMessage(
        chatId,
        {
          text:
            `📌 Uso:\n` +
            `• ${usedPrefix}${command} 504XXXXXXXX\n` +
            `• ${usedPrefix}${command} +504 XXXX-XXXX\n\n` +
            `Ejemplo:\n` +
            `• ${usedPrefix}${command} 50499998888`
        },
        { quoted: msg }
      )
    }

    const clean = cleanNumberInput(text)
    if (!clean || clean.length < 8) {
      return sock.sendMessage(
        chatId,
        { text: `⚠️ Número inválido.\nEjemplo: ${usedPrefix}${command} 50499998888` },
        { quoted: msg }
      )
    }

    const targetJid = `${clean}@s.whatsapp.net`

    // metadata
    let md = null
    try { md = await sock.groupMetadata(chatId) } catch {}
    const participants = md?.participants || []
    const groupName = (md?.subject || "Grupo").trim()

    // ✅ admin del usuario EXACTO como close.js
    let isAdmin = false
    try {
      const p = participants.find((x) => x.id === senderJid || x.id === decoded)
      isAdmin = p?.admin === "admin" || p?.admin === "superadmin"
    } catch {}

    if (!isAdmin && !isOwner && !fromMe) {
      return sock.sendMessage(
        chatId,
        { text: "🚫 Solo administradores del grupo o el owner pueden usar este comando." },
        { quoted: msg }
      )
    }

    // ✅ admin del BOT (POR DÍGITOS) ✅ FIX REAL
    const botIsAdmin = botIsAdminInGroup(sock, md)
    if (!botIsAdmin) {
      return sock.sendMessage(
        chatId,
        { text: "⛔ Necesito ser administrador para agregar usuarios." },
        { quoted: msg }
      )
    }

    // existe en WhatsApp
    let exists = null
    try { exists = await sock.onWhatsApp(targetJid) } catch { exists = null }

    if (!exists || !Array.isArray(exists) || exists.length === 0) {
      return sock.sendMessage(
        chatId,
        { text: `📍 El número +${clean} no existe en WhatsApp.\nVerifica el código de país.` },
        { quoted: msg }
      )
    }

    // intentar agregar
    let addRes = null
    try {
      addRes = await sock.groupParticipantsUpdate(chatId, [targetJid], "add")
    } catch {}

    const row = Array.isArray(addRes) ? addRes[0] : null
    const status = row?.status

    if (status === 200 || status === "200") {
      return sock.sendMessage(
        chatId,
        { text: `✅ Usuario agregado\n• Número: +${clean}` },
        { quoted: msg }
      )
    }

    if (status === 409 || status === "409") {
      return sock.sendMessage(chatId, { text: "📍 Ese usuario ya está en el grupo." }, { quoted: msg })
    }

    // privacidad/otros -> invitación (NO digas que bot no es admin)
    const reason =
      (status === 403 || status === "403")
        ? "📍 El usuario tiene privacidad y no permite ser agregado."
        : (status === 408 || status === "408")
          ? "📍 No se pudo agregar (posible privacidad / timeout)."
          : "📍 No se pudo agregar (posible privacidad)."

    let link = ""
    try {
      const code = await sock.groupInviteCode(chatId)
      link = `https://chat.whatsapp.com/${code}`
    } catch {}

    if (!link) {
      return sock.sendMessage(
        chatId,
        { text: `📍 No pude generar el link de invitación.\nEnvíalo manualmente desde info del grupo.` },
        { quoted: msg }
      )
    }

    await sendInviteWithButtons(sock, targetJid, groupName, link, reason)

    return sock.sendMessage(
      chatId,
      {
        text:
          `✅ Invitación enviada a +${clean}\n\n` +
          `📌 Nota: si el usuario tiene privacidad, solo podrá unirse con el enlace.`
      },
      { quoted: msg }
    )
  } catch (error) {
    console.error("❌ Error en el comando add:", error)
    const chatId = msg?.key?.remoteJid
    if (chatId) {
      await sock.sendMessage(chatId, { text: "❌ Ocurrió un error al ejecutar el comando add." }, { quoted: msg }).catch(() => {})
    }
  }
}