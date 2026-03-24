// src/commands/add.js
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const normalizeDigits = (x) => String(x || "").replace(/\D/g, "")
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

// ✅ DETECTOR ROBUSTO: bot admin en groupMetadata (rc.9 friendly)
function isBotAdminInGroup(sock, md) {
  try {
    const parts = md?.participants || []
    if (!parts.length) return false

    const rawBot = sock?.user?.id || ""
    let decBot = rawBot
    try { if (sock?.decodeJid) decBot = sock.decodeJid(rawBot) } catch {}

    const candidates = new Set([rawBot, decBot, stripDevice(rawBot), stripDevice(decBot)])

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

    for (const p of parts) {
      const pid = String(p?.id || "")
      const pid2 = stripDevice(pid)
      if (candidates.has(pid) || candidates.has(pid2)) {
        return p?.admin === "admin" || p?.admin === "superadmin"
      }
    }

    const candDigits = new Set(Array.from(candidates).map(normalizeDigits).filter(Boolean))
    for (const p of parts) {
      const pidDigits = normalizeDigits(p?.id)
      if (pidDigits && candDigits.has(pidDigits)) {
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

    // ✅ who used the command (para mención en el DM)
    const senderJid = getSenderJid(msg)
    let decoded = senderJid
    try { if (sock?.decodeJid) decoded = sock.decodeJid(senderJid) } catch {}
    const senderNum = jidToNumber(senderJid)
    const senderNumDecoded = jidToNumber(decoded)
    const finalSenderNum = senderNumDecoded || senderNum

    // ✅ preferimos mencionar el jid “real” del que ejecutó el comando
    const inviterJid = decoded || senderJid
    const inviterTag = `@${normalizeDigits(finalSenderNum)}`

    const isOwner = !!ctx.isOwner || isOwnerByNumbers({ senderNum, senderNumDecoded })
    const fromMe = !!msg.key?.fromMe

    const md = await sock.groupMetadata(chatId)
    const groupName = (md?.subject || "un grupo").trim()

    // ✅ admin del usuario (igual close)
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

    // ✅ admin del bot
    const isBotAdmin = isBotAdminInGroup(sock, md)
    if (!isBotAdmin) {
      return sock.sendMessage(chatId, {
        text:
          "⛔ No puedo agregar usuarios porque el bot no es administrador.\n" +
          "📌 Solución: haz admin al bot y vuelve a intentar."
      }, { quoted: msg })
    }

    // existe en WhatsApp
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

    // intentar agregar
    let res = null
    try { res = await sock.groupParticipantsUpdate(chatId, [targetJid], "add") } catch {}

    const row = Array.isArray(res) ? res[0] : null
    const status = row?.status

    if (status === 200 || status === "200") {
      await sock.sendMessage(chatId, { text: `✅ Usuario agregado\n• Número: +${cleanNumber}` }, { quoted: msg })
      await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
      return
    }

    if (status === 409 || status === "409") {
      await sock.sendMessage(chatId, { text: "📍 Ese usuario ya está en el grupo." }, { quoted: msg })
      await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
      return
    }

    // ✅ privacidad / invitación requerida
    const link = await getGroupInviteLink(sock, chatId)

    // 1) ✅ MENSAJE PRO AL PRIVADO (con mención del que invitó)
    const dmText =
      `╭─ 𝗜𝗡𝗩𝗜𝗧𝗔𝗖𝗜𝗢́𝗡 𝗔 𝗚𝗥𝗨𝗣𝗢\n` +
      `│ 👋 Hola\n` +
      `│ Te invitaron a unirte a:\n` +
      `│ 🏷️ ${groupName}\n` +
      `│ 🙋 Invitado por: ${inviterTag}\n` +
      `│\n` +
      `│ 🔗 Enlace para entrar:\n` +
      `│ ${link}\n` +
      `│\n` +
      `│ ⏳ Si el enlace no abre, cópialo y pégalo en WhatsApp.\n` +
      `╰────────────`

    // ✅ mentions para que salga como mención real
    await sock.sendMessage(targetJid, {
      text: dmText,
      mentions: [inviterJid]
    }).catch(() => {})

    // 2) ✅ MENSAJE PRO AL GRUPO (solo confirma)
    const groupText =
      `╭─ 𝗜𝗡𝗩𝗜𝗧𝗔𝗖𝗜𝗢́𝗡 𝗘𝗡𝗩𝗜𝗔𝗗𝗔\n` +
      `│ ✅ Enviada al privado del usuario\n` +
      `│ 👤 Número: +${cleanNumber}\n` +
      `│\n` +
      `│ ℹ️ Normalmente esto pasa por privacidad\n` +
      `│ (no permite ser agregado directo)\n` +
      `╰────────────`

    await sock.sendMessage(chatId, { text: groupText }, { quoted: msg })

    await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
  } catch (e) {
    console.error("❌ Error en add:", e)
    const chatId = msg?.key?.remoteJid
    if (chatId) {
      await sock.sendMessage(chatId, { text: "❌ Ocurrió un error al ejecutar add." }, { quoted: msg }).catch(() => {})
    }
  }
}