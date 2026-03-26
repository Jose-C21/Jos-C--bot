export default async function antiestado(sock, msg, { args, isGroup, isAdmin, isOwner }) {
  const chatId = msg.key.remoteJid

  if (!isGroup) {
    return sock.sendMessage(chatId, { text: "❗ Este comando solo funciona en grupos." }, { quoted: msg })
  }

  if (!isAdmin && !isOwner) {
    return sock.sendMessage(chatId, { text: "❌ Solo administradores pueden usar este comando." }, { quoted: msg })
  }

  const fs = await import("fs")
  const path = await import("path")

  const dbPath = path.join(process.cwd(), "data", "activos.json")

  let db = {}
  try {
    db = JSON.parse(fs.readFileSync(dbPath))
  } catch {
    db = {}
  }

  if (!db.antiestado) db.antiestado = {}

  const option = (args[0] || "").toLowerCase()

  if (option === "on") {
    db.antiestado[chatId] = true

    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2))

    return sock.sendMessage(chatId, {
      text: "✅ Anti-estado activado.\nSe eliminarán menciones de estados."
    }, { quoted: msg })
  }

  if (option === "off") {
    delete db.antiestado[chatId]

    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2))

    return sock.sendMessage(chatId, {
      text: "❌ Anti-estado desactivado."
    }, { quoted: msg })
  }

  await sock.sendMessage(chatId, {
    text:
`╭───〔 ANTI-ESTADO 〕───╮
│
│  .antiestado on
│  .antiestado off
│
╰──────────────────────╯`
  }, { quoted: msg })
}