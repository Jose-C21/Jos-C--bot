// src/commands/aceptar.js
// Uso: .aceptar 20  → acepta las 20 solicitudes más antiguas | .aceptar todas
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"

const SIGNATURE =
  "\n\n⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|𝘑𝘊𝘒𝘡𝘐𝘯𝘧𝘪𝘯𝘪𝘵𝘺𝘓𝘰𝘰𝘱\n> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦 𝑍"

const MAX_POR_COMANDO = 200   // tope de seguridad por uso
const LOTE = 20               // cuántas se aceptan por petición
const PAUSA_MS = 1500         // pausa entre lotes (evita límites de WhatsApp)

const LN = "┄┄┄┄┄┄┄┄┄┄┄┄┄"
const caja = (titulo, pie, bloques) =>
  `> ⟢ ${titulo} ⟣\n${LN}\n` +
  bloques.map(([ico, tit, val]) => `╭ ${ico} ${tit}\n╰▸ ${val}`).join("\n\n") +
  `\n${LN}\n> ${pie}${SIGNATURE}`

const digitos = (j = "") => String(j).split("@")[0].split(":")[0].replace(/[^0-9]/g, "")
const pausa = (ms) => new Promise(r => setTimeout(r, ms))

function isOwnerByNumbers({ senderNum, senderNumDecoded }) {
  const owners = (config.owners || []).map(String)
  const ownersLid = (config.ownersLid || []).map(String)
  return [senderNum, senderNumDecoded].some(n => owners.includes(String(n)) || ownersLid.includes(String(n)))
}

export default async function aceptar(sock, msg, { args = [], usedPrefix = "." } = {}) {
  const chatId = msg?.key?.remoteJid
  if (!chatId) return
  const responder = (text, extra = {}) => sock.sendMessage(chatId, { text, ...extra }, { quoted: msg })
  const reaccion = (e) => sock.sendMessage(chatId, { react: { text: e, key: msg.key } }).catch(() => {})

  try {
    if (!String(chatId).endsWith("@g.us")) {
      return await responder(caja("ᴀᴄᴇᴘᴛᴀʀ", "ꜱᴏʟᴏ ꜰᴜɴᴄɪᴏɴᴀ ᴇɴ ɢʀᴜᴘᴏꜱ", [["❌", "𝗦𝗼𝗹𝗼 𝗴𝗿𝘂𝗽𝗼𝘀", "Úsalo dentro de un grupo"]]))
    }

    const senderJid = getSenderJid(msg)
    let decoded = senderJid
    try { if (sock?.decodeJid) decoded = sock.decodeJid(senderJid) } catch {}
    const isOwner = isOwnerByNumbers({ senderNum: jidToNumber(senderJid), senderNumDecoded: jidToNumber(decoded) })
    const fromMe = !!msg.key?.fromMe

    // ¿quien lo usa es admin / owner?
    const md = await sock.groupMetadata(chatId)
    const esAdmin = (id) => (md.participants || []).some(p =>
      p.admin && [p.id, p.lid, p.phoneNumber].some(x => x && digitos(x) === digitos(id)))
    if (!isOwner && !fromMe && !esAdmin(senderJid) && !esAdmin(decoded)) {
      return await responder(caja("ᴀᴄᴇᴘᴛᴀʀ", "ꜱᴏʟᴏ ᴀᴅᴍɪɴꜱ ʏ ᴏᴡɴᴇʀꜱ", [["⛔", "𝗦𝗶𝗻 𝗽𝗲𝗿𝗺𝗶𝘀𝗼", "Solo los administradores o el owner pueden aceptar solicitudes"]]))
    }

    // ¿el bot es admin?
    const botIds = [sock.user?.id, sock.user?.lid].filter(Boolean)
    if (!botIds.some(esAdmin)) {
      return await responder(caja("ᴀᴄᴇᴘᴛᴀʀ", "ʜᴀᴢ ᴀᴅᴍɪɴ ᴀʟ ʙᴏᴛ ᴘᴀʀᴀ ᴜꜱᴀʀʟᴏ", [["⚠️", "𝗕𝗼𝘁 𝘀𝗶𝗻 𝗮𝗱𝗺𝗶𝗻", "Necesito ser administrador del grupo"]]))
    }

    await reaccion("⏳")
    const pendientes = (await sock.groupRequestParticipantsList(chatId)) || []
    pendientes.sort((a, b) => Number(a.request_time || 0) - Number(b.request_time || 0))

    const arg = String(args[0] || "").toLowerCase()
    const todas = ["todas", "todos", "all"].includes(arg)
    const n = todas ? pendientes.length : parseInt(arg, 10)

    if (!todas && !(n > 0)) {
      await reaccion("📋")
      return await responder(caja("ᴀᴄᴇᴘᴛᴀʀ ꜱᴏʟɪᴄɪᴛᴜᴅᴇꜱ", "ᴇʟ ʙᴏᴛ ᴀᴄᴇᴘᴛᴀ ʟᴀꜱ ᴍᴀ́ꜱ ᴀɴᴛɪɢᴜᴀꜱ ᴘʀɪᴍᴇʀᴏ", [
        ["📥", "𝗣𝗲𝗻𝗱𝗶𝗲𝗻𝘁𝗲𝘀", `${pendientes.length}`],
        ["📌", "𝗨𝘀𝗼", `${usedPrefix}aceptar 20\n   ${usedPrefix}aceptar todas`],
        ["⚙️", "𝗟𝗶́𝗺𝗶𝘁𝗲", `${MAX_POR_COMANDO} por uso`]
      ]))
    }

    if (!pendientes.length) {
      await reaccion("📭")
      return await responder(caja("ᴀᴄᴇᴘᴛᴀʀ ꜱᴏʟɪᴄɪᴛᴜᴅᴇꜱ", "ɴᴏ ʜᴀʏ ɴᴀᴅᴀ ᴘᴏʀ ᴀᴄᴇᴘᴛᴀʀ", [["📭", "𝗣𝗲𝗻𝗱𝗶𝗲𝗻𝘁𝗲𝘀", "0 solicitudes"]]))
    }

    const objetivo = Math.min(n, pendientes.length, MAX_POR_COMANDO)
    const lista = pendientes.slice(0, objetivo).map(p => p.jid).filter(Boolean)

    let aceptadas = 0
    let fallidas = 0
    for (let i = 0; i < lista.length; i += LOTE) {
      const lote = lista.slice(i, i + LOTE)
      try {
        const res = await sock.groupRequestParticipantsUpdate(chatId, lote, "approve")
        for (const r of res || []) (String(r.status) === "200" ? aceptadas++ : fallidas++)
        if (!res?.length) fallidas += lote.length
      } catch (e) {
        console.error("[aceptar] lote falló:", e?.message || e)
        fallidas += lote.length
      }
      if (i + LOTE < lista.length) await pausa(PAUSA_MS)
    }

    await reaccion(aceptadas ? "✅" : "❌")
    const restantes = Math.max(0, pendientes.length - aceptadas)
    return await responder(caja("ꜱᴏʟɪᴄɪᴛᴜᴅᴇꜱ ᴀᴄᴇᴘᴛᴀᴅᴀꜱ", "ʟᴀꜱ ᴍᴀ́ꜱ ᴀɴᴛɪɢᴜᴀꜱ ᴘʀɪᴍᴇʀᴏ", [
      ["✅", "𝗔𝗰𝗲𝗽𝘁𝗮𝗱𝗮𝘀", `${aceptadas}`],
      ...(fallidas ? [["⚠️", "𝗡𝗼 𝘀𝗲 𝗽𝘂𝗱𝗶𝗲𝗿𝗼𝗻", `${fallidas}`]] : []),
      ["📥", "𝗣𝗲𝗻𝗱𝗶𝗲𝗻𝘁𝗲𝘀", `${restantes}`]
    ]))
  } catch (e) {
    console.error("[aceptar] ERROR:", e)
    await reaccion("❌")
    await responder(caja("ᴇʀʀᴏʀ ᴀᴄᴇᴘᴛᴀʀ", "ɪɴᴛᴇ́ɴᴛᴀʟᴏ ᴅᴇ ɴᴜᴇᴠᴏ", [["⚠️", "𝗘𝗿𝗿𝗼𝗿", e?.message || "Error desconocido"]]))
  }
}
