import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from "baileys"
import qrcode from "qrcode-terminal"
import { logger } from "../utils/logger.js"
import chalk from "chalk"
import figlet from "figlet"

// ─────────────────────────────────────────────
// ✅ INPUT SIMPLE (sin readline) para panel web
// ─────────────────────────────────────────────
function createInput() {
  process.stdin.setEncoding("utf8")
  process.stdin.resume()

  const queue = []
  let resolver = null

  function onData(chunk) {
    const line = String(chunk).trim()
    if (!line) return
    if (resolver) {
      const r = resolver
      resolver = null
      r(line)
    } else {
      queue.push(line)
    }
  }

  process.stdin.on("data", onData)

  return async function inputLine() {
    if (queue.length) return queue.shift()
    return await new Promise((res) => (resolver = res))
  }
}
const inputLine = createInput()

function line() {
  console.log(chalk.cyanBright("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"))
}

function center(text, width = 38) {
  const s = String(text)
  if (s.length >= width) return s
  const left = Math.floor((width - s.length) / 2)
  return " ".repeat(left) + s
}

// ✅ Banner compacto (móvil friendly)
function banner() {
  const WIDTH = 38

  const padCenter = (line, width = WIDTH) => {
    const s = String(line).replace(/\s+$/, "")
    if (s.length >= width) return s.slice(0, width)
    const left = Math.floor((width - s.length) / 2)
    return " ".repeat(left) + s
  }

  console.log(chalk.cyanBright("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"))

  // ASCII principal pequeño: POWERED BY
  const pb = figlet.textSync("POWERED BY", { font: "Small" }).split("\n")
  const pbClean = pb.map(l => l.trimEnd()).filter(l => l.trim().length)
  for (const l of pbClean) console.log(chalk.cyanBright(padCenter(l)))

  console.log(chalk.cyanBright("──────────────────────────────────────"))

  // ASCII pequeño centrado para nombres
  const names = figlet.textSync("Jose C - Kathy", { font: "Small" }).split("\n")
  const namesClean = names.map(l => l.trimEnd()).filter(l => l.trim().length)
  for (const l of namesClean) console.log(chalk.magentaBright(padCenter(l)))

  console.log(chalk.cyanBright("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"))
}

async function askMode() {
  while (true) {
    console.log(chalk.yellow("Elige vinculación:"))
    console.log(chalk.green("  1) QR"))
    console.log(chalk.green("  2) Código (Pairing)\n"))
    process.stdout.write(chalk.white("> "))

    const pick = (await inputLine()).trim()
    if (pick === "1" || pick === "2") return pick
    console.log(chalk.red("\n❌ Opción inválida. Escribe 1 o 2.\n"))
  }
}

async function askPhone() {
  while (true) {
    console.log("")
    console.log(chalk.yellow("📱 Escribe tu número (sin +)"))
    console.log(chalk.gray("Ej: 504XXXXXXXX"))
    process.stdout.write(chalk.white("> "))

    const phone = await inputLine()
    const clean = phone.replace(/\D/g, "")
    if (clean.length >= 10) return clean

    console.log(chalk.red("\n❌ Número inválido. Debe tener al menos 10 dígitos.\n"))
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

  if (!alreadyLinked && mode === "code") {
    const clean = await askPhone()
    console.log(chalk.gray("\n⏳ Generando código...\n"))

    const code = await sock.requestPairingCode(clean)

    line()
    console.log(chalk.greenBright("🔢 CÓDIGO: ") + chalk.whiteBright(code))
    line()
    console.log(chalk.white("WhatsApp → Dispositivos vinculados → Vincular con número → ingresa el código\n"))
  }

  sock.ev.on("connection.update", (u) => {
    const { connection, lastDisconnect, qr } = u

    if (!alreadyLinked && mode === "qr" && qr) {
      console.log(chalk.gray("📷 Escanea el QR para vincular:\n"))
      qrcode.generate(qr, { small: true })
      console.log("")
    }

    if (connection === "open") console.log(chalk.greenBright("✅ Conectado\n"))

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