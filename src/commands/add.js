// src/commands/add.js
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"
import { proto, generateWAMessageFromContent } from "baileys"

const normalizeDigits = (x) => String(x || "").replace(/\D/g, "")

// Quita :device si viene (ej: 12345:2@s.whatsapp.net -> 12345@s.whatsapp.net)
const stripDevice = (jid = "") => String(jid || "").replace(/:\d+(?=@)/g, "")

function getText(msg) {
  const m = msg?.message || {}
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    ""
  ).trim()
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

async function getGroupInviteLink(sock, chatId) {
  const code = await sock.groupInviteCode(chatId)
  return `https://chat.whatsapp.com/${code}`
}

// ✅ Botones compatibles (Baileys 7 rc.9) + fallback
async function sendInviteWithButtons(sock, targetJid, groupName, link, reasonText = "") {
  const caption =
    `👋 Hola!\n` +
    `Te invitaron a unirte al grupo:\n` +
    `• ${groupName}\n\n` +
    (reasonText ? `${reasonText}\n\n` : "") +
    `Pulsa el botón para entrar:`

  // interactiveMessage (nativo)
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
  } catch {
    // fallback texto
    await sock.sendMessage(targetJid, { text: `${caption}\n\n${link}` }).catch(() => {})
  }

  // fallback extra: manda link sí o sí
  await sock.sendMessage(targetJid, { text: link }).catch(() => {})
}

// ✅ DETECTOR ROBUSTO: bot admin en groupMetadata
function isBotAdminInGroup(sock, md) {
  try {
    const parts = md?.participants || []
    if (!parts.length) return false

    const rawBot = sock?.user?.id || ""
    let decBot = rawBot
    try { if (sock?.decodeJid) decBot = sock.decodeJid(rawBot) } catch {}

    // Candidatos posibles del bot (con y sin device)
    const candidates = new Set([
      rawBot,
      decBot,
      stripDevice(rawBot),
      stripDevice(decBot),
    ])

    // Algunas builds traen sock.user.lid
    const botLid = sock?.user?.lid
    if (botLid) {
      candidates.add(botLid)
      candidates.add(stripDevice(botLid))
      try {
        const decLid = sock.decodeJid(botLid)
        candidates.add(decLid)
        candidates.add(stripDevice(decLid))
      } catch {}
    }

    // 1) match exacto / sin device (igual al bot viejo, pero con más variantes)
    for (const p of parts) {
      const pid = String(p?.id || "")
      const pid2 = stripDevice(pid)
      if (candidates.has(pid) || candidates.has(pid2)) {
        return p?.admin === "admin" || p?.admin === "superadmin"
      }
    }

    // 2) fallback por dígitos (por si cambia @s.whatsapp / @lid / :device)
    const candDigits = new Set(Array.from(candidates).map(normalizeDigits).filter(Boolean))
    for (const p of parts) {
      const pidDigits = normalizeDigits(p?.id)
      if (!pidDigits) continue
      if (candDigits.has(pidDigits)) {
        return p?.admin === "admin" || p?.admin === "superadmin"
      }
    }

    return false
  } catch {
    return false
  }
}

export default async function add(sock, msg, ctx = {}) {
  try {
    const chatId = msg?.key?.remoteJid
    if (!chatId) return

    const isGroup = String(chatId).endsWith("@g.us")
    if (!isGroup) {
      return sock.sendMessage(chatId, { text: "⛔ Este comando solo funciona en grupos." }, { quoted: msg })
    }

    // args
    const usedPrefix = ctx.usedPrefix || config.prefix || "."
    const command = ctx.command || "add"
    const fullText = getText(msg)

    const input =
      (ctx.args?.join(" ") || "").trim() ||
      fullText.replace(new RegExp(`^\\${usedPrefix}${command}\\s*`, "i"), "").trim()

    if (!input) {
      return sock.sendMessage(chatId, {
        text:
          `📌 Uso:\n` +
          `• ${usedPrefix}${command} 504XXXXXXXX\n` +
          `• ${usedPrefix}${command} +504 XXXX-XXXX`
      }, { quoted: msg })
    }

    const cleanNumber = normalizeDigits(input)
    if (!cleanNumber || cleanNumber.length < 8) {
      return sock.sendMessage(chatId, {
        text:
          `⚠️ Número inválido.\n` +
          `Ejemplo: ${usedPrefix}${command} 504XXXXXXXX`
      }, { quoted: msg })
    }

    const targetJid = `${cleanNumber}@s.whatsapp.net`

    // sender
    const senderJid = getSenderJid(msg)
    const senderNum = jidToNumber(senderJid)

    let decoded = senderJid
    try { if (sock?.decodeJid) decoded = sock.decodeJid(senderJid) } catch {}
    const senderNumDecoded = jidToNumber(decoded)

    const isOwner = !!ctx.isOwner || isOwnerByNumbers({ senderNum, senderNumDecoded })
    const fromMe = !!msg.key?.fromMe

    // metadata
    const md = await sock.groupMetadata(chatId)
    const groupName = (md?.subject || "un grupo").trim()

    // ✅ isAdmin del usuario (igual close.js)
    let isAdmin = false
    try {
      const p = md.participants?.find(x => x.id === senderJid || x.id === decoded)
      isAdmin = p?.admin === "admin" || p?.admin === "superadmin"
    } catch {}

    if (!isAdmin && !isOwner && !fromMe) {
      return sock.sendMessage(chatId, {
        text: "⛔ No tienes permisos.\n⚠️ Solo administradores o el dueño del bot pueden usar este comando."
      }, { quoted: msg })
    }

    // ✅ isAdmin del bot (FIX REAL)
    const isBotAdmin = isBotAdminInGroup(sock, md)
    if (!isBotAdmin) {
      return sock.sendMessage(chatId, { text: "⛔ Necesito ser administrador para agregar usuarios." }, { quoted: msg })
    }

    // verificar existe en WhatsApp
    let exists = null
    try { exists = await sock.onWhatsApp(targetJid) } catch {}
    if (!exists || !exists.length) {
      return sock.sendMessage(chatId, {
        text:
          `📍 El número +${cleanNumber} no existe en WhatsApp o es inválido.\n` +
          `Verifica el código de país.`
      }, { quoted: msg })
    }

    await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } }).catch(() => {})

    // intentar agregar directo
    let res = null
    try { res = await sock.groupParticipantsUpdate(chatId, [targetJid], "add") } catch {}

    const row = Array.isArray(res) ? res[0] : null
    const status = row?.status

    // agregado
    if (status === 200 || status === "200") {
      await sock.sendMessage(chatId, { text: `✅ Usuario agregado\n• Número: +${cleanNumber}` }, { quoted: msg })
      await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
      return
    }

    // ya estaba
    if (status === 409 || status === "409") {
      await sock.sendMessage(chatId, { text: "📍 Ese usuario ya está en el grupo." }, { quoted: msg })
      await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
      return
    }

    // privacidad / invitación requerida (403/408 o cualquier otro)
    const link = await getGroupInviteLink(sock, chatId)
    await sendInviteWithButtons(
      sock,
      targetJid,
      groupName,
      link,
      "📍 Es posible que el usuario tenga privacidad y no permita ser agregado."
    )

    await sock.sendMessage(chatId, { text: `✅ Invitación enviada a +${cleanNumber}` }, { quoted: msg })
    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
  } catch (e) {
    console.error("❌ Error en add:", e)
    const chatId = msg?.key?.remoteJid
    if (chatId) {
      await sock.sendMessage(chatId, { text: "❌ Ocurrió un error al ejecutar add." }, { quoted: msg }).catch(() => {})
    }
  }
}