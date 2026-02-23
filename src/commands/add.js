// src/commands/add.js
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"
import { proto, generateWAMessageFromContent } from "baileys"

// ─────────────────────────────────────────────
// ✅ Owner helper (igual estilo que close.js)
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// ✅ Helpers
// ─────────────────────────────────────────────
const onlyDigits = (x) => String(x || "").replace(/\D/g, "")
const cleanNumberInput = (txt = "") => onlyDigits(txt)

async function sendInviteWithButtons(sock, targetJid, groupName, link, reasonText = "") {
  const caption =
    `👋 Hola!\n` +
    `Te invitaron a unirte al grupo:\n` +
    `• ${groupName}\n\n` +
    (reasonText ? `${reasonText}\n\n` : "") +
    `Pulsa el botón para entrar:`

  // ✅ Native Flow URL button (funciona en Baileys 7.0.0-rc.9)
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
    // fallback fuerte
    await sock.sendMessage(targetJid, { text: `${caption}\n\n${link}` }).catch(() => {})
    return false
  }
}

export default async function add(sock, msg, { args, usedPrefix = ".", command = "add", isOwner: isOwnerFromRouter } = {}) {
  try {
    const chatId = msg?.key?.remoteJid
    if (!chatId) return

    const isGroup = String(chatId).endsWith("@g.us")
    if (!isGroup) {
      return sock.sendMessage(chatId, { text: "❌ Este comando solo funciona en grupos." }, { quoted: msg })
    }

    // reaccion (opcional)
    await sock.sendMessage(chatId, { react: { text: "⏰", key: msg.key } }).catch(() => {})

    const senderJid = getSenderJid(msg)
    const senderNum = jidToNumber(senderJid)

    let decoded = senderJid
    try { if (sock?.decodeJid) decoded = sock.decodeJid(senderJid) } catch {}
    const senderNumDecoded = jidToNumber(decoded)

    const fromMe = !!msg.key?.fromMe
    const isOwner = !!isOwnerFromRouter || isOwnerByNumbers({ senderNum, senderNumDecoded })

    // args -> número
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
        { text: `⚠️ Número inválido.\nDebe contener solo números y el código de país.\n\nEjemplo: ${usedPrefix}${command} 50499998888` },
        { quoted: msg }
      )
    }

    const targetJid = `${clean}@s.whatsapp.net`

    // ── metadata para permisos + nombre grupo
    let md
    try { md = await sock.groupMetadata(chatId) } catch { md = null }

    const groupName = (md?.subject || "Grupo").trim()
    const participants = md?.participants || []

    // ✅ Permisos del usuario (admin/owner/fromMe)
    let isAdmin = false
    try {
      const p = participants.find(x => x.id === senderJid || x.id === decoded)
      isAdmin = p?.admin === "admin" || p?.admin === "superadmin"
    } catch {}

    if (!isAdmin && !isOwner && !fromMe) {
      return sock.sendMessage(
        chatId,
        { text: "🚫 Solo administradores del grupo o el owner pueden usar este comando." },
        { quoted: msg }
      )
    }

    // ✅ Verificar que EL BOT sea admin (si no, no puede agregar)
    const botJid = sock?.user?.id
    let botIsAdmin = false
    try {
      const b = participants.find(x => x.id === botJid)
      botIsAdmin = b?.admin === "admin" || b?.admin === "superadmin"
    } catch {}

    if (!botIsAdmin) {
      // aquí SÍ aplica decirlo: si no es admin, no puede agregar ni invitar por "add" directo
      return sock.sendMessage(
        chatId,
        { text: "⛔ Necesito ser administrador para agregar usuarios." },
        { quoted: msg }
      )
    }

    // ✅ Verificar si existe en WhatsApp
    let exists = null
    try { exists = await sock.onWhatsApp(targetJid) } catch { exists = null }

    if (!exists || !Array.isArray(exists) || exists.length === 0) {
      return sock.sendMessage(
        chatId,
        { text: `📍 El número +${clean} no existe en WhatsApp.\nVerifica el código de país y que sea correcto.` },
        { quoted: msg }
      )
    }

    // ✅ Intentar agregar
    let addRes
    try {
      addRes = await sock.groupParticipantsUpdate(chatId, [targetJid], "add")
    } catch (e) {
      addRes = null
    }

    // Baileys a veces devuelve array de objetos { jid, status }
    const row = Array.isArray(addRes) ? addRes[0] : null
    const status = row?.status

    // ✅ 200 -> agregado
    if (status === 200 || status === "200") {
      return sock.sendMessage(
        chatId,
        { text: `✅ Usuario agregado\n• Número: +${clean}` },
        { quoted: msg }
      )
    }

    // ✅ 409 -> ya está
    if (status === 409 || status === "409") {
      return sock.sendMessage(chatId, { text: "📍 Ese usuario ya está en el grupo." }, { quoted: msg })
    }

    // ✅ 403/408/otros -> privacidad o no se pudo -> enviar invitación (NO decir que bot no es admin)
    //    (esto es lo que querías: invitación = privacidad u otro bloqueo)
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
    } catch {
      link = ""
    }

    if (!link) {
      return sock.sendMessage(
        chatId,
        { text: `📍 No pude generar el link de invitación.\nEnvía el link manual:\n(WhatsApp > Info del grupo > Invitar con enlace)` },
        { quoted: msg }
      )
    }

    await sendInviteWithButtons(sock, targetJid, groupName, link, reason)

    return sock.sendMessage(
      chatId,
      {
        text:
          `✅ Invitación enviada\n` +
          `• Número: +${clean}\n\n` +
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