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
  const WIDTH = 38 // ancho interno del cuadro (ajustado para móvil)
  const top    = "╔" + "═".repeat(WIDTH) + "╗"
  const mid    = "║" + " ".repeat(WIDTH) + "║"
  const bottom = "╚" + "═".repeat(WIDTH) + "╝"

  const center = (text) => {
    text = String(text)
    if (text.length > WIDTH) text = text.slice(0, WIDTH)
    const left = Math.floor((WIDTH - text.length) / 2)
    const right = WIDTH - text.length - left
    return "║" + " ".repeat(left) + text + " ".repeat(right) + "║"
  }

  console.log(chalk.cyanBright(top))
  console.log(chalk.cyanBright(mid))
  console.log(chalk.cyanBright(center("POWERED BY")))
  console.log(chalk.magentaBright(center("Jose C  -  Kathy")))
  console.log(chalk.cyanBright(mid))
  console.log(chalk.cyanBright(bottom))
  console.log("")
}

async function askMode() {
  const W = 34
  const top = "┌" + "─".repeat(W) + "┐"
  const bot = "└" + "─".repeat(W) + "┘"
  const row = (t = "") => "│" + t.padEnd(W, " ") + "│"
  const sep = "├" + "─".repeat(W) + "┤"

  while (true) {
    console.log(chalk.cyanBright(top))
    console.log(chalk.cyanBright(row("  MENU DE VINCULACION")))
    console.log(chalk.cyanBright(sep))
    console.log(chalk.cyanBright(row("  1) QR")))
    console.log(chalk.cyanBright(row("  2) CODIGO (PAIRING)")))
    console.log(chalk.cyanBright(bot))
    process.stdout.write(chalk.white("Selecciona 1 o 2 > "))

    const pick = (await inputLine()).trim()
    if (pick === "1" || pick === "2") return pick

    console.log(chalk.red("\nOpcion invalida. Escribe 1 o 2.\n"))
  }
}

async function askPhone() {
  const W = 34
  const top = "┌" + "─".repeat(W) + "┐"
  const bot = "└" + "─".repeat(W) + "┘"
  const row = (t = "") => "│" + t.padEnd(W, " ") + "│"
  const sep = "├" + "─".repeat(W) + "┤"

  while (true) {
    console.log("")
    console.log(chalk.cyanBright(top))
    console.log(chalk.cyanBright(row("  INGRESA TU NUMERO")))
    console.log(chalk.cyanBright(sep))
    console.log(chalk.cyanBright(row("  Formato: internacional")))
    console.log(chalk.cyanBright(row("  Sin +")))
    console.log(chalk.cyanBright(row("  Ejemplo: 504XXXXXXXX")))
    console.log(chalk.cyanBright(bot))
    process.stdout.write(chalk.white("Numero > "))

    const phone = await inputLine()
    const clean = phone.replace(/\D/g, "")

    if (clean.length >= 10) return clean
    console.log(chalk.red("\nNumero invalido. Minimo 10 digitos.\n"))
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

const W = 34
const top = "┌" + "─".repeat(W) + "┐"
const bot = "└" + "─".repeat(W) + "┘"
const row = (t = "") => "│" + t.padEnd(W, " ") + "│"

console.log(chalk.cyanBright(top))
console.log(chalk.cyanBright(row("  CODIGO GENERADO")))
console.log(chalk.cyanBright(row("")))
console.log(chalk.magentaBright(row(("  " + code).slice(0, W))))
console.log(chalk.cyanBright(row("")))
console.log(chalk.cyanBright(bot))
console.log(chalk.gray("WhatsApp > Dispositivos vinculados > Vincular con numero"))
console.log(chalk.gray("Ingresa el codigo\n"))

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