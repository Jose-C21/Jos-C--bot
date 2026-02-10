import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers
} from "baileys"
import qrcode from "qrcode-terminal"
import { logger } from "../utils/logger.js"
import chalk from "chalk"
import figlet from "figlet" // lo dejo por si luego lo quieres usar

// ✅ NUEVO: bienvenida/despedida (evento)
import { onGroupParticipantsUpdate } from "../core/groupWelcome.js"

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
const stripAnsi = (s = "") => String(s).replace(/\x1B\[[0-9;]*m/g, "")

const centerAnsi = (txt, width) => {
  const raw = stripAnsi(txt)
  if (raw.length >= width) return txt
  const left = Math.floor((width - raw.length) / 2)
  const right = width - raw.length - left
  return " ".repeat(left) + txt + " ".repeat(right)
}

function banner() {
  const OUT = 44       // ancho fijo para panel (evita wrap)
  const DASH = 10      // largo de líneas a los lados (corto = no se rompe)

  const top =
    chalk.whiteBright("─".repeat(DASH)) +
    chalk.whiteBright("(") +
    chalk.gray(" POWERED BY ") +          // solo el texto en oscuro
    chalk.whiteBright(")") +
    chalk.whiteBright("─".repeat(DASH))

  const names = chalk.yellowBright("José C - Kathy")
  const bottom = chalk.cyanBright("─".repeat(30))

  console.log("")
  console.log(centerAnsi(top, OUT))
  console.log(centerAnsi(names, OUT))
  console.log(centerAnsi(bottom, OUT))
  console.log("")
}

// ✅ Formato pro del pairing code: ABCD – EFGH (solo visual)
function formatPairingCode(code = "") {
  const raw = String(code).replace(/[^A-Za-z0-9]/g, "").toUpperCase()
  if (raw.length >= 8) return raw.slice(0, 4) + " – " + raw.slice(4, 8)
  return raw
}

// ─────────────────────────────────────────────
// ✅ UI PRO (sin emojis) - combina con el banner
// ─────────────────────────────────────────────
const UI = {
  OUT: 44,
  hrSoft(len = 34) {
    // separador gris suave
    console.log(centerAnsi(chalk.gray("─".repeat(len)), UI.OUT))
  },
  hrCyan(len = 30) {
    // separador cyan (como tu banner)
    console.log(centerAnsi(chalk.cyanBright("─".repeat(len)), UI.OUT))
  },
  title(txt) {
    console.log(chalk.cyanBright("◆ ") + chalk.cyanBright(txt))
  },
  info(txt) {
    console.log(chalk.gray("  • ") + chalk.white(txt))
  },
  // ✅ hints en rojo claro
  hint(txt) {
    console.log(chalk.gray("  • ") + chalk.redBright(txt))
  },
  item(num, txt, highlight = false) {
    const n = highlight ? chalk.cyanBright(String(num)) : chalk.white(String(num))
    console.log(chalk.white("   ") + n + chalk.white(") ") + chalk.white(txt))
  },
  prompt(label = "▸ ") {
    process.stdout.write(chalk.cyanBright(label))
  },
  error(txt) {
    console.log(chalk.red("× ") + chalk.red(txt))
  },
  success(txt) {
    console.log(chalk.greenBright(txt))
  },
  dim(txt) {
    console.log(chalk.gray(txt))
  }
}

// ─────────────────────────────────────────────
// ✅ Menú de selección
// ─────────────────────────────────────────────
async function askMode() {
  while (true) {
    UI.hrSoft(26)
    UI.title("Elige tu vinculación")
    UI.item(1, "QR")
    UI.item(2, "Código", true)
    UI.hrSoft(26)
    UI.prompt("▸ Selecciona 1/2: ")

    const pick = (await inputLine()).trim()
    if (pick === "1" || pick === "2") return pick

    UI.error("Opción inválida. Escribe 1 o 2.")
  }
}

async function askPhone() {
  while (true) {
    UI.hrSoft(26)
    UI.title("Ingresa tu número")
    UI.hint("Formato: internacional (sin +)")
    UI.hint("Ejemplo: 504XXXXXXXX")
    UI.hrSoft(26)
    UI.prompt("▸ Número: ")

    const phone = await inputLine()
    const clean = phone.replace(/\D/g, "")

    if (clean.length >= 10) return clean
    UI.error("Número inválido. Mínimo 10 dígitos.")
  }
}

// ─────────────────────────────────────────────
// ✅ Socket
// ─────────────────────────────────────────────
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
    UI.success("Sesión ya vinculada, iniciando...\n")
  }

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger,
    browser: Browsers.ubuntu("Chrome")
  })

  sock.ev.on("creds.update", saveCreds)

  // ✅ NUEVO: bienvenida/despedida por evento
  sock.ev.on("group-participants.update", async (update) => {
    try {
      await onGroupParticipantsUpdate(sock, update)
    } catch (e) {
      console.error("[group-participants.update]", e)
    }
  })

  // ── Pairing code flow
  if (!alreadyLinked && mode === "code") {
    const clean = await askPhone()

    console.log("")
    UI.title("Generando código")
    UI.dim(chalk.redBright("  • Espera un momento..."))
    console.log("")

    const code = await sock.requestPairingCode(clean)

    UI.hrSoft(26)
    console.log(
      chalk.cyanBright("CÓDIGO: ") + chalk.whiteBright(formatPairingCode(code))
    )
    UI.info("WhatsApp > Dispositivos vinculados > Vincular con número")
    UI.info("Ingresa el código")
    UI.hrCyan(30)
    console.log("")
  }

  sock.ev.on("connection.update", (u) => {
    const { connection, lastDisconnect, qr } = u

    // ── QR flow
    if (!alreadyLinked && mode === "qr" && qr) {
      UI.hrSoft(26)
      UI.title("QR de vinculación")
      UI.info("WhatsApp > Dispositivos vinculados > Vincular dispositivo")
      UI.info("Escanea el QR")
      UI.hrSoft(26)
      console.log("")
      qrcode.generate(qr, { small: true })
      console.log("")
      UI.hrCyan(30)
      console.log("")
    }

    if (connection === "open") {
      UI.success("Conectado\n")
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode
      const reconnect = code !== DisconnectReason.loggedOut
      UI.error(`Conexión cerrada. Reconnect: ${reconnect} code: ${code}`)
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