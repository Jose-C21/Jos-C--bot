// src/commands/totalmensajes.js
import fs from "fs"
import path from "path"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const DATA_DIR = path.join(process.cwd(), "data")

const CONTEO_PATH = path.join(DATA_DIR, "conteo.json")
const COOLDOWN_PATH = path.join(DATA_DIR, "cooldowns_totalmensajes.json")
const CONFIANZA_PATH = path.join(DATA_DIR, "confianza.json")

const COOLDOWN_SECONDS = 21600 // 6 horas

function ensureFile(filePath, defaultJson) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(defaultJson, null, 2))
}

function readJsonSafe(filePath, fallback = {}) {
  try {
    ensureFile(filePath, fallback)
    return JSON.parse(fs.readFileSync(filePath, "utf8") || JSON.stringify(fallback))
  } catch {
    return fallback
  }
}

function writeJsonSafe(filePath, data) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

function formatoTiempo(totalSeg) {
  const h = Math.floor(totalSeg / 3600)
  const m = Math.floor((totalSeg % 3600) / 60)
  const s = Math.floor(totalSeg % 60)

  const partes = []
  if (h) partes.push(`${h} hora${h > 1 ? "s" : ""}`)
  if (m) partes.push(`${m} minuto${m > 1 ? "s" : ""}`)
  if (s || partes.length === 0) partes.push(`${s} segundo${s > 1 ? "s" : ""}`)

  if (partes.length === 1) return partes[0]
  if (partes.length === 2) return partes.join(" y ")
  return partes.slice(0, -1).join(", ") + " y " + partes.slice(-1)
}

export default async function totalmensajes(sock, msg) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return

  const isGroup = String(chatId).endsWith("@g.us")
  if (!isGroup) {
    await sock.sendMessage(chatId, { text: "❌ Este comando solo puede usarse en grupos." }, { quoted: msg })
    return
  }

  // ✅ asegurar archivos
  ensureFile(CONTEO_PATH, {})
  ensureFile(COOLDOWN_PATH, {})
  ensureFile(CONFIANZA_PATH, {
    confianza: [
      "50432213256",
      "208272208490541",
      "18057074359",
      "19580839829625"
    ]
  })

  const senderJid = getSenderJid(msg)
  const senderNum = jidToNumber(senderJid)

  const cooldownData = readJsonSafe(COOLDOWN_PATH, {})
  const confianzaData = readJsonSafe(CONFIANZA_PATH, { confianza: [] })
  const listaConfiables = confianzaData.confianza || []

  const ahora = Date.now()
  const ultimoUso = cooldownData[senderJid] || 0
  const restanteSeg = Math.ceil((ultimoUso + COOLDOWN_SECONDS * 1000 - ahora) / 1000)

  const esConfiable = listaConfiables.some(id => String(id).includes(String(senderNum)))

  if (!esConfiable && restanteSeg > 0) {
    const tiempoTexto = formatoTiempo(restanteSeg)
    await sock.sendMessage(chatId, {
      text: `> ⏳ *@${senderNum}*, ᴅᴇʙᴇꜱ ᴇꜱᴘᴇʀᴀʀ *${tiempoTexto}* ᴀɴᴛᴇꜱ ᴅᴇ ᴠᴏʟᴠᴇʀ ᴀ ᴜꜱᴀʀ ᴇꜱᴛᴇ ᴄᴏᴍᴀɴᴅᴏ.`,
      mentions: [senderJid]
    }, { quoted: msg })
    return
  }

  // guardar uso
  cooldownData[senderJid] = ahora
  writeJsonSafe(COOLDOWN_PATH, cooldownData)

  // leer conteo
  const conteo = readJsonSafe(CONTEO_PATH, {})
  const groupData = conteo[chatId]

  if (!groupData) {
    await sock.sendMessage(chatId, { text: "No hay datos aún." }, { quoted: msg })
    return
  }

  // metadata y miembros reales
  const metadata = await sock.groupMetadata(chatId)
  const participantes = metadata.participants || []
  const miembrosReales = new Set(participantes.map(p => String(p.id).replace(/\D/g, "")))

  // consolidar por número (para unir JIDs raros/lid)
  const porNumero = {}
  for (const jid in groupData) {
    const numero = String(jid).replace(/\D/g, "")
    const mensajes = Number(groupData[jid] || 0)
    if (!miembrosReales.has(numero)) continue

    if (!porNumero[numero]) porNumero[numero] = { total: 0, bestJid: jid }
    porNumero[numero].total += mensajes
    // preferir el jid real del participante si aparece
    const participante = participantes.find(p => String(p.id).replace(/\D/g, "") === numero)
    if (participante?.id) porNumero[numero].bestJid = participante.id
  }

  const topUsuarios = Object.entries(porNumero)
    .map(([num, d]) => ({ num, jid: d.bestJid, total: d.total }))
    .sort((a, b) => b.total - a.total)

  const top30 = topUsuarios.slice(0, 30)
  const medallas = ["🥇", "🥈", "🥉"]

  let mensaje = `> 🏆 *Top de usuarios más activos en ${metadata.subject}:*\n\n`
  const mentions = []

  top30.forEach((u, i) => {
    const medalla = medallas[i] || `${i + 1}.`
    mensaje += `${medalla} @${u.num} ➤ ${u.total} mensajes\n`
    if (u.jid) mentions.push(u.jid)
  })

  await sock.sendMessage(chatId, { text: mensaje.trim(), mentions }, { quoted: msg })
}