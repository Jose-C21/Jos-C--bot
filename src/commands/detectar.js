import fs from "fs"
import path from "path"
import { exec } from "child_process"
import { downloadContentFromMessage } from "baileys"
import { Shazam } from "node-shazam"
import yts from "yt-search"
import axios from "axios"

const shazam = new Shazam()

const APIKEY = "sk_2fea7c1a-0c7d-429c-bbb7-7a3b936ef4f4"
const API_RESOLVE = "https://api-sky.ultraplus.click/youtube/resolve"

const THUMB_URL = "https://i.postimg.cc/zvGnpW8F/7-C5-CF8-AB-92-E7-45-F5-89-D5-97291-B10761-D.png"

function signature(){
return `⟣ ©️ 𝓬𝓸𝓹𝔂𝓻𝓲𝓰𝓱𝓽|частная система
> ⟣ 𝗖𝗿𝗲𝗮𝘁𝗼𝗿𝘀 & 𝗗𝗲𝘃: 𝐽𝑜𝑠𝑒 𝐶 - 𝐾𝑎𝑡ℎ𝑦`
}

function safeFileName(name=""){
return name.replace(/[^a-zA-Z0-9]/g,"_").slice(0,50)
}

async function fetchBuffer(url){
const r = await fetch(url)
const ab = await r.arrayBuffer()
return Buffer.from(ab)
}

export default async function detectar(sock,msg){

const chatId = msg?.key?.remoteJid
if(!chatId) return

const ctx = msg?.message?.extendedTextMessage?.contextInfo

if(!ctx?.quotedMessage){
return sock.sendMessage(chatId,{
text:"🎧 Responde a un *audio o video* para detectar la canción."
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

await sock.sendMessage(chatId,{react:{text:"⏳",key:msg.key}})

/* DESCARGAR MEDIA */

const stream = await downloadContentFromMessage(
media,
media.mimetype.startsWith("video") ? "video" : "audio"
)

let buffer = Buffer.from([])

for await(const chunk of stream){
buffer = Buffer.concat([buffer,chunk])
}

/* TMP */

const tmpDir = path.join(process.cwd(),"tmp")
if(!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir)

const input = path.join(tmpDir,`input_${Date.now()}.ogg`)
const output = path.join(tmpDir,`audio_${Date.now()}.wav`)

fs.writeFileSync(input,buffer)

/* EXTRAER FRAGMENTO OPTIMIZADO */

await new Promise((resolve,reject)=>{

exec(
`ffmpeg -y -i "${input}" -ss 10 -t 15 -ac 2 -ar 44100 "${output}"`,
(err)=> err ? reject(err) : resolve()
)

})

fs.unlinkSync(input)

/* SHAZAM */

const result = await shazam.recognise(output,"en-US")

fs.unlinkSync(output)

const track = result?.track
if(!track) throw "No identificado"

/* DATOS */

const title = track.title || "Desconocido"
const artist = track.subtitle || "Desconocido"
const duration = track.hub?.actions?.[0]?.duration || "N/A"

let album="N/A"
let genre="N/A"
let year="N/A"

const section = track.sections?.find(x=>x.type==="SONG")

if(section?.metadata){

for(const m of section.metadata){

if(m.title==="Album") album=m.text
if(m.title==="Genre") genre=m.text
if(m.title==="Released") year=m.text

}

}

/* PORTADA */

const cover =
track.images?.coverart ||
track.images?.background ||
THUMB_URL

/* CAPTION */

const caption =
`╭─ 🎧 𝗖𝗔𝗡𝗖𝗜𝗢́𝗡 𝗗𝗘𝗧𝗘𝗖𝗧𝗔𝗗𝗔 
│
│ 🎵 Título: ${title}
│ 👤 Artista: ${artist}
│ 💿 Álbum: ${album}
│ 🎼 Género: ${genre}
│ 📅 Año: ${year}
│ ⏱ Duración: ${duration}
│
╰────────────────╯

${signature()}`

await sock.sendMessage(chatId,{
image:{url:cover},
caption
},{quoted:msg})

/* BUSCAR EN YOUTUBE */

const search = await yts(`${artist} ${title}`)
if(!search.videos.length) throw "Audio no encontrado"

const video = search.videos[0]

/* CACHÉ */

const cacheDir = path.join(process.cwd(),"cache","play")
if(!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir,{recursive:true})

const clean = safeFileName(video.title)
const filePath = path.join(cacheDir,`${clean}.mp3`)

/* MINIATURA FKONTAK */

const thumb2 = await fetchBuffer(THUMB_URL)

const jidUsuario = msg?.key?.participant || msg?.participant || msg?.key?.remoteJid

/* SI EXISTE */

if(fs.existsSync(filePath)){

const fkontak = {
key:{
participants:"0@s.whatsapp.net",
remoteJid:"0@s.whatsapp.net",
fromMe:false,
id:"DetectCache"
},
message:{
locationMessage:{
name:video.title,
jpegThumbnail:thumb2,
description:"🎵 Archivo desde caché"
}
},
participant:"0@s.whatsapp.net"
}

await sock.sendMessage(chatId,{
audio:fs.readFileSync(filePath),
mimetype:"audio/mpeg",
contextInfo:{mentionedJid: jidUsuario ? [jidUsuario] : []}
},{quoted:fkontak})

await sock.sendMessage(chatId,{react:{text:"⚡",key:msg.key}})
return
}

/* DESCARGAR */

const apiRes = await axios.post(
API_RESOLVE,
{url:video.url,type:"audio",format:"mp3"},
{
headers:{
"Content-Type":"application/json",
apikey:APIKEY
}
}
)

const resultApi = apiRes.data?.result || apiRes.data?.data

let audioUrl =
resultApi?.media?.dl_download ||
resultApi?.media?.direct

if(audioUrl.startsWith("/")){
audioUrl="https://api-sky.ultraplus.click"+audioUrl
}

const audio = await axios.get(audioUrl,{
responseType:"arraybuffer",
headers:{apikey:APIKEY}
})

fs.writeFileSync(filePath,Buffer.from(audio.data))

const fkontak = {
key:{
participants:"0@s.whatsapp.net",
remoteJid:"0@s.whatsapp.net",
fromMe:false,
id:"DetectNuevo"
},
message:{
locationMessage:{
name:video.title,
jpegThumbnail:thumb2,
description:"⚡ Descargado y guardado en caché"
}
},
participant:"0@s.whatsapp.net"
}

await sock.sendMessage(chatId,{
audio:fs.readFileSync(filePath),
mimetype:"audio/mpeg",
contextInfo:{mentionedJid: jidUsuario ? [jidUsuario] : []}
},{quoted:fkontak})

await sock.sendMessage(chatId,{react:{text:"✅",key:msg.key}})

}catch(err){

console.error("[detectar]",err)

await sock.sendMessage(chatId,{
text:"❌ No se pudo identificar la canción."
},{quoted:msg})

await sock.sendMessage(chatId,{react:{text:"❌",key:msg.key}})

}

}