import fs from "fs"
import path from "path"
import { jidToNumber } from "../utils/jid.js"

const DATA_DIR = path.join(process.cwd(), "data")
const CONTEO_PATH = path.join(DATA_DIR, "conteo.json")

function ensureConteoDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(CONTEO_PATH)) fs.writeFileSync(CONTEO_PATH, "{}")
}

export default async function reiniciarconteo(sock, msg, ctx) {
  const chatId = msg.key.remoteJid
  const { isOwner, senderNum } = ctx

  // 🔒 Solo privado
  if (chatId.endsWith("@g.us")) {
    return sock.sendMessage(chatId, {
      text: "⚠️ Este comando solo puede usarse en *privado* con el bot."
    })
  }

  // 👑 Solo owner
  if (!isOwner) {
    return sock.sendMessage(chatId, {
      text: "⛔ *Solo OWNER* puede ejecutar este comando."
    })
  }

  ensureConteoDB()

  const conteo = JSON.parse(fs.readFileSync(CONTEO_PATH, "utf-8") || "{}")
  const grupos = Object.keys(conteo)

  if (!grupos.length) {
    return sock.sendMessage(chatId, {
      text: "📭 No hay grupos con conteos guardados."
    })
  }

  // 📋 Lista
  let texto = "> 📊 *Grupos con conteo activo*\n\n"
  const map = {}
  let i = 1

  for (const gid of grupos) {
    try {
      const meta = await sock.groupMetadata(gid)
      texto += `${i}. ${meta.subject}\n`
      map[i] = { id: gid, name: meta.subject }
    } catch {
      texto += `${i}. Grupo no accesible\n`
      map[i] = { id: gid, name: "Desconocido" }
    }
    i++
  }

  texto += "\n✳️ *Responde con el número del grupo a reiniciar*"
  await sock.sendMessage(chatId, { text: texto })

  // ⏳ Esperar respuesta
  const elegido = await new Promise((resolve) => {
    const handler = ({ messages }) => {
      const m = messages?.[0]
      if (!m) return
      if (m.key.remoteJid !== chatId) return
      if (m.key.fromMe) return

      const t =
        m.message?.conversation ||
        m.message?.extendedTextMessage?.text ||
        ""

      const n = parseInt(t.trim())
      if (!map[n]) return

      sock.ev.off("messages.upsert", handler)
      resolve(map[n])
    }

    sock.ev.on("messages.upsert", handler)

    setTimeout(() => {
      sock.ev.off("messages.upsert", handler)
      resolve(null)
    }, 60000)
  })

  if (!elegido) {
    return sock.sendMessage(chatId, {
      text: "⌛ Tiempo agotado. Comando cancelado."
    })
  }

  // 🧹 Reiniciar conteo
  const actualizado = JSON.parse(fs.readFileSync(CONTEO_PATH, "utf-8") || "{}")
  actualizado[elegido.id] = {}
  fs.writeFileSync(CONTEO_PATH, JSON.stringify(actualizado, null, 2))

  await sock.sendMessage(chatId, {
    react: { text: "🧹", key: msg.key }
  })

  await sock.sendMessage(chatId, {
    text: `✅ Conteo reiniciado en *${elegido.name}*`
  })

  // 👑 Owners
  const ownerPrincipal = `${senderNum}@s.whatsapp.net`
  const ownerApoyo = "18057074359@s.whatsapp.net"

  const meta = await sock.groupMetadata(elegido.id)
  const miembros = meta.participants.map(p => p.id)

  // 📢 Aviso PRO
  await sock.sendMessage(elegido.id, {
    text:
`╭━🧹𝗖𝗢𝗡𝗧𝗘𝗢 𝗥𝗘𝗜𝗡𝗜𝗖𝗜𝗔𝗗𝗢
┃ 🏷️  Grupo: ${meta.subject}
┃
┃ 📊  El conteo de mensajes
┃      fue completamente reiniciado
┃
┃ 👑  Owner: @${senderNum}
┃ 👸🏻  Owner (Apoyo): @${jidToNumber(ownerApoyo)}
┃
┃ 🔄  Estado:
┃      Todos los contadores fueron
┃      restablecidos a *0*
╰━━━━━━━━━━━━━━━━`
    mentions: [ownerPrincipal, ownerApoyo, ...miembros]
  })

  console.log(`✅ Conteo reiniciado: ${elegido.id} (${elegido.name})`)
}