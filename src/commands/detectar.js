import fs from "fs"
import path from "path"
import { exec } from "child_process"
import { downloadContentFromMessage } from "baileys"
import { Shazam } from "node-shazam"
import play from "./play.js"

const shazam = new Shazam()

function signature(){
return `⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система
> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`
}

export default async function detectar(sock,msg){

const chatId = msg?.key?.remoteJid
if(!chatId) return

const ctx = msg?.message?.extendedTextMessage?.contextInfo

if(!ctx?.quotedMessage){

return sock.sendMessage(chatId,{
text:"🎧 *Responde a un audio o video para detectar la canción.*"
},{quoted:msg})

}

const quoted = ctx.quotedMessage

const media =
quoted.audioMessage ||
quoted.videoMessage

if(!media?.mimetype || !/audio|video/.test(media.mimetype)){

return sock.sendMessage(chatId,{
text:"❌ El mensaje respondido no es audio ni video."
},{quoted:msg})

}

try{

await sock.sendMessage(chatId,{
react:{text:"⏳",key:msg.key}
})

/* 📥 DESCARGAR MEDIA */

const stream = await downloadContentFromMessage(
media,
media.mimetype.startsWith("video") ? "video" : "audio"
)

let buffer = Buffer.from([])

for await(const chunk of stream){
buffer = Buffer.concat([buffer,chunk])
}

/* 📁 TMP */

const tmpDir = path.join(process.cwd(),"tmp")

if(!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir)

const input = path.join(tmpDir,`input_${Date.now()}.ogg`)
const output = path.join(tmpDir,`audio_${Date.now()}.wav`)

fs.writeFileSync(input,buffer)

/* 🎧 EXTRAER 12 SEGUNDOS */

await new Promise((resolve,reject)=>{

exec(
`ffmpeg -y -i "${input}" -t 12 -ac 2 -ar 44100 "${output}"`,
(err)=> err ? reject(err) : resolve()
)

})

fs.unlinkSync(input)

/* 🔎 DETECTAR CANCIÓN */

const result = await shazam.recognise(output,"en-US")

fs.unlinkSync(output)

const track = result?.track

if(!track){
throw "Canción no identificada"
}

/* 📊 DATOS */

const title = track.title || "Desconocido"
const artist = track.subtitle || "Desconocido"

let album = "N/A"
let genre = "N/A"
let year = "N/A"

const section = track.sections?.find(x => x.type === "SONG")

if(section?.metadata){

section.metadata.forEach(m => {

if(m.title === "Album") album = m.text
if(m.title === "Genre") genre = m.text
if(m.title === "Released") year = m.text

})

}

/* 🎨 CAPTION PRO */

const caption =
`╭──〔🎧 𝗖𝗔𝗡𝗖𝗜𝗢́𝗡 𝗗𝗘𝗧𝗘𝗖𝗧𝗔𝗗𝗔〕──╮
│
│ 🎵 Título: ${title}
│ 👤 Artista: ${artist}
│ 💿 Álbum: ${album}
│ 🎼 Género: ${genre}
│ 📅 Año: ${year}
│
╰──────────────────────╯

${signature()}`

await sock.sendMessage(chatId,{
text:caption
},{quoted:msg})

/* 🔊 DESCARGAR CANCIÓN */

const query = `${artist} ${title}`

await play(sock,msg,{
args:query.split(" ")
})

await sock.sendMessage(chatId,{
react:{text:"✅",key:msg.key}
})

}catch(err){

console.error("[detectar]",err)

await sock.sendMessage(chatId,{
text:"❌ No se pudo identificar la canción."
},{quoted:msg})

await sock.sendMessage(chatId,{
react:{text:"❌",key:msg.key}
})

}

}