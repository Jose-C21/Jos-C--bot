// src/core/adminGuard.js
//
// Seguridad de administración:
// Solo los OWNERS configurados (config.owners / config.ownersLid) pueden
// dar o quitar el cargo de administrador dentro del grupo.
//
// - Si un admin (que no es owner) le quita el admin a otro admin:
//     -> se le retira el admin al que lo quitó (castigo)
//     -> se le devuelve el admin al que se lo quitaron (restauración)
//
// - Si un admin (que no es owner) le da el admin a un miembro:
//     -> se le retira el admin al que lo otorgó (castigo)
//     -> se le retira el admin al que lo recibió (castigo)
//
// En ambos casos se envía un único aviso bonito mencionando a ambas partes.

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

function isBotAdminFromMd(md, botNumbers) {
  const parts = md?.participants || []
  for (const p of parts) {
    if (botNumbers.has(jidToNumber(p?.id))) {
      return p?.admin === "admin" || p?.admin === "superadmin"
    }
  }
  return false
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

    const botIsAdmin = isBotAdminFromMd(md, botNumbers)
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
        "🚨 *ALERTA DE SEGURIDAD* 🚨",
        "",
        "❌ Acción de administración no autorizada",
        "",
        `👤 Lo hizo: ${authorTag}`,
        `🎯 Le quitó el admin a: ${targetTags}`,
        "",
        "📌 Solo los *owners* del grupo pueden quitar administración.",
        "",
        "🔧 Corrección automática aplicada:",
        `• Se retiró el admin a ${authorTag}`,
        `• Se devolvió el admin a ${targetTags}`,
        "",
        `🛡️ ${groupName} está protegido.`
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
        "🚨 *ALERTA DE SEGURIDAD* 🚨",
        "",
        "❌ Acción de administración no autorizada",
        "",
        `👤 Lo hizo: ${authorTag}`,
        `🎯 Le dio admin a: ${targetTags}`,
        "",
        "📌 Solo los *owners* del grupo pueden otorgar administración.",
        "",
        "🔧 Corrección automática aplicada:",
        `• Se retiró el admin a ${authorTag}`
      ]

      if (punishableTargets.length) {
        lines.push(`• Se retiró el admin a ${targetTags}`)
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
