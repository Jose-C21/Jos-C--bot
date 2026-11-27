// src/commands/afk.js
import fs from "fs"
import path from "path"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const SIGNATURE =
  "\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|𝘑𝘊𝘒𝘡𝘐𝘯𝘧𝘪𝘯𝘪𝘵𝘺𝘓𝘰𝘰𝘱\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦 𝑍"

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

const LN = "┄┄┄┄┄┄┄┄┄┄┄┄┄"
const caja = (titulo, pie, bloques) =>
  `> ⟢ ${titulo} ⟣\n${LN}\n` +
  bloques.map(([ico, tit, val]) => `╭ ${ico} ${tit}\n╰▸ ${val}`).join("\n\n") +
  `\n${LN}\n> ${pie}${SIGNATURE}`

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

// Clave compuesta: grupo + usuario
function makeKey(groupId, userKey) {
  return `${groupId}::${userKey}`
}

function soloDigits(j = "") { return String(j).split("@")[0].split(":")[0].replace(/[^0-9]/g, "") }

// Grupos donde están el bot y el owner → entradas AFK globales
async function grupoDelOwner(sock, ids) {
  const out = []
  let todos = {}
  try { todos = await sock.groupFetchAllParticipating() } catch {}
  for (const g of Object.values(todos)) {
    const p = (g.participants || []).find(p =>
      [p.id, p.lid, p.phoneNumber].some(x => x && ids.has(soloDigits(x)))
    )
    if (p) out.push({ groupId: g.id, jid: p.id })
  }
  return out
}

export default async function afk(sock, msg, { args = [], usedPrefix = ".", isOwner = false }) {
  try {
    const chatId = msg?.key?.remoteJid
    if (!chatId) return

    const isGroup = String(chatId).endsWith("@g.us")
    const subCmd = (args[0] || "").toLowerCase()

    // ── PRIVADO: solo owners → AFK en todos los grupos ──────
    if (!isGroup) {
      if (!isOwner) {
        return await sock.sendMessage(chatId, {
          text: caja("ᴀꜰᴋ", "ᴇꜱᴛᴇ ᴄᴏᴍᴀɴᴅᴏ ꜱᴏʟᴏ ꜰᴜɴᴄɪᴏɴᴀ ᴇɴ ɢʀᴜᴘᴏꜱ", [["❌", "𝗦𝗼𝗹𝗼 𝗴𝗿𝘂𝗽𝗼𝘀", "Usa .afk dentro de un grupo"]])
        }, { quoted: msg })
      }

      const razonPv = args.join(" ").trim()
      if (!razonPv || ["lista", "on", "estado", "status"].includes(subCmd) && args.length === 1) {
        return await sock.sendMessage(chatId, {
          text: caja("ᴀꜰᴋ ɢʟᴏʙᴀʟ", "ᴇʟ ᴀꜰᴋ ꜱᴇ ǫᴜɪᴛᴀ ᴀʟ ᴇꜱᴄʀɪʙɪʀ ᴇɴ ᴜɴ ɢʀᴜᴘᴏ", [
            ["📌", "𝗨𝘀𝗼", `${usedPrefix}afk <razón>`],
            ["💬", "𝗘𝗷𝗲𝗺𝗽𝗹𝗼", `${usedPrefix}afk durmiendo`],
            ["🌐", "𝗔𝗹𝗰𝗮𝗻𝗰𝗲", "Todos los grupos donde estamos tú y yo"]
          ])
        }, { quoted: msg })
      }

      const senderJid = getSenderJid(msg)
      let dec = senderJid
      try { if (sock?.decodeJid) dec = sock.decodeJid(senderJid) } catch {}
      const ids = new Set([
        jidToNumber(senderJid), jidToNumber(dec),
        soloDigits(msg?.key?.remoteJidAlt), soloDigits(msg?.key?.participantAlt)
      ].filter(Boolean))
      const globalId = jidToNumber(dec) || jidToNumber(senderJid)

      const grupos = await grupoDelOwner(sock, ids)
      if (!grupos.length) {
        return await sock.sendMessage(chatId, {
          text: caja("ᴀꜰᴋ ɢʟᴏʙᴀʟ", "ɴᴏ ᴇɴᴄᴏɴᴛʀᴇ ɢʀᴜᴘᴏꜱ ᴄᴏɴ ᴀᴍʙᴏꜱ", [["⚠️", "𝗦𝗶𝗻 𝗴𝗿𝘂𝗽𝗼𝘀", "No aparezco en ningún grupo contigo"]])
        }, { quoted: msg })
      }

      const db = readDB()
      for (const k of Object.keys(db)) if (db[k].globalId === globalId) delete db[k]
      const ahora = Date.now()
      for (const g of grupos) {
        const dbKey = makeKey(g.groupId, g.jid)
        db[dbKey] = {
          dbKey, groupId: g.groupId, jid: g.jid, num: soloDigits(g.jid),
          razon: razonPv, activadoEn: ahora, global: true, globalId
        }
      }
      writeDB(db)

      try { await sock.sendMessage(chatId, { react: { text: "🌙", key: msg.key } }) } catch {}
      return await sock.sendMessage(chatId, {
        text: caja("ᴀꜰᴋ ɢʟᴏʙᴀʟ ᴀᴄᴛɪᴠᴀᴅᴏ", "ᴀᴠɪꜱᴏ ᴀᴄᴛɪᴠᴏ ᴇɴ ᴛᴏᴅᴏꜱ ʟᴏꜱ ɢʀᴜᴘᴏꜱ", [
          ["📝", "𝗥𝗮𝘇ó𝗻", razonPv],
          ["🏷️", "𝗚𝗿𝘂𝗽𝗼𝘀", `${grupos.length}`]
        ])
      }, { quoted: msg })
    }

    const senderJid = getSenderJid(msg)
    let decodedJid  = senderJid
    try { if (sock?.decodeJid) decodedJid = sock.decodeJid(senderJid) } catch {}
    const userNum = jidToNumber(decodedJid) || jidToNumber(senderJid)
    const userKey = decodedJid || senderJid

    const dbKey  = makeKey(chatId, userKey)
    const db     = readDB()

    // ── .afk lista → ver todos los AFK de ESTE grupo ────────
    if (subCmd === "lista") {
      const enEsteGrupo = Object.values(db).filter(e => e.groupId === chatId)

      if (!enEsteGrupo.length) {
        return await sock.sendMessage(chatId, {
          text: caja("ʟɪꜱᴛᴀ ᴀꜰᴋ", "ɴᴀᴅɪᴇ ᴇꜱᴛᴀ ᴀꜰᴋ ᴇɴ ᴇꜱᴛᴇ ɢʀᴜᴘᴏ", [["✅", "𝗘𝘀𝘁𝗮𝗱𝗼", "Ningún miembro en AFK"]])
        }, { quoted: msg })
      }

      const mentions = enEsteGrupo.map(e => e.jid)
      return await sock.sendMessage(chatId, {
        text: caja("ʟɪꜱᴛᴀ ᴀꜰᴋ", `${enEsteGrupo.length} ᴜꜱᴜᴀʀɪᴏ(ꜱ) ᴇɴ ᴀꜰᴋ`,
          enEsteGrupo.map((e, i) => ["🌙", `𝗨𝘀𝘂𝗮𝗿𝗶𝗼 ${i + 1}`,
            `@${e.num}\n   📝 ${e.razon}\n   ⏳ ${tiempoTranscurrido(e.activadoEn)}`])),
        mentions
      }, { quoted: msg })
    }

    // ── Sin argumentos → ayuda ───────────────────────────────
    if (!subCmd) {
      return await sock.sendMessage(chatId, {
        text: caja("ᴄᴏᴍᴀɴᴅᴏ ᴀꜰᴋ", "ᴇʟ ᴀꜰᴋ ꜱᴇ ǫᴜɪᴛᴀ ᴀʟ ᴇꜱᴄʀɪʙɪʀ ᴇɴ ᴇʟ ɢʀᴜᴘᴏ", [
          ["✅", "𝗔𝗰𝘁𝗶𝘃𝗮𝗿", `${usedPrefix}afk <razón>`],
          ["📋", "𝗩𝗲𝗿 𝗔𝗙𝗞 𝗱𝗲𝗹 𝗴𝗿𝘂𝗽𝗼", `${usedPrefix}afk lista`],
          ["💬", "𝗘𝗷𝗲𝗺𝗽𝗹𝗼𝘀", `${usedPrefix}afk estudiando\n   ${usedPrefix}afk en una reunión\n   ${usedPrefix}afk durmiendo`]
        ])
      }, { quoted: msg })
    }

    // ── Subcomandos reservados sin razón ─────────────────────
    if (subCmd === "on" || subCmd === "estado" || subCmd === "status") {
      return await sock.sendMessage(chatId, {
        text: caja("ʀᴀᴢᴏ́ɴ ʀᴇǫᴜᴇʀɪᴅᴀ", "ɪɴᴅɪᴄᴀ ᴜɴᴀ ʀᴀᴢᴏ́ɴ ᴘᴀʀᴀ ᴀᴄᴛɪᴠᴀʀ ᴇʟ ᴀꜰᴋ", [
          ["⚠️", "𝗥𝗮𝘇ó𝗻 𝗿𝗲𝗾𝘂𝗲𝗿𝗶𝗱𝗮", "Debes indicar una razón"],
          ["💬", "𝗘𝗷𝗲𝗺𝗽𝗹𝗼𝘀", `${usedPrefix}afk estudiando\n   ${usedPrefix}afk durmiendo`]
        ])
      }, { quoted: msg })
    }

    // ── Activar AFK — toda la línea es la razón ──────────────
    const razon = args.join(" ").trim()

    db[dbKey] = {
      dbKey,
      groupId:    chatId,
      jid:        userKey,
      num:        userNum,
      razon,
      activadoEn: Date.now()
    }
    writeDB(db)

    try { await sock.sendMessage(chatId, { react: { text: "🌙", key: msg.key } }) } catch {}

    return await sock.sendMessage(chatId, {
      text: caja("ᴀꜰᴋ ᴀᴄᴛɪᴠᴀᴅᴏ", "ʟᴀꜱ ᴍᴇɴᴄɪᴏɴᴇꜱ ʏ ʀᴇꜱᴘᴜᴇꜱᴛᴀꜱ ᴍᴏꜱᴛʀᴀʀᴀɴ ᴇꜱᴛᴇ ᴀᴠɪꜱᴏ", [
        ["👤", "𝗨𝘀𝘂𝗮𝗿𝗶𝗼", `@${userNum}`],
        ["📝", "𝗥𝗮𝘇ó𝗻", razon]
      ]),
      mentions: [userKey]
    }, { quoted: msg })

  } catch (e) {
    console.error("[afk cmd] ERROR:", e)
    try {
      await sock.sendMessage(msg?.key?.remoteJid, {
        text: caja("ᴇʀʀᴏʀ ᴀꜰᴋ", "ɪɴᴛᴇ́ɴᴛᴀʟᴏ ɴᴜᴇᴠᴀᴍᴇɴᴛᴇ", [["⚠️", "𝗘𝗿𝗿𝗼𝗿", "Ocurrió un error al procesar el comando AFK"]])
      }, { quoted: msg })
    } catch {}
  }
}
