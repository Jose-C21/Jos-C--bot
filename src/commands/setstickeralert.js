import fs from "fs"
import path from "path"

const DB = path.join(process.cwd(),"database","stickerAlert.json")

if(!fs.existsSync(DB)){
fs.writeFileSync(DB,JSON.stringify({}))
}

export default async function setstickeralert(sock,msg){

const chat = msg.key.remoteJid
const ctx = msg.message?.extendedTextMessage?.contextInfo

if(!ctx?.quotedMessage?.stickerMessage){
return sock.sendMessage(chat,{
text:"❌ Responde al sticker."
},{quoted:msg})
}

const sticker = ctx.quotedMessage.stickerMessage

const hash = sticker.fileSha256.toString("base64")

fs.writeFileSync(DB,JSON.stringify({hash},null,2))

await sock.sendMessage(chat,{
text:"✅ Sticker guardado."
},{quoted:msg})

}