// src/commands/afk.js
import fs from "fs"
import path from "path"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const SIGNATURE =
  "\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦"

const DATA_DIR = path.join(process.cwd(), "data")
const AFK_PATH = path.join(DATA_DIR, "afk.json")

function ensureDB() {
  try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }) } catch {}
  try { if (!fs.existsSync(AFK_PATH))  fs.writeFileSync(AFK_PATH, "{}") } catch {}
}
function readDB() {
  try { ensureDB(); return JSON.parse(fs.readFileSync(AFK_PATH, "utf8") || "{}") } catch { return {} }
}
function writeDB(db) {
  try { ensureDB(); fs.writeFileSync(AFK_PATH, JSON.stringify(db, null, 2)) } catch {}
}

// Tiempo transcurrido legible
function tiempoTranscurrido(ts) {
  const diff = Date.now() - ts
  const s = Math.floor(diff / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d >= 1)  return `${d}d ${h % 24}h`
  if (h >= 1)  return `${h}h ${m % 60}m`
  if (m >= 1)  return `${m}m`
  return "unos segundos"
}

export default async function afk(sock, msg, { args = [], usedPrefix = "." }) {
  try {
    const chatId = msg?.key?.remoteJid
    if (!chatId) return

    const senderJid = getSenderJid(msg)
    let decodedJid  = senderJid
    try { if (sock?.decodeJid) decodedJid = sock.decodeJid(senderJid) } catch {}
    const userNum = jidToNumber(decodedJid) || jidToNumber(senderJid)
    const userKey = decodedJid || senderJid

    const subCmd = (args[0] || "").toLowerCase()
    const db     = readDB()

    // ── Sin argumentos o .afk on → activar ─────────────────
    if (!subCmd || subCmd === "on") {
      const razon = args.slice(subCmd === "on" ? 1 : 0).join(" ").trim()

if (!razon) {
  return await sock.sendMessage(chatId, {
  text:
`⚠️ 𝗥𝗮𝘇ó𝗻 𝗿𝗲𝗾𝘂𝗲𝗿𝗶𝗱𝗮

𝗗𝗲𝗯𝗲𝘀 𝗶𝗻𝗱𝗶𝗰𝗮𝗿 𝘂𝗻𝗮 𝗿𝗮𝘇ó𝗻
𝗽𝗮𝗿𝗮 𝗮𝗰𝘁𝗶𝘃𝗮𝗿 𝗲𝗹 𝗺𝗼𝗱𝗼 𝗔𝗙𝗞.

📌 𝗘𝗷𝗲𝗺𝗽𝗹𝗼𝘀:

• ${usedPrefix}afk estudiando
• ${usedPrefix}afk trabajando
• ${usedPrefix}afk durmiendo
• ${usedPrefix}afk en una reunión

${SIGNATURE}`
}, { quoted: msg })
}

      db[userKey] = {
        jid:        userKey,
        num:        userNum,
        razon,
        activadoEn: Date.now()
      }
      writeDB(db)

      try { await sock.sendMessage(chatId, { react: { text: "🌙", key: msg.key } }) } catch {}

      return await sock.sendMessage(chatId, {
        text:
`╭─〔 🌙 𝗠𝗢𝗗𝗢 𝗔𝗙𝗞 𝗔𝗖𝗧𝗜𝗩𝗔𝗗𝗢 〕─⬣

👤 𝗨𝘀𝘂𝗮𝗿𝗶𝗼:
@${userNum}

📝 𝗥𝗮𝘇ó𝗻:
${razon}

🔕 𝗟𝗮𝘀 𝗺𝗲𝗻𝗰𝗶𝗼𝗻𝗲𝘀 𝘆 𝗿𝗲𝘀𝗽𝘂𝗲𝘀𝘁𝗮𝘀
𝗺𝗼𝘀𝘁𝗿𝗮𝗿á𝗻 𝗲𝘀𝘁𝗲 𝗮𝘃𝗶𝘀𝗼
𝗮𝘂𝘁𝗼𝗺á𝘁𝗶𝗰𝗮𝗺𝗲𝗻𝘁𝗲.

╰────────────────⬣${SIGNATURE}`,
        mentions: [userKey]
      }, { quoted: msg })
    }

    // ── .afk off → desactivar manualmente ──────────────────
    if (subCmd === "off") {
      if (!db[userKey]) {
        return await sock.sendMessage(chatId, {
          text:
`╭─〔 ℹ️ 𝗦𝗜𝗡 𝗔𝗙𝗞 𝗔𝗖𝗧𝗜𝗩𝗢 〕─⬣

👤 𝗨𝘀𝘂𝗮𝗿𝗶𝗼:
@${userNum}

❌ 𝗡𝗼 𝘁𝗶𝗲𝗻𝗲𝘀 𝗻𝗶𝗻𝗴ú𝗻
𝗺𝗼𝗱𝗼 𝗔𝗙𝗞 𝗮𝗰𝘁𝗶𝘃𝗮𝗱𝗼.

╰────────────────⬣${SIGNATURE}`,
          mentions: [userKey]
        }, { quoted: msg })
      }

      const entry = db[userKey]
      const tiempo = tiempoTranscurrido(entry.activadoEn)
      delete db[userKey]
      writeDB(db)

      try { await sock.sendMessage(chatId, { react: { text: "✅", key: msg.key } }) } catch {}

      return await sock.sendMessage(chatId, {
        text:
`╭─〔 ✅ 𝗔𝗙𝗞 𝗗𝗘𝗦𝗔𝗖𝗧𝗜𝗩𝗔𝗗𝗢 〕─⬣

👤 𝗨𝘀𝘂𝗮𝗿𝗶𝗼:
@${userNum}

⏳ 𝗗𝘂𝗿𝗮𝗰𝗶ó𝗻:
${tiempo}

📝 𝗥𝗮𝘇ó𝗻:
${entry.razon}

🔔 𝗬𝗮 𝗲𝘀𝘁á𝘀
𝗱𝗶𝘀𝗽𝗼𝗻𝗶𝗯𝗹𝗲.

╰────────────────⬣${SIGNATURE}`,
        mentions: [userKey]
      }, { quoted: msg })
    }

    // ── .afk estado → ver si está activo ───────────────────
    if (subCmd === "estado" || subCmd === "status") {
      const entry = db[userKey]
      if (!entry) {
        return await sock.sendMessage(chatId, {
          text:
`╭─〔 📋 𝗘𝗦𝗧𝗔𝗗𝗢 𝗔𝗙𝗞 〕─⬣

👤 𝗨𝘀𝘂𝗮𝗿𝗶𝗼:
@${userNum}

❌ 𝗡𝗼 𝘁𝗶𝗲𝗻𝗲𝘀
𝗔𝗙𝗞 𝗮𝗰𝘁𝗶𝘃𝗼.

╰────────────────⬣${SIGNATURE}`,
          mentions: [userKey]
        }, { quoted: msg })
      }

      return await sock.sendMessage(chatId, {
        text:
`╭─〔 🌙 𝗘𝗦𝗧𝗔𝗗𝗢 𝗔𝗙𝗞 〕─⬣

👤 𝗨𝘀𝘂𝗮𝗿𝗶𝗼:
@${userNum}

📝 𝗥𝗮𝘇ó𝗻:
${entry.razon}

⏳ 𝗧𝗶𝗲𝗺𝗽𝗼 𝘁𝗿𝗮𝗻𝘀𝗰𝘂𝗿𝗿𝗶𝗱𝗼:
${tiempoTranscurrido(entry.activadoEn)}

🔕 𝗘𝗹 𝗺𝗼𝗱𝗼 𝗔𝗙𝗞
𝘀𝗶𝗴𝘂𝗲 𝗮𝗰𝘁𝗶𝘃𝗼.

╰────────────────⬣${SIGNATURE}`,
        mentions: [userKey]
      }, { quoted: msg })
    }

    // ── Tratar el texto como razón directa ──────────────────
    // Ej: .afk comiendo, .afk durmiendo
    const razonDirecta = args.join(" ").trim()
    if (razonDirecta) {
      db[userKey] = {
        jid:        userKey,
        num:        userNum,
        razon:      razonDirecta,
        activadoEn: Date.now()
      }
      writeDB(db)

      try { await sock.sendMessage(chatId, { react: { text: "🌙", key: msg.key } }) } catch {}

      return await sock.sendMessage(chatId, {
        text:
`╭─〔 🌙 𝗠𝗢𝗗𝗢 𝗔𝗙𝗞 𝗔𝗖𝗧𝗜𝗩𝗔𝗗𝗢 〕─⬣

👤 𝗨𝘀𝘂𝗮𝗿𝗶𝗼:
@${userNum}

📝 𝗥𝗮𝘇ó𝗻:
${razon}

🔕 𝗟𝗮𝘀 𝗺𝗲𝗻𝗰𝗶𝗼𝗻𝗲𝘀 𝘆 𝗿𝗲𝘀𝗽𝘂𝗲𝘀𝘁𝗮𝘀
𝗺𝗼𝘀𝘁𝗿𝗮𝗿á𝗻 𝗲𝘀𝘁𝗲 𝗮𝘃𝗶𝘀𝗼
𝗮𝘂𝘁𝗼𝗺á𝘁𝗶𝗰𝗮𝗺𝗲𝗻𝘁𝗲.

╰────────────────⬣${SIGNATURE}`,
        mentions: [userKey]
      }, { quoted: msg })
    }

  } catch (e) {
  console.error("[afk cmd] ERROR:", e)

  try {
    await sock.sendMessage(msg?.key?.remoteJid, {
      text:
`╭─〔 ❌ 𝗘𝗥𝗥𝗢𝗥 𝗔𝗙𝗞 〕─⬣

⚠️ 𝗢𝗰𝘂𝗿𝗿𝗶ó 𝘂𝗻 𝗲𝗿𝗿𝗼𝗿
𝗮𝗹 𝗽𝗿𝗼𝗰𝗲𝘀𝗮𝗿 𝗲𝗹
𝗰𝗼𝗺𝗮𝗻𝗱𝗼 𝗔𝗙𝗞.

🔄 𝗜𝗻𝘁é𝗻𝘁𝗮𝗹𝗼
𝗻𝘂𝗲𝘃𝗮𝗺𝗲𝗻𝘁𝗲.

╰────────────────⬣${SIGNATURE}`
    }, { quoted: msg })
  } catch {}
}
}
