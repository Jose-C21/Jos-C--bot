import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from "baileys"
import qrcode from "qrcode-terminal"
import { logger } from "../utils/logger.js"
import readline from "node:readline"
import chalk from "chalk"

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(String(answer || "").trim())
    })
  })
}

function banner() {
  console.clear?.()
  console.log(chalk.cyanBright("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"))
  console.log(chalk.magentaBright("      🤖  Jose C - Grupo Bot v1"))
  console.log(chalk.cyanBright("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"))
}

export async function startSock(onMessage) {
  const { state, saveCreds } = await useMultiFileAuthState("sessions")
  const alreadyLinked = !!state?.creds?.registered

  banner()

  let mode = "qr"
  if (!alreadyLinked) {
    console.log(chalk.yellow("Elige vinculación:"))
    console.log(chalk.green("  1) QR"))
    console.log(chalk.green("  2) Código (Pairing)\n"))
    const pick = await ask(chalk.white("> "))
    mode = pick === "2" ? "code" : "qr"
    console.log("")
  } else {
    console.log(chalk.green("✅ Sesión ya vinculada, iniciando...\n"))
  }

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger, // ✅ ya no spamea JSON
    browser: Browsers.ubuntu("Chrome")
  })

  sock.ev.on("creds.update", saveCreds)

  if (!alreadyLinked && mode === "code") {
    const phone = await ask(chalk.yellow("📱 Escribe tu número (ej: 504XXXXXXXX): ") )
    const clean = phone.replace(/\D/g, "")
    if (!clean) {
      console.log(chalk.red("❌ Número inválido.\n"))
    } else {
      console.log(chalk.gray("⏳ Generando código...\n"))
      const code = await sock.requestPairingCode(clean)
      console.log(chalk.cyanBright("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"))
      console.log(chalk.greenBright("🔢 CÓDIGO: ") + chalk.whiteBright(code))
      console.log(chalk.cyanBright("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"))
      console.log(chalk.white("WhatsApp → Dispositivos vinculados → Vincular con número → ingresa el código\n"))
    }
  }

  sock.ev.on("connection.update", async (u) => {
    const { connection, lastDisconnect, qr } = u

    if (!alreadyLinked && mode === "qr" && qr) {
      console.log(chalk.gray("📷 Escanea el QR para vincular:\n"))
      qrcode.generate(qr, { small: true })
      console.log("")
    }

    if (connection === "open") {
      console.log(chalk.greenBright("✅ Conectado\n"))
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode
      const reconnect = code !== DisconnectReason.loggedOut
      console.log(chalk.red("⚠️ Conexión cerrada.") + " Reconnect:", reconnect, "code:", code)
      if (reconnect) startSock(onMessage)
    }
  })

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages || []) {
      try { await onMessage(sock, msg) } catch {}
    }
  })

  return sock
}
