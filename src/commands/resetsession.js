import fs from "fs"
import path from "path"
import config from "../config.js"

export default async function resetsession(sock, msg, { isOwner }) {
  const chatId = msg.key.remoteJid

  if (!isOwner) {
    await sock.sendMessage(chatId, { text: "⛔ Solo owners pueden usar este comando." }, { quoted: msg })
    return
  }

  await sock.sendMessage(chatId, {
    text:
      "⚠️ Reset de sesión\n\n" +
      "1) Cerrar sesión (logout)\n" +
      "2) Borrar carpeta sessions\n" +
      "3) Reiniciar proceso"
  }, { quoted: msg })

  // 1) Logout (intenta desvincular)
  try { await sock.logout() } catch {}

  // 2) Borrar sessions (sin terminal)
  try {
    const sessionsDir = path.join(process.cwd(), config.sessionsDir || "sessions")
    fs.rmSync(sessionsDir, { recursive: true, force: true })
  } catch {}

  // 3) Reiniciar
  setTimeout(() => process.exit(0), 1200)
}
