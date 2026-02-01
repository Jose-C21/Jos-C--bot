import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from "baileys"
import qrcode from "qrcode-terminal"
import { logger } from "../utils/logger.js"
import chalk from "chalk"
import figlet from "figlet" // lo dejo por si luego lo quieres usar

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

// ✅ Banner (estilo B: limpio, pro, sin cajas raras)



// Quita colores para medir bien y centrar real
const stripAnsi = (s="") => String(s).replace(/\x1B\[[0-9;]*m/g, "")

const centerAnsi = (txt, width) => {
  const raw = stripAnsi(txt)
  if (raw.length >= width) return txt
  const left = Math.floor((width - raw.length) / 2)
  const right = width - raw.length - left
  return " ".repeat(left) + txt + " ".repeat(right)
}

function banner() {
  const W = 40 // 👈 ajusta 36–42 si tu panel cambia

  // texto POWERED BY (oscuro como antes)
  const poweredTxt = "( POWERED BY )"
  const powered = chalk.gray(poweredTxt) // oscuro (no cyan)

  // línea superior: "──── ( POWERED BY ) ────" en gris claro
  const rawPoweredLen = poweredTxt.length
  const usable = Math.max(0, W - rawPoweredLen)
  const leftLen = Math.floor(usable / 2)
  const rightLen = usable - leftLen

  const topLine =
    chalk.whiteBright("─".repeat(leftLen)) +
    powered +
    chalk.whiteBright("─".repeat(rightLen))

  // nombre centrado (amarillo)
  const names = centerAnsi(chalk.yellowBright("José C - Kathy"), W)

  // línea inferior cyan, corta y centrada (como tu imagen)
  const bottomLine = centerAnsi(chalk.cyanBright("─".repeat(28)), W)

  console.log("\n" + centerAnsi(topLine, W))
  console.log(names)
  console.log(bottomLine + "\n")
}

async function askMode() {
  while (true) {
    console.log(chalk.cyanBright("\nElige tu vinculación:"))
    console.log(chalk.white("  1) QR"))
    console.log(chalk.white("  2) Código (Pairing)\n"))
    process.stdout.write(chalk.cyanBright("> "))

    const pick = (await inputLine()).trim()
    if (pick === "1" || pick === "2") return pick

    console.log(chalk.red("Opción inválida. Escribe 1 o 2.\n"))
  }
}

async function askPhone() {
  while (true) {
    console.log(chalk.cyanBright("\nEscribe tu número (sin +):"))
    console.log(chalk.white("Ejemplo: 504XXXXXXXX"))
    process.stdout.write(chalk.cyanBright("> "))

    const phone = await inputLine()
    const clean = phone.replace(/\D/g, "")

    if (clean.length >= 10) return clean

    console.log(chalk.red("Número inválido. Mínimo 10 dígitos.\n"))
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

    console.log(chalk.cyanBright("\nGenerando código...\n"))

    const code = await sock.requestPairingCode(clean)

    console.log(chalk.cyanBright("CÓDIGO: ") + chalk.whiteBright(code))
    console.log(chalk.white("WhatsApp > Dispositivos vinculados > Vincular con número"))
    console.log(chalk.white("Ingresa el código\n"))
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