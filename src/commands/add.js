// src/commands/add.js
import config from "../config.js"
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

async function sendInviteWithButtons(sock, chatId, targetJid, groupName, link, reasonText = "") {
  // Enviar al privado del usuario
  await sock.sendMessage(targetJid, {
    text:
      `👋 Hola!\n` +
      `Te invitaron a unirte al grupo:\n` +
      `• ${groupName}\n\n` +
      (reasonText ? `${reasonText}\n\n` : "") +
      `Pulsa el botón para entrar:`,
    buttons: [
      { buttonId: `join_${Date.now()}`, buttonText: { displayText: "Unirme al grupo" }, type: 1 }
    ],
    headerType: 1
  }).catch(() => {})

  // Luego mandar el link como “texto” también (por si el botón no aparece en algunos clientes)
  await sock.sendMessage(targetJid, { text: link }).catch(() => {})
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
          `Debe contener solo números y código de país.\n\n` +
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

    const isOwner = isOwnerByNumbers({ senderNum, senderNumDecoded })
    const fromMe = !!msg.key?.fromMe

    // metadata + admin checks (igual estilo close)
    const md = await sock.groupMetadata(chatId)
    const groupName = (md?.subject || "un grupo").trim()

    // isAdmin del usuario
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

    // isAdmin del bot
    const botJid = sock?.user?.id
    let botDecoded = botJid
    try { if (sock?.decodeJid) botDecoded = sock.decodeJid(botJid) } catch {}

    let isBotAdmin = false
    try {
      const b = md.participants?.find(x => x.id === botJid || x.id === botDecoded)
      isBotAdmin = b?.admin === "admin" || b?.admin === "superadmin"
    } catch {}

    // verificar existe en whatsapp
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

    // si el bot NO es admin => solo invitación (y aquí SÍ lo decimos)
    if (!isBotAdmin) {
      const link = await getGroupInviteLink(sock, chatId)
      await sendInviteWithButtons(sock, chatId, targetJid, groupName, link, "📌 No puedo agregarte directo porque el bot no es admin.")
      await sock.sendMessage(chatId, {
        text: `✅ Invitación enviada a +${cleanNumber}`
      }, { quoted: msg })
      await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
      return
    }

    // intentar agregar directo
    let res
    try {
      res = await sock.groupParticipantsUpdate(chatId, [targetJid], "add")
    } catch {
      res = null
    }

    const row = Array.isArray(res) ? res[0] : null
    const status = row?.status

    // agregado
    if (status === 200 || status === "200") {
      await sock.sendMessage(chatId, {
        text: `✅ Usuario agregado\n• Número: +${cleanNumber}`
      }, { quoted: msg })
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
      chatId,
      targetJid,
      groupName,
      link,
      "📍 Es posible que el usuario tenga privacidad y no permita ser agregado."
    )

    await sock.sendMessage(chatId, {
      text: `✅ Invitación enviada a +${cleanNumber}`
    }, { quoted: msg })
    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
  } catch (e) {
    console.error("❌ Error en add:", e)
    const chatId = msg?.key?.remoteJid
    if (chatId) {
      await sock.sendMessage(chatId, { text: "❌ Ocurrió un error al ejecutar add." }, { quoted: msg })
    }
  }
}