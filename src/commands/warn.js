// src/commands/warn.js
import fs from "fs"
import path from "path"
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const SIGNATURE =
  "\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦"

const DATA_DIR = path.join(process.cwd(), "data")
const WARNS_PATH = path.join(DATA_DIR, "warns.json")

const LIMIT = 3

function ensureDB() {
  try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}
  try { if (!fs.existsSync(WARNS_PATH)) fs.writeFileSync(WARNS_PATH, "{}") } catch {}
}

function readDB() {
  try {
    ensureDB()
    return JSON.parse(fs.readFileSync(WARNS_PATH, "utf8") || "{}")
  } catch {
    return {}
  }
}

function writeDB(db) {
  try {
    ensureDB()
    fs.writeFileSync(WARNS_PATH, JSON.stringify(db, null, 2))
  } catch {}
}

const onlyDigits = (x) => String(x || "").replace(/\D/g, "")

// ✅ FIX: limpiar razón (quita menciones tipo @Dalila / @504xxxx)
function cleanReasonText(raw = "") {
  let s = String(raw || "").trim()
  if (!s) return ""

  // quita menciones de nombres (@Dalila, @Jose, etc)
  s = s.replace(/@\S+/g, "").trim()

  // quita menciones numéricas (@504xxxxxx)
  s = s.replace(/@\d{6,}/g, "").trim()

  // limpia espacios
  s = s.replace(/\s+/g, " ").trim()

  return s
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

function unwrapMessage(msg) {
  let m = msg?.message || {}
  while (true) {
    if (m?.ephemeralMessage?.message) { m = m.ephemeralMessage.message; continue }
    if (m?.viewOnceMessageV2?.message) { m = m.viewOnceMessageV2.message; continue }
    if (m?.viewOnceMessageV2Extension?.message) { m = m.viewOnceMessageV2Extension.message; continue }
    break
  }
  return m
}

function getCtxInfo(msg) {
  const m = unwrapMessage(msg)
  return (
    m?.extendedTextMessage?.contextInfo ||
    m?.imageMessage?.contextInfo ||
    m?.videoMessage?.contextInfo ||
    m?.documentMessage?.contextInfo ||
    null
  )
}

function getMentionTagFromJid(jid) {
  return `@${jidToNumber(jid) || onlyDigits(jid) || "usuario"}`
}

async function getGroupSubject(sock, chatId) {
  try {
    const md = await sock.groupMetadata(chatId)
    return (md?.subject || "Grupo").trim()
  } catch {
    return "Grupo"
  }
}

function pickTargetJid(msg) {
  const ctx = getCtxInfo(msg) || {}
  if (ctx?.mentionedJid?.length) return ctx.mentionedJid[0]
  if (ctx?.participant) return ctx.participant
  return null
}

function buildWarnCard({ userJid, subject, count, reason, modJid }) {
  const userTag = getMentionTagFromJid(userJid)
  const modTag = getMentionTagFromJid(modJid)

  return (
`╭─ ⚠️ 𝗪𝗔𝗥𝗡 𝗦𝗬𝗦𝗧𝗘𝗠
│ 👤 Usuario: ${userTag}
│ 📌 Grupo: ${subject}
│ 🚨 Warn: ${count}/${LIMIT}
│ 📝 Razón: ${reason || "Sin razón"}
│ 👮 Mod: ${modTag}
╰────────────
⚠️ Al llegar a ${LIMIT}/${LIMIT}: *EXPULSIÓN AUTOMÁTICA*` + SIGNATURE
  )
}

function buildWarnsList({ userJid, subject, count, reasons = [] }) {
  const userTag = getMentionTagFromJid(userJid)
  const lines = reasons.slice(-10).map((r, i) => `│ • ${i + 1}. ${r}`).join("\n") || "│ • (sin historial)"
  return (
`╭─ 📋 𝗪𝗔𝗥𝗡𝗦
│ 👤 Usuario: ${userTag}
│ 📌 Grupo: ${subject}
│ 🚨 Total: ${count}/${LIMIT}
├────────────
${lines}
╰────────────` + SIGNATURE
  )
}

function buildResetMsg({ userJid, subject, modJid }) {
  const userTag = getMentionTagFromJid(userJid)
  const modTag = getMentionTagFromJid(modJid)
  return (
`╭─ ✅ 𝗥𝗘𝗦𝗘𝗧 𝗪𝗔𝗥𝗡𝗦
│ 👤 Usuario: ${userTag}
│ 📌 Grupo: ${subject}
│ 🧹 Estado: Advertencias restablecidas
│ 👮 Mod: ${modTag}
╰────────────` + SIGNATURE
  )
}

async function isSenderAdminLikeKick(sock, chatId, senderJid, decodedJid) {
  const metadata = await sock.groupMetadata(chatId)
  const groupAdmins = (metadata.participants || []).filter((p) => p.admin)
  return groupAdmins.some((p) => p.id === senderJid || p.id === decodedJid)
}

// ✅ ayuda pro cuando piden .warn sin target / sin reply
function buildHelpPro({ subject }) {
  const p = config.prefix || "."
  return (
`╭─ ⚠️ 𝗪𝗔𝗥𝗡 𝗦𝗬𝗦𝗧𝗘𝗠
│ 📌 Grupo: ${subject}
│ 🚨 Límite: ${LIMIT}/${LIMIT}  (al llegar: EXPULSIÓN)
├────────────
│ ✅ ¿Para qué sirve?
│ Controla advertencias por usuario. A los ${LIMIT} warns: *kick automático*.
├────────────
│ 🧩 ¿Cómo usar?
│ 1) Menciona al usuario o responde su mensaje (reply).
│ 2) Escribe la razón (opcional, pero recomendado).
├────────────
│ ✅ 𝗖𝗢𝗠𝗔𝗡𝗗𝗢𝗦
│
│ • ${p}warn @usuario <razón>
│   ↳ Agrega 1 advertencia.
│   ↳ Ej: ${p}warn @usuario insultos
│
│ • ${p}warns @usuario
│   ↳ Muestra total e historial (últimos 10).
│
│ • ${p}unwarn @usuario <cantidad>
│   ↳ Quita advertencias.
│   ↳ Ej: ${p}unwarn @usuario 1
│
│ • ${p}resetwarns @usuario
│   ↳ Borra todas las advertencias del usuario.
│
│ 📍 Tip (reply):
│ Responde al mensaje del usuario y escribe:
│ • ${p}warn <razón>
╰────────────` + SIGNATURE
  )
}

export default async function warnSystem(sock, msg, { args = [], command = "warn" } = {}) {
  try {
    const chatId = msg?.key?.remoteJid
    if (!chatId) return

    const isGroup = String(chatId).endsWith("@g.us")
    await sock.sendMessage(chatId, { react: { text: "⚠️", key: msg.key } }).catch(() => {})

    if (!isGroup) {
      return await sock.sendMessage(
        chatId,
        { text: "🚫 *Este comando solo funciona en grupos.*" + SIGNATURE },
        { quoted: msg }
      )
    }

    // sender ids (como tu kick)
    const senderJid = getSenderJid(msg)
    const senderNum = jidToNumber(senderJid)

    let decodedJid = senderJid
    try { if (sock?.decodeJid) decodedJid = sock.decodeJid(senderJid) } catch {}
    const senderNumDecoded = jidToNumber(decodedJid)

    const isOwner = isOwnerByNumbers({ senderNum, senderNumDecoded })
    const fromMe = !!msg.key?.fromMe

    // admin?
    let isSenderAdmin = false
    try {
      isSenderAdmin = await isSenderAdminLikeKick(sock, chatId, senderJid, decodedJid)
    } catch {}

    // Permisos: admin/owner/fromMe
    if (!isSenderAdmin && !isOwner && !fromMe) {
      return await sock.sendMessage(
        chatId,
        { text: "❌ *Solo los administradores o el owner pueden usar el sistema de warns.*" + SIGNATURE },
        { quoted: msg }
      )
    }

    const subject = await getGroupSubject(sock, chatId)

    // target (mención o reply)
    const targetJid = pickTargetJid(msg)

    // comandos
    const cmd = String(command || "warn").toLowerCase()

    // ayuda rápida si no hay target cuando se requiere
    const needTarget = ["warn", "warns", "unwarn", "resetwarns", "resetwarnings"].includes(cmd)
    if (needTarget && !targetJid) {
      return await sock.sendMessage(
        chatId,
        { text: buildHelpPro({ subject }) },
        { quoted: msg }
      )
    }

    // DB
    const db = readDB()
    db[chatId] = db[chatId] || {}

    const key = String(targetJid)
    db[chatId][key] = db[chatId][key] || { count: 0, reasons: [] }

    // WARNCFG (opcional, si luego quieres expandir)
    if (cmd === "warncfg") {
      return await sock.sendMessage(
        chatId,
        {
          text:
            `╭─ ⚙️ 𝗪𝗔𝗥𝗡 𝗖𝗙𝗚\n` +
            `│ 📌 Grupo: ${subject}\n` +
            `│ 🚨 Límite: ${LIMIT}\n` +
            `│ ✅ Acción: Kick automático al llegar a ${LIMIT}\n` +
            `╰────────────` +
            SIGNATURE
        },
        { quoted: msg }
      )
    }

    // WARNS (ver)
    if (cmd === "warns") {
      const row = db[chatId][key] || { count: 0, reasons: [] }
      await sock.sendMessage(
        chatId,
        {
          text: buildWarnsList({
            userJid: targetJid,
            subject,
            count: row.count || 0,
            reasons: row.reasons || []
          }),
          mentions: [targetJid]
        },
        { quoted: msg }
      ).catch(() => {})
      await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
      return
    }

    // RESETWARNS (restablecer advertencias)
    if (cmd === "resetwarns" || cmd === "resetwarnings") {
      delete db[chatId][key]
      writeDB(db)

      await sock.sendMessage(
        chatId,
        {
          text: buildResetMsg({ userJid: targetJid, subject, modJid: decodedJid }),
          mentions: [targetJid, decodedJid]
        },
        { quoted: msg }
      ).catch(() => {})
      await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
      return
    }

    // UNWARN @user <n>
    if (cmd === "unwarn") {
      const row = db[chatId][key] || { count: 0, reasons: [] }
      const n = parseInt(args?.[0] || "1", 10)
      const dec = Number.isFinite(n) ? n : 1

      row.count = Math.max(0, (row.count || 0) - Math.max(1, dec))
      db[chatId][key] = row
      if (row.count <= 0) delete db[chatId][key]
      writeDB(db)

      const left = Math.max(0, row.count || 0)
      await sock.sendMessage(
        chatId,
        {
          text:
            `✅ ${getMentionTagFromJid(targetJid)}\n` +
            `Se removieron ${Math.max(1, dec)} advertencia(s).\n` +
            `🚨 Warn actual: ${left}/${LIMIT}` +
            SIGNATURE,
          mentions: [targetJid]
        },
        { quoted: msg }
      ).catch(() => {})
      await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
      return
    }

    // WARN (sumar)
    if (cmd === "warn") {
      // ✅ FIX: limpiar razón para que no salga "@Dalila insultos"
      const rawReason = (args || []).join(" ").trim()
      const reason = cleanReasonText(rawReason) || "Sin razón"

      const row = db[chatId][key] || { count: 0, reasons: [] }

      row.count = (row.count || 0) + 1
      row.reasons = Array.isArray(row.reasons) ? row.reasons : []
      row.reasons.push(reason)

      db[chatId][key] = row
      writeDB(db)

      // aviso pro (con expulsión automática al 3/3)
      await sock.sendMessage(
        chatId,
        {
          text: buildWarnCard({
            userJid: targetJid,
            subject,
            count: row.count,
            reason,
            modJid: decodedJid
          }),
          mentions: [targetJid, decodedJid]
        },
        { quoted: msg }
      ).catch(() => {})

      // kick automático al llegar a 3
      if (row.count >= LIMIT) {
        // refrescar metadata y confirmar que sigue en el grupo
        let md
        try { md = await sock.groupMetadata(chatId) } catch {}
        const stillIn = (md?.participants || []).some((p) => p.id === targetJid)
        if (stillIn) {
          // si es admin no expulsar
          const admins = (md?.participants || []).filter((p) => p.admin).map((p) => p.id)
          const isTargetAdmin = admins.includes(targetJid)

          if (!isTargetAdmin) {
            await sock.groupParticipantsUpdate(chatId, [targetJid], "remove").catch(() => {})
            await sock.sendMessage(
              chatId,
              {
                text:
                  `🚫 ${getMentionTagFromJid(targetJid)} fue expulsado por llegar a *${LIMIT}/${LIMIT} warns*.` +
                  SIGNATURE,
                mentions: [targetJid]
              },
              { quoted: msg }
            ).catch(() => {})
          } else {
            await sock.sendMessage(
              chatId,
              { text: `⚠️ No puedo expulsar a un administrador.` + SIGNATURE },
              { quoted: msg }
            ).catch(() => {})
          }
        }

        // ✅ borrar warns automáticamente si se expulsó / o llegó al límite
        delete db[chatId][key]
        writeDB(db)
      }

      await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }).catch(() => {})
      return
    }

    // si cae aquí, comando desconocido
    await sock.sendMessage(chatId, { text: "❌ Comando de warn no reconocido." + SIGNATURE }, { quoted: msg }).catch(() => {})
  } catch (e) {
    console.error("❌ Error en warn system:", e)
    const chatId = msg?.key?.remoteJid
    if (chatId) {
      await sock.sendMessage(chatId, { text: "❌ Ocurrió un error en el sistema de warns." + SIGNATURE }, { quoted: msg }).catch(() => {})
    }
  }
}