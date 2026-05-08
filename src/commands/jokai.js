import fs from "fs"
import path from "path"
import config from "../config.js"

import {
  getSenderJid,
  jidToNumber
} from "../utils/jid.js"

const DB =
  path.join(process.cwd(), "database", "jokai.json")

/* ========================= */
/* ✨ FIRMA */
/* ========================= */

const SIGNATURE =
`\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система
> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`

/* ========================= */
/* 📂 DB */
/* ========================= */

function loadDB() {

  if (!fs.existsSync(DB)) return {}

  try {
    return JSON.parse(fs.readFileSync(DB))
  } catch {
    return {}
  }
}

function saveDB(data) {
  fs.writeFileSync(
    DB,
    JSON.stringify(data, null, 2)
  )
}

/* ========================= */
/* 👑 OWNER */
/* ========================= */

function isOwnerByNumbers({
  senderNum,
  senderNumDecoded
}) {

  const owners =
    (config.owners || []).map(String)

  const ownersLid =
    (config.ownersLid || []).map(String)

  return (

    owners.includes(String(senderNum)) ||

    owners.includes(String(senderNumDecoded)) ||

    ownersLid.includes(String(senderNum)) ||

    ownersLid.includes(String(senderNumDecoded))
  )
}

/* ========================= */
/* 🚀 COMANDO */
/* ========================= */

export default async function jokai(
  sock,
  msg,
  { args }
) {

  try {

    const chatId =
      msg?.key?.remoteJid

    if (!chatId) return

    const isGroup =
      String(chatId).endsWith("@g.us")

    /* ========================= */
    /* 👤 USUARIO */
    /* ========================= */

    const senderJid =
      getSenderJid(msg)

    const senderNum =
      jidToNumber(senderJid)

    let decodedJid = senderJid

    try {

      if (sock?.decodeJid) {
        decodedJid =
          sock.decodeJid(senderJid)
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

    /* ========================= */
    /* 👮 ADMIN */
    /* ========================= */

    let isSenderAdmin = false

    if (isGroup) {

      const metadata =
        await sock.groupMetadata(chatId)

      const groupAdmins =
        (metadata.participants || [])
          .filter(p => p.admin)

      isSenderAdmin =
        groupAdmins.some(
          p =>
            p.id === senderJid ||
            p.id === decodedJid
        )
    }

    /* ========================= */
    /* ❌ PERMISOS */
    /* ========================= */

    if (
      isGroup &&
      !isSenderAdmin &&
      !isOwner &&
      !fromMe
    ) {

      return await sock.sendMessage(
        chatId,
        {
          text:
`⚠️ \`JØKAI\`

Solo administradores o owners pueden activar o desactivar JØKAI.${SIGNATURE}`
        },
        { quoted: msg }
      )
    }

    /* ========================= */
    /* ⚡ OPCIÓN */
    /* ========================= */

    const db = loadDB()

    const option =
      (args?.[0] || "")
        .toLowerCase()

    if (
      !["on", "off"]
        .includes(option)
    ) {

      return await sock.sendMessage(
        chatId,
        {
          text:
`⚡ \`JØKAI\`

Usa:

.jokai on
.jokai off${SIGNATURE}`
        },
        { quoted: msg }
      )
    }

    /* ========================= */
    /* 💾 GUARDAR */
    /* ========================= */

    db[chatId] =
      option === "on"

    saveDB(db)

    /* ========================= */
    /* ✅ RESPUESTA */
    /* ========================= */

    await sock.sendMessage(
      chatId,
      {
        text:

option === "on"

? `⚡ \`Hola, soy JØKAI\`

✨ JØKAI fue activada en este chat.${SIGNATURE}`

: `⚡ \`JØKAI\`

💤 JØKAI fue desactivada.${SIGNATURE}`

      },
      { quoted: msg }
    )

  } catch (e) {

    console.log(
      "❌ ERROR JØKAI CMD:",
      e
    )

    const chatId =
      msg?.key?.remoteJid

    if (!chatId) return

    await sock.sendMessage(
      chatId,
      {
        text:
`❌ Ocurrió un error usando JØKAI.${SIGNATURE}`
      },
      { quoted: msg }
    ).catch(() => {})
  }
}
