import fs from "fs"
import { jidToNumber } from "../utils/jid.js"

export default async function reiniciarconteo(sock, msg, ctx) {
  const chatId = msg.key.remoteJid
  const { isOwner, senderNum } = ctx

  // 🔒 Solo privado
  if (chatId.endsWith("@g.us")) {
    return sock.sendMessage(chatId, {
      text: "⚠️ Este comando solo puede usarse en *privado* con el bot."
    })
  }

  // 👑 Solo owner (router ya lo calculó)
  if (!isOwner) {
    return sock.sendMessage(chatId, {
      text: "⛔ *Solo OWNER* puede ejecutar este comando."
    })
  }

  const conteoPath = "/home/container/conteo.json"

  if (!fs.existsSync(conteoPath)) {
    return sock.sendMessage(chatId, {
      text: "❌ No existe el archivo de conteo aún."
    })
  }

  const conteo = JSON.parse(fs.readFileSync(conteoPath, "utf-8"))
  const grupos = Object.keys(conteo)

  if (!grupos.length) {
    return sock.sendMessage(chatId, {
      text: "📭 No hay grupos con conteos guardados."
    })
  }

  // 📋 Lista de grupos
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
  const actualizado = JSON.parse(fs.readFileSync(conteoPath, "utf-8"))
  actualizado[elegido.id] = {}
  fs.writeFileSync(conteoPath, JSON.stringify(actualizado, null, 2))

  await sock.sendMessage(chatId, {
    react: { text: "🧹", key: msg.key }
  })

  await sock.sendMessage(chatId, {
    text: `✅ Conteo reiniciado en *${elegido.name}*`
  })

  // 👑 Owners (ambos)
  const ownerPrincipal = `${senderNum}@s.whatsapp.net`
  const ownerApoyo = "18057074359@s.whatsapp.net"

  const meta = await sock.groupMetadata(elegido.id)
  const miembros = meta.participants.map(p => p.id)

  // 📢 Aviso PRO con menciones invisibles
  await sock.sendMessage(elegido.id, {
    text:
`╭━━━〔 🧹 𝗖𝗢𝗡𝗧𝗘𝗢 𝗥𝗘𝗜𝗡𝗜𝗖𝗜𝗔𝗗𝗢 〕━━━╮
┃ 📊 El conteo de mensajes ha sido
┃ completamente *reiniciado*
┃
┃ 🏷️ Grupo: ${meta.subject}
┃
┃ 👑 Owner: @${senderNum}
┃ 👸🏻 Owner: @${jidToNumber(ownerApoyo)}
┃
┃ 🔁 Todos los contadores vuelven a 0
╰━━━━━━━━━━━━━━━━━━━━━━╯`,
    mentions: [ownerPrincipal, ownerApoyo, ...miembros]
  })

  console.log(`✅ Conteo reiniciado: ${elegido.id} (${elegido.name})`)
}