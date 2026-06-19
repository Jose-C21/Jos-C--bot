import config from "../config.js"
import { jidToNumber, isProtectedJid } from "../utils/jid.js"

const SIGNATURE =
  "\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦"

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

function normalizeParticipant(p) {
  if (!p) return { jid: "", phoneJid: "" }
  if (typeof p === "string") return { jid: p, phoneJid: "" }
  return { jid: String(p.id || ""), phoneJid: String(p.phoneNumber || "") }
}

function mentionTag(jid = "") {
  return `@${jidToNumber(jid)}`
}

function getBotNumberSet(sock) {
  const set = new Set()
  const add = (j) => {
    const n = jidToNumber(j)
    if (n) set.add(n)
  }
  add(sock?.user?.id)
  add(sock?.user?.lid)
  try { add(sock?.decodeJid?.(sock?.user?.id)) } catch {}
  try { add(sock?.decodeJid?.(sock?.user?.lid)) } catch {}
  return set
}

function isBotAdminFromMd(sock, md, botNumbers) {
  const parts = md?.participants || []

  const botJid = sock?.user?.id
  let decodedBotJid = botJid
  try { if (sock?.decodeJid) decodedBotJid = sock.decodeJid(botJid) } catch {}

  const botParticipant = parts.find(p => {
    if (!p?.id) return false
    if (p.id === botJid || p.id === decodedBotJid) return true
    const n = jidToNumber(p.id)
    return n && botNumbers.has(n)
  })

  return botParticipant?.admin === "admin" || botParticipant?.admin === "superadmin"
}


/**
 * Detecta si un autor de un evento group-participants.update es el propio bot.
 * Útil para que otros módulos (ej. groupWelcome) ignoren los avisos genéricos
 * cuando la acción de promote/demote fue ejecutada por este mismo bot
 * (acciones correctivas de este guard).
 */
export function isBotAuthor(sock, author) {
  if (!author) return false
  const botNumbers = getBotNumberSet(sock)
  if (botNumbers.has(jidToNumber(author))) return true

  let decodedAuthor = author
  try { if (sock?.decodeJid) decodedAuthor = sock.decodeJid(author) } catch {}
  return botNumbers.has(jidToNumber(decodedAuthor))
}

export async function adminSecurityGuard(sock, update) {
  try {
    const { id: groupId, participants = [], action, author } = update || {}

    if (!groupId || !String(groupId).endsWith("@g.us")) return false
    if (action !== "promote" && action !== "demote") return false
    if (!participants.length || !author) return false

    const botNumbers = getBotNumberSet(sock)
    const authorNum = jidToNumber(author)

    // ignorar eventos generados por el propio bot (sus acciones correctivas)
    if (botNumbers.has(authorNum)) return false

    let decodedAuthor = author
    try { if (sock?.decodeJid) decodedAuthor = sock.decodeJid(author) } catch {}
    const authorNumDecoded = jidToNumber(decodedAuthor)

    if (botNumbers.has(authorNumDecoded)) return false

    // los owners sí pueden dar/quitar admin con total libertad
    if (isOwnerByNumbers({ senderNum: authorNum, senderNumDecoded: authorNumDecoded })) {
      return false
    }

    const rawTargets = []
    for (const p of participants) {
      const { jid: pJid, phoneJid } = normalizeParticipant(p)
      const targetJid = phoneJid || pJid
      if (targetJid) rawTargets.push(targetJid)
    }
    if (!rawTargets.length) return false

    let md = null
    let groupName = "este grupo"
    try {
      md = await sock.groupMetadata(groupId)
      groupName = (md?.subject || "este grupo").trim()
    } catch {}

    console.log("[DEBUG botIsAdmin]", JSON.stringify({
  sockUserId: sock?.user?.id,
  sockUserLid: sock?.user?.lid,
  botNumbers: Array.from(botNumbers),
  participantsRaw: (md?.participants || []).map(p => ({ id: p?.id, admin: p?.admin }))
}))
  const botIsAdmin = isBotAdminFromMd(sock, md, botNumbers)

    const authorTag = mentionTag(decodedAuthor || author)

    if (action === "demote") {
      const targetTags = rawTargets.map(mentionTag).join(", ")
      const mentions = Array.from(new Set([author, decodedAuthor, ...rawTargets].filter(Boolean)))

      if (!botIsAdmin) {
        await sock.sendMessage(groupId, {
          text:
`🚨 *ALERTA DE SEGURIDAD* 🚨

❌ ${authorTag} le quitó el admin a ${targetTags} sin ser owner.

📌 Solo los *owners* del grupo pueden quitar administración.

⚠️ No pude corregirlo automáticamente porque no soy administrador del grupo.
🔧 Hazme administrador para activar esta protección.` + SIGNATURE,
          mentions
        }).catch(() => {})
        return true
      }

      await sock.groupParticipantsUpdate(groupId, [author], "demote").catch(() => {})
      for (const t of rawTargets) {
        await sock.groupParticipantsUpdate(groupId, [t], "promote").catch(() => {})
      }

      const lines = [
        "🚨 𝗔𝗟𝗘𝗥𝗧𝗔 𝗗𝗘 𝗦𝗘𝗚𝗨𝗥𝗜𝗗𝗔𝗗 🚨",
        "",
        "❌ 𝗔𝗰𝗰𝗶𝗼́𝗻 𝗱𝗲 𝗮𝗱𝗺𝗶𝗻𝗶𝘀𝘁𝗿𝗮𝗰𝗶𝗼́𝗻 𝗻𝗼 𝗮𝘂𝘁𝗼𝗿𝗶𝘇𝗮𝗱𝗮",
        "",
        `👤 𝗟𝗼 𝗵𝗶𝘇𝗼: ${authorTag}`,
        `🎯 𝗟𝗲 𝗾𝘂𝗶𝘁𝗼́ 𝗲𝗹 𝗮𝗱𝗺𝗶𝗻 𝗮: ${targetTags}`,
        "",
        "📌 𝗦𝗼𝗹𝗼 𝗹𝗼𝘀 𝗼𝘄𝗻𝗲𝗿𝘀 𝗱𝗲𝗹 𝗴𝗿𝘂𝗽𝗼 𝗽𝘂𝗲𝗱𝗲𝗻 𝗾𝘂𝗶𝘁𝗮𝗿 𝗮𝗱𝗺𝗶𝗻𝗶𝘀𝘁𝗿𝗮𝗰𝗶𝗼́𝗻.",
        "",
        "🔧 𝗖𝗼𝗿𝗿𝗲𝗰𝗰𝗶𝗼́𝗻 𝗮𝘂𝘁𝗼𝗺𝗮́𝘁𝗶𝗰𝗮 𝗮𝗽𝗹𝗶𝗰𝗮𝗱𝗮:",
        `🔻 𝗦𝗲 𝗿𝗲𝘁𝗶𝗿𝗼́ 𝗲𝗹 𝗮𝗱𝗺𝗶𝗻 𝗮 ${authorTag}`,
        `🔁 𝗦𝗲 𝗱𝗲𝘃𝗼𝗹𝘃𝗶𝗼́ 𝗲𝗹 𝗮𝗱𝗺𝗶𝗻 𝗮 ${targetTags}`,
        "",
        `🛡️ ${groupName} 𝗲𝘀𝘁𝗮́ 𝗽𝗿𝗼𝘁𝗲𝗴𝗶𝗱𝗼.`
      ]

      await sock.sendMessage(groupId, {
        text: lines.join("\n") + SIGNATURE,
        mentions
      }).catch(() => {})

      return true
    }

    if (action === "promote") {
      // si únicamente le dieron admin al propio bot, no es una violación
      const realTargets = rawTargets.filter(t => !botNumbers.has(jidToNumber(t)))
      if (!realTargets.length) return false

      // nunca le quitamos el admin a un owner por error
      const punishableTargets = realTargets.filter(t => !isProtectedJid(sock, t, config))

      const targetTags = realTargets.map(mentionTag).join(", ")
      const mentions = Array.from(new Set([author, decodedAuthor, ...realTargets].filter(Boolean)))

      if (!botIsAdmin) {
        await sock.sendMessage(groupId, {
          text:
`🚨 *ALERTA DE SEGURIDAD* 🚨

❌ ${authorTag} le dio el admin a ${targetTags} sin ser owner.

📌 Solo los *owners* del grupo pueden otorgar administración.

⚠️ No pude corregirlo automáticamente porque no soy administrador del grupo.
🔧 Hazme administrador para activar esta protección.` + SIGNATURE,
          mentions
        }).catch(() => {})
        return true
      }

      await sock.groupParticipantsUpdate(groupId, [author], "demote").catch(() => {})
      for (const t of punishableTargets) {
        await sock.groupParticipantsUpdate(groupId, [t], "demote").catch(() => {})
      }

      const lines = [
        "🚨 𝗔𝗟𝗘𝗥𝗧𝗔 𝗗𝗘 𝗦𝗘𝗚𝗨𝗥𝗜𝗗𝗔𝗗 🚨",
        "",
        "❌ 𝗔𝗰𝗰𝗶𝗼́𝗻 𝗱𝗲 𝗮𝗱𝗺𝗶𝗻𝗶𝘀𝘁𝗿𝗮𝗰𝗶𝗼́𝗻 𝗻𝗼 𝗮𝘂𝘁𝗼𝗿𝗶𝘇𝗮𝗱𝗮",
        "",
        `👤 𝗟𝗼 𝗵𝗶𝘇𝗼: ${authorTag}`,
        `🎯 𝗟𝗲 𝗱𝗶𝗼 𝗮𝗱𝗺𝗶𝗻 𝗮: ${targetTags}`,
        "",
        "📌 𝗦𝗼𝗹𝗼 𝗹𝗼𝘀 𝗼𝘄𝗻𝗲𝗿𝘀 𝗱𝗲𝗹 𝗴𝗿𝘂𝗽𝗼 𝗽𝘂𝗲𝗱𝗲𝗻 𝗼𝘁𝗼𝗿𝗴𝗮𝗿 𝗮𝗱𝗺𝗶𝗻𝗶𝘀𝘁𝗿𝗮𝗰𝗶𝗼́𝗻.",
        "",
        "🔧 𝗖𝗼𝗿𝗿𝗲𝗰𝗰𝗶𝗼́𝗻 𝗮𝘂𝘁𝗼𝗺𝗮́𝘁𝗶𝗰𝗮 𝗮𝗽𝗹𝗶𝗰𝗮𝗱𝗮:",
        `🔻 𝗦𝗲 𝗿𝗲𝘁𝗶𝗿𝗼́ 𝗲𝗹 𝗮𝗱𝗺𝗶𝗻 𝗮 ${authorTag}`
      ]

      if (punishableTargets.length) {
        lines.push(`🔻 𝗦𝗲 𝗿𝗲𝘁𝗶𝗿𝗼́ 𝗲𝗹 𝗮𝗱𝗺𝗶𝗻 𝗮 ${targetTags}`)
      }

      lines.push("", `🛡️ ${groupName} está protegido.`)

      await sock.sendMessage(groupId, {
        text: lines.join("\n") + SIGNATURE,
        mentions
      }).catch(() => {})

      return true
    }

    return false
  } catch (e) {
    console.error("[adminSecurityGuard] error:", e)
    return false
  }
}
