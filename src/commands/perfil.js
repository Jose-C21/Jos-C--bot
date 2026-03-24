// src/commands/perfil.js
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const FALLBACK_PP = "https://i.postimg.cc/VLCVJnd5/F6049B9B-B574-486D-94C7-AC17ED4438C2.png"

// 🧠 limpiar JID (número real o LID)
const limpiarId = (jid) => String(jid || "").replace(/[^0-9]/g, "")

// 🔐 Grupo especial (igual que tu lógica)
const GRUPO_RESTRINGIDO = "120363402012008160@g.us"
const ADMINS_CONFIANZA = [
  "50432213256",
  "18057074359",
  "19580839829625",
  "208272208490541",
]

// ✅ Firma que ya usas
const FIRMA =
`⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система
> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`

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

export default async function perfil(sock, msg, { args = [], usedPrefix = "." }) {
  try {
    const chatId = msg?.key?.remoteJid
    if (!chatId) return

    const senderJid = getSenderJid(msg)
    const senderNum = jidToNumber(senderJid)

    let decoded = senderJid
    try { if (sock?.decodeJid) decoded = sock.decodeJid(senderJid) } catch {}
    const senderNumDecoded = jidToNumber(decoded)

    const isOwner = isOwnerByNumbers({ senderNum, senderNumDecoded })
    const fromMe = !!msg.key?.fromMe

    // 📸 reacción inicial
    await sock.sendMessage(chatId, { react: { text: "📸", key: msg.key } }).catch(() => {})

    // 🔐 Si es grupo restringido → solo admins autorizados (tu lógica)
    if (chatId === GRUPO_RESTRINGIDO) {
      const senderClean = limpiarId(senderJid || decoded)

      const md = await sock.groupMetadata(chatId)
      const participante = md.participants?.find(p => limpiarId(p.id) === senderClean)

      const isAdmin = participante?.admin === "admin" || participante?.admin === "superadmin"
      if (!isAdmin && !fromMe && !isOwner) {
        await sock.sendMessage(chatId, { text: "⛔ Solo administradores pueden usar este comando en este grupo." }, { quoted: msg })
        return
      }

      if (!ADMINS_CONFIANZA.includes(senderClean) && !fromMe && !isOwner) {
        await sock.sendMessage(chatId, { text: "⛔ En este grupo solo administradores autorizados pueden usar este comando." }, { quoted: msg })
        return
      }
    }

    // ================== TARGET ==================
    const ctx = msg.message?.extendedTextMessage?.contextInfo || {}
    const mentioned = ctx.mentionedJid?.[0]
    const replied = ctx.participant

    // texto/args → número
    const rawText = (args.join(" ") || "").trim()
    let targetJid = null

    if (mentioned) targetJid = mentioned
    else if (replied) targetJid = replied
    else if (rawText) {
      const num = rawText.replace(/[^0-9]/g, "")
      if (num.length >= 7) targetJid = `${num}@s.whatsapp.net`
    }

    // ✅ guía (mejor, diferente a la tuya anterior)
    if (!targetJid) {
      const help =
        `🖼️ *Foto de perfil*\n\n` +
        `• Responde a un mensaje y escribe: *${usedPrefix}perfil*\n` +
        `• Menciona a alguien: *${usedPrefix}perfil @usuario*\n` +
        `• O escribe un número: *${usedPrefix}perfil 50499998888*\n\n` +
        `⚠️ Si la foto es privada ok ok, te saldrá una imagen por defecto.`
      await sock.sendMessage(chatId, { text: help }, { quoted: msg })
      return
    }

    // ✅ obtener foto
    let ppUrl = FALLBACK_PP
    try {
      ppUrl = await sock.profilePictureUrl(targetJid, "image")
    } catch {}

    const caption =
      `*Foto de perfil de:* @${jidToNumber(targetJid)}\n\n${FIRMA}`

    await sock.sendMessage(
      chatId,
      {
        image: { url: ppUrl },
        caption,
        mentions: [targetJid],
      },
      { quoted: msg }
    )
  } catch (error) {
    console.error("❌ Error en el comando perfil:", error)
    await sock.sendMessage(
      msg.key.remoteJid,
      { text: "❌ *Error:* No se pudo obtener la foto de perfil." },
      { quoted: msg }
    )
  }
}