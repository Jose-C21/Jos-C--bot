// src/adapter/baileys.js
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers
} from "baileys"
import qrcode from "qrcode-terminal"
import { logger } from "../utils/logger.js"
import chalk from "chalk"
import figlet from "figlet"

// ✅ bienvenida/despedida (evento)
import { onGroupParticipantsUpdate } from "../core/groupWelcome.js"

// ✅ antiarabe guard (evento)
import { antiarabeGuard } from "../core/antiarabeGuard.js"

// ✅ config para owners
import config from "../config.js"

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

// ✅ Banner (estilo B)
const stripAnsi = (s = "") => String(s).replace(/\x1B\[[0-9;]*m/g, "")

const centerAnsi = (txt, width) => {
  const raw = stripAnsi(txt)
  if (raw.length >= width) return txt
  const left = Math.floor((width - raw.length) / 2)
  const right = width - raw.length - left
  return " ".repeat(left) + txt + " ".repeat(right)
}

function banner() {
  const OUT = 44
  const DASH = 10

  const top =
    chalk.whiteBright("─".repeat(DASH)) +
    chalk.whiteBright("(") +
    chalk.gray(" POWERED BY ") +
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
    console.log(centerAnsi(chalk.gray("─".repeat(len)), UI.OUT))
  },
  hrCyan(len = 30) {
    console.log(centerAnsi(chalk.cyanBright("─".repeat(len)), UI.OUT))
  },
  title(txt) {
    console.log(chalk.cyanBright("◆ ") + chalk.cyanBright(txt))
  },
  info(txt) {
    console.log(chalk.gray("  • ") + chalk.white(txt))
  },
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

// ✅ helper owner (para bypass)
function isOwnerByNumbers({ senderNum, senderNumDecoded }) {
  const owners = (config.owners || []).map(String)
  const ownersLid = (config.ownersLid || []).map(String)
  return (
    owners.includes(String(senderNum)) ||
    owners.includes(String(senderNumDecoded)) ||
    ownersLid.includes(String(senderNum)) ||
    ownersLid.includes(String(senderNumDecoded))
  )
}

// ─────────────────────────────────────────────
// ✅ helpers anti-cuelgue / reconexión
// ─────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function getStatusCode(err) {
  return err?.output?.statusCode || err?.data?.statusCode || err?.statusCode
}

// timeout wrapper (para que requestPairingCode NO se quede colgado)
async function withTimeout(promise, ms, label = "timeout") {
  let t
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(label)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(t)
  }
}

// esperar a que el socket esté “vivo” (conecta al WS)
async function waitSocketReady(sock, ms = 15000) {
  return await withTimeout(
    new Promise((resolve) => {
      const onUpdate = (u) => {
        const c = u?.connection
        // "connecting" ya significa que el WS está en proceso, y normalmente basta para pairing
        if (c === "open" || c === "connecting") {
          sock.ev.off("connection.update", onUpdate)
          resolve(true)
        }
      }
      sock.ev.on("connection.update", onUpdate)
    }),
    ms,
    "waitSocketReady_timeout"
  )
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

  // ✅ factory para recrear socket en reintentos
  const makeSock = () =>
    makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: Browsers.ubuntu("Chrome"),

      // ✅ “blindaje” básico (reduce cuelgues)
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 20_000
    })

  let sock = makeSock()

  sock.ev.on("creds.update", saveCreds)

  // ✅ EVENTO: entradas/salidas del grupo
  sock.ev.on("group-participants.update", async (update) => {
    try {
      console.log("[group-participants.update] RAW:", JSON.stringify(update))

      // ✅ 1) ANTIARABE primero
      const blocked = await antiarabeGuard(sock, update, { isOwnerByNumbers })
      if (blocked) {
        console.log("[antiarabeGuard] blocked -> NO welcome")
        return
      }

      // ✅ 2) BIENVENIDA / DESPEDIDA
      await onGroupParticipantsUpdate(sock, update)
    } catch (e) {
      console.error("[group-participants.update] ERROR:", e)
    }
  })

  // ─────────────────────────────────────────────
  // ✅ Pairing code flow (BLINDADO)
  // ─────────────────────────────────────────────
  if (!alreadyLinked && mode === "code") {
    const clean = await askPhone()

    console.log("")
    UI.title("Generando código")
    UI.dim(chalk.redBright("  • Espera un momento..."))
    console.log("")

    // ✅ reintentos (si da 428 / Connection Closed / se cuelga)
    const MAX_TRIES = 4
    const PAIR_TIMEOUT_MS = 25_000

    let lastErr = null
    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
      try {
        // 1) esperar socket listo
        await waitSocketReady(sock, 15_000)

        // 2) pedir código con timeout
        const code = await withTimeout(
          sock.requestPairingCode(clean),
          PAIR_TIMEOUT_MS,
          "requestPairingCode_timeout"
        )

        UI.hrSoft(26)
        console.log(chalk.cyanBright("CÓDIGO: ") + chalk.whiteBright(formatPairingCode(code)))
        UI.info("WhatsApp > Dispositivos vinculados > Vincular con número")
        UI.info("Ingresa el código")
        UI.hrCyan(30)
        console.log("")
        lastErr = null
        break
      } catch (e) {
        lastErr = e
        const sc = getStatusCode(e)
        console.error("[pairing] attempt", attempt, "error:", e?.message || e, "status:", sc)

        // si fue timeout o 428/ConnectionClosed => recrear socket y reintentar
        const msg = String(e?.message || "")
        const shouldRecreate =
          msg.includes("Connection Closed") ||
          msg.includes("Precondition Required") ||
          msg.includes("timeout") ||
          sc === 428

        if (attempt < MAX_TRIES && shouldRecreate) {
          UI.error(`Fallo de conexión (intento ${attempt}/${MAX_TRIES}). Reintentando...`)
          try { sock.end?.() } catch {}
          await sleep(1200 + attempt * 700)
          sock = makeSock()
          sock.ev.on("creds.update", saveCreds)
          // re-enganchar eventos
          sock.ev.on("group-participants.update", async (update) => {
            try {
              const blocked = await antiarabeGuard(sock, update, { isOwnerByNumbers })
              if (blocked) return
              await onGroupParticipantsUpdate(sock, update)
            } catch {}
          })
          continue
        }

        // si no se puede recuperar
        break
      }
    }

    if (lastErr) {
      UI.error("No se pudo generar el código.")
      UI.hint("Si cerraste sesión o se corrompió auth, borra la carpeta sessions/ y vuelve a vincular.")
      UI.hint("También prueba QR si el código sigue fallando.")
      console.log("")
    }
  }

  // ─────────────────────────────────────────────
  // ✅ connection.update
  // ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────────
  // ✅ messages.upsert
  // ─────────────────────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages || []) {
      try { await onMessage(sock, msg) } catch {}
    }
  })

  return sock
}