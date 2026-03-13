import fs from "fs"
import path from "path"

const DB_DIR = path.join(process.cwd(), "database")
const DB = path.join(DB_DIR, "stickerAlert.json")

export default async function setstickeralert(sock, msg, { isOwner }){

const chat = msg.key.remoteJid

/* SOLO OWNER */

if(!isOwner){
return sock.sendMessage(chat,{
text:"❌ Este comando solo puede usarlo el *owner* del bot."
},{quoted:msg})
}

const ctx = msg.message?.extendedTextMessage?.contextInfo

if(!ctx?.quotedMessage?.stickerMessage){
return sock.sendMessage(chat,{
text:"❌ Responde al sticker que quieres usar."
},{quoted:msg})
}

const sticker = ctx.quotedMessage.stickerMessage
const hash = sticker.fileSha256?.toString("base64")

if(!hash){
return sock.sendMessage(chat,{
text:"❌ No se pudo leer el sticker."
},{quoted:msg})
}

/* CREAR CARPETA SI NO EXISTE */

if(!fs.existsSync(DB_DIR)){
fs.mkdirSync(DB_DIR,{recursive:true})
}

/* GUARDAR JSON */

fs.writeFileSync(DB, JSON.stringify({hash}, null, 2))

await sock.sendMessage(chat,{
text:"✅ Sticker guardado para alerta privada."
},{quoted:msg})

}