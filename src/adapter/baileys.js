import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from "baileys"
import qrcode from "qrcode-terminal"
import { logger } from "../utils/logger.js"
import readline from "node:readline"

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(String(answer || "").trim())
    })
  })
}

export async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState("sessions") // ✅ crea sessions/ al guardar

  const alreadyLinked = !!state?.creds?.registered

  let mode = "qr"
  if (!alreadyLinked) {
    const pick = await ask("\nElige vinculación:\n1) QR\n2) Código\n> ")
    mode = pick === "2" ? "code" : "qr"
  }

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger,
    browser: Browsers.ubuntu("Chrome")
  })

  sock.ev.on("creds.update", saveCreds) // ✅ aquí es cuando se escribe sessions/*

  if (!alreadyLinked && mode === "code") {
    const phone = await ask("Escribe tu número (ej: 504XXXXXXXX): ")
    const clean = phone.replace(/\D/g, "")
    if (!clean) {
      console.log("❌ Número inválido.")
    } else {
      const code = await sock.requestPairingCode(clean)
      console.log("\n🔢 CÓDIGO:", code)
      console.log("WhatsApp → Dispositivos vinculados → Vincular con número → ingresa el código\n")
    }
  }

  sock.ev.on("connection.update", async (u) => {
    const { connection, lastDisconnect, qr } = u

    if (!alreadyLinked && mode === "qr" && qr) {
      qrcode.generate(qr, { small: true })
    }

    if (connection === "open") console.log("✅ Conectado")

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode
      const reconnect = code !== DisconnectReason.loggedOut
      console.log("⚠️ Conexión cerrada. Reconnect:", reconnect, "code:", code)
      if (reconnect) startSock()
    }
  })

  return sock
}
