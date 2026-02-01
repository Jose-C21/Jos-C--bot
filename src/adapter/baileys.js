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
  console.log(chalk.magentaBright("   ⚡ Powered by José C - Kathy ⚡"))
  console.log(chalk.cyanBright("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"))
}

async function askMode() {
  while (true) {
    console.log(chalk.yellow("Elige vinculación:"))
    console.log(chalk.green("  1) QR"))
    console.log(chalk.green("  2) Código (Pairing)\n"))
    const pick = await ask(chalk.white("> "))
    const p = pick.trim()
    if (p === "1" || p === "2") return p
    console.log(chalk.red("\n❌ Opción inválida. Escribe 1 o 2.\n"))
  }
}

async function askPhone() {
  while (true) {
    console.log("") // salto para que no se pegue al "> 2"
    const phone = await ask(chalk.yellow("📱 Escribe tu número (ej: 504XXXXXXXX): "))
    const clean = phone.replace(/\D/g, "")

    // ✅ evita que “2” se acepte como número
    if (clean.length >= 10) return clean

    console.log(chalk.red("❌ Número inválido. Debe tener al menos 10 dígitos.\n"))
  }
}

export async function startSock(onMessage) {
  const { state, saveCreds } = await useMultiFileAuthState("sessions")
  const alreadyLinked = !!state?.creds?.registered

  banner()

  let mode = "qr"
  if (!alreadyLinked) {
    const pick = await askMode()
    mode = pick === "2" ? "code" : "qr"
    console.log("")
  } else {
    console.log(chalk.green("✅ Sesión ya vinculada, iniciando...\n"))
  }

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger,
    browser: Browsers.ubuntu("Chrome")
  })

  sock.ev.on("creds.update", saveCreds)

  // ✅ Pairing Code
  if (!alreadyLinked && mode === "code") {
    const clean = await askPhone()
    console.log(chalk.gray("\n⏳ Generando código...\n"))

    const code = await sock.requestPairingCode(clean)

    console.log(chalk.cyanBright("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"))
    console.log(chalk.greenBright("🔢 CÓDIGO: ") + chalk.whiteBright(code))
    console.log(chalk.cyanBright("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"))
    console.log(chalk.white("WhatsApp → Dispositivos vinculados → Vincular con número → ingresa el código\n"))
  }

  sock.ev.on("connection.update", async (u) => {
    const { connection, lastDisconnect, qr } = u

    // ✅ QR
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