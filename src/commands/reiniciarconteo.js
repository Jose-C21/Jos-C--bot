// src/commands/reiniciarconteo.js
import fs from "fs"
import path from "path"
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const SIGNATURE =
  "\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽 | частная система\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦"

// 📊 archivo de conteo
const CONTEO_PATH = path.join(process.cwd(), "data", "conteo.json")

// 👑 OWNER DE APOYO (también es owner)
const SUPPORT_OWNER_JID = "18057074359@s.whatsapp.net"

function ensureConteo() {
  const dir = path.dirname(CONTEO_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(CONTEO_PATH)) fs.writeFileSync(CONTEO_PATH, "{}")
}

function readConteo() {
  ensureConteo()
  return JSON.parse(fs.readFileSync(CONTEO_PATH, "utf-8") || "{}")
}

function writeConteo(data) {
  ensureConteo()
  fs.writeFileSync(CONTEO_PATH, JSON.stringify(data, null, 2))
}

function isOwner(senderNum) {
  const owners = (config.owners || []).map(String)
  return owners.includes(String(senderNum))
}

export default async function reiniciarConteo(sock, msg) {
  try {
    const chatId = msg.key.remoteJid
    const isGroup = chatId.endsWith("@g.us")

    // ❌ solo privado
    if (isGroup) {
      return await sock.sendMessage(
        chatId,
        { text: "⚠️ *Este comando solo puede usarse en privado con el bot.*" + SIGNATURE },
        { quoted: msg }
      )
    }

    const senderJid = getSenderJid(msg)
    const senderNum = jidToNumber(senderJid)

    // ❌ solo owner
    if (!isOwner(senderNum)) {
      return await sock.sendMessage(
        chatId,
        { text: "🚫 *Solo el OWNER puede ejecutar este comando.*" + SIGNATURE },
        { quoted: msg }
      )
    }

    const conteo = readConteo()
    const grupos = Object.keys(conteo)

    if (!grupos.length) {
      return await sock.sendMessage(
        chatId,
        { text: "📭 *No hay grupos con conteo registrado.*" + SIGNATURE },
        { quoted: msg }
      )
    }

    // 📋 lista de grupos
    let texto = "📊 *Grupos con conteo activo:*\n\n"
    const mapa = {}
    let i = 1

    for (const gid of grupos) {
      try {
        const md = await sock.groupMetadata(gid)
        texto += `${i}. ${md.subject}\n`
        mapa[i] = { id: gid, name: md.subject }
      } catch {
        texto += `${i}. Grupo no accesible\n`
        mapa[i] = { id: gid, name: "Desconocido" }
      }
      i++
    }

    texto += "\n✳️ *Responde con el número del grupo a reiniciar*"
    await sock.sendMessage(chatId, { text: texto })

    // ⏳ esperar respuesta única
    const seleccion = await new Promise((resolve) => {
      const handler = async (upsert) => {
        const m = upsert.messages?.[0]
        if (!m || m.key.fromMe) return
        if (m.key.remoteJid !== chatId) return

        const num = parseInt(
          m.message?.conversation ||
          m.message?.extendedTextMessage?.text ||
          ""
        )

        if (!mapa[num]) return
        sock.ev.off("messages.upsert", handler)
        resolve(mapa[num])
      }
      sock.ev.on("messages.upsert", handler)
    })

    if (!seleccion) return

    // 🧹 reiniciar conteo
    const nuevo = readConteo()
    nuevo[seleccion.id] = {}
    writeConteo(nuevo)

    await sock.sendMessage(chatId, { react: { text: "🧹", key: msg.key } })
    await sock.sendMessage(
      chatId,
      { text: `🧹 Conteo reiniciado en *${seleccion.name}*.` },
      { quoted: msg }
    )

    // 📢 AVISO PRO EN EL GRUPO
    const metadata = await sock.groupMetadata(seleccion.id)
    const miembros = metadata.participants.map(p => p.id)

    const AVISO_PRO =
`╭─ 🧹 𝗖𝗢𝗡𝗧𝗘𝗢 𝗥𝗘𝗜𝗡𝗜𝗖𝗜𝗔𝗗𝗢
│
│ 📊 Sistema: Total de Mensajes
│ 🏷️ Grupo: ${metadata.subject}
│
│ 👑 Owner:
│ @${jidToNumber(senderJid)}
│
│ 👑 Owner:
│ @${jidToNumber(SUPPORT_OWNER_JID)}
│
│ 🔄 Estado:
│ Todos los conteos fueron
│ restablecidos a *0*
│
╰────────────────────
📢 El conteo ha iniciado nuevamente.`

    await sock.sendMessage(
      seleccion.id,
      {
        text: AVISO_PRO,
        mentions: [
          senderJid,
          SUPPORT_OWNER_JID,
          ...miembros // 👻 mención invisible
        ]
      }
    )

    console.log(`✅ Conteo reiniciado: ${seleccion.id} (${seleccion.name})`)

  } catch (e) {
    console.error("❌ Error reiniciarconteo:", e)
  }
}