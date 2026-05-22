import fs from "fs"
import path from "path"
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const DATA_DIR =
  path.join(
    process.cwd(),
    "data"
  )

const ACTIVOS_PATH =
  path.join(
    DATA_DIR,
    "activos.json"
  )

function ensureActivos() {

  if (!fs.existsSync(DATA_DIR)) {

    fs.mkdirSync(
      DATA_DIR,
      {
        recursive: true
      }
    )
  }

  if (!fs.existsSync(ACTIVOS_PATH)) {

    fs.writeFileSync(

      ACTIVOS_PATH,

      JSON.stringify({

        antiporno: {}

      }, null, 2)

    )

    return
  }

  try {

    const j = JSON.parse(

      fs.readFileSync(
        ACTIVOS_PATH,
        "utf8"
      ) || "{}"

    )

    if (!j.antiporno) {

      j.antiporno = {}
    }

    fs.writeFileSync(

      ACTIVOS_PATH,

      JSON.stringify(
        j,
        null,
        2
      )

    )

  } catch {

    fs.writeFileSync(

      ACTIVOS_PATH,

      JSON.stringify({

        antiporno: {}

      }, null, 2)

    )
  }
}

function readActivosSafe() {

  try {

    ensureActivos()

    const j = JSON.parse(

      fs.readFileSync(
        ACTIVOS_PATH,
        "utf8"
      ) || "{}"

    )

    if (!j.antiporno) {

      j.antiporno = {}
    }

    return j

  } catch {

    return {

      antiporno: {}

    }
  }
}

function writeActivosSafe(j) {

  ensureActivos()

  fs.writeFileSync(

    ACTIVOS_PATH,

    JSON.stringify(
      j,
      null,
      2
    )
  )
}

function isOwnerByNumbers({

  senderNum,
  senderNumDecoded

}) {

  const owners =
    (config.owners || [])
      .map(String)

  const ownersLid =
    (config.ownersLid || [])
      .map(String)

  return (

    owners.includes(
      String(senderNum)
    ) ||

    owners.includes(
      String(senderNumDecoded)
    ) ||

    ownersLid.includes(
      String(senderNum)
    ) ||

    ownersLid.includes(
      String(senderNumDecoded)
    )

  )
}

export default async function antiporno(
  sock,
  msg,
  { args }
) {

  const chatId =
    msg?.key?.remoteJid

  if (
    !chatId ||
    !chatId.endsWith("@g.us")
  ) {

    await sock.sendMessage(

      chatId,

      {
        text:
          "❌ Este comando solo funciona en grupos."
      },

      {
        quoted: msg
      }

    )

    return
  }

  const mode =
    String(
      args?.[0] || ""
    ).toLowerCase()

  if (
    mode !== "on" &&
    mode !== "off"
  ) {

    await sock.sendMessage(

      chatId,

      {
        text:
`Usa:

.antiporno on
.antiporno off`
      },

      {
        quoted: msg
      }

    )

    return
  }

  const senderJid =
    getSenderJid(msg)

  const senderNum =
    jidToNumber(senderJid)

  let decodedJid =
    senderJid

  try {

    if (sock?.decodeJid) {

      decodedJid =
        sock.decodeJid(
          senderJid
        )
    }

  } catch {}

  const senderNumDecoded =
    jidToNumber(decodedJid)

  const isOwner =
    isOwnerByNumbers({

      senderNum,
      senderNumDecoded

    })

  const fromMe =
    !!msg.key?.fromMe

  // =========================
  // SOLO OWNERS
  // =========================

  if (
    !isOwner &&
    !fromMe
  ) {

    await sock.sendMessage(

      chatId,

      {
        text:
          "🚫 Solo los owners pueden usar este comando."
      },

      {
        quoted: msg
      }

    )

    return
  }

  const activos =
    readActivosSafe()

  // =========================
  // ON
  // =========================

  if (mode === "on") {

    activos.antiporno[chatId] =
      true

    writeActivosSafe(
      activos
    )

    await sock.sendMessage(

      chatId,

      {
        text:
          "✅ Anti-porno activado en este grupo."
      },

      {
        quoted: msg
      }

    )

  }

  // =========================
  // OFF
  // =========================

  else {

    delete activos.antiporno[chatId]

    writeActivosSafe(
      activos
    )

    await sock.sendMessage(

      chatId,

      {
        text:
          "🛑 Anti-porno desactivado en este grupo."
      },

      {
        quoted: msg
      }

    )
  }

  // =========================
  // REACTION
  // =========================

  await sock.sendMessage(

    chatId,

    {
      react: {

        text: "✅",
        key: msg.key

      }
    }

  ).catch(() => {})
}