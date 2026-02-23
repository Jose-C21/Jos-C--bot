// src/commands/add.js
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const cleanDigits = (s = "") => String(s).replace(/\D/g, "")

async function isAdminInGroup(sock, chatId, userJid) {
  try {
    const md = await sock.groupMetadata(chatId)
    const u = md?.participants?.find((p) => p.id === userJid)
    return u?.admin === "admin" || u?.admin === "superadmin"
  } catch {
    return false
  }
}

async function isBotAdminInGroup(sock, chatId) {
  try {
    const md = await sock.groupMetadata(chatId)
    const botJid = sock?.user?.id ? sock.user.id.split(":")[0] + "@s.whatsapp.net" : ""
    const b = md?.participants?.find((p) => p.id === botJid)
    return b?.admin === "admin" || b?.admin === "superadmin"
  } catch {
    return false
  }
}

async function sendInviteFallback(sock, chatId, cleanNumber, groupName, link) {
  const targetJid = `${cleanNumber}@s.whatsapp.net`
  const botName = config?.botName || "Bot"

  const text =
    `INVITACIÓN A GRUPO\n\n` +
    `Hola 👋\n` +
    `Te invitaron a: ${groupName}\n\n` +
    `Enlace:\n${link}\n\n` +
    `— ${botName}`

  // intentar enviar DM
  await sock.sendMessage(targetJid, { text }).catch(() => {})

  // confirmar en el grupo
  await sock.sendMessage(chatId, {
    text:
      `✅ Invitación enviada a +${cleanNumber}\n` +
      `Nota: si el usuario tiene privacidad, puede que no le llegue el DM.`,
  }).catch(() => {})
}

export default async function add(sock, msg, { args = [], usedPrefix = ".", command = "add", isOwner = false } = {}) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const isGroup = String(chatId).endsWith("@g.us")
  if (!isGroup) {
    await sock.sendMessage(chatId, { text: "⛔ Este comando solo funciona en grupos." }, { quoted: msg })
    return
  }

  const senderJid = getSenderJid(msg)
  const senderNum = jidToNumber(senderJid)

  // permisos: admin o owner
  const senderIsAdmin = await isAdminInGroup(sock, chatId, senderJid)
  if (!senderIsAdmin && !isOwner) {
    await sock.sendMessage(chatId, { text: "⛔ Solo administradores o el owner pueden usar este comando." }, { quoted: msg })
    return
  }

  // bot admin
  const botIsAdmin = await isBotAdminInGroup(sock, chatId)
  if (!botIsAdmin) {
    await sock.sendMessage(chatId, { text: "⛔ Necesito ser administrador para agregar usuarios." }, { quoted: msg })
    return
  }

  const textRaw = (args.join(" ") || "").trim()
  if (!textRaw) {
    await sock.sendMessage(chatId, {
      text:
        `Uso:\n` +
        `${usedPrefix}${command} 504XXXXXXXX\n` +
        `${usedPrefix}${command} +504 XXXX-XXXX`,
    }, { quoted: msg })
    return
  }

  const cleanNumber = cleanDigits(textRaw)
  if (!cleanNumber || !/^\d+$/.test(cleanNumber)) {
    await sock.sendMessage(chatId, {
      text:
        `⚠️ Número inválido.\n` +
        `Debe contener solo números (con código de país).\n\n` +
        `Ejemplo:\n${usedPrefix}${command} 504XXXXXXXX`,
    }, { quoted: msg })
    return
  }

  const targetJid = `${cleanNumber}@s.whatsapp.net`

  // reacción
  await sock.sendMessage(chatId, { react: { text: "⏰", key: msg.key } }).catch(() => {})

  // existe en WhatsApp
  let exists = null
  try {
    exists = await sock.onWhatsApp(targetJid)
  } catch {
    exists = null
  }
  if (!exists || !exists.length) {
    await sock.sendMessage(chatId, {
      text:
        `📍 El número +${cleanNumber} no existe en WhatsApp.\n` +
        `Verifica que esté correcto y tenga el código de país.`,
    }, { quoted: msg })
    return
  }

  // nombre del grupo + link
  let groupName = "un grupo"
  try {
    const md = await sock.groupMetadata(chatId)
    groupName = (md?.subject || "un grupo").trim()
  } catch {}

  let link = ""
  try {
    const code = await sock.groupInviteCode(chatId)
    link = `https://chat.whatsapp.com/${code}`
  } catch {
    link = ""
  }

  // intentar agregar
  try {
    const res = await sock.groupParticipantsUpdate(chatId, [targetJid], "add")
    const first = Array.isArray(res) ? res[0] : null
    const status = first?.status

    // 200 ok
    if (status === 200 || status === "200") {
      await sock.sendMessage(chatId, {
        text: `✅ Usuario agregado\nNúmero: +${cleanNumber}`,
      }, { quoted: msg })
      return
    }

    // ya está
    if (status === 409 || status === "409") {
      await sock.sendMessage(chatId, { text: "📍 Ese usuario ya está en el grupo." }, { quoted: msg })
      return
    }

    // 403/408 u otros -> mandar invitación
    if (link) {
      await sendInviteFallback(sock, chatId, cleanNumber, groupName, link)
      return
    }

    await sock.sendMessage(chatId, {
      text:
        `⚠️ No se pudo agregar automáticamente.\n` +
        `Intenta enviar el enlace manualmente al número:\n+${cleanNumber}`,
    }, { quoted: msg })
  } catch (e) {
    // si falla el add, mandar invitación
    if (link) {
      await sendInviteFallback(sock, chatId, cleanNumber, groupName, link)
      return
    }

    await sock.sendMessage(chatId, {
      text: `❌ Error al agregar. Intenta manualmente.\nNúmero: +${cleanNumber}`,
    }, { quoted: msg })
  }
}