// src/commands/add.js
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const normalizeDigits = (x) => String(x || "").replace(/\D/g, "")

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

function isOwnerByNumbers(config, { senderNum, senderNumDecoded }) {
  const owners = (config.owners || []).map(String)
  const ownersLid = (config.ownersLid || []).map(String)
  return (
    owners.includes(String(senderNum)) ||
    owners.includes(String(senderNumDecoded)) ||
    ownersLid.includes(String(senderNum)) ||
    ownersLid.includes(String(senderNumDecoded))
  )
}

async function tryInviteLink(sock, chatId, targetJid, groupName) {
  const code = await sock.groupInviteCode(chatId)
  const link = `https://chat.whatsapp.com/${code}`

  // invitación por privado
  await sock.sendMessage(targetJid, {
    text:
      `👋 Hola!\n` +
      `Te invitaron a unirte al grupo:\n` +
      `• ${groupName}\n\n` +
      `Únete aquí:\n${link}`
  }).catch(() => {})

  return link
}

export default async function add(sock, msg, ctx = {}) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const isGroup = String(chatId).endsWith("@g.us")
  if (!isGroup) {
    await sock.sendMessage(chatId, { text: "⛔ Este comando solo funciona en grupos." }, { quoted: msg })
    return
  }

  // texto del comando (lo que sigue después de .add)
  const fullText = getText(msg)
  const usedPrefix = ctx.usedPrefix || "."
  const command = ctx.command || "add"

  const input = (ctx.args?.join(" ") || "").trim() || fullText.replace(new RegExp(`^\\${usedPrefix}${command}\\s*`, "i"), "").trim()

  if (!input) {
    await sock.sendMessage(chatId, {
      text:
        `📌 Uso:\n` +
        `• ${usedPrefix}${command} 504XXXXXXXX\n` +
        `• ${usedPrefix}${command} +504 XXXX-XXXX`
    }, { quoted: msg })
    return
  }

  const cleanNumber = normalizeDigits(input)
  if (!cleanNumber || cleanNumber.length < 8) {
    await sock.sendMessage(chatId, {
      text:
        `⚠️ Número inválido.\n` +
        `Debe contener solo números y código de país.\n\n` +
        `Ejemplo: ${usedPrefix}${command} 504XXXXXXXX`
    }, { quoted: msg })
    return
  }

  const targetJid = `${cleanNumber}@s.whatsapp.net`

  // metadata + permisos
  const metadata = await sock.groupMetadata(chatId)
  const participants = metadata?.participants || []

  const senderJid = getSenderJid(msg)
  let decodedSenderJid = senderJid
  try { if (sock?.decodeJid) decodedSenderJid = sock.decodeJid(senderJid) } catch {}

  const senderNum = jidToNumber(senderJid)
  const senderNumDecoded = jidToNumber(decodedSenderJid)
  const finalSenderNum = senderNumDecoded || senderNum

  // buscar sender en participantes por dígitos (sirve lid/jid)
  const senderRow = participants.find(p => normalizeDigits(p.id) === normalizeDigits(decodedSenderJid) || normalizeDigits(p.id) === normalizeDigits(senderJid))
  const isSenderAdmin = senderRow?.admin === "admin" || senderRow?.admin === "superadmin"

  // bot admin (MUY IMPORTANTE)
  const botJid = sock?.user?.id
  let decodedBotJid = botJid
  try { if (sock?.decodeJid) decodedBotJid = sock.decodeJid(botJid) } catch {}
  const botRow = participants.find(p => normalizeDigits(p.id) === normalizeDigits(decodedBotJid) || normalizeDigits(p.id) === normalizeDigits(botJid))
  const isBotAdmin = botRow?.admin === "admin" || botRow?.admin === "superadmin"

  // owner bypass (si en ctx viene isOwner ya lo usamos, si no, por números)
  const config = (await import("../config.js")).default
  const isOwner = !!ctx.isOwner || isOwnerByNumbers(config, { senderNum: finalSenderNum, senderNumDecoded: finalSenderNum })

  if (!isSenderAdmin && !isOwner) {
    await sock.sendMessage(chatId, {
      text: "⛔ Solo administradores (o owner) pueden usar este comando."
    }, { quoted: msg })
    return
  }

  // reacción
  await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } }).catch(() => {})

  // verificar existe en WhatsApp
  let exists = null
  try { exists = await sock.onWhatsApp(targetJid) } catch {}
  if (!exists || !exists.length) {
    await sock.sendMessage(chatId, {
      text:
        `📍 El número +${cleanNumber} no parece existir en WhatsApp.\n` +
        `Verifica el código de país.`
    }, { quoted: msg })
    return
  }

  const groupName = (metadata?.subject || "un grupo").trim()

  // si bot no es admin => solo invitación
  if (!isBotAdmin) {
    const link = await tryInviteLink(sock, chatId, targetJid, groupName)
    await sock.sendMessage(chatId, {
      text:
        `✅ Invitación enviada a +${cleanNumber}\n` +
        `📌 El bot no es admin, por eso se mandó enlace.\n` +
        `🔗 ${link}`
    }, { quoted: msg })
    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
    return
  }

  // intentar agregar directo
  try {
    const res = await sock.groupParticipantsUpdate(chatId, [targetJid], "add")

    const row = Array.isArray(res) ? res[0] : null
    const status = row?.status

    // 200 agregado
    if (status === 200 || status === "200") {
      await sock.sendMessage(chatId, {
        text: `✅ Usuario agregado\n• Número: +${cleanNumber}`
      }, { quoted: msg })
      await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
      return
    }

    // 409 ya está
    if (status === 409 || status === "409") {
      await sock.sendMessage(chatId, { text: "📍 Ese usuario ya está en el grupo." }, { quoted: msg })
      await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
      return
    }

    // otros => invitación
    const link = await tryInviteLink(sock, chatId, targetJid, groupName)
    await sock.sendMessage(chatId, {
      text:
        `✅ Invitación enviada a +${cleanNumber}\n` +
        `📍 Puede tener privacidad o no permitir ser agregado.\n` +
        `🔗 ${link}`
    }, { quoted: msg })
    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
  } catch (e) {
    // fallback invitación
    const link = await tryInviteLink(sock, chatId, targetJid, groupName).catch(() => "")
    await sock.sendMessage(chatId, {
      text:
        `✅ No se pudo agregar directo, se envió invitación.\n` +
        `• Número: +${cleanNumber}` +
        (link ? `\n🔗 ${link}` : "")
    }, { quoted: msg })
    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
  }
}