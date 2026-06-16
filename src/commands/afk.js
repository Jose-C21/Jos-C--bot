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

    // ── .afk lista → ver todos los AFK del grupo ────────────
    if (subCmd === "lista") {
      const isGroup = String(chatId).endsWith("@g.us")
      if (!isGroup) {
        return await sock.sendMessage(chatId, {
          text: `❌ Este comando solo funciona en grupos.${SIGNATURE}`
        }, { quoted: msg })
      }

      const todos = Object.values(db)
      if (!todos.length) {
        return await sock.sendMessage(chatId, {
          text:
`╭─〔 📋 𝗟𝗜𝗦𝗧𝗔 𝗔𝗙𝗞 〕─⬣

✅ 𝗡𝗮𝗱𝗶𝗲 𝗲𝘀𝘁á
𝗲𝗻 𝗺𝗼𝗱𝗼 𝗔𝗙𝗞
𝗮𝗰𝘁𝘂𝗮𝗹𝗺𝗲𝗻𝘁𝗲.

╰────────────────⬣${SIGNATURE}`
        }, { quoted: msg })
      }

      // Verificar que los AFK pertenecen a este grupo
      let metadata
      try { metadata = await sock.groupMetadata(chatId) } catch { metadata = null }
      const participantes = metadata?.participants?.map(p => p.id) || []

      const enEsteGrupo = participantes.length > 0
        ? todos.filter(e => participantes.some(p =>
            p.replace(/:[\d]+@/, "@") === e.jid.replace(/:[\d]+@/, "@")
          ))
        : todos

      if (!enEsteGrupo.length) {
        return await sock.sendMessage(chatId, {
          text:
`╭─〔 📋 𝗟𝗜𝗦𝗧𝗔 𝗔𝗙𝗞 〕─⬣

✅ 𝗡𝗶𝗻𝗴ú𝗻 𝗺𝗶𝗲𝗺𝗯𝗿𝗼
𝗱𝗲 𝗲𝘀𝘁𝗲 𝗴𝗿𝘂𝗽𝗼
𝗲𝘀𝘁á 𝗲𝗻 𝗔𝗙𝗞.

╰────────────────⬣${SIGNATURE}`
        }, { quoted: msg })
      }

      const mentions = enEsteGrupo.map(e => e.jid)
      const lineas = enEsteGrupo.map((e, i) =>
        `${i + 1}. @${e.num}\n   📝 ${e.razon}\n   ⏳ ${tiempoTranscurrido(e.activadoEn)}`
      ).join("\n\n")

      return await sock.sendMessage(chatId, {
        text:
`╭─〔 🌙 𝗟𝗜𝗦𝗧𝗔 𝗔𝗙𝗞 〕─⬣

${lineas}

╰────────────────⬣${SIGNATURE}`,
        mentions
      }, { quoted: msg })
    }

    // ── Sin argumentos → mostrar ayuda ──────────────────────
    if (!subCmd) {
      return await sock.sendMessage(chatId, {
        text:
`╭─〔 🌙 𝗖𝗢𝗠𝗔𝗡𝗗𝗢 𝗔𝗙𝗞 〕─⬣

📌 𝗨𝘀𝗼:

✅ 𝗔𝗰𝘁𝗶𝘃𝗮𝗿:
${usedPrefix}afk <razón>

❌ 𝗗𝗲𝘀𝗮𝗰𝘁𝗶𝘃𝗮𝗿:
${usedPrefix}afk off

📋 𝗩𝗲𝗿 𝗔𝗙𝗞 𝗱𝗲𝗹 𝗴𝗿𝘂𝗽𝗼:
${usedPrefix}afk lista

𝗘𝗷𝗲𝗺𝗽𝗹𝗼𝘀:
• ${usedPrefix}afk estudiando
• ${usedPrefix}afk en una reunión
• ${usedPrefix}afk durmiendo

╰────────────────⬣${SIGNATURE}`
      }, { quoted: msg })
    }

    // ── Subcomandos reservados que no son razón ──────────────
    const RESERVED = ["on", "estado", "status"]
    if (RESERVED.includes(subCmd)) {
      // "on" sin razón → pedir razón
      // "estado"/"status" → redirigir a lista
      if (subCmd === "estado" || subCmd === "status") {
        return await sock.sendMessage(chatId, {
          text: `ℹ️ Ese comando cambió. Usa *${usedPrefix}afk lista* para ver quién está en AFK en este grupo.${SIGNATURE}`
        }, { quoted: msg })
      }
      // .afk on sin razón
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

    // ── Activar AFK — toda la línea es la razón ─────────────
    const razon = args.join(" ").trim()

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
