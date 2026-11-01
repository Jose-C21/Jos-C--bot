import fs from "fs"
import path from "path"
import config from "../config.js"
import { getSenderJid, jidToNumber } from "../utils/jid.js"
const P = path.join(process.cwd(), "data", "activos.json")
const F = [["bienvenida","Bienvenida","bienvenida on/off"],["despedidas","Despedidas","bienvenida on/off despedidas"],["antilink","Antilink","antilink on/off"],["antis","Antis","antis on/off"],["antiarabe","Anti árabe","antiarabe on/off"],["antipersona","Anti persona","antipersona on/off"],["antiestado","Anti estado","antiestado on/off"],["antiporno","Anti porno","antiporno on/off"],["conteooff","Conteo mensajes","pausarconteo / reanudarconteo",true]]
const rd = () => { try { return JSON.parse(fs.readFileSync(P, "utf8") || "{}") } catch { return {} } }
const own = (a, b) => { const o = [...(config.owners || []), ...(config.ownersLid || [])].map(String); return o.includes(String(a)) || o.includes(String(b)) }
export default async function activos(sock, msg, { usedPrefix = "." } = {}) {
  const c = msg?.key?.remoteJid
  if (!c) return
  if (!String(c).endsWith("@g.us")) return sock.sendMessage(c, { text: "⚠️ *Este comando solo se usa en grupos.*" }, { quoted: msg })
  const s = getSenderJid(msg)
  let d = s
  try { if (sock?.decodeJid) d = sock.decodeJid(s) } catch {}
  let ad = false
  try { const md = await sock.groupMetadata(c); const p = md.participants?.find(x => x.id === s || x.id === d); ad = p?.admin === "admin" || p?.admin === "superadmin" } catch {}
  if (!ad && !own(jidToNumber(s), jidToNumber(d)) && !msg.key?.fromMe) return sock.sendMessage(c, { text: "🚫 Solo administradores, owner o el bot pueden usar este comando." }, { quoted: msg })
  const db = rd()
  let n = 0
  const l = F.map(([k, nm, cmd, inv]) => { const a = inv ? !db?.[k]?.[c] : !!db?.[k]?.[c]; if (a) n++; return `${a ? "🟢" : "🔴"} *${nm}* — ${a ? "ACTIVO" : "INACTIVO"}\n   ↳ ${usedPrefix}${cmd}` })
  await sock.sendMessage(c, { text: `⚙️ *ESTADO DE FUNCIONES EN ESTE GRUPO*\n\n${l.join("\n\n")}\n\n📊 Activas: *${n}/${F.length}*` }, { quoted: msg })
  await sock.sendMessage(c, { react: { text: "✅", key: msg.key } }).catch(() => {})
}
