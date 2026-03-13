import fs from "fs"
import path from "path"
import { exec } from "child_process"
import { downloadContentFromMessage } from "baileys"
import { Shazam } from "node-shazam"
import yts from "yt-search"
import axios from "axios"

const shazam = new Shazam()

const SKY_APIKEY = "sk_2fea7c1a-0c7d-429c-bbb7-7a3b936ef4f4"
const SKY_API = "https://api-sky.ultraplus.click/youtube/resolve"

const SYLPHY_APIKEY = "sylphy-MtyAgpx"
const SYLPHY_API = "https://sylphy.xyz/download/v2/ytmp3"

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

function trad(en = "") {
const map = {
"years ago":"años","year ago":"año",
"months ago":"meses","month ago":"mes",
"weeks ago":"semanas","week ago":"semana",
"days ago":"días","day ago":"día",
"hours ago":"horas","hour ago":"hora",
"minutes ago":"minutos","minute ago":"minuto",
"seconds ago":"segundos","second ago":"segundo"
}

const out = Object.entries(map).reduce((t,[e,es])=>{
return t.replace(new RegExp(`\\b${e}\\b`,"g"),es)
},en||"")

return ("hace "+out).trim()
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

/* FRAGMENTOS PARA SHAZAM */

const stat = fs.statSync(input)
const durationEst = Math.floor(stat.size / 16000)

const fragments = []

fragments.push({start:3,length:12})

if(durationEst > 20){
fragments.push({start:Math.floor(durationEst/2),length:12})
}

if(durationEst > 60){
fragments.push({start:Math.floor(durationEst*0.75),length:12})
}

/* DETECCIÓN */

let track = null

for(const frag of fragments){

await new Promise((resolve,reject)=>{
exec(
`ffmpeg -y -i "${input}" -ss ${frag.start} -t ${frag.length} -ac 2 -ar 44100 "${output}"`,
(err)=> err ? reject(err) : resolve()
)
})

const result = await shazam.recognise(output,"en-US")

if(result?.track){
track = result.track
break
}

}

fs.unlinkSync(input)
fs.unlinkSync(output)

if(!track) throw "No identificado"

/* DATOS */

const title = track.title || "Desconocido"
const artist = track.subtitle || "Desconocido"

let album="N/A"
let genre=track.genres?.primary || "N/A"
let year="N/A"

const section = track.sections?.find(x=>x.type==="SONG")

if(section?.metadata){
for(const meta of section.metadata){

const name = meta.title?.toLowerCase()

if(name.includes("album")) album=meta.text
if(name.includes("released")) year=meta.text

}
}

/* PORTADA */

const cover =
track.images?.coverarthq ||
track.images?.coverart ||
track.images?.background ||
THUMB_URL

/* BUSCAR YOUTUBE */

const search = await yts(`${artist} ${title}`)
if(!search.videos.length) throw "Audio no encontrado"

const video = search.videos[0]

const duration = video.timestamp || "N/A"
const views = Number(video.views).toLocaleString()
const subido = trad(video.ago || "")

/* CAPTION */

const caption =
`╭─ 🎧 𝗖𝗔𝗡𝗖𝗜𝗢́𝗡 𝗗𝗘𝗧𝗘𝗖𝗧𝗔𝗗𝗔
│
│ 🎵 Título: ${title}
│ 👤 Artista: ${artist}
│ 💿 Álbum: ${album}
│ 🎼 Género: ${genre}
│ ⏱ Duración: ${duration}
│ 👁 Vistas: ${views}
│ 📅 Subido: ${subido}
│
│ 🔗 YouTube:
│ ${video.url}
│
╰────────────────╯

${signature()}`

await sock.sendMessage(chatId,{
image:{url:cover},
caption
},{quoted:msg})

/* CACHE */

const cacheDir = path.join(process.cwd(),"cache","play")
if(!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir,{recursive:true})

const clean = safeFileName(video.title)
const filePath = path.join(cacheDir,`${clean}.mp3`)

const thumb2 = await fetchBuffer(THUMB_URL)

const jidUsuario = msg?.key?.participant || msg?.participant || msg?.key?.remoteJid

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

/* DESCARGAR AUDIO */

let audioUrl = null

try{

console.log("🌐 SYLPHY V2")

const sylphy = await axios.get(
`${SYLPHY_API}?url=${encodeURIComponent(video.url)}&api_key=${SYLPHY_APIKEY}`
)

audioUrl = sylphy.data?.result?.dl_url

}catch(e){

console.log("⚠️ SYLPHY FALLÓ")

}

if(!audioUrl){

console.log("🌐 SKYULTRAPLUS")

const apiRes = await axios.post(
SKY_API,
{url:video.url,type:"audio",format:"mp3"},
{
headers:{
"Content-Type":"application/json",
apikey:SKY_APIKEY
}
}
)

const resultApi = apiRes.data?.result || apiRes.data?.data

audioUrl =
resultApi?.media?.dl_download ||
resultApi?.media?.direct

if(audioUrl?.startsWith("/")){
audioUrl="https://api-sky.ultraplus.click"+audioUrl
}

}

if(!audioUrl) throw "No se pudo obtener el audio"

const audio = await axios.get(audioUrl,{
responseType:"arraybuffer",
timeout:60000
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