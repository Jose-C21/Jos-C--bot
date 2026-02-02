import fs from "fs"
import path from "path"
import config from "../config.js"

export default async function resetsession(sock, msg, { isOwner }) {
  const chatId = msg?.key?.remoteJid || "unknown"
  console.log("[RESETSESSION] called", { chatId, isOwner })

  if (!isOwner) {
    console.log("[RESETSESSION] blocked: not owner")
    await sock.sendMessage(chatId, { text: "⛔ Solo owners pueden usar este comando." }, { quoted: msg })
    return
  }

  // Aviso
  try {
    await sock.sendMessage(chatId, {
      text:
        "⚠️ Reset de sesión\n\n" +
        "1) Cerrar sesión (logout)\n" +
        "2) Borrar carpeta sessions\n" +
        "3) Reiniciar proceso"\n" +
        "Sesión Cerrada Con Éxito ✅"
    }, { quoted: msg })
  } catch (e) {
    console.log("[RESETSESSION] sendMessage warning:", e?.message || e)
  }

  // 1) Logout
  try {
    console.log("[RESETSESSION] logout()...")
    await sock.logout()
    console.log("[RESETSESSION] logout() OK")
  } catch (e) {
    console.log("[RESETSESSION] logout() FAILED:", e?.message || e)
  }

  // 2) Borrar sessions
  try {
    const sessionsDir = path.join(process.cwd(), config.sessionsDir || "sessions")
    console.log("[RESETSESSION] removing sessions dir:", sessionsDir)
    fs.rmSync(sessionsDir, { recursive: true, force: true })
    console.log("[RESETSESSION] sessions removed OK")
  } catch (e) {
    console.log("[RESETSESSION] sessions remove FAILED:", e?.message || e)
  }

  // 3) Reiniciar
  console.log("[RESETSESSION] exiting process in 1200ms")
  setTimeout(() => process.exit(0), 1200)
}