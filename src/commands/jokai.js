import fs from "fs"
import path from "path"

const DB =
  path.join(process.cwd(), "database", "jokai.json")

function loadDB() {
  if (!fs.existsSync(DB)) return {}
  return JSON.parse(fs.readFileSync(DB))
}

function saveDB(data) {
  fs.writeFileSync(DB, JSON.stringify(data, null, 2))
}

export default async function jokai(
  sock,
  msg,
  { args }
) {

  const chatId = msg.key.remoteJid
  const db = loadDB()

  const option =
    (args[0] || "").toLowerCase()

  if (!["on", "off"].includes(option)) {

    return sock.sendMessage(chatId, {
      text:
`⚡ JØKAI

Usa:
.jokai on
.jokai off`
    }, { quoted: msg })
  }

  db[chatId] = option === "on"

  saveDB(db)

  await sock.sendMessage(chatId, {
    text:
option === "on"
? "⚡ JØKAI activada en este chat."
: "⚡ JØKAI desactivada."
  }, { quoted: msg })
}
