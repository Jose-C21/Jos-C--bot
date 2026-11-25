import fs from "fs"
import { proto } from "baileys"

export default async function checkbaileys(sock, msg) {
  const chatId = msg?.key?.remoteJid
  let ver = "?"
  try { ver = JSON.parse(fs.readFileSync("node_modules/baileys/package.json","utf8")).version } catch {}
  await sock.sendMessage(chatId, {
    text: `Baileys ${ver}\nAudioStickerMessage: ${!!proto.Message.AudioStickerMessage}`
  }, { quoted: msg })
}
