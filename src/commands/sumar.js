import fs from "fs"
import path from "path"
import { jidToNumber } from "../utils/jid.js"

const DATA_DIR = path.join(process.cwd(), "data")
const CONTEO_PATH = path.join(DATA_DIR, "conteo.json")

function ensureFile() {
  const dir = path.dirname(CONTEO_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(CONTEO_PATH)) fs.writeFileSync(CONTEO_PATH, "{}")
}

function readDB() {
  ensureFile()
  return JSON.parse(fs.readFileSync(CONTEO_PATH))
}

function writeDB(db) {
  fs.writeFileSync(CONTEO_PATH, JSON.stringify(db, null, 2))
}

export default async function sumar(sock, msg, { args, isOwner }) {
  const chatId = msg.key.remoteJid
  const isGroup = String(chatId).endsWith("@g.us")

  if (!isGroup) {
    await sock.sendMessage(chatId, { text: "❌ Solo en grupos." }, { quoted: msg })
    return
  }

  // 🔒 solo owner
  if (!isOwner) {
    await sock.sendMessage(chatId, {
      text: "❌ Solo el owner puede usar este comando."
    }, { quoted: msg })
    return
  }

  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []

  let targetJid = ""
  let cantidad = 0

  // ─────────────────────────────
  // ✅ CASO 1: CON MENCIÓN
  // ─────────────────────────────
  if (mentioned.length) {
    targetJid = mentioned[0]
    cantidad = Number(args[1])
  } else {
    // ─────────────────────────────
    // ✅ CASO 2: CON NÚMERO (FIX LID)
    // ─────────────────────────────
    const num = String(args[0] || "").replace(/\D/g, "")

    if (!num) {
      await sock.sendMessage(chatId, {
        text: "❌ Usa:\n.sumar @usuario 100\n.sumar 504XXXXXXXX 100"
      }, { quoted: msg })
      return
    }

    const db = readDB()
    const groupData = db[chatId] || {}

    // 🔥 1) buscar en conteo.json (MEJOR OPCIÓN)
    let encontrado = Object.keys(groupData).find(jid => {
      const clean = String(jid).replace(/\D/g, "")
      return clean.endsWith(num)
    })

    // 🟡 2) fallback: buscar en participantes
    if (!encontrado) {
      try {
        const metadata = await sock.groupMetadata(chatId)

        const participante = metadata.participants.find(p => {
          const clean = String(p.id || "").replace(/\D/g, "")
          return clean.endsWith(num)
        })

        if (participante) encontrado = participante.id
      } catch {}
    }

    // ❌ no encontrado
    if (!encontrado) {
      await sock.sendMessage(chatId, {
        text: "❌ Usuario no encontrado ni en conteo ni en grupo."
      }, { quoted: msg })
      return
    }

    targetJid = encontrado
    cantidad = Number(args[1])
  }

  // ─────────────────────────────
  // ❌ VALIDACIÓN
  // ─────────────────────────────
  if (!cantidad || cantidad <= 0) {
    await sock.sendMessage(chatId, {
      text: "❌ Cantidad inválida."
    }, { quoted: msg })
      return
  }

  // ─────────────────────────────
  // ✅ GUARDAR
  // ─────────────────────────────
  const db = readDB()

  if (!db[chatId]) db[chatId] = {}

  if (!db[chatId][targetJid]) db[chatId][targetJid] = 0

  db[chatId][targetJid] += cantidad

  writeDB(db)

  const numFinal = jidToNumber(targetJid)

  await sock.sendMessage(chatId, {
    text: `✅ Se agregaron *${cantidad}* mensajes a @${numFinal}`,
    mentions: [targetJid]
  }, { quoted: msg })
}